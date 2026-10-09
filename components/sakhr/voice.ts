'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice for Sakhr.
 *  - Speak:  record a clip (MediaRecorder) → /api/ai/sakhr/transcribe (Whisper) → text.
 *            The clip ends by itself when the speaker stops talking (voice activity
 *            detection), so no button is needed. If the server has no speech service,
 *            the browser's own recognition is used.
 *  - Listen: replies are read with the browser's speech synthesis, only when an
 *            Arabic voice exists (an English voice reading Arabic is unusable).
 */

export type VoiceState = 'idle' | 'recording' | 'transcribing';

const MAX_SECONDS = 60;
/** Quiet time after speech that means "I finished talking". */
const END_SILENCE_MS = 1300;
/** Speech needed before a pause counts as the end (ignores clicks and breaths). */
const MIN_SPEECH_MS = 300;
/** Hands-free listening gives up when nobody speaks for this long. */
const NO_SPEECH_MS = 8000;
const BARS = 7;
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function browserRecognitionCtor(): (new () => BrowserRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function voiceInputSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const recorder = typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return recorder || !!browserRecognitionCtor();
}

// One audio context for the whole page. Browsers (iOS above all) only let it run
// after a tap, so it is woken on the first tap and reused when Sakhr listens again
// by itself in a hands-free conversation.
let sharedCtx: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume().catch(() => undefined);
  return sharedCtx;
}

function micError(err: unknown): string {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'اسمح للمتصفح باستعمال الميكروفون ثم أعد المحاولة.';
  if (name === 'NotFoundError') return 'لم يُعثر على ميكروفون في هذا الجهاز.';
  return 'تعذّر تشغيل الميكروفون.';
}

export function useVoiceRecorder({
  onText,
  onError,
  onInterim,
  onNoSpeech,
}: {
  onText: (text: string) => void;
  onError: (message: string) => void;
  onInterim?: (text: string) => void;
  /** Hands-free listening ended because nobody spoke. */
  onNoSpeech?: () => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.1));
  const mode = useRef<'server' | 'browser'>('server');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const raf = useRef(0);
  const timer = useRef(0);
  const discard = useRef<boolean | 'silent'>(false);
  const peak = useRef(0);
  const audioMeterRan = useRef(false);
  const recognition = useRef<BrowserRecognition | null>(null);
  const handlers = useRef({ onText, onError, onInterim, onNoSpeech });
  handlers.current = { onText, onError, onInterim, onNoSpeech };
  const finish = useRef<(send: boolean) => void>(() => undefined);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    source.current?.disconnect();
    source.current = null;
    setLevels(Array(BARS).fill(0.1));
  }, []);

  useEffect(() => () => {
    discard.current = true;
    try {
      recorder.current?.state === 'recording' && recorder.current.stop();
      recognition.current?.abort();
    } catch {
      /* already stopped */
    }
    cleanup();
  }, [cleanup]);

  const transcribe = useCallback(async (blob: Blob) => {
    setState('transcribing');
    try {
      const form = new FormData();
      form.append('audio', blob, `voice.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
      const res = await fetch('/api/ai/sakhr/transcribe', { method: 'POST', body: form, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        handlers.current.onText(String(data.text));
      } else if (data.code === 'NO_STT' && browserRecognitionCtor()) {
        // No server speech service: use the browser's recognition from now on.
        mode.current = 'browser';
        handlers.current.onError('اضغط على الميكروفون مرة أخرى وتكلّم — سيُكتب كلامك مباشرة.');
      } else {
        handlers.current.onError(data.error || 'تعذّر تحويل الصوت إلى نص.');
      }
    } catch {
      handlers.current.onError('تعذّر الاتصال بالخادم.');
    } finally {
      setState('idle');
    }
  }, []);

  const startBrowser = useCallback((auto = false) => {
    const Ctor = browserRecognitionCtor();
    if (!Ctor) return handlers.current.onError('التعرّف على الصوت غير مدعوم في هذا المتصفح.');
    const rec = new Ctor();
    rec.lang = 'ar-DZ';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const t = e.results[i][0]?.transcript || '';
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      handlers.current.onInterim?.(`${finalText}${interim}`);
    };
    rec.onerror = (e: any) => {
      if (e?.error !== 'aborted' && e?.error !== 'no-speech') handlers.current.onError(e?.error === 'not-allowed' ? micError({ name: 'NotAllowedError' }) : 'تعذّر التعرّف على الصوت.');
    };
    rec.onend = () => {
      window.clearInterval(timer.current);
      setState('idle');
      recognition.current = null;
      if (!discard.current && finalText.trim()) handlers.current.onText(finalText.trim());
      else if (!discard.current && auto) handlers.current.onNoSpeech?.();
    };
    recognition.current = rec;
    discard.current = false;
    setSeconds(0);
    setState('recording');
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    rec.start();
  }, []);

  /** auto = hands-free turn: silently gives up when nobody speaks. */
  const start = useCallback(async ({ auto = false }: { auto?: boolean } = {}) => {
    if (state !== 'idle') return;
    const canRecord = typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    if (mode.current === 'browser' || !canRecord) return startBrowser(auto);
    audioContext(); // wake it while this tap still counts
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = media;
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = new MediaRecorder(media, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      discard.current = false;
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || mimeType || 'audio/webm' });
        cleanup();
        if (discard.current === 'silent') {
          setState('idle');
          handlers.current.onNoSpeech?.();
          return;
        }
        if (discard.current || blob.size < 1200) {
          setState('idle');
          if (!discard.current) handlers.current.onError('التسجيل قصير جداً — اضغط وتكلّم ثم اضغط إرسال.');
          return;
        }
        // The meter never moved: nothing was said, so nothing is sent.
        if (audioMeterRan.current && peak.current < 0.18) {
          setState('idle');
          handlers.current.onError('لم يصل أي صوت — تأكد من الميكروفون وتكلّم بوضوح.');
          return;
        }
        void transcribe(blob);
      };
      recorder.current = rec;
      peak.current = 0;
      audioMeterRan.current = false;
      rec.start(250);

      // Live level meter for the recording bar.
      try {
        const ctx = audioContext();
        if (!ctx) throw new Error('no audio context');
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        const src = ctx.createMediaStreamSource(media);
        src.connect(analyser);
        source.current = src;
        audioMeterRan.current = true;
        const data = new Uint8Array(analyser.frequencyBinCount);

        // Voice activity: loudness against the room's own background noise.
        const vad = ctx.createAnalyser();
        vad.fftSize = 1024;
        src.connect(vad);
        const wave = new Uint8Array(vad.fftSize);
        const began = performance.now();
        let last = began;
        let floor = -1;
        let speechMs = 0;
        let heard = false;
        let lastVoice = began;
        let ended = false;

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const step = Math.max(1, Math.floor(data.length / BARS));
          const next = Array.from({ length: BARS }, (_, i) => Math.max(0.1, Math.min(1, (data[i * step] || 0) / 200)));
          peak.current = Math.max(peak.current, ...next);
          setLevels(next);

          const now = performance.now();
          const dt = now - last;
          last = now;
          vad.getByteTimeDomainData(wave);
          let sum = 0;
          for (let i = 0; i < wave.length; i += 1) {
            const v = (wave[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / wave.length);
          // The floor follows quiet moments quickly and loud ones very slowly.
          floor = floor < 0 ? Math.min(rms, 0.01) : rms < floor ? floor + (rms - floor) * 0.3 : floor + (rms - floor) * 0.002;
          const voiced = rms > Math.max(0.022, floor * 2.8);
          if (voiced) {
            speechMs += dt;
            lastVoice = now;
            if (speechMs >= MIN_SPEECH_MS) heard = true;
          }
          if (!ended && heard && now - lastVoice > END_SILENCE_MS) {
            ended = true;
            finish.current(true);
          } else if (!ended && auto && !heard && now - began > NO_SPEECH_MS) {
            ended = true;
            discard.current = 'silent';
            finish.current(false);
          }
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* meter is decoration only */
      }

      setSeconds(0);
      setState('recording');
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS && recorder.current?.state === 'recording') recorder.current.stop();
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      cleanup();
      setState('idle');
      handlers.current.onError(micError(err));
    }
  }, [cleanup, startBrowser, state, transcribe]);

  /** Finish and send (send=false throws the recording away). */
  const stop = useCallback((send = true) => {
    if (discard.current !== 'silent') discard.current = !send;
    window.clearInterval(timer.current);
    if (recognition.current) {
      send ? recognition.current.stop() : recognition.current.abort();
      return;
    }
    if (recorder.current?.state === 'recording') recorder.current.stop();
    else {
      cleanup();
      setState('idle');
    }
  }, [cleanup]);
  finish.current = stop;

  return { state, seconds, levels, start, stop };
}

/* ------------------------------------------------------------------ */
/* Reading replies aloud                                               */
/* ------------------------------------------------------------------ */

function arabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ar'));
  return voices.find((v) => /dz/i.test(v.lang)) || voices.find((v) => /google|natural|online/i.test(v.name)) || voices[0] || null;
}

/** null = not checked yet; the server voice (Gemini) works on every device. */
let serverVoice: boolean | null = null;
let serverCheck: Promise<boolean> | null = null;
function checkServerVoice(): Promise<boolean> {
  serverCheck ||= fetch('/api/ai/sakhr/speech', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => (serverVoice = Boolean(d?.available)))
    .catch(() => (serverVoice = false));
  return serverCheck;
}

/** True when replies can be read aloud: natural server voice, or an Arabic voice on the device. */
export function useArabicVoice(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => alive && setOk(Boolean(serverVoice) || Boolean(arabicVoice()));
    void checkServerVoice().then(check);
    check();
    window.speechSynthesis?.addEventListener?.('voiceschanged', check);
    return () => {
      alive = false;
      window.speechSynthesis?.removeEventListener?.('voiceschanged', check);
    };
  }, []);
  return ok;
}

/** Plain speakable text: no markdown, tables, links or emoji. */
export function speakableText(markdown: string): string {
  return markdown
    .split('\n')
    .filter((l) => !/^\s*\|/.test(l))
    .join('. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`>|]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/(\s*\.\s*){2,}/g, '. ')
    .trim()
    .slice(0, 1500);
}

/** Sentence-sized pieces; the first is short so speech starts quickly. */
function chunksOf(text: string): string[] {
  const sentences = text.split(/(?<=[.!?؟،؛])\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    const limit = out.length === 0 ? 140 : 320;
    if (cur && (cur + ' ' + s).length > limit) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > 560 ? c.match(/.{1,560}(\s|$)/g) || [c] : [c])).map((c) => c.trim()).filter(Boolean);
}

// One shared <audio>: unlocked on a tap, it may then play later (iOS rule).
let player: HTMLAudioElement | null = null;
let session = 0;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
  }
  return player;
}

/** Call from a tap (mic / send / speaker button) so a reply arriving later can be played. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  audioContext();
  const p = getPlayer();
  if (p.src && !p.paused) return;
  p.src = SILENT_WAV;
  p.play().catch(() => undefined);
}

function browserSpeak(clean: string, mine: number, onEnd?: () => void): boolean {
  const voice = arabicVoice();
  const synth = window.speechSynthesis;
  if (!synth || !voice) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.voice = voice;
  u.lang = voice.lang;
  // A cancel (stopSpeaking / a newer reply) is not "finished speaking".
  u.onend = () => mine === session && onEnd?.();
  u.onerror = () => mine === session && onEnd?.();
  synth.speak(u);
  return true;
}

async function fetchChunk(text: string): Promise<Blob> {
  const res = await fetch('/api/ai/sakhr/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.blob();
}

function playBlob(blob: Blob, mine: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (mine !== session) return resolve();
    const p = getPlayer();
    const url = URL.createObjectURL(blob);
    const done = (fn: () => void) => () => {
      p.onended = null;
      p.onerror = null;
      URL.revokeObjectURL(url);
      fn();
    };
    p.onended = done(resolve);
    p.onerror = done(() => reject(new Error('play')));
    p.src = url;
    p.play().catch(done(() => reject(new Error('blocked'))));
  });
}

/**
 * Read a reply aloud with the natural Arabic server voice: chunk by chunk, the
 * next chunk is prepared while the current one plays. Falls back to the device
 * voice when the server voice is unavailable. Returns false if nothing can speak.
 */
export function speak(text: string, onEnd?: () => void): boolean {
  if (typeof window === 'undefined') return false;
  const clean = speakableText(text);
  if (!clean) return false;
  stopSpeaking();
  const mine = ++session;
  if (serverVoice === false) return browserSpeak(clean, mine, onEnd);

  const parts = chunksOf(clean);
  void (async () => {
    let next: Promise<Blob> | null = fetchChunk(parts[0]);
    for (let i = 0; i < parts.length; i += 1) {
      if (mine !== session) return;
      let blob: Blob;
      try {
        blob = await next!;
      } catch {
        // Server voice failed: finish with the device voice when there is one.
        if (mine === session && !browserSpeak(parts.slice(i).join(' '), mine, onEnd)) onEnd?.();
        return;
      }
      next = i + 1 < parts.length ? fetchChunk(parts[i + 1]) : null;
      next?.catch(() => undefined);
      try {
        await playBlob(blob, mine);
      } catch {
        if (mine === session) onEnd?.();
        return;
      }
    }
    if (mine === session) onEnd?.();
  })();
  return true;
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return;
  session += 1;
  window.speechSynthesis?.cancel();
  if (player) {
    player.pause();
    player.removeAttribute('src');
  }
}
