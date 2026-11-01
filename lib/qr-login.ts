import crypto from 'node:crypto';
import { getSqliteDb } from '@/lib/sqlite';
import { normalizeLoginRole, type LoginRole } from '@/lib/roles';
import type { ClientMeta } from '@/lib/login-session';

/**
 * Sign in on a new device with a phone that is already signed in (like WhatsApp Web).
 *
 *  1. The new device asks for a request: it gets a QR secret (shown as a QR and
 *     as a short code) and a device secret that stays in an httpOnly cookie, so
 *     only that browser can ever collect the session.
 *  2. A signed-in phone scans it. The request is bound to that phone's account;
 *     the new device then shows a two-digit number and the phone must pick it.
 *  3. Any account opens itself on the device. The Super Admin's phone instead
 *     chooses who the device signs in as (the Super Admin, or an accountant /
 *     guide / pilgrim account), confirmed with a security-key tap. Admins
 *     (AGENCY_MANAGER) never sign in this way: security key only.
 *  4. The new device collects the session once; the request is then burnt.
 *
 * Only hashes of both secrets are stored. Every request expires within minutes.
 */

export const QR_DEVICE_COOKIE = 'ss_qr_device';
export const QR_PENDING_TTL_MS = 2 * 60 * 1000;
export const QR_SCANNED_TTL_MS = 3 * 60 * 1000;

/** Who the phone may sign a device in as. Admin (AGENCY_MANAGER) and staff agents are left out on purpose. */
export const QR_TARGET_ROLES = ['SUPER_ADMIN', 'ACCOUNTANT', 'GUIDE_MURSHID', 'PILGRIM_USER'] as const;
export type QrTargetRole = (typeof QR_TARGET_ROLES)[number];

export function isQrTargetRole(value: unknown): value is QrTargetRole {
  return (QR_TARGET_ROLES as readonly string[]).includes(String(value));
}

export type QrStatus = 'pending' | 'scanned' | 'approved' | 'used' | 'denied' | 'expired';

export type QrRequest = {
  id: string;
  codeHash: string;
  shortHash: string;
  deviceHash: string;
  status: QrStatus;
  pair_number: number;
  approver_id: string | null;
  target_id: string | null;
  device_ua: string;
  device_ip: string;
  created_at: number;
  expires_at: number;
};

/* No 0/O, 1/I/L: the short code is read off a screen and typed on a phone. */
const SHORT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function shortCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += SHORT_ALPHABET[b % SHORT_ALPHABET.length];
  return out;
}

/** "abcd-efgh", "ABCDEFGH" and "ABCD EFGH" all mean the same short code. */
export function normalizeShortCode(value: string): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

let tableReady = false;
function db() {
  const sqlite = getSqliteDb();
  if (!tableReady) {
    sqlite.exec(`CREATE TABLE IF NOT EXISTS qr_login_requests (
      id TEXT PRIMARY KEY,
      codeHash TEXT NOT NULL UNIQUE,
      shortHash TEXT NOT NULL,
      deviceHash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      pair_number INTEGER NOT NULL DEFAULT 0,
      approver_id TEXT,
      target_id TEXT,
      device_ua TEXT,
      device_ip TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_qr_login_device ON qr_login_requests (deviceHash)');
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_qr_login_short ON qr_login_requests (shortHash)');
    tableReady = true;
  }
  return sqlite;
}

function sweep() {
  // Finished requests are kept a day for the audit trail, then dropped.
  db().prepare('DELETE FROM qr_login_requests WHERE expires_at < ?').run(Date.now() - 24 * 60 * 60 * 1000);
}

/** A request past its time counts as expired, whatever its stored status. */
function live(row: QrRequest | undefined): QrRequest | null {
  if (!row) return null;
  if ((row.status === 'pending' || row.status === 'scanned' || row.status === 'approved') && row.expires_at < Date.now()) {
    db().prepare("UPDATE qr_login_requests SET status = 'expired' WHERE id = ? AND status = ?").run(row.id, row.status);
    return { ...row, status: 'expired' };
  }
  return row;
}

/* ------------------------------------------------------------------ *
 * New device
 * ------------------------------------------------------------------ */

/** Per-address limit on new requests (one process serves the site). */
const g = globalThis as unknown as { __ssQrStarts?: Map<string, number[]> };
const starts: Map<string, number[]> = (g.__ssQrStarts ||= new Map<string, number[]>());
const START_LIMIT = 15;
const START_WINDOW_MS = 10 * 60 * 1000;

export function startLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (starts.get(ip) || []).filter((t) => now - t < START_WINDOW_MS);
  if (recent.length >= START_LIMIT) {
    starts.set(ip, recent);
    return true;
  }
  recent.push(now);
  starts.set(ip, recent);
  if (starts.size > 2000) for (const [k, v] of starts) if (!v.some((t) => now - t < START_WINDOW_MS)) starts.delete(k);
  return false;
}

export function createQrRequest(meta: ClientMeta, previousDeviceSecret?: string) {
  sweep();
  const sqlite = db();
  // A refreshed QR replaces the old one: an old code on the screen can no longer be used.
  if (previousDeviceSecret) {
    sqlite
      .prepare("UPDATE qr_login_requests SET status = 'expired' WHERE deviceHash = ? AND status IN ('pending', 'scanned')")
      .run(sha(previousDeviceSecret));
  }
  const id = crypto.randomBytes(16).toString('hex');
  const code = crypto.randomBytes(32).toString('base64url');
  const short = shortCode();
  const deviceSecret = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + QR_PENDING_TTL_MS;
  sqlite
    .prepare(
      `INSERT INTO qr_login_requests (id, codeHash, shortHash, deviceHash, status, pair_number, device_ua, device_ip, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`
    )
    .run(id, sha(code), sha(short), sha(deviceSecret), meta.userAgent.slice(0, 300), meta.clientIp, now, expiresAt);
  return { code, shortCode: `${short.slice(0, 4)}-${short.slice(4)}`, deviceSecret, expiresAt };
}

export function requestForDevice(deviceSecret: string): QrRequest | null {
  if (!deviceSecret) return null;
  const row = db()
    .prepare('SELECT * FROM qr_login_requests WHERE deviceHash = ? ORDER BY created_at DESC LIMIT 1')
    .get(sha(deviceSecret)) as QrRequest | undefined;
  return live(row);
}

/** Single use: only one caller can turn an approved request into a session. */
export function claimApproved(row: QrRequest): boolean {
  const res = db()
    .prepare("UPDATE qr_login_requests SET status = 'used' WHERE id = ? AND status = 'approved' AND expires_at >= ?")
    .run(row.id, Date.now());
  return res.changes === 1;
}

/* ------------------------------------------------------------------ *
 * Super Admin's phone
 * ------------------------------------------------------------------ */

export type ScanResult =
  | { ok: true; request: QrRequest; choices: number[] }
  | { ok: false; code: 'NOT_FOUND' | 'EXPIRED' | 'TAKEN' | 'FINISHED' };

function pairChoices(right: number): number[] {
  const set = new Set([right]);
  while (set.size < 3) set.add(crypto.randomInt(10, 100));
  return [...set].sort(() => crypto.randomInt(0, 3) - 1);
}

/**
 * Binds the request to the scanning account and picks the matching number.
 * Accepts the QR secret or the short code. Scanning again from the same
 * account (a page reload) returns the same request.
 */
export function scanQrRequest(codeOrShort: string, approverId: string): ScanResult {
  const sqlite = db();
  const raw = String(codeOrShort || '').trim();
  const short = normalizeShortCode(raw);
  let row = sqlite.prepare('SELECT * FROM qr_login_requests WHERE codeHash = ?').get(sha(raw)) as QrRequest | undefined;
  if (!row && short.length === 8) {
    row = sqlite
      .prepare('SELECT * FROM qr_login_requests WHERE shortHash = ? ORDER BY created_at DESC LIMIT 1')
      .get(sha(short)) as QrRequest | undefined;
  }
  const current = live(row);
  if (!current) return { ok: false, code: 'NOT_FOUND' };
  if (current.status === 'expired') return { ok: false, code: 'EXPIRED' };

  if (current.status === 'scanned') {
    if (current.approver_id !== approverId) return { ok: false, code: 'TAKEN' };
    return { ok: true, request: current, choices: pairChoices(current.pair_number) };
  }
  if (current.status !== 'pending') return { ok: false, code: 'FINISHED' };

  const pair = crypto.randomInt(10, 100);
  const expiresAt = Date.now() + QR_SCANNED_TTL_MS;
  const res = sqlite
    .prepare("UPDATE qr_login_requests SET status = 'scanned', approver_id = ?, pair_number = ?, expires_at = ? WHERE id = ? AND status = 'pending'")
    .run(approverId, pair, expiresAt, current.id);
  if (res.changes !== 1) return { ok: false, code: 'TAKEN' };
  return {
    ok: true,
    request: { ...current, status: 'scanned', approver_id: approverId, pair_number: pair, expires_at: expiresAt },
    choices: pairChoices(pair),
  };
}

export function requestForApprover(id: string, approverId: string): QrRequest | null {
  const row = live(db().prepare('SELECT * FROM qr_login_requests WHERE id = ?').get(String(id || '')) as QrRequest | undefined);
  if (!row || row.approver_id !== approverId) return null;
  return row;
}

export function approveQrRequest(row: QrRequest, targetId: string): boolean {
  const res = db()
    .prepare("UPDATE qr_login_requests SET status = 'approved', target_id = ? WHERE id = ? AND status = 'scanned' AND expires_at >= ?")
    .run(targetId, row.id, Date.now());
  return res.changes === 1;
}

export function denyQrRequest(row: QrRequest): void {
  db().prepare("UPDATE qr_login_requests SET status = 'denied' WHERE id = ? AND status IN ('pending', 'scanned')").run(row.id);
}

/* ------------------------------------------------------------------ *
 * Accounts the phone can pick
 * ------------------------------------------------------------------ */

export type QrAccount = { id: string; name: string; username: string; photo: string; phone: string };

function usable(user: any): boolean {
  return user && user.loginEnabled !== 0 && user.status !== 'SUSPENDED' && user.status !== 'REJECTED';
}

/** Names are encrypted at rest, so the search runs here rather than in SQL. */
export function listQrAccounts(role: QrTargetRole, query = '', limit = 30): { total: number; accounts: QrAccount[] } {
  if (role === 'SUPER_ADMIN') return { total: 0, accounts: [] };
  const rows = (db().prepare('SELECT id, name, username, email, phone, avatar, role, status, loginEnabled FROM users').all() as any[]).filter(
    (u) => usable(u) && normalizeLoginRole(u.role) === role
  );
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const hits = q
    ? rows.filter(
        (u) =>
          String(u.name || '').toLowerCase().includes(q) ||
          String(u.username || '').toLowerCase().includes(q) ||
          String(u.email || '').toLowerCase().includes(q) ||
          (digits.length >= 3 && String(u.phone || '').replace(/\D/g, '').includes(digits))
      )
    : rows;
  hits.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  return {
    total: rows.length,
    accounts: hits.slice(0, limit).map((u) => ({
      id: String(u.id),
      name: String(u.name || u.username || ''),
      username: String(u.username || ''),
      photo: typeof u.avatar === 'string' && /^(\/|https?:|data:image)/.test(u.avatar) ? u.avatar : '',
      phone: String(u.phone || ''),
    })),
  };
}

export function countQrAccounts(): Record<QrTargetRole, number> {
  const counts: Record<QrTargetRole, number> = { SUPER_ADMIN: 1, ACCOUNTANT: 0, GUIDE_MURSHID: 0, PILGRIM_USER: 0 };
  const rows = db().prepare('SELECT role, status, loginEnabled FROM users').all() as any[];
  for (const u of rows) {
    if (!usable(u)) continue;
    const role = normalizeLoginRole(u.role) as LoginRole;
    if (role !== 'SUPER_ADMIN' && isQrTargetRole(role)) counts[role] += 1;
  }
  return counts;
}

/** The account the device will open, re-checked at approval and at collection. */
export function qrTargetAccount(targetId: string, role: QrTargetRole): any | null {
  const user = db().prepare('SELECT * FROM users WHERE id = ?').get(String(targetId || '')) as any;
  if (!usable(user)) return null;
  return normalizeLoginRole(user.role) === role ? user : null;
}
