import { NextRequest, NextResponse } from 'next/server';
import { dbGetAppUsers, dbGetLastMessageForChat } from '@/lib/db';
import { getAuthUser, authUserToUser } from '@/lib/request-auth';
import { getChannelsForUser } from '@/lib/chat-utils';

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول للوصول للمحادثات' }, { status: 401 });
  }

  const currentUser = authUserToUser(auth);
  const allUsers = dbGetAppUsers();
  const channels = getChannelsForUser(currentUser, allUsers);

  const enriched = channels.map((ch) => {
    const last = dbGetLastMessageForChat(ch.id);
    return {
      ...ch,
      lastMessage: last?.text || ch.subtitle || 'ابدأ المحادثة',
      lastTime: last?.time || '',
      unread: 0,
    };
  });

  return NextResponse.json({ channels: enriched, currentUser });
}
