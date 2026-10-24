import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { callHistory, contactsFor, userById } from '@/lib/connect/store';
import { groupsFor } from '@/lib/connect/groups';

export const dynamic = 'force-dynamic';

/** People I may talk to (clients ↔ team only), with last message, unread and online state; plus my call log. */
export async function GET(req: Request) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const contacts = contactsFor(s.me);
  const allowed = new Set(contacts.map((c) => c.id));
  const calls = callHistory(s.me.id)
    .filter((c) => allowed.has(c.callerId === s.me.id ? c.calleeId : c.callerId))
    .map((c) => {
      const other = userById(c.callerId === s.me.id ? c.calleeId : c.callerId);
      return {
        id: c.id,
        peerId: other?.id || '',
        peerName: other?.name || '',
        outgoing: c.callerId === s.me.id,
        state: c.state,
        createdTs: c.createdTs,
        seconds: c.answeredTs && c.endedTs ? Math.round((c.endedTs - c.answeredTs) / 1000) : 0,
      };
    });
  return NextResponse.json({ contacts, calls, groups: groupsFor(s.me) }, { headers: { 'Cache-Control': 'no-store' } });
}
