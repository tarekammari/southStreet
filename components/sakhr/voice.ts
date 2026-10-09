'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice for Sakhr.
 *  - Speak:  record a clip (MediaRecorder) → /api/ai/sakhr/transcribe (Whisper) → text.
 *            If the server has no speech service, the browser's own recognition is used.
 *  - Listen: replies are read with the browser's speech synthesis, only when an
 *            Arabic voice exists (an English voice reading Arabic is unusable).
 */

export type VoiceState = 'idle' | 'recording' | 'transcribing';

const MAX_SECONDS = 60;
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

function micError(err: unknown): string {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'اسمح للمتصفح باستعمال الميكروفون ثم أعد المحاولة.';
  if (name === 'NotFoundError') return 'لم يُعثر على ميكروفون في هذا الجهاز.';
  return 'تعذّر تشغيل الميكروفون.';
}

export function useVoiceRecorder({ onText, onError, onInterim }: { onText: (text: string) => void; onError: (message: string) => void; onInterim?: (text: string) => void }) {
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.1));
  const mode = useRef<'server' | 'browser'>('server');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const timer = useRef(0);
  const discard = useRef(false);
  const peak = useRef(0);
  const audioMeterRan = useRef(false);
  const recognition = useRef<BrowserRecognition | null>(null);
  const handlers = useRef({ onText, onError, onInterim });
  handlers.current = { onText, onError, onInterim };

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
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

  const startBrowser = useCallback(() => {
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
    };
    recognition.current = rec;
    discard.current = false;
    setSeconds(0);
    setState('recording');
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    rec.start();
  }, []);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    const canRecord = typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    if (mode.current === 'browser' || !canRecord) return startBrowser();
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
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        ctx.createMediaStreamSource(media).connect(analyser);
        audioCtx.current = ctx;
        audioMeterRan.current = true;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const step = Math.max(1, Math.floor(data.length / BARS));
          const next = Array.from({ length: BARS }, (_, i) => Math.max(0.1, Math.min(1, (data[i * step] || 0) / 200)));
          peak.current = Math.max(peak.current, ...next);
          setLevels(next);
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
    discard.current = !send;
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

/** True once the browser has an Arabic voice (voices load asynchronously). */
export function useArabicVoice(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const check = () => setOk(Boolean(arabicVoice()));
    check();
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', check);
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
    .trim()
    .slice(0, 900);
}

export function speak(text: string, onEnd?: () => void): boolean {
  const voice = arabicVoice();
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const clean = speakableText(text);
  if (!synth || !voice || !clean) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}
