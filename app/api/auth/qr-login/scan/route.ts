import { NextResponse } from 'next/server';
import { requireSession, type GateResult } from '@/lib/staff-gate';
import { isPrivilegedRole } from '@/lib/roles';
import { ownerSkipsStepUp } from '@/lib/owner-google';
import { clientMeta, recordLoginFailure } from '@/lib/login-session';
import { deviceLabel } from '@/lib/user-access-view';
import { countQrAccounts, scanQrRequest } from '@/lib/qr-login';

export const dynamic = 'force-dynamic';

/**
 * A signed-in phone scanned a sign-in QR (or typed its short code).
 * Binds the request to this account and returns what the phone shows:
 * the device asking, the three numbers to choose from and, for the Super
 * Admin, the roles to choose from (mode "choose"). Any other account can only
 * open itself (mode "self"); Admins (AGENCY_MANAGER) sign in with their key only.
 */

function phoneGate(req: Request): GateResult & { mode?: 'choose' | 'self' } {
  const gate = requireSession(req);
  if ('error' in gate) return gate;
  if (gate.role === 'SUPER_ADMIN') return { ...gate, mode: 'choose' };
  if (isPrivilegedRole(gate.role)) {
    return { error: NextResponse.json({ error: 'حساب المشرف يدخل إلى الأجهزة بمفتاح الأمان فقط.', code: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { ...gate, mode: 'self' };
}

const g = globalThis as unknown as { __ssQrScanMisses?: Map<string, number[]> };
const misses: Map<string, number[]> = (g.__ssQrScanMisses ||= new Map<string, number[]>());
const MISS_LIMIT = 10;
const MISS_WINDOW_MS = 10 * 60 * 1000;

function recentMisses(userId: string): number[] {
  const now = Date.now();
  const list = (misses.get(userId) || []).filter((t) => now - t < MISS_WINDOW_MS);
  misses.set(userId, list);
  return list;
}

const MESSAGES = {
  NOT_FOUND: 'الرمز غير صحيح. امسح الرمز الظاهر على الجهاز من جديد.',
  EXPIRED: 'انتهت صلاحية هذا الرمز. حدّث الرمز على الجهاز ثم امسحه مجدداً.',
  TAKEN: 'هذا الرمز مُسح من جهاز آخر. حدّث الرمز على الجهاز.',
  FINISHED: 'استُعمل هذا الرمز من قبل. حدّث الرمز على الجهاز.',
} as const;

/** Lets the phone page know who is signed in on this browser before opening the camera. */
export async function GET(req: Request) {
  const gate = phoneGate(req);
  if ('error' in gate) return gate.error;
  return NextResponse.json({ me: { id: gate.account.id, name: gate.account.name }, mode: gate.mode, keyTap: gate.mode === 'choose' && !ownerSkipsStepUp(gate.account) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const gate = phoneGate(req);
  if ('error' in gate) return gate.error;

  if (recentMisses(gate.account.id).length >= MISS_LIMIT) {
    return NextResponse.json({ error: 'محاولات كثيرة برموز غير صحيحة. انتظر 10 دقائق.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const result = scanQrRequest(String(body.code || '').slice(0, 120), gate.account.id);
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') {
      recentMisses(gate.account.id).push(Date.now());
      recordLoginFailure(clientMeta(req), 'رمز QR لربط جهاز غير صحيح');
    }
    return NextResponse.json({ error: MESSAGES[result.code], code: result.code }, { status: result.code === 'NOT_FOUND' ? 404 : 410 });
  }

  const { request, choices } = result;
  return NextResponse.json(
    {
      id: request.id,
      expiresAt: request.expires_at,
      choices,
      device: {
        label: deviceLabel(request.device_ua),
        ip: request.device_ip,
        userAgent: request.device_ua,
        requestedAt: request.created_at,
        sameNetwork: request.device_ip === clientMeta(req).clientIp,
      },
      me: { id: gate.account.id, name: gate.account.name },
      mode: gate.mode,
      keyTap: gate.mode === 'choose' && !ownerSkipsStepUp(gate.account),
      counts: gate.mode === 'choose' ? countQrAccounts() : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
