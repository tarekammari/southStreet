import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { chatPeer, loadVoice } from '@/lib/connect/store';
import { groupIdOf, isMember } from '@/lib/connect/groups';

export const dynamic = 'force-dynamic';

/** A voice note — only for the two people of that conversation, or the group's members. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const { id } = await params;
  const media = loadVoice(id);
  const group = media ? groupIdOf(media.chatId) : null;
  const allowed = media && (group ? isMember(group, s.me.id) || s.me.role === 'SUPER_ADMIN' : chatPeer(media.chatId, s.me.id));
  if (!media || !allowed) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(media.data), {
    headers: { 'Content-Type': media.mime, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
