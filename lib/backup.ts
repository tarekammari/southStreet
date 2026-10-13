import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { getSqliteDb } from './sqlite';
import { resolveDbPath } from './db-path';
import { backupPublicKey, encryptBuffer, encryptStream, fingerprint } from './backup-crypto';
import { dbEncryptionSecret, dbLookupSecret } from './secrets';

/**
 * Database backups: a consistent online snapshot (SQLite backup API, safe while
 * the app runs), gzip-compressed, kept for BACKUP_KEEP days' worth of files.
 * Uploaded images are mirrored next to them (only new or changed files).
 *
 * Folder: BACKUP_DIR, or "backups" next to the database file. Only the app's
 * own account can read it.
 *
 * With BACKUP_PUBLIC_KEY_FILE set (production), each backup is also encrypted to
 * the owner's backup key (lib/backup-crypto.ts): "*.db.gz.enc". The server can
 * make backups but not open them. Next to them, "recovery-kit-<id>.env.enc"
 * holds the database secrets those backups need, sealed with the same key, so
 * the offline private key alone is enough to rebuild everything.
 */

const NAME_RE = /^south_street-\d{8}-\d{6}-(manual|auto|pre-update|pre-restore)\.db\.gz(\.enc)?$/;

export type BackupInfo = { name: string; size: number; createdAt: string; reason: string; encrypted: boolean };

export function backupDir(): string {
  const dir = process.env.BACKUP_DIR?.trim() || path.join(path.dirname(resolveDbPath()), 'backups');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

/** Fingerprint of the database secret a backup needs (matches its recovery kit). */
export function dbKeyId(): string {
  return fingerprint(dbEncryptionSecret());
}

/** Seals the secrets needed to read backups made with the current database key (once per key). */
function writeRecoveryKit(dir: string, publicKey: NonNullable<ReturnType<typeof backupPublicKey>>): void {
  const kid = dbKeyId();
  const file = path.join(dir, `recovery-kit-${kid}.env.enc`);
  if (fs.existsSync(file)) return;
  const lines = [
    `# South Street recovery kit, ${new Date().toISOString()}`,
    `# Needed to read backups whose dbKid is ${kid}.`,
    `DB_ENCRYPTION_SECRET=${dbEncryptionSecret()}`,
    `DB_LOOKUP_SECRET=${dbLookupSecret()}`,
    ...['JWT_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'APP_ORIGIN']
      .filter((k) => process.env[k])
      .map((k) => `${k}=${process.env[k]}`),
    '',
  ];
  fs.writeFileSync(file, encryptBuffer(publicKey, kid, Buffer.from(lines.join('\n'))), { mode: 0o600 });
}

function keepCount(): number {
  const n = Number(process.env.BACKUP_KEEP);
  return Number.isFinite(n) && n >= 3 ? Math.floor(n) : 14;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Copies new or changed uploads into <backups>/uploads. */
function mirrorUploads(dir: string): number {
  const sources = [path.join(process.cwd(), 'public', 'images', 'uploads'), path.join(process.cwd(), 'images', 'uploads')];
  const target = path.join(dir, 'uploads');
  fs.mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const from = path.join(src, entry.name);
      const to = path.join(target, entry.name);
      const a = fs.statSync(from);
      if (fs.existsSync(to) && fs.statSync(to).size === a.size) continue;
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

export function listBackups(): BackupInfo[] {
  const dir = backupDir();
  return fs
    .readdirSync(dir)
    .filter((name) => NAME_RE.test(name))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString(), reason: name.match(NAME_RE)?.[1] || 'manual', encrypted: name.endsWith('.enc') };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Full path of a backup, or null for anything that is not one of our files (no path tricks). */
export function backupFilePath(name: string): string | null {
  if (!NAME_RE.test(name)) return null;
  const file = path.join(backupDir(), name);
  return fs.existsSync(file) ? file : null;
}

export async function createBackup(reason: 'manual' | 'auto' | 'pre-update' | 'pre-restore' = 'manual'): Promise<BackupInfo & { uploadsCopied: number }> {
  const dir = backupDir();
  const publicKey = backupPublicKey();
  const name = `south_street-${stamp()}-${reason}.db.gz${publicKey ? '.enc' : ''}`;
  const tmp = path.join(dir, `.${name}.tmp.db`);
  try {
    const db = getSqliteDb() as unknown as { backup?: (dest: string) => Promise<unknown> };
    if (typeof db.backup !== 'function') throw new Error('This database driver has no backup support');
    await db.backup(tmp);
    const out = fs.createWriteStream(path.join(dir, name), { mode: 0o600 });
    if (publicKey) {
      await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), encryptStream(publicKey, dbKeyId()), out);
      writeRecoveryKit(dir, publicKey);
    } else {
      await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), out);
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const uploadsCopied = mirrorUploads(dir);

  // Keep the newest N; never prune the one just made.
  for (const old of listBackups().slice(keepCount())) {
    if (old.name !== name) fs.rmSync(path.join(dir, old.name), { force: true });
  }
  const st = fs.statSync(path.join(dir, name));
  return { name, size: st.size, createdAt: st.mtime.toISOString(), reason, encrypted: Boolean(publicKey), uploadsCopied };
}
