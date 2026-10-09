import { NextResponse } from 'next/server';
import { extractSessionToken } from '@/lib/session-token';
import { verifyToken, verifyPurposeToken, type JwtPayload } from '@/lib/auth';
import { getSqliteDb } from '@/lib/sqlite';
import { isPrivilegedRole, normalizeLoginRole, type LoginRole } from '@/lib/roles';

/**
 * One gate for every staff/admin API.
 *  - the role comes from the database, never from the token claims;
 *  - disabled / suspended accounts are refused;
 *  - Super Admin and Admin sessions must have been opened with a security key
 *    (mfa claim) and must match the account's current tokenVersion.
 */

export type GateOk = {
  account: any;
  role: LoginRole;
  payload: JwtPayload;
};

export type GateResult = GateOk | { error: NextResponse };

function readToken(req: Request): string | null {
  return extractSessionToken(req.headers.get('authorization'), req.headers.get('cookie'));
}

function deny(status: number, error: string, code?: string) {
  return { error: NextResponse.json({ error, code }, { status }) };
}

export function requireSession(req: Request): GateResult {
  const token = readToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return deny(401, 'يلزم تسجيل الدخول', 'AUTH_REQUIRED');

  const account = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) as any;
  if (!account) return deny(401, 'الحساب غير موجود', 'AUTH_REQUIRED');
  if (account.loginEnabled === 0 || account.status === 'SUSPENDED' || account.status === 'REJECTED') {
    return deny(403, 'تم إيقاف هذا الحساب', 'ACCOUNT_DISABLED');
  }
  if ((Number(payload.tv) || 0) !== (Number(account.tokenVersion) || 0)) {
    return deny(401, 'انتهت الجلسة — سجّل الدخول من جديد', 'SESSION_REVOKED');
  }

  const role = normalizeLoginRole(account.role);
  if (isPrivilegedRole(role) && payload.mfa !== true) {
    return deny(401, 'حسابات الإدارة تتطلب الدخول بمفتاح الأمان', 'SECURITY_KEY_REQUIRED');
  }
  return { account, role, payload };
}

export function requireRole(req: Request, allowed: Iterable<LoginRole>): GateResult {
  const gate = requireSession(req);
  if ('error' in gate) return gate;
  if (!new Set(allowed).has(gate.role)) return deny(403, 'صلاحية غير كافية', 'FORBIDDEN');
  return gate;
}

export const SUPER_ONLY: LoginRole[] = ['SUPER_ADMIN'];
export const ADMINS: LoginRole[] = ['SUPER_ADMIN', 'AGENCY_MANAGER'];

/* ------------------------------------------------------------------ *
 * Step-up: dangerous actions need a security-key tap from the last minutes.
 * The client obtains the token from /api/auth/webauthn/step-up and sends it
 * in the `x-step-up` header.
 * ------------------------------------------------------------------ */

export const STEP_UP_HEADER = 'x-step-up';
export const STEP_UP_TTL = '5m';

export function requireStepUp(req: Request, gate: GateOk): { error: NextResponse } | null {
  const token = req.headers.get(STEP_UP_HEADER) || '';
  const claims = verifyPurposeToken<{ sub: string }>(token, 'step-up');
  if (!claims || claims.sub !== gate.account.id) {
    return deny(428, 'هذا الإجراء يتطلب تأكيداً بمفتاح الأمان', 'STEP_UP_REQUIRED');
  }
  return null;
}
