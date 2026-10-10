/**
 * Uploaded images on hosts without a lasting disk (Vercel + Turso).
 *
 * The upload route normally writes files under public/images/uploads. On a
 * serverless host that folder is wiped, so images go into the database instead
 * (already compressed to WebP by the upload route) and are served by
 * /api/staff-image/db_<id>.webp — the same URL shape as files on disk.
 * On the VPS nothing changes: files stay on disk.
 */
import crypto from 'crypto';
import { getSqliteDb } from './sqlite';
import { isServerlessHost } from './db-path';

export const DB_MEDIA_PREFIX = 'db_';

/** Images must be stored in the database when the disk does not last. */
export function mediaGoesToDatabase(): boolean {
  return isServerlessHost() || Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

/** The raw (unencrypted) connection: binary data is stored as-is. */
function raw() {
  const db = getSqliteDb() as any;
  const prepare = (db.__rawPrepare as ((sql: string) => any) | undefined) || db.prepare.bind(db);
  return { prepare };
}

let ready = false;
function ensureTable() {
  if (ready) return;
  raw().prepare('CREATE TABLE IF NOT EXISTS media_files (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL)').run();
  ready = true;
}

/** Saves an image and returns its public file name (db_<id>.webp). */
export function saveMedia(buffer: Buffer, mime: string, ext: string): string {
  ensureTable();
  const id = `${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
  raw().prepare('INSERT INTO media_files (id, mime, data, created_at) VALUES (?, ?, ?, ?)').run(id, mime, buffer, new Date().toISOString());
  return `${DB_MEDIA_PREFIX}${id}${ext}`;
}

/** Reads an image saved by saveMedia, or null. */
export function loadMedia(filename: string): { mime: string; data: Buffer } | null {
  const id = filename.slice(DB_MEDIA_PREFIX.length).replace(/\.[a-z0-9]+$/i, '');
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return null;
  try {
    ensureTable();
    const row = raw().prepare('SELECT mime, data FROM media_files WHERE id = ?').get(id) as { mime?: string; data?: unknown } | undefined;
    if (!row?.data) return null;
    const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as ArrayBuffer);
    return { mime: String(row.mime || 'image/webp'), data };
  } catch {
    return null;
  }
}
