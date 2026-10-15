import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { chatStamps, incomingFor, userById } from '@/lib/connect/store';
import { linksStamp } from '@/lib/connect/links';

export const dynamic = 'force-dynamic';

/** Called every few seconds by the open app: what changed, and is someone calling me? */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const { unread, stamps } = chatStamps(s.me);
  const call = incomingFor(s.me.id);
  const caller = call ? userById(call.callerId) : null;
  return NextResponse.json(
    {
      now: Date.now(),
      unread,
      stamps,
      people: linksStamp(s.me.id),
      incoming:
        call && caller
          ? { id: call.id, offer: call.offer, caller: { id: caller.id, name: caller.name, roleLabel: caller.roleLabel, photo: caller.photo } }
          : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
