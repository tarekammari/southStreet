import { NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { canTalk, isOnline, markRead, saveConnectMessage, saveVoice, userById } from '@/lib/connect/store';
import { buildDmChatId } from '@/lib/chat-utils';
import { pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';

const TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'];
const MAX = 3 * 1024 * 1024; // a few minutes of compressed speech

/** POST multipart {to, duration, audio} — a voice note. */
export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const form = await req.formData().catch(() => null);
  const audio = form?.get('audio');
  const peer = userById(String(form?.get('to') || ''));
  if (!peer || !canTalk(s.me, peer)) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
  if (!(audio instanceof File) || !audio.size) return NextResponse.json({ error: 'لم يصل التسجيل' }, { status: 400 });
  if (audio.size > MAX) return NextResponse.json({ error: 'الرسالة الصوتية طويلة جداً' }, { status: 413 });
  const mime = (audio.type || 'audio/webm').split(';')[0].toLowerCase();
  if (!TYPES.includes(mime)) return NextResponse.json({ error: 'صيغة صوت غير مدعومة' }, { status: 415 });
  const duration = Math.max(1, Math.min(600, Math.round(Number(form?.get('duration')) || 1)));
  const chatId = buildDmChatId(s.me.id, peer.id);
  const mediaId = saveVoice(chatId, Buffer.from(await audio.arrayBuffer()), mime);
  const message = saveConnectMessage(s.me, chatId, { kind: 'voice', text: 'رسالة صوتية', mediaId, duration });
  markRead(chatId, s.me.id);
  if (!isOnline(peer.id)) {
    void pushTo(peer.id, { kind: 'message', title: s.me.name, body: '🎤 رسالة صوتية', tag: `chat-${chatId}`, url: `/connect?chat=${s.me.id}` });
  }
  return NextResponse.json({ message });
}
