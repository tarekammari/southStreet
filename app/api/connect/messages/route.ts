import { NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { canTalk, isOnline, lastSeen, markDelivered, markRead, messagesFor, receiptOf, saveConnectMessage, userById } from '@/lib/connect/store';
import { buildDmChatId } from '@/lib/chat-utils';
import { pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';

function peerOf(meId: string, peerId: string) {
  const peer = userById(peerId);
  return peer ? { peer, chatId: buildDmChatId(meId, peer.id) } : null;
}

/** GET ?with=<userId>&since=<ts> — the conversation (marks it read). */
export async function GET(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const target = peerOf(s.me.id, String(req.nextUrl.searchParams.get('with') || ''));
  if (!target || !canTalk(s.me, target.peer)) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
  const since = Number(req.nextUrl.searchParams.get('since')) || 0;
  markRead(target.chatId, s.me.id);
  return NextResponse.json(
    {
      chatId: target.chatId,
      peerOnline: isOnline(target.peer.id),
      peerSeen: lastSeen(target.peer.id),
      /** How far the other side received / read my messages (✓✓ / blue ✓✓). */
      receipt: receiptOf(target.chatId, target.peer.id),
      messages: messagesFor(target.chatId, since),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * POST {to, text} — send a text message.
 * POST {action:'delivered'} — a device of mine showed a message notification (✓✓ for the sender).
 */
export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  if (body.action === 'delivered') {
    markDelivered(s.me.id);
    return NextResponse.json({ success: true });
  }
  const target = peerOf(s.me.id, String(body.to || ''));
  if (!target || !canTalk(s.me, target.peer)) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
  const text = String(body.text || '').trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
  const message = saveConnectMessage(s.me, target.chatId, { kind: 'text', text });
  markRead(target.chatId, s.me.id);
  // Always: a closed app (even one whose background listener keeps it "online") shows the
  // notification; an app open on screen hides it by itself.
  void pushTo(target.peer.id, { kind: 'message', title: s.me.name, body: text.slice(0, 140), tag: `chat-${target.chatId}`, url: `/connect?chat=${s.me.id}`, msgId: message.id, chatId: target.chatId });
  return NextResponse.json({ message });
}
