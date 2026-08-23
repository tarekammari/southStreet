import { NextRequest, NextResponse } from 'next/server';
import { dbGetMessages, dbSaveMessage } from '@/lib/db';
import { getAuthUser } from '@/lib/request-auth';
import { userInChat } from '@/lib/chat-utils';
import { Message } from '@/types';

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId') || 'group-campaign-makkah';

  if (auth && !userInChat(chatId, auth.id)) {
    return NextResponse.json({ error: 'غير مصرح بالوصول لهذه المحادثة' }, { status: 403 });
  }

  const messages = dbGetMessages(chatId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const body: Message = await req.json();

    if (!body.chatId || !body.text) {
      return NextResponse.json({ error: 'بيانات الرسالة غير مكتملة' }, { status: 400 });
    }

    if (auth) {
      if (!userInChat(body.chatId, auth.id)) {
        return NextResponse.json({ error: 'غير مصرح بإرسال رسالة في هذه المحادثة' }, { status: 403 });
      }
      body.senderId = auth.id;
      body.senderName = auth.name;
      body.senderRole = auth.role;
    }

    const saved = dbSaveMessage(body);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: 'فشل حفظ الرسالة' }, { status: 500 });
  }
}
