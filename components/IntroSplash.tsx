'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { finishIntro, introIsDone } from '@/lib/intro';

const MIN_MS = 1100;
const MAX_MS = 2400;
const LEAVE_MS = 650;

// Decide before paint so a repeat visit never flashes the splash.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Branded first-load splash, once per browser session. Server-rendered so it
 * covers the page from the first paint; the boot script hides it before paint
 * on repeat loads, print pages and for reduced motion.
 */
export default function IntroSplash() {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show');

  useBeforePaint(() => {
    if (introIsDone()) {
      setPhase('gone');
      return;
    }
    const started = performance.now();
    let leaveTimer = 0;
    let goneTimer = 0;

    const leave = () => {
      if (leaveTimer) return;
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      leaveTimer = window.setTimeout(() => {
        setPhase('leaving');
        finishIntro();
        goneTimer = window.setTimeout(() => setPhase('gone'), LEAVE_MS);
      }, wait);
    };

    if (document.readyState === 'complete') leave();
    else window.addEventListener('load', leave, { once: true });
    const cap = window.setTimeout(leave, MAX_MS);

    return () => {
      window.removeEventListener('load', leave);
      window.clearTimeout(cap);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(goneTimer);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      className={`intro-splash${phase === 'leaving' ? ' is-leaving' : ''}`}
      role="presentation"
      aria-hidden
      onClick={() => {
        if (phase !== 'show') return;
        setPhase('leaving');
        finishIntro();
        window.setTimeout(() => setPhase('gone'), LEAVE_MS);
      }}
    >
      <div className="intro-splash-glow" />
      <div className="intro-splash-center">
        <div className="intro-splash-logo"><BrandLogo /></div>
        <p className="intro-splash-tag">رحلتك إلى الحرمين تبدأ من هنا</p>
        <span className="intro-splash-bar"><i /></span>
      </div>
    </div>
  );
}
