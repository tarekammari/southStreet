import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { chatStamps, incomingEvent, incomingFor, markDelivered, touchPresence, userById } from '@/lib/connect/store';
import { linksStamp } from '@/lib/connect/links';
import { groupsFor } from '@/lib/connect/groups';

export const dynamic = 'force-dynamic';

/** Called every few seconds by the open app: what changed, and is someone calling me? */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  touchPresence(s.me.id);
  markDelivered(s.me.id);
  const { unread: dmUnread, stamps } = chatStamps(s.me);
  // Group chats count too (new message → the app reloads its lists).
  const groups = groupsFor(s.me);
  for (const g of groups) stamps[g.chatId] = g.lastTs;
  const unread = dmUnread + groups.reduce((n, g) => n + g.unread, 0);
  const call = incomingFor(s.me.id);
  const caller = call ? userById(call.callerId) : null;
  return NextResponse.json(
    {
      now: Date.now(),
      unread,
      stamps,
      people: linksStamp(s.me.id),
      incoming: call && caller ? incomingEvent(call, caller) : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
