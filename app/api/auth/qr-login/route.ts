import { NextResponse } from 'next/server';
import { clientMeta, completeLogin } from '@/lib/login-session';
import { sessionCookieOptions } from '@/lib/session-token';
import { isPrivilegedRole, normalizeLoginRole } from '@/lib/roles';
import { getSqliteDb } from '@/lib/sqlite';
import {
  QR_DEVICE_COOKIE,
  claimApproved,
  createQrRequest,
  isQrTargetRole,
  requestForDevice,
  startLimited,
  type QrRequest,
} from '@/lib/qr-login';

export const dynamic = 'force-dynamic';

/**
 * The new device's side of "sign in with the Super Admin's phone".
 *   POST → a fresh QR (the device secret goes into an httpOnly cookie);
 *   GET  → long-poll for the request's state; once the phone approves, this
 *          same call opens the session on this browser.
 * See lib/qr-login.ts for the whole flow.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const LONG_POLL_MS = 25_000;
const POLL_STEP_MS = 700;

function deviceSecretOf(req: Request): string {
  const match = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${QR_DEVICE_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function deviceCookie(maxAgeSeconds: number, req: Request) {
  return { ...sessionCookieOptions(maxAgeSeconds, req), sameSite: 'strict' as const, path: '/api/auth/qr-login' };
}

export async function POST(req: Request) {
  const meta = clientMeta(req);
  if (startLimited(meta.clientIp)) {
    return NextResponse.json({ error: 'طلبات كثيرة لرمز الدخول. انتظر بضع دقائق ثم أعد المحاولة.' }, { status: 429, headers: NO_STORE });
  }
  const created = createQrRequest(meta, deviceSecretOf(req));
  const res = NextResponse.json(
    { code: created.code, shortCode: created.shortCode, expiresAt: created.expiresAt },
    { headers: NO_STORE }
  );
  res.cookies.set(QR_DEVICE_COOKIE, created.deviceSecret, deviceCookie(10 * 60, req));
  return res;
}

/** The account the phone chose, checked again now: it may have been suspended in the meantime. */
function accountToOpen(row: QrRequest): any | null {
  const db = getSqliteDb();
  const approver = db.prepare('SELECT * FROM users WHERE id = ?').get(String(row.approver_id || '')) as any;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(String(row.target_id || '')) as any;
  if (!approver || !target) return null;
  const ok = (u: any) => u.loginEnabled !== 0 && u.status !== 'SUSPENDED' && u.status !== 'REJECTED';
  if (!ok(approver) || !ok(target) || normalizeLoginRole(approver.role) !== 'SUPER_ADMIN') return null;
  const role = normalizeLoginRole(target.role);
  if (!isQrTargetRole(role)) return null;
  // The only privileged account a phone can open is its own.
  if (role === 'SUPER_ADMIN' && target.id !== approver.id) return null;
  return target;
}

export async function GET(req: Request) {
  const secret = deviceSecretOf(req);
  const since = new URL(req.url).searchParams.get('since') || '';
  const deadline = Date.now() + LONG_POLL_MS;

  let row = requestForDevice(secret);
  while (row && row.status === since && (row.status === 'pending' || row.status === 'scanned') && Date.now() < deadline) {
    if (req.signal.aborted) return new NextResponse(null, { status: 204 });
    await new Promise((r) => setTimeout(r, POLL_STEP_MS));
    row = requestForDevice(secret);
  }

  if (!row) return NextResponse.json({ status: 'none' }, { headers: NO_STORE });

  if (row.status === 'approved') {
    const target = accountToOpen(row);
    if (!target || !claimApproved(row)) {
      return NextResponse.json({ status: 'denied' }, { headers: NO_STORE });
    }
    const res = completeLogin(target, clientMeta(req), {
      mfa: isPrivilegedRole(target.role),
      method: 'qr-phone-link',
    });
    res.cookies.set(QR_DEVICE_COOKIE, '', deviceCookie(0, req));
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (row.status === 'scanned') {
    return NextResponse.json({ status: 'scanned', pairNumber: row.pair_number, expiresAt: row.expires_at }, { headers: NO_STORE });
  }
  // A used request is reported as finished: the session was already handed out once.
  const status = row.status === 'used' ? 'expired' : row.status;
  return NextResponse.json({ status, expiresAt: row.expires_at }, { headers: NO_STORE });
}
