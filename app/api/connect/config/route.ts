import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { iceServers, vapidPublicKey } from '@/lib/connect/push';
import { controlOf, settings } from '@/lib/connect/policy';

export const dynamic = 'force-dynamic';

/** What the app needs at start: who I am, call relay servers, push key. */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  return NextResponse.json(
    {
      me: s.me,
      iceServers: iceServers(s.me.id),
      vapidPublicKey: vapidPublicKey() || null,
      // The Super Admin's rules this app follows (call buttons, relay only).
      policy: {
        calls: s.me.role === 'SUPER_ADMIN' || (settings().calls && !controlOf(s.me.id).callsBlocked),
        relayOnly: settings().relayOnly,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
