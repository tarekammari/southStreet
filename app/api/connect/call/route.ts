import { NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { addIce, answerCall, busy, canTalk, finishCall, getCall, iceFor, startCall, userById } from '@/lib/connect/store';
import { pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';

/**
 * Voice-call signalling (WebRTC). Audio itself goes directly between the two
 * phones (or through the TURN relay); this route only exchanges the setup.
 *   GET  ?id=&since=        state of a call + the other side's network candidates
 *   POST {action:'start', to, offer}
 *   POST {action:'answer'|'decline'|'end', id, answer?}
 *   POST {action:'ice', id, candidate}
 */
export async function GET(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const call = getCall(String(req.nextUrl.searchParams.get('id') || ''));
  if (!call || (call.callerId !== s.me.id && call.calleeId !== s.me.id)) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });
  const since = Number(req.nextUrl.searchParams.get('since')) || 0;
  return NextResponse.json(
    {
      state: call.state,
      answer: call.callerId === s.me.id ? call.answer || null : null,
      answeredTs: call.answeredTs || null,
      candidates: iceFor(call.id, s.me.id, since),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));

  if (body.action === 'start') {
    const peer = userById(String(body.to || ''));
    if (!peer || !canTalk(s.me, peer)) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
    const offer = String(body.offer || '');
    if (!offer.includes('v=0')) return NextResponse.json({ error: 'عرض اتصال غير صالح' }, { status: 400 });
    if (busy(peer.id)) return NextResponse.json({ error: 'الطرف الآخر في مكالمة الآن', code: 'BUSY' }, { status: 409 });
    const call = startCall(s.me, peer, offer);
    void pushTo(peer.id, { kind: 'call', title: `📞 مكالمة من ${s.me.name}`, body: 'اضغط للرد', tag: `call-${call.id}`, url: `/connect?call=${call.id}` });
    return NextResponse.json({ id: call.id });
  }

  const call = getCall(String(body.id || ''));
  if (!call || (call.callerId !== s.me.id && call.calleeId !== s.me.id)) return NextResponse.json({ error: 'غير موجودة' }, { status: 404 });

  if (body.action === 'answer') {
    if (call.calleeId !== s.me.id) return NextResponse.json({ error: 'غير مسموح' }, { status: 403 });
    if (call.state !== 'ringing') return NextResponse.json({ error: 'انتهت المكالمة', state: call.state }, { status: 409 });
    const answer = String(body.answer || '');
    if (!answer.includes('v=0')) return NextResponse.json({ error: 'رد غير صالح' }, { status: 400 });
    return NextResponse.json({ state: answerCall(call, answer).state });
  }
  if (body.action === 'decline') {
    return NextResponse.json({ state: finishCall(call, call.calleeId === s.me.id && call.state === 'ringing' ? 'declined' : 'ended').state });
  }
  if (body.action === 'end') {
    return NextResponse.json({ state: finishCall(call, 'ended').state });
  }
  if (body.action === 'ice') {
    const candidate = typeof body.candidate === 'string' ? body.candidate : JSON.stringify(body.candidate || {});
    if (candidate.length > 2 && (call.state === 'ringing' || call.state === 'active')) addIce(call.id, s.me.id, candidate);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
