import { NextRequest, NextResponse } from 'next/server';
import { dbGetMessages, dbSaveMessage } from '@/lib/db';
import { Message } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId') || 'group-makkah';
  const messages = dbGetMessages(chatId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  try {
    const body: Message = await req.json();
    if (!body.chatId || !body.text) {
      return NextResponse.json({ error: 'بيانات الرسالة غير مكتملة' }, { status: 400 });
    }
    const saved = dbSaveMessage(body);
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: 'فشل حفظ الرسالة' }, { status: 500 });
  }
}
