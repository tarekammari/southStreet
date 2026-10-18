import crypto from 'crypto';
import { spawn } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { requireSession } from '@/lib/staff-gate';
import { resolveRequestIp } from '@/lib/security-threats';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Text → natural Arabic speech for Sakhr's replies. The page sends one
 * sentence-sized chunk at a time and plays them in order.
 *
 * Speed first:
 *  - Groq's Arabic voice (canopylabs/orpheus-arabic-saudi) when the account has
 *    it (very fast), then Gemini TTS models;
 *  - a model that is out of quota (429) or too slow is skipped for a while
 *    instead of being retried on every sentence; when every voice is resting
 *    the page is told at once (code BUSY) and reads with the device voice;
 *  - audio goes out as MP3 (ffmpeg), about 10× smaller than WAV on mobile data.
 * GET tells the page whether server speech is available.
 */

type Provider = { id: string; kind: 'groq' | 'gemini'; model: string };

const GEMINI_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
const GROQ_TTS_MODEL = 'canopylabs/orpheus-arabic-saudi';
const MAX_CHARS = 600;
const WINDOW_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;
/** One sentence must not hold the conversation: give up and let the next voice (or the device) speak. */
const CALL_TIMEOUT_MS = 9_000;

const g = globalThis as unknown as {
  __ssTtsHits?: Map<string, number[]>;
  __ssTtsCache?: Map<string, { audio: Buffer; type: string }>;
  __ssTtsRest?: Map<string, { until: number; strikes: number }>;
};
const hits = (g.__ssTtsHits ||= new Map());
const cache = (g.__ssTtsCache ||= new Map()); // insertion order = LRU order
/** Voices resting after a quota error / timeout, with a growing pause for repeat offenders. */
const resting = (g.__ssTtsRest ||= new Map());

function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t: number) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t: number) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > max;
}

function rest(id: string, baseMs: number) {
  const prev = resting.get(id);
  const strikes = prev && prev.until > Date.now() - 10 * 60_000 ? prev.strikes + 1 : 1;
  // 1, 2, 4 … up to 30 minutes: a daily quota that is used up stays skipped.
  resting.set(id, { until: Date.now() + Math.min(baseMs * 2 ** (strikes - 1), 30 * 60_000), strikes });
}
const isResting = (id: string) => (resting.get(id)?.until || 0) > Date.now();

function geminiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || '';
}
function groqKey(): string {
  return process.env.GROQ_API_KEY?.trim() || '';
}

function providers(): Provider[] {
  const list: Provider[] = [];
  if (groqKey() && process.env.SAKHR_GROQ_TTS !== 'off') list.push({ id: 'groq', kind: 'groq', model: GROQ_TTS_MODEL });
  if (geminiKey()) for (const model of GEMINI_MODELS) list.push({ id: `gemini:${model}`, kind: 'gemini', model });
  return list;
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

let ffmpegMissing = false;
/** WAV → MP3 (mono, 48 kb/s). Falls back to the WAV when ffmpeg is not installed. */
function toMp3(wav: Buffer): Promise<{ audio: Buffer; type: string }> {
  if (ffmpegMissing) return Promise.resolve({ audio: wav, type: 'audio/wav' });
  return new Promise((resolve) => {
    const out: Buffer[] = [];
    let settled = false;
    const done = (r: { audio: Buffer; type: string }) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', '-f', 'mp3', 'pipe:1']);
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      done({ audio: wav, type: 'audio/wav' });
    }, 5000);
    proc.stdout.on('data', (d: Buffer) => out.push(d));
    proc.on('error', () => {
      ffmpegMissing = true;
      clearTimeout(timer);
      done({ audio: wav, type: 'audio/wav' });
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const mp3 = Buffer.concat(out);
      done(code === 0 && mp3.length > 0 ? { audio: mp3, type: 'audio/mpeg' } : { audio: wav, type: 'audio/wav' });
    });
    proc.stdin.on('error', () => undefined);
    proc.stdin.end(wav);
  });
}

class TtsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function groqSpeech(text: string): Promise<Buffer> {
  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: GROQ_TTS_MODEL, input: text, voice: process.env.SAKHR_GROQ_VOICE?.trim() || 'fahad', response_format: 'wav' }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new TtsError(res.status, detail.slice(0, 200));
  }
  return Buffer.from(await res.arrayBuffer());
}

async function geminiSpeech(model: string, text: string, voice: string): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: geminiKey() });
  const result = await ai.models.generateContent({
    model,
    // Only the words to say: TTS models read any instruction aloud.
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    },
  });
  const inline = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) throw new TtsError(502, 'no audio');
  const raw = Buffer.from(inline.data, 'base64');
  const mime = String(inline.mimeType || '').toLowerCase();
  const rate = Number(mime.match(/rate=(\d+)/)?.[1]) || 24000;
  return mime.includes('wav') ? raw : pcmToWav(raw, rate);
}

export async function GET() {
  const list = providers();
  return NextResponse.json(
    { available: list.length > 0, resting: list.length > 0 && list.every((p) => isResting(p.id)) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const list = providers();
  if (!list.length) return NextResponse.json({ error: 'الصوت غير مفعّل', code: 'NO_TTS' }, { status: 503 });

  const session = requireSession(req);
  const who = 'error' in session
    ? `ip:${resolveRequestIp({ forwarded: req.headers.get('x-forwarded-for'), realIp: req.headers.get('x-real-ip'), fallback: 'local' })}`
    : `user:${session.account.id}`;

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: 'لا يوجد نص' }, { status: 400 });

  const voice = process.env.SAKHR_VOICE?.trim() || 'Charon';
  const id = crypto.createHash('sha256').update(`${voice}|${text}`).digest('hex');
  const headers = (type: string) => ({ 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
  const cached = cache.get(id);
  if (cached) {
    cache.delete(id);
    cache.set(id, cached);
    return new NextResponse(new Uint8Array(cached.audio), { headers: headers(cached.type) });
  }

  // Only uncached audio counts against the limit (replays are free).
  if (limited(who, 'error' in session ? 40 : 160)) {
    return NextResponse.json({ error: 'طلبات صوت كثيرة — أعد المحاولة بعد قليل', code: 'BUSY' }, { status: 429 });
  }

  const ready = list.filter((p) => !isResting(p.id));
  if (!ready.length) return NextResponse.json({ error: 'خدمة الصوت مشغولة الآن', code: 'BUSY' }, { status: 429 });

  for (const p of ready) {
    const started = Date.now();
    try {
      const wav = p.kind === 'groq' ? await groqSpeech(text) : await geminiSpeech(p.model, text, voice);
      const out = await toMp3(wav);
      cache.set(id, out);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
      return new NextResponse(new Uint8Array(out.audio), { headers: { ...headers(out.type), 'X-Voice': p.id, 'X-Voice-Ms': String(Date.now() - started) } });
    } catch (error: any) {
      const status = Number(error?.status) || 0;
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      // Out of quota or not enabled for this account (e.g. terms not accepted): rest it.
      if (status === 429) rest(p.id, 60_000);
      else if (status === 400 || status === 401 || status === 403 || status === 404) rest(p.id, 30 * 60_000);
      else if (timedOut || status >= 500) rest(p.id, 30_000);
      console.warn(`[sakhr] tts ${p.id} failed (${status || (timedOut ? 'timeout' : 'network')}) after ${Date.now() - started} ms`);
    }
  }
  return NextResponse.json({ error: 'خدمة الصوت مشغولة الآن', code: 'BUSY' }, { status: 429 });
}
