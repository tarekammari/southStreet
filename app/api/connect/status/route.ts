import { NextResponse } from 'next/server';
import { vapidPublicKey } from '@/lib/connect/push';
import { CONNECT_VERSION } from '@/lib/connect/version';

export const dynamic = 'force-dynamic';

/**
 * Public health of Connect (no personal data, no keys): the deployed version and
 * whether ringing on closed apps (push) and the call relay (TURN) are set up.
 */
export async function GET() {
  return NextResponse.json(
    {
      version: CONNECT_VERSION,
      build: (process.env.APP_VERSION || '').slice(0, 7),
      push: Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim()),
      relay: Boolean((process.env.TURN_URLS || '').trim()),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
