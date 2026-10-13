import { NextResponse } from 'next/server';
import { checkContact } from '@/lib/account-lookup';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';

/**
 * POST {email?, phone?} → whether an account already uses them, so the sign-up
 * form can offer "sign in instead" before the user fills everything in.
 * Says only "exists" and how to sign in (never a name); 30 checks / 10 min per address.
 */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const g = globalThis as unknown as { __ssContactChecks?: Map<string, number[]> };
const hits = (g.__ssContactChecks ||= new Map());

export async function POST(req: Request) {
  const ip = resolveRequestIp({ forwarded: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), fallback: '127.0.0.1' });
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t: number) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (recent.length > LIMIT) return NextResponse.json({ error: 'محاولات كثيرة. حاول بعد قليل.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const result = checkContact({ email: String(body.email || '').slice(0, 200), phone: String(body.phone || '').slice(0, 40) });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
