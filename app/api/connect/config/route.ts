import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { iceServers, vapidPublicKey } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';

/** What the app needs at start: who I am, call relay servers, push key. */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  return NextResponse.json(
    { me: s.me, iceServers: iceServers(s.me.id), vapidPublicKey: vapidPublicKey() || null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
