import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';
import { getSqliteDb } from '@/lib/sqlite';
import { upsertUserSession } from '@/lib/presence';
import { hashPassword, needsPasswordRehash, generateDeviceFingerprint } from '@/lib/security';
import { signToken, PRIVILEGED_EXPIRES_IN } from '@/lib/auth';
import { normalizeLoginRole, postLoginPath, isPrivilegedRole, LOGIN_ROLE_LABELS, type AppRedirectPath } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';
import { pilgrimAppointment, pilgrimWaitingRedirect } from '@/lib/booking';
import { recordLoginIncident } from '@/lib/security-monitor';
import { resolveRequestIp } from '@/lib/security-threats';
import { tokenVersionOf } from '@/lib/webauthn';

/** Shared sign-in plumbing for the password step and the security-key step. */

export type ClientMeta = { clientIp: string; userAgent: string; pcPrint: string };

export function clientMeta(req: Request): ClientMeta {
  const headers = req.headers;
  const clientIp = resolveRequestIp({
    forwarded: headers.get('x-forwarded-for'),
    realIp: headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
  const userAgent = headers.get('user-agent') || 'Mozilla/5.0';
  const acceptLang = headers.get('accept-language') || 'ar-DZ';
  const { pcPrint } = generateDeviceFingerprint(clientIp, userAgent, acceptLang);
  return { clientIp, userAgent, pcPrint };
}

/* ------------------------------------------------------------------ *
 * Brute-force protection: per IP and per account.
 * Development is exempt; production never trusts a "localhost" claim,
 * because the address can come from a spoofable forwarding header.
 * ------------------------------------------------------------------ */

const IP_LIMIT = 5;
const ACCOUNT_LIMIT = 8;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Strikes live in the database, so a restart or an update does not wipe an
 * attacker's lock. Keys: "ip:<address>" and "acct:<user id>".
 */
let strikeTableReady = false;
function strikeDb() {
  const db = getSqliteDb();
  if (!strikeTableReady) {
    db.exec('CREATE TABLE IF NOT EXISTS login_strikes (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)');
    strikeTableReady = true;
  }
  return db;
}

const lockoutDisabled = () => process.env.NODE_ENV !== 'production';

function bump(key: string, limit: number): boolean {
  const db = strikeDb();
  const now = Date.now();
  const rec = (db.prepare('SELECT count, lock_until FROM login_strikes WHERE key = ?').get(key) as { count: number; lock_until: number } | undefined) || {
    count: 0,
    lock_until: 0,
  };
  let count = rec.count;
  let lockUntil = rec.lock_until;
  if (lockUntil && lockUntil < now) {
    count = 0;
    lockUntil = 0;
  }
  count += 1;
  if (count >= limit) lockUntil = now + LOCK_MS;
  db.prepare(
    'INSERT INTO login_strikes (key, count, lock_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, lock_until = excluded.lock_until, updated_at = excluded.updated_at'
  ).run(key, count, lockUntil, now);
  // Old entries are useless after a day.
  db.prepare('DELETE FROM login_strikes WHERE updated_at < ?').run(now - 24 * 60 * 60 * 1000);
  return lockUntil > now;
}

export function recordLoginFailure(meta: ClientMeta, reason: string, accountId?: string) {
  if (lockoutDisabled()) return;
  let ipLocked = false;
  let accountLocked = false;
  try {
    ipLocked = bump(`ip:${meta.clientIp}`, IP_LIMIT);
    accountLocked = accountId ? bump(`acct:${accountId}`, ACCOUNT_LIMIT) : false;
  } catch {
    /* a storage hiccup must not break login */
  }
  try {
    recordLoginIncident({
      ip: meta.clientIp,
      userAgent: meta.userAgent,
      reason: ipLocked || accountLocked ? `${reason} — حظر مؤقت 15 دقيقة` : reason,
      blocked: ipLocked || accountLocked,
    });
  } catch {
    /* monitoring must not break login */
  }
}

function lockedFor(key: string): number {
  try {
    const rec = strikeDb().prepare('SELECT lock_until FROM login_strikes WHERE key = ?').get(key) as { lock_until: number } | undefined;
    return rec && rec.lock_until > Date.now() ? Math.ceil((rec.lock_until - Date.now()) / 60000) : 0;
  } catch {
    return 0;
  }
}

export function lockoutResponse(meta: ClientMeta, accountId?: string): NextResponse | null {
  if (lockoutDisabled()) return null;
  const mins = Math.max(lockedFor(`ip:${meta.clientIp}`), accountId ? lockedFor(`acct:${accountId}`) : 0);
  if (!mins) return null;
  return NextResponse.json(
    { error: `تم إيقاف المحاولات مؤقتاً بسبب تكرار الأخطاء. أعد المحاولة بعد ${mins} دقيقة.` },
    { status: 429 }
  );
}

export function clearLoginFailures(meta: ClientMeta, accountId?: string) {
  try {
    const db = strikeDb();
    db.prepare('DELETE FROM login_strikes WHERE key = ?').run(`ip:${meta.clientIp}`);
    if (accountId) db.prepare('DELETE FROM login_strikes WHERE key = ?').run(`acct:${accountId}`);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Session issuance
 * ------------------------------------------------------------------ */

function publicUser(user: any, meta: ClientMeta) {
  const role = normalizeLoginRole(user.role);
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    username: user.username as string,
    role,
    roleName: (user.roleName as string) || LOGIN_ROLE_LABELS[role],
    status: user.status as string,
    phone: user.phone as string,
    code: user.code as string,
    staffId: user.staffId as string,
    avatar: user.avatar as string | undefined,
    lastLoginIp: meta.clientIp,
    pcFingerprint: meta.pcPrint,
    redirect: postLoginPath(role) as AppRedirectPath,
  };
}

/**
 * Opens a session. Privileged accounts only reach this after a security-key
 * check (`mfa: true`); anything else is refused here as a last line of defence.
 */
export function completeLogin(
  user: any,
  meta: ClientMeta,
  opts: { mfa?: boolean; method?: string; plainPassword?: string } = {}
): NextResponse {
  const role = normalizeLoginRole(user.role);
  const privileged = isPrivilegedRole(role);
  if (privileged && !opts.mfa) {
    return NextResponse.json({ error: 'حسابات الإدارة تتطلب مفتاح الأمان' }, { status: 403 });
  }

  const sqlite = getSqliteDb();
  sqlite.prepare('UPDATE users SET lastLoginIp = ?, pcFingerprint = ? WHERE id = ?').run(meta.clientIp, meta.pcPrint, user.id);
  if (opts.plainPassword && needsPasswordRehash(user.passwordHash)) {
    sqlite.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(hashPassword(opts.plainPassword), user.id);
  }

  try {
    upsertUserSession({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      ip: meta.clientIp,
      pcPrint: meta.pcPrint,
      userAgent: meta.userAgent,
    });
  } catch (err: any) {
    console.warn('[Session Save Notice]:', err?.message);
  }

  clearLoginFailures(meta, user.id);
  const safeUser = publicUser(user, meta);
  const waiting = role === 'PILGRIM_USER' ? pilgrimWaitingRedirect(user.id) : null;
  if (waiting) safeUser.redirect = waiting.redirect as AppRedirectPath;
  else if (role === 'PILGRIM_USER') safeUser.redirect = '/portal';
  const appointment = role === 'PILGRIM_USER' && !waiting ? pilgrimAppointment(user.id) : null;

  const token = signToken(
    {
      id: user.id,
      code: user.code || user.username || user.id,
      name: user.name,
      role: user.role,
      roleName: safeUser.roleName,
      email: user.email,
      username: user.username,
      phone: user.phone,
    } as any,
    {
      mfa: privileged ? true : undefined,
      tokenVersion: tokenVersionOf(user.id),
      expiresIn: privileged ? PRIVILEGED_EXPIRES_IN : undefined,
    }
  );

  try {
    dbLogAudit(
      user.name,
      user.role,
      privileged ? 'تسجيل دخول إداري (مفتاح أمان)' : 'تسجيل دخول ناجح',
      `method=${opts.method || 'password'}`,
      meta.clientIp
    );
  } catch {
    /* login must succeed even if the audit table is old */
  }

  const res = NextResponse.json({
    status: 'SUCCESS',
    user: safeUser,
    token,
    waitingBooking: Boolean(waiting),
    appointment,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(privileged ? 60 * 60 * 8 : 60 * 60 * 24));
  return res;
}
