import { NextResponse } from 'next/server';
import { ADMINS, requireRole, requireStepUp } from '@/lib/staff-gate';
import { clientMeta } from '@/lib/login-session';
import { listUserSessions, endUserSession, upsertUserSession } from '@/lib/presence';
import { deviceLabel } from '@/lib/user-access-view';
import { bumpTokenVersion, tokenVersionOf } from '@/lib/webauthn';
import { signToken, PRIVILEGED_EXPIRES_IN } from '@/lib/auth';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';
import { LOGIN_ROLE_LABELS, normalizeLoginRole } from '@/lib/roles';
import { dbLogAudit } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Super Admin / Admin: the devices signed in to your own account.
 *   GET                              → recent sessions (this device marked);
 *   POST {action:'signout-others'}   → every other device is signed out (site and
 *     Connect app), after a key / fingerprint step-up; this device stays in.
 */

const RECENT_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const here = clientMeta(req).pcPrint;
  const now = Date.now();
  // Newest first; one row per device (a device can leave several session rows).
  const seen = new Set<string>();
  const sessions = listUserSessions(gate.account.id)
    .filter((s: any) => !s.endedAt && now - Date.parse(s.lastActive || s.loginTime || '') < RECENT_MS)
    .filter((s: any) => {
      const key = String(s.pcPrint || s.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20)
    .map((s: any) => ({
      id: String(s.id),
      device: deviceLabel(s.userAgent),
      mobile: /android|iphone|ipad|mobile/i.test(String(s.userAgent || '')),
      ip: String(s.ip || ''),
      loginTime: s.loginTime || null,
      lastActive: s.lastActive || null,
      current: s.pcPrint === here,
    }));
  return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'signout-others') return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  const stepUp = requireStepUp(req, gate);
  if (stepUp) return stepUp.error;

  const user = gate.account;
  const meta = clientMeta(req);
  // A new token generation revokes every older session token at once.
  bumpTokenVersion(user.id);
  endUserSession(user.id);
  upsertUserSession({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    ip: meta.clientIp,
    pcPrint: meta.pcPrint,
    userAgent: meta.userAgent,
  });
  const role = normalizeLoginRole(user.role);
  const token = signToken(
    {
      id: user.id,
      code: user.code || user.username || user.id,
      name: user.name,
      role: user.role,
      roleName: user.roleName || LOGIN_ROLE_LABELS[role],
      email: user.email,
      username: user.username,
      phone: user.phone,
    } as any,
    { mfa: true, tokenVersion: tokenVersionOf(user.id), expiresIn: PRIVILEGED_EXPIRES_IN }
  );
  try {
    dbLogAudit(user.name, user.role, 'تسجيل الخروج من كل الأجهزة الأخرى', '', meta.clientIp);
  } catch {
    /* audit is best-effort */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 8, req));
  return res;
}
