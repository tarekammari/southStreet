import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('south_street_token', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return res;
}
