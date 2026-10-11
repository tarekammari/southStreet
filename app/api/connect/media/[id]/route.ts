import { NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { chatPeer, loadVoice } from '@/lib/connect/store';

export const dynamic = 'force-dynamic';

/** A voice note — only for the two people of that conversation. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const { id } = await params;
  const media = loadVoice(id);
  if (!media || !chatPeer(media.chatId, s.me.id)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(media.data), {
    headers: { 'Content-Type': media.mime, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
