import { NextResponse } from 'next/server';
import { signPurposeToken } from '@/lib/auth';
import { ADMINS, requireRole, STEP_UP_TTL } from '@/lib/staff-gate';
import { beginAuthentication, finishAuthentication } from '@/lib/webauthn';

/**
 * Step-up confirmation for dangerous actions (managing Admins, deleting
 * accounts, changing security keys). GET → key challenge, POST → short-lived
 * token the client sends in the `x-step-up` header.
 */

export async function GET(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const started = await beginAuthentication(req, gate.account.id, 'step-up');
  if (!started) return NextResponse.json({ error: 'لا يوجد مفتاح أمان مسجّل' }, { status: 409 });
  return NextResponse.json(started);
}

export async function POST(req: Request) {
  const gate = requireRole(req, ADMINS);
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  try {
    const { userId } = await finishAuthentication(req, String(body.flowToken || ''), body.response, 'step-up');
    if (userId !== gate.account.id) throw new Error('MISMATCH');
  } catch {
    return NextResponse.json({ error: 'تعذّر التحقق من مفتاح الأمان' }, { status: 401 });
  }
  return NextResponse.json({ stepUpToken: signPurposeToken({ sub: gate.account.id }, 'step-up', STEP_UP_TTL) });
}
