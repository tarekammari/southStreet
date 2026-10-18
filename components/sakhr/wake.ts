'use client';

import { useEffect, useRef } from 'react';

/**
 * «نداء صخر» — start a voice conversation by saying «مرحبا صخر» / «اسمع صخر» /
 * «يا صخر», end it with «خلاص صخر» / «stop صخر».
 *
 * Wake listening uses the browser's own speech recognition (Chrome, Edge,
 * Android, Safari 14.5+), only after the user switches it on and only while
 * the page is open and visible. It pauses during the conversation itself
 * (which records and transcribes as usual) and resumes afterwards.
 */

const DIACRITICS = /[ً-ْٰـ]/g;

/** Lower-case, no diacritics, one spelling for alef / taa marbuta / yaa, no punctuation. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// «صخر» is sometimes heard as «صقر» / «سخر»: those count only after a greeting.
const NAME = '(?:صخر|sakhr|sakher|sakhar|saker|sakar)';
const NAME_LOOSE = '(?:صخر|صقر|سخر|ساخر|sakhr|sakher|sakhar|saker|sakar)';
const GREETING = '(?:مرحبا|مرحبه|مرحبتين|مرحب|اسمع|اسمعني|يا|ياا|هاي|هلا|اهلا|اهلين|السلام عليكم|سلام عليكم|سلام|صباح الخير|مساء الخير|hey|hi|hello|ok|okay|اوكي)';
const WAKE = new RegExp(`(?:^|\\s)(?:${GREETING}\\s+${NAME_LOOSE}|${NAME})(?=\\s|$)`, 'u');
const STOP_WORDS = /(?:^|\s)(?:خلاص|خلص|ستوب|stop|وقف|اوقف|توقف|كفى|كفايه|يكفي|باي|bye|اسكت|سكت|بسلامه|مع السلامه|يعطيك الصحه|شكرا|thanks|merci)(?=\s|$)/u;
const HAS_NAME = new RegExp(`(?:^|\\s)${NAME_LOOSE}(?=\\s|$)`, 'u');

/** «مرحبا صخر …»: woken, with whatever was said after the wake phrase. */
export function matchWake(text: string): { rest: string } | null {
  const t = normalizeSpeech(text);
  const m = t.match(WAKE);
  if (!m || m.index === undefined) return null;
  return { rest: t.slice(m.index + m[0].length).trim() };
}

/** «خلاص صخر» / «stop sakhr» / just «خلاص» — a short utterance that ends the conversation. */
export function isStopCommand(text: string): boolean {
  const t = normalizeSpeech(text);
  const words = t.split(' ').filter(Boolean);
  if (!words.length || words.length > 4 || !STOP_WORDS.test(t)) return false;
  return HAS_NAME.test(t) || words.length <= 2;
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function wakeSupported(): boolean {
  return Boolean(recognitionCtor());
}

/**
 * Listens for the wake phrase while `active`. `onWake(rest)` gets what was said
 * after it («مرحبا صخر ما هي البرامج» → «ما هي البرامج»), once the speaker pauses.
 */
export function useWakeWord({
  active,
  onWake,
  onDenied,
}: {
  active: boolean;
  onWake: (rest: string) => void;
  /** The microphone was refused: the caller switches the mode off. */
  onDenied: () => void;
}) {
  const handlers = useRef({ onWake, onDenied });
  handlers.current = { onWake, onDenied };

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!active || !Ctor) return;
    let alive = true;
    let rec: Recognition | null = null;
    let restartTimer = 0;
    let fireTimer = 0;
    let quickEnds = 0;
    let startedAt = 0;

    const fire = (rest: string) => {
      if (!alive) return;
      alive = false; // one wake per listening session; the caller pauses us now
      window.clearTimeout(fireTimer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      // Give the microphone back before the conversation opens its own.
      window.setTimeout(() => handlers.current.onWake(rest), 300);
    };

    const start = () => {
      if (!alive || document.visibilityState !== 'visible') return;
      const r = new Ctor();
      r.lang = 'ar-DZ';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e: any) => {
        let text = '';
        let final = false;
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          text += e.results[i][0]?.transcript || '';
          if (e.results[i].isFinal) final = true;
        }
        const woke = matchWake(text);
        if (!woke) return;
        // Wait for the end of the sentence: «مرحبا صخر، ما هي البرامج؟» is one request.
        window.clearTimeout(fireTimer);
        if (final) fire(woke.rest);
        else fireTimer = window.setTimeout(() => fire(woke.rest), 900);
      };
      r.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          alive = false;
          handlers.current.onDenied();
        }
      };
      r.onend = () => {
        rec = null;
        if (!alive) return;
        // Browsers end recognition after a silence: start again (slower if it keeps failing).
        quickEnds = Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
        restartTimer = window.setTimeout(start, quickEnds > 4 ? 5000 : 250);
      };
      rec = r;
      startedAt = Date.now();
      try {
        r.start();
      } catch {
        restartTimer = window.setTimeout(start, 1000);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!rec && alive) start();
      } else {
        try {
          rec?.abort();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      alive = false;
      window.clearTimeout(restartTimer);
      window.clearTimeout(fireTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [active]);
}
