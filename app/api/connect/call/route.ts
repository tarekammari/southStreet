import { after, NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { addIce, answerCall, busy, canTalk, finishCall, getCall, iceFor, startCall, userById } from '@/lib/connect/store';
import { pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const me = s.me;
    // A closed app rings with ONE call notification: the native Android app turns
    // it into a full-screen call screen with a looping ringtone; browsers keep a
    // persistent notification with رد / رفض. When the call stops ringing, the
    // device is told how it ended so it stops ringing / shows a missed call.
    after(async () => {
      const common = { tag: `call-${call.id}`, callId: call.id, caller: me.name, photo: me.photo || '', role: me.roleLabel || '' };
      await pushTo(peer.id, {
        ...common,
        kind: 'call',
        title: `📞 ${me.name}`,
        body: 'مكالمة صوتية واردة — South Street Connect',
        url: `/connect?call=${call.id}`,
      });
      for (let t = 0; t < 100; t++) {
        await sleep(500);
        if (getCall(call.id)?.state !== 'ringing') break; // getCall also turns a 45 s ring into "missed"
      }
      const last = getCall(call.id);
      const outcome = !last || last.state === 'active' ? 'answered' : last.state === 'missed' ? 'missed' : last.state === 'declined' ? 'declined' : 'ended';
      await pushTo(peer.id, {
        ...common,
        kind: 'call-end',
        outcome,
        title: outcome === 'answered' ? 'تم الرد على المكالمة' : `مكالمة فائتة من ${me.name}`,
        body: outcome === 'answered' ? '' : 'اضغط لمعاودة الاتصال',
        url: `/connect?chat=${me.id}`,
      });
    });
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
    if (candidate.length > 2 && (call.state === 'ringing' || call.state === 'active')) addIce(call, s.me.id, candidate);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
