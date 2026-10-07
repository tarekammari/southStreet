import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { toolGetAgencySettings } from '@/lib/ai-tools';
import { resolveRequestIp } from '@/lib/security-threats';
import { runSakhr, SakhrNotConfiguredError, type ChatTurn } from '@/lib/sakhr/agent';
import type { Who } from '@/lib/sakhr/tools';

/**
 * Sakhr chat endpoint. Works for visitors (public tools only) and for every
 * signed-in role (tools matching that role). Changes are never made here —
 * they come back as confirmation cards handled by ./action.
 */

export const dynamic = 'force-dynamic';
// Gemini + a few tool rounds; Vercel Hobby allows up to 60 s.
export const maxDuration = 60;

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 16;
const WINDOW_MS = 5 * 60 * 1000;
const LIMITS = { ANON: 15, SIGNED_IN: 60 };

const g = globalThis as unknown as { __ssSakhrRate?: Map<string, number[]> };
const hits = (g.__ssSakhrRate ||= new Map());

function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t: number) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE);
  if (!message) return NextResponse.json({ error: 'اكتب رسالتك أولاً' }, { status: 400 });

  const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
    .slice(-MAX_HISTORY)
    .map((t: any) => ({ role: t?.role === 'model' ? 'model' : 'user', text: String(t?.text || '').slice(0, MAX_MESSAGE) }))
    .filter((t: ChatTurn) => t.text);

  // Visitors get the public tools; an expired or key-less admin session is treated as a visitor.
  const session = requireSession(req);
  const signedIn = !('error' in session);
  const role: Who = signedIn ? session.role : 'ANON';

  const ip = resolveRequestIp({
    forwarded: req.headers.get('x-forwarded-for'),
    realIp: req.headers.get('x-real-ip'),
    fallback: '127.0.0.1',
  });
  if (rateLimited(signedIn ? `u:${session.account.id}` : `ip:${ip}`, signedIn ? LIMITS.SIGNED_IN : LIMITS.ANON)) {
    return NextResponse.json({ error: 'رسائل كثيرة في وقت قصير. انتظر قليلاً ثم أعد المحاولة.' }, { status: 429 });
  }

  const agency = toolGetAgencySettings();
  try {
    const result = await runSakhr({
      ctx: { req, role, userId: signedIn ? session.account.id : undefined },
      userName: signedIn ? session.account.name : undefined,
      agency: {
        name: agency.agency_name || 'ساوث ستريت للأسفار والعمرة',
        phone: agency.phone,
        email: agency.email,
        address: [agency.address, agency.city].filter(Boolean).join('، '),
      },
      history,
      message,
    });
    return NextResponse.json({ ...result, role });
  } catch (error: any) {
    if (error instanceof SakhrNotConfiguredError) {
      return NextResponse.json(
        { error: 'صخر غير مُفعَّل بعد: يلزم إضافة مفتاح GROQ_API_KEY أو GEMINI_API_KEY في إعدادات الخادم.' },
        { status: 503 }
      );
    }
    const status = Number(error?.status || error?.code) || 0;
    console.error('[sakhr] chat failed', status, error?.message);
    if (status === 429) {
      return NextResponse.json({ error: 'ضغط كبير على خدمة الذكاء الاصطناعي الآن. أعد المحاولة بعد دقيقة.' }, { status: 429 });
    }
    if (status === 503 || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return NextResponse.json({ error: 'خدمة الذكاء الاصطناعي مزدحمة الآن. أعد المحاولة بعد لحظات.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'تعذّر على صخر الرد الآن. أعد المحاولة بعد لحظات.' }, { status: 502 });
  }
}
