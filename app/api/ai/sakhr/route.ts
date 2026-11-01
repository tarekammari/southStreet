import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/staff-gate';
import { toolGetAgencySettings } from '@/lib/ai-tools';
import { resolveRequestIp } from '@/lib/security-threats';
import { runSakhr, SakhrNotConfiguredError, type AgentReply, type ChatTurn } from '@/lib/sakhr/agent';
import { cacheGet, cacheSet, normalizeQuestion, PUBLIC_TOOLS, recordMetric, SakhrBusyError, withSlot } from '@/lib/sakhr/capacity';
import type { Who } from '@/lib/sakhr/tools';
import { getBrand } from '@/lib/brand-server';

/**
 * Sakhr chat endpoint. Works for visitors (public tools only) and for every
 * signed-in role (tools matching that role). Changes are never made here —
 * they come back as confirmation cards handled by ./action.
 * Capacity (lib/sakhr/capacity.ts): one message per user at a time and a fair
 * queue for everyone; visitors' common first questions are answered from a
 * 5-minute cache; every answer is measured (npm run sakhr:stats).
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
  // Spoken question: short spoken answer (read aloud at once).
  const voice = body.voice === true;
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

  // A visitor's opening question ("which programmes are open?") is the same for everyone.
  const cacheKey = role === 'ANON' && history.length === 0 ? `anon:${voice ? 'v:' : ''}${normalizeQuestion(message)}` : null;
  if (cacheKey) {
    const hit = cacheGet<Omit<AgentReply, 'meta'>>(cacheKey);
    if (hit) {
      recordMetric({ role, provider: 'cache', ms: 0, tokens: 0, rounds: 0, tools: [], cached: true, ok: true });
      return NextResponse.json({ ...hit, role });
    }
  }

  const agency = toolGetAgencySettings();
  const started = Date.now();
  try {
    const userKey = signedIn ? `u:${session.account.id}` : `ip:${ip}`;
    const result = await withSlot(userKey, () => runSakhr({
      ctx: { req, role, userId: signedIn ? session.account.id : undefined },
      userName: signedIn ? session.account.name : undefined,
      agency: {
        name: agency.agency_name || getBrand().agency_name,
        phone: agency.phone,
        email: agency.email,
        address: [agency.address, agency.city].filter(Boolean).join('، '),
      },
      history,
      message,
      voice,
    }));
    const { meta, ...reply } = result;
    recordMetric({
      role,
      provider: meta?.provider || 'unknown',
      ms: Date.now() - started,
      tokens: meta?.tokens || 0,
      rounds: meta?.rounds || 0,
      tools: meta?.tools || [],
      cached: false,
      ok: true,
    });
    if (cacheKey && reply.reply && !reply.actions.length && !reply.clientActions.length && (meta?.tools || []).every((t) => PUBLIC_TOOLS.has(t))) {
      cacheSet(cacheKey, reply);
    }
    return NextResponse.json({ ...reply, role });
  } catch (error: any) {
    if (error instanceof SakhrBusyError) {
      return NextResponse.json(
        {
          error:
            error.reason === 'same-user'
              ? `${getBrand().assistant_name || 'صخر'} ما زال يجيب على رسالتك السابقة، لحظة من فضلك…`
              : `${getBrand().assistant_name || 'صخر'} يخدم عدداً كبيراً من الزوار الآن. لحظة من فضلك ثم أعد الإرسال.`,
          busy: true,
        },
        { status: error.reason === 'same-user' ? 429 : 503 }
      );
    }
    recordMetric({ role, provider: 'failed', ms: Date.now() - started, tokens: 0, rounds: 0, tools: [], cached: false, ok: false });
    if (error instanceof SakhrNotConfiguredError) {
      return NextResponse.json(
        { error: `${getBrand().assistant_name || 'صخر'} غير مُفعَّل بعد: يلزم إضافة مفتاح GROQ_API_KEY أو GEMINI_API_KEY في إعدادات الخادم.` },
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
    return NextResponse.json({ error: `تعذّر على ${getBrand().assistant_name || 'صخر'} الرد الآن. أعد المحاولة بعد لحظات.` }, { status: 502 });
  }
}
