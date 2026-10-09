import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-token';

export const dynamic = 'force-dynamic';

/**
 * One-time upgrade for browsers signed in before sessions moved to an httpOnly
 * cookie: the page sends the token it kept in localStorage (as a Bearer header),
 * we check it exactly like any request, and answer with the httpOnly cookie for
 * the token's remaining lifetime. The page then forgets the token.
 */
export async function POST(req: NextRequest) {
  const gate = requireSession(req);
  if ('error' in gate) return gate.error;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const exp = Number((gate.payload as { exp?: number }).exp) || 0;
  const remaining = exp ? exp - Math.floor(Date.now() / 1000) : 0;
  if (!token || remaining <= 0) return NextResponse.json({ error: 'انتهت الجلسة' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(remaining));
  return res;
}
