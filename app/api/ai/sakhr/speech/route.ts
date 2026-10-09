import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireSession } from '@/lib/staff-gate';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/**
 * Text → natural Arabic speech for Sakhr's replies (Gemini TTS).
 * The page sends one sentence-sized chunk at a time and plays them in order.
 * GET tells the page whether server speech is available.
 */

const MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
const MAX_CHARS = 600;
const WINDOW_MS = 5 * 60 * 1000;
const CACHE_MAX = 120;

const hits = new Map<string, number[]>();
const cache = new Map<string, Buffer>(); // insertion order = LRU order

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t: number) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > max;
}

/** Raw 16-bit PCM (audio/L16) → playable WAV. */
function pcmToWav(pcm: Buffer, rate = 24000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function apiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || '';
}

export async function GET() {
  return NextResponse.json({ available: Boolean(apiKey()) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const key = apiKey();
  if (!key) return NextResponse.json({ error: 'الصوت غير مفعّل', code: 'NO_TTS' }, { status: 503 });

  const session = requireSession(req);
  const who = 'error' in session
    ? `ip:${resolveRequestIp({ forwarded: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), fallback: 'local' })}`
    : `user:${session.account.id}`;

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: 'لا يوجد نص' }, { status: 400 });

  const voice = process.env.SAKHR_VOICE?.trim() || 'Charon';
  const id = crypto.createHash('sha256').update(`${voice}|${text}`).digest('hex');
  const cached = cache.get(id);
  if (cached) {
    cache.delete(id);
    cache.set(id, cached);
    return new NextResponse(new Uint8Array(cached), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
  }

  // Only uncached audio counts against the limit (replays are free).
  if (limited(who, 'error' in session ? 25 : 120)) {
    return NextResponse.json({ error: 'طلبات صوت كثيرة — أعد المحاولة بعد قليل', code: 'BUSY' }, { status: 429 });
  }

  const ai = new GoogleGenAI({ apiKey: key });
  let lastStatus = 0;
  for (const model of MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        // Only the words to say: TTS models read any instruction aloud.
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          abortSignal: AbortSignal.timeout(25_000),
        },
      });
      const inline = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!inline?.data) continue;
      const raw = Buffer.from(inline.data, 'base64');
      const mime = String(inline.mimeType || '').toLowerCase();
      const rate = Number(mime.match(/rate=(\d+)/)?.[1]) || 24000;
      const wav = mime.includes('wav') ? raw : pcmToWav(raw, rate);
      cache.set(id, wav);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      return new NextResponse(new Uint8Array(wav), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=86400' } });
    } catch (error: any) {
      lastStatus = Number(error?.status) || 0;
      console.warn(`[sakhr] tts ${model} failed (${lastStatus || 'network'})`);
    }
  }
  return NextResponse.json(
    { error: lastStatus === 429 ? 'خدمة الصوت مشغولة الآن' : 'تعذّر إنشاء الصوت', code: lastStatus === 429 ? 'BUSY' : 'TTS_FAILED' },
    { status: lastStatus === 429 ? 429 : 502 }
  );
}
