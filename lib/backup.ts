import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { getSqliteDb } from './sqlite';
import { resolveDbPath } from './db-path';

/**
 * Database backups: a consistent online snapshot (SQLite backup API, safe while
 * the app runs), gzip-compressed, kept for BACKUP_KEEP days' worth of files.
 * Uploaded images are mirrored next to them (only new or changed files).
 *
 * Folder: BACKUP_DIR, or "backups" next to the database file.
 * Backups hold encrypted data: they are useless without DB_ENCRYPTION_SECRET,
 * so keep a copy of the secrets somewhere safe too (never next to the backups).
 */

const NAME_RE = /^south_street-\d{8}-\d{6}-(manual|auto|pre-update|pre-restore)\.db\.gz$/;

export type BackupInfo = { name: string; size: number; createdAt: string; reason: string };

export function backupDir(): string {
  const dir = process.env.BACKUP_DIR?.trim() || path.join(path.dirname(resolveDbPath()), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
      return { name, size: st.size, createdAt: st.mtime.toISOString(), reason: name.match(NAME_RE)?.[1] || 'manual' };
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
  const name = `south_street-${stamp()}-${reason}.db.gz`;
  const tmp = path.join(dir, `.${name}.tmp.db`);
  try {
    const db = getSqliteDb() as unknown as { backup?: (dest: string) => Promise<unknown> };
    if (typeof db.backup !== 'function') throw new Error('This database driver has no backup support');
    await db.backup(tmp);
    await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), fs.createWriteStream(path.join(dir, name)));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const uploadsCopied = mirrorUploads(dir);

  // Keep the newest N; never prune the one just made.
  for (const old of listBackups().slice(keepCount())) {
    if (old.name !== name) fs.rmSync(path.join(dir, old.name), { force: true });
  }
  const st = fs.statSync(path.join(dir, name));
  return { name, size: st.size, createdAt: st.mtime.toISOString(), reason, uploadsCopied };
}
