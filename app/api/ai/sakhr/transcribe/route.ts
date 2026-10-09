import { NextRequest, NextResponse } from 'next/server';
import Groq, { toFile } from 'groq-sdk';
import { requireSession } from '@/lib/staff-gate';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Voice → text for Sakhr (Whisper on Groq). The browser records a short clip
 * and posts it here; the text comes back and is sent as a normal message.
 * Without GROQ_API_KEY it answers 503 / NO_STT and the page falls back to the
 * browser's own speech recognition.
 */

const MAX_BYTES = 8 * 1024 * 1024; // ~1 minute of compressed speech is far below this
const TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/aac'];
const WINDOW_MS = 5 * 60 * 1000;

/** Phrases Whisper is known to invent from silence or noise (subtitle credits, sign-offs). */
const HALLUCINATIONS = [
  /^(so|you|thank you\.?|thanks for watching!?|bye\.?|\.+|\?+)$/i,
  /ترجمة\s+نانسي/,
  /اشتركوا?\s+في\s+القناة/,
  /شكرا\s+(لكم\s+)?(على\s+)?(ل)?المشاهدة/,
  /^(sous-titr|sous-titres)/i,
];
const hits = new Map<string, number[]>();

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t: number) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > max;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'التحويل الصوتي غير مفعّل', code: 'NO_STT' }, { status: 503 });

  const session = requireSession(req);
  const who = 'error' in session
    ? `ip:${resolveRequestIp({ forwarded: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), fallback: 'local' })}`
    : `user:${session.account.id}`;
  if (limited(who, 'error' in session ? 15 : 60)) {
    return NextResponse.json({ error: 'رسائل صوتية كثيرة — أعد المحاولة بعد قليل' }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: 'لم يصل أي تسجيل' }, { status: 400 });
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: 'التسجيل طويل جداً' }, { status: 413 });
    const type = (audio.type || '').split(';')[0].toLowerCase();
    if (type && !TYPES.includes(type)) return NextResponse.json({ error: 'صيغة صوت غير مدعومة' }, { status: 415 });

    const ext = type.includes('mp4') || type.includes('m4a') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : type.includes('mpeg') || type.includes('mp3') ? 'mp3' : 'webm';
    const groq = new Groq({ apiKey, timeout: 20_000, maxRetries: 1 });
    const result = await groq.audio.transcriptions.create({
      file: await toFile(Buffer.from(await audio.arrayBuffer()), `voice.${ext}`),
      model: 'whisper-large-v3-turbo',
      // No prompt: a context hint in one language makes Whisper repeat it when the
      // speaker uses another (Algerians mix Arabic, Darija and French).
      // verbose_json carries Whisper's own "was there speech?" estimate per segment.
      response_format: 'verbose_json',
      temperature: 0,
    });
    const verbose = result as { text?: string; segments?: { no_speech_prob?: number; avg_logprob?: number }[] };
    const text = String(verbose.text || '').trim();
    const segments = verbose.segments || [];
    const noSpeech = segments.length > 0 && segments.every((seg) => (seg.no_speech_prob ?? 0) > 0.6 || (seg.avg_logprob ?? 0) < -1.2);
    if (!text || noSpeech || HALLUCINATIONS.some((re) => re.test(text))) {
      return NextResponse.json({ error: 'لم أسمع كلاماً واضحاً — اقترب من الميكروفون وأعد المحاولة', code: 'NO_SPEECH' }, { status: 422 });
    }
    return NextResponse.json({ text: text.slice(0, 2000) });
  } catch (error: any) {
    const status = Number(error?.status) || 0;
    console.error('[sakhr] transcribe failed', status, String(error?.message || '').slice(0, 200));
    return NextResponse.json(
      { error: status === 429 ? 'خدمة الصوت مشغولة — أعد المحاولة بعد دقيقة' : 'تعذّر تحويل الصوت إلى نص', code: status === 429 ? 'BUSY' : 'STT_FAILED' },
      { status: status === 429 ? 429 : 502 }
    );
  }
}
