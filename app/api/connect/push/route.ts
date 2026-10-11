import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { savePush } from '@/lib/connect/store';

export const dynamic = 'force-dynamic';

/** POST {subscription} — this device wants notifications for messages and calls. */
export async function POST(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  try {
    savePush(s.me.id, body.subscription);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'اشتراك غير صالح' }, { status: 400 });
  }
}
