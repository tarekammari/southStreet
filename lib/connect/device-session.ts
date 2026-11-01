import crypto from 'crypto';
import type { NextResponse } from 'next/server';
import { getSqliteDb } from '../sqlite';
import { signPurposeToken, verifyPurposeToken } from '../auth';
import { isPrivilegedRole } from '../roles';

/**
 * SS Connect stays signed in on a device until the user signs out there.
 *
 * The site's session lasts 24 h (8 h for admins). Connect, like any messaging
 * app, must keep ringing for weeks, so a device that opened Connect while
 * signed in gets its own Connect session: an httpOnly cookie sent only to
 * /api/connect, valid 90 days and renewed while the app is used. It only opens
 * the Connect APIs (messages, calls, push), not the rest of the site.
 *
 * Every session is a row here, so it ends at once when the user signs out on
 * that device, when the account is suspended, or when its tokenVersion changes
 * (password change, "sign out everywhere").
 */

export const CONNECT_COOKIE = 'ss_connect_session';
const COOKIE_PATH = '/api/connect';
const TTL_DAYS = 90;
const TTL_MS = TTL_DAYS * 24 * 3600 * 1000;
/** A session older than this gets a fresh one (new id, new 90 days) on renewal. */
const ROTATE_MS = 24 * 3600 * 1000;
const SEEN_EVERY_MS = 10 * 60 * 1000;

type Claims = { sub: string; sid: string; tv: number; mfa?: boolean };
type Row = { session_id: string; user_id: string; created_ts: number; seen_ts: number; expires_ts: number; revoked_ts: number | null };

let ready = false;
function db() {
  const d = getSqliteDb();
  if (!ready) {
    d.exec(`CREATE TABLE IF NOT EXISTS connect_sessions (
      session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_ts INTEGER NOT NULL,
      seen_ts INTEGER NOT NULL, expires_ts INTEGER NOT NULL, revoked_ts INTEGER
    )`);
    d.exec('CREATE INDEX IF NOT EXISTS connect_sessions_user ON connect_sessions (user_id)');
    ready = true;
  }
  return d;
}

function readCookie(req: Request): string {
  const match = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${CONNECT_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function secureFor(req: Request): boolean {
  if (/^https:\/\//i.test(process.env.APP_ORIGIN || '')) return true;
  return req.headers.get('x-forwarded-proto') === 'https';
}

function setCookie(res: NextResponse, req: Request, value: string, maxAgeMs: number) {
  res.cookies.set(CONNECT_COOKIE, value, {
    httpOnly: true,
    secure: secureFor(req),
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
  });
}

/** The account behind this device's Connect session, if the session is still good. */
export function deviceSession(req: Request): { userId: string; sid: string; createdTs: number; tv: number; mfa: boolean } | null {
  const claims = verifyPurposeToken<Claims>(readCookie(req), 'connect');
  if (!claims?.sub || !claims.sid) return null;
  const row = db().prepare('SELECT * FROM connect_sessions WHERE session_id = ?').get(claims.sid) as Row | undefined;
  const now = Date.now();
  if (!row || row.user_id !== claims.sub || row.revoked_ts || row.expires_ts < now) return null;
  const account = db().prepare('SELECT role, status, loginEnabled, tokenVersion FROM users WHERE id = ?').get(claims.sub) as any;
  if (!account || account.loginEnabled === 0 || account.status === 'SUSPENDED' || account.status === 'REJECTED') return null;
  if ((Number(claims.tv) || 0) !== (Number(account.tokenVersion) || 0)) return null;
  // Admin accounts: only a session first opened with the security key.
  if (isPrivilegedRole(account.role) && claims.mfa !== true) return null;
  if (now - row.seen_ts > SEEN_EVERY_MS) db().prepare('UPDATE connect_sessions SET seen_ts = ? WHERE session_id = ?').run(now, row.session_id);
  return { userId: claims.sub, sid: row.session_id, createdTs: row.created_ts, tv: Number(claims.tv) || 0, mfa: claims.mfa === true };
}

/** Start a Connect session on this device (replacing `previousSid`, if any) and set its cookie. */
export function startDeviceSession(
  res: NextResponse,
  req: Request,
  user: { id: string; tokenVersion?: number; mfa?: boolean },
  previousSid?: string
): number {
  const now = Date.now();
  const sid = crypto.randomBytes(18).toString('base64url');
  const expires = now + TTL_MS;
  db().prepare('INSERT INTO connect_sessions (session_id, user_id, created_ts, seen_ts, expires_ts) VALUES (?, ?, ?, ?, ?)').run(sid, user.id, now, now, expires);
  if (previousSid) db().prepare('UPDATE connect_sessions SET revoked_ts = ? WHERE session_id = ?').run(now, previousSid);
  const token = signPurposeToken({ sub: user.id, sid, tv: Number(user.tokenVersion) || 0, mfa: user.mfa === true ? true : undefined }, 'connect', `${TTL_DAYS}d`);
  setCookie(res, req, token, TTL_MS);
  // Housekeeping: forget long-dead sessions.
  db().prepare('DELETE FROM connect_sessions WHERE expires_ts < ? OR (revoked_ts IS NOT NULL AND revoked_ts < ?)').run(now - TTL_MS, now - TTL_MS);
  return expires;
}

/** Keep a session going: a fresh one once a day, so an app in use never reaches the 90 days. */
export function shouldRotate(createdTs: number): boolean {
  return Date.now() - createdTs > ROTATE_MS;
}

/** Sign this device out of Connect. */
export function endDeviceSession(res: NextResponse, req: Request) {
  const claims = verifyPurposeToken<Claims>(readCookie(req), 'connect');
  if (claims?.sid) db().prepare('UPDATE connect_sessions SET revoked_ts = ? WHERE session_id = ? AND revoked_ts IS NULL').run(Date.now(), claims.sid);
  setCookie(res, req, '', 0);
}
