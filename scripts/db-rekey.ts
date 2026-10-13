/**
 * Re-encrypts the database with new secrets.
 *
 *   npm run db:rekey -- --generate      create new secrets, migrate, write them to .env
 *   npm run db:rekey                    migrate to DB_ENCRYPTION_SECRET / DB_LOOKUP_SECRET already in the env
 *
 * The OLD secrets come from OLD_DB_ENCRYPTION_SECRET / OLD_DB_LOOKUP_SECRET, or the
 * legacy built-in key when those are not set. Stop the app first.
 *
 * What it does, in one transaction (after a backup in ./backups):
 *   - every encrypted value: decrypt with the old key, encrypt with the new one
 *     (a value the old key cannot open aborts everything: wrong old key);
 *   - users' username / email / code lookup hashes: recomputed with the new key.
 *   - encrypted binary values (Connect voice messages): same, with the new key;
 *   - WhatsApp conversation keys (phone hashes): recomputed with the new key.
 * What cannot be recomputed (only a one-way hash is stored) and must be reissued:
 *   staff QR codes, Super Admin recovery codes, unused activation links.
 * With BACKUP_PUBLIC_KEY_FILE set, the safety backup is encrypted to the backup key
 * and the old secrets are sealed in a recovery kit, so older backups stay openable.
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import zlib from 'zlib';
import { LEGACY_DB_SECRET } from '../lib/secrets';
import { backupPublicKey, encryptBuffer, fingerprint } from '../lib/backup-crypto';

const PREFIX = 'SSENC1.';
const generate = process.argv.includes('--generate');
const envFile = process.env.REKEY_ENV_FILE || path.join(process.cwd(), '.env');

// With --generate the data is currently under whatever the app uses now (.env value or the legacy key).
const currentEnc = process.env.DB_ENCRYPTION_SECRET?.trim() || process.env.SERVER_ENCRYPTION_KEY?.trim() || LEGACY_DB_SECRET;
const oldEnc = process.env.OLD_DB_ENCRYPTION_SECRET?.trim() || (generate ? currentEnc : LEGACY_DB_SECRET);
const oldLookup = process.env.OLD_DB_LOOKUP_SECRET?.trim() || (generate ? process.env.DB_LOOKUP_SECRET?.trim() || oldEnc : oldEnc);

const newEnc = generate ? crypto.randomBytes(48).toString('base64url') : process.env.DB_ENCRYPTION_SECRET?.trim() || '';
const newLookup = generate ? crypto.randomBytes(48).toString('base64url') : process.env.DB_LOOKUP_SECRET?.trim() || newEnc;

if (newEnc.length < 32 || newLookup.length < 32) {
  console.error('New secrets missing or shorter than 32 characters. Use --generate, or set DB_ENCRYPTION_SECRET / DB_LOOKUP_SECRET.');
  process.exit(1);
}
if (newEnc === oldEnc && newLookup === oldLookup) {
  console.error('New and old secrets are identical — nothing to do.');
  process.exit(1);
}

const dbPath = path.resolve(process.env.DB_PATH?.trim() || path.join(process.cwd(), 'south_street.db'));
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const oldKey = crypto.scryptSync(oldEnc, 'southstreet-db-gcm-v1', 32);
const newKey = crypto.scryptSync(newEnc, 'southstreet-db-gcm-v1', 32);
const legacyCbcKey = crypto.scryptSync(oldEnc, 'salt', 32);

function decryptOld(stored: string): string {
  if (stored.startsWith(PREFIX)) {
    const [iv, tag, data] = stored.slice(PREFIX.length).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', oldKey, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  }
  const [ivHex, enc] = stored.split(':');
  const d = crypto.createDecipheriv('aes-256-cbc', legacyCbcKey, Buffer.from(ivHex, 'hex'));
  return d.update(enc, 'hex', 'utf8') + d.final('utf8');
}

function encryptNew(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', newKey, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return `${PREFIX}${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

const BLOB_MAGIC = Buffer.from('SSB1');
function reencryptBlob(b: Buffer): Buffer {
  const d = crypto.createDecipheriv('aes-256-gcm', oldKey, b.subarray(4, 16));
  d.setAuthTag(b.subarray(16, 32));
  const plain = Buffer.concat([d.update(b.subarray(32)), d.final()]);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', newKey, iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([BLOB_MAGIC, iv, c.getAuthTag(), enc]);
}

function isLegacyCbc(v: string): boolean {
  if (!v.includes(':')) return false;
  const [ivHex, rest] = v.split(':');
  return Boolean(ivHex && rest && /^[0-9a-f]{32}$/i.test(ivHex));
}

const lookup = (value: string) => {
  const n = (value || '').trim().toLowerCase();
  return n ? crypto.createHmac('sha256', newLookup).update(n).digest('hex') : '';
};

(async () => {
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');

  const backupDir = process.env.BACKUP_DIR?.trim() || path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupFile = path.join(backupDir, `pre-rekey-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await db.backup(backupFile);
  const sealKey = backupPublicKey();
  if (sealKey) {
    // Encrypted to the owner's backup key, plus the OLD secrets it needs, sealed the same way.
    const oldKid = fingerprint(oldEnc);
    fs.writeFileSync(`${backupFile}.gz.enc`, encryptBuffer(sealKey, oldKid, zlib.gzipSync(fs.readFileSync(backupFile))), { mode: 0o600 });
    fs.rmSync(backupFile);
    const kit = path.join(backupDir, `recovery-kit-${oldKid}.env.enc`);
    if (!fs.existsSync(kit)) {
      fs.writeFileSync(kit, encryptBuffer(sealKey, oldKid, Buffer.from(`DB_ENCRYPTION_SECRET=${oldEnc}\nDB_LOOKUP_SECRET=${oldLookup}\n`)), { mode: 0o600 });
    }
    console.log(`Backup (encrypted): ${backupFile}.gz.enc`);
  } else {
    fs.chmodSync(backupFile, 0o600);
    console.log(`Backup: ${backupFile}`);
  }

  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  let values = 0;

  db.transaction(() => {
    for (const table of tables) {
      const cols = (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);
      const rows = db.prepare(`SELECT rowid AS __rowid, * FROM "${table}"`).all() as Record<string, unknown>[];
      for (const row of rows) {
        const changes: Record<string, string | Buffer> = {};
        for (const col of cols) {
          const v = row[col];
          if (Buffer.isBuffer(v) && v.length > 32 && v.subarray(0, 4).equals(BLOB_MAGIC)) {
            try {
              changes[col] = reencryptBlob(v);
            } catch {
              throw new Error(`Cannot decrypt ${table}.${col} (rowid ${row.__rowid}) with the OLD key — nothing was changed.`);
            }
            continue;
          }
          if (typeof v !== 'string' || !v) continue;
          if (!v.startsWith(PREFIX) && !isLegacyCbc(v)) continue;
          let plain: string;
          try {
            plain = decryptOld(v);
          } catch {
            throw new Error(`Cannot decrypt ${table}.${col} (rowid ${row.__rowid}) with the OLD key — nothing was changed.`);
          }
          changes[col] = encryptNew(plain);
        }
        const keys = Object.keys(changes);
        if (keys.length) {
          db.prepare(`UPDATE "${table}" SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE rowid = ?`).run(...keys.map((k) => changes[k]), row.__rowid);
          values += keys.length;
        }
      }
    }

    // Lookup hashes follow the new lookup secret.
    const userCols = new Set((db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name));
    const users = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
    const open = (v: unknown) => (typeof v === 'string' && (v.startsWith(PREFIX) || isLegacyCbc(v)) ? decryptNewOrPlain(v) : String(v || ''));
    for (const u of users) {
      const username = open(u.username);
      const email = open(u.email);
      const code = open(u.code);
      const sets: string[] = [];
      const vals: unknown[] = [];
      const set = (col: string, val: unknown) => {
        if (userCols.has(col)) {
          sets.push(`"${col}" = ?`);
          vals.push(val);
        }
      };
      set('usernameHash', username ? lookup(username) : '');
      set('emailHash', email ? lookup(email) : '');
      set('codeHash', code ? lookup(code) : '');
      set('code_hash', code ? lookup(code) : '');
      // QR secrets were hashed with the old key: they must be reissued.
      set('qrSecretHash', '');
      set('qr_secret_hash', '');
      if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, u.id);
    }

    // WhatsApp conversations are keyed by a phone hash: recompute it (messages follow).
    if (tables.includes('wa_conversations')) {
      const convs = db.prepare('SELECT phone_hash, phone FROM wa_conversations').all() as { phone_hash: string; phone: string }[];
      for (const c of convs) {
        // Same normalisation as lib/whatsapp/store.ts normalizePhone.
        let phone = open(c.phone).replace(/[^0-9]/g, '');
        if (phone.startsWith('00')) phone = phone.slice(2);
        if (phone.length === 10 && phone.startsWith('0')) phone = `213${phone.slice(1)}`;
        if (!phone) continue;
        const next = lookup(`wa:${phone}`);
        db.prepare('UPDATE wa_conversations SET phone_hash = ? WHERE phone_hash = ?').run(next, c.phone_hash);
        if (tables.includes('wa_messages')) db.prepare('UPDATE wa_messages SET phone_hash = ? WHERE phone_hash = ?').run(next, c.phone_hash);
      }
    }

    // One-way hashes made with the old key: remove so the app asks for new ones.
    for (const t of ['recovery_codes', 'enrollment_tokens']) {
      if (tables.includes(t)) db.prepare(`DELETE FROM ${t}`).run();
    }
  })();

  db.close();
  console.log(`Re-encrypted ${values} values in ${tables.length} tables; lookup hashes rebuilt for users.`);

  if (generate) {
    let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    const put = (name: string, value: string) => {
      const line = `${name}=${value}`;
      env = new RegExp(`^${name}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${name}=.*$`, 'm'), line) : `${env.replace(/\s*$/, '')}\n${line}\n`;
    };
    put('DB_ENCRYPTION_SECRET', newEnc);
    put('DB_LOOKUP_SECRET', newLookup);
    fs.writeFileSync(envFile, env);
    console.log('New secrets written to .env (DB_ENCRYPTION_SECRET, DB_LOOKUP_SECRET). Keep a safe copy: without them the data cannot be read.');
  }
  console.log('Next: start the app, sign in, then issue new recovery codes (Security keys) and new staff QR codes if used.');
})().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});

function decryptNewOrPlain(v: string): string {
  const [iv, tag, data] = v.slice(PREFIX.length).split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', newKey, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
