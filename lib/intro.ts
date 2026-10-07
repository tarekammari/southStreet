'use client';

import { useEffect, useState } from 'react';
import { INTRO_DONE_EVENT, INTRO_SEEN_KEY } from '@/lib/intro-boot';

/** First-load choreography helpers; the boot script lives in lib/intro-boot.ts. */

export { INTRO_DONE_EVENT };

type IntroWindow = Window & { __ssIntro?: 'playing' | 'done' };

export function introIsDone(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as IntroWindow).__ssIntro !== 'playing';
}

export function finishIntro() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* private mode: the splash simply shows again next visit */
  }
  (window as IntroWindow).__ssIntro = 'done';
  window.dispatchEvent(new Event(INTRO_DONE_EVENT));
}

/** True once the splash has lifted — use it to start entrance animations. */
export function useIntroDone(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (introIsDone()) {
      setDone(true);
      return;
    }
    const onDone = () => setDone(true);
    window.addEventListener(INTRO_DONE_EVENT, onDone);
    return () => window.removeEventListener(INTRO_DONE_EVENT, onDone);
  }, []);
  return done;
}
