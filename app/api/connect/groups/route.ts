import { NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { markRead } from '@/lib/connect/store';
import { canPost, getGroup, groupConversation, isMember, postToGroup, setMuted } from '@/lib/connect/groups';

export const dynamic = 'force-dynamic';

/**
 * A group chat in the app (groups are made in /connect/admin).
 *   GET  ?id=&since=           the conversation (marks it read)
 *   POST {id, text}            write (members of an open group; "admins" mode: admins only)
 *   POST {id, action:'mute'|'unmute'}
 */
function groupFor(meId: string, role: string, id: string) {
  const g = getGroup(id);
  return g && (isMember(g.id, meId) || role === 'SUPER_ADMIN') ? g : null;
}

export async function GET(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const g = groupFor(s.me.id, s.me.role, String(req.nextUrl.searchParams.get('id') || ''));
  if (!g) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
  markRead(g.chatId, s.me.id);
  return NextResponse.json(groupConversation(g, s.me, Number(req.nextUrl.searchParams.get('since')) || 0), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const g = groupFor(s.me.id, s.me.role, String(body.id || ''));
  if (!g) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
  if (body.action === 'mute' || body.action === 'unmute') {
    setMuted(g.id, s.me.id, body.action === 'mute');
    return NextResponse.json({ muted: body.action === 'mute' });
  }
  if (!canPost(g, s.me)) {
    return NextResponse.json({ error: g.closed ? 'المجموعة مغلقة' : 'المشرفون فقط يكتبون في هذه المجموعة' }, { status: 403 });
  }
  const text = String(body.text || '').trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
  const message = postToGroup(g, s.me, { kind: 'text', text });
  markRead(g.chatId, s.me.id);
  return NextResponse.json({ message });
}
