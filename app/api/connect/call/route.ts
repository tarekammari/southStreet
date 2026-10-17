import { after, NextRequest, NextResponse } from 'next/server';
import { connectSession } from '@/lib/connect/session';
import { addIce, answerCall, busy, canTalk, finishCall, getCall, iceFor, ringingCall, startCall, userById } from '@/lib/connect/store';
import { pushTo } from '@/lib/connect/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** At most 8 calls started per person per minute (stops ring-bombing). */
const started = new Map<string, number[]>();
function tooMany(userId: string): boolean {
  const now = Date.now();
  const recent = (started.get(userId) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  started.set(userId, recent);
  return recent.length > 8;
}

/**
 * Voice-call signalling (WebRTC). Audio itself goes directly between the two
 * phones (or through the TURN relay); this route only exchanges the setup.
 *   GET  ?id=&since=        state of a call + the other side's network candidates
 *   POST {action:'start', to, offer, key?, sig?}
 *   POST {action:'ringing', id}            the callee's device rings (caller sees «يرنّ…»)
 *   POST {action:'answer', id, answer, key?, sig?}
 *   POST {action:'decline'|'end', id}
 *   POST {action:'ice', id, candidate}
 *   POST {action:'restart', id, data}      reconnect after a network change (ICE restart)
 * `key` / `sig`: the device's public key and its signature over the audio
 * encryption fingerprint, checked by the other phone (lib/connect/e2e.ts) — the
 * server only passes them on and cannot forge them.
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
      key: call.callerId === s.me.id ? call.answerKey || null : null,
      sig: call.callerId === s.me.id ? call.answerSig || null : null,
      ringingTs: call.ringingTs || null,
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
    if (!peer) return NextResponse.json({ error: 'غير متاح' }, { status: 403 });
    // Two clients call each other only after one accepted the other's request.
    if (!canTalk(s.me, peer)) {
      return peer.role === 'PILGRIM_USER'
        ? NextResponse.json({ error: 'أرسل طلب تواصل أولاً — يمكنكما الاتصال بعد قبوله', code: 'NOT_CONNECTED' }, { status: 403 })
        : NextResponse.json({ error: 'غير متاح' }, { status: 403 });
    }
    const offer = String(body.offer || '');
    if (!offer.includes('v=0')) return NextResponse.json({ error: 'عرض اتصال غير صالح' }, { status: 400 });
    if (tooMany(s.me.id)) return NextResponse.json({ error: 'محاولات اتصال كثيرة — انتظر دقيقة', code: 'RATE' }, { status: 429 });
    if (busy(peer.id)) return NextResponse.json({ error: 'الطرف الآخر في مكالمة الآن', code: 'BUSY' }, { status: 409 });
    const call = startCall(s.me, peer, offer, { key: body.key, sig: body.sig });
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

  if (body.action === 'ringing') {
    if (call.calleeId !== s.me.id) return NextResponse.json({ error: 'غير مسموح' }, { status: 403 });
    return NextResponse.json({ state: ringingCall(call).state });
  }
  if (body.action === 'answer') {
    if (call.calleeId !== s.me.id) return NextResponse.json({ error: 'غير مسموح' }, { status: 403 });
    if (call.state !== 'ringing') return NextResponse.json({ error: 'انتهت المكالمة', state: call.state }, { status: 409 });
    const answer = String(body.answer || '');
    if (!answer.includes('v=0')) return NextResponse.json({ error: 'رد غير صالح' }, { status: 400 });
    return NextResponse.json({ state: answerCall(call, answer, { key: body.key, sig: body.sig }).state });
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
  if (body.action === 'restart') {
    const data = body.data && typeof body.data === 'object' ? body.data : null;
    if (!data || !['offer', 'answer', 'request'].includes(data.restart)) return NextResponse.json({ error: 'غير صالح' }, { status: 400 });
    if (call.state !== 'active') return NextResponse.json({ error: 'انتهت المكالمة', state: call.state }, { status: 409 });
    addIce(call, s.me.id, JSON.stringify({ restart: data.restart, sdp: typeof data.sdp === 'string' ? data.sdp : undefined }), 16_000);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
