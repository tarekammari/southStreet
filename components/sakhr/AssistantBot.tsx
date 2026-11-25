'use client';

import React, { useEffect, useRef } from 'react';

export type BotMood = 'idle' | 'listening' | 'thinking' | 'talking';

/**
 * The assistant's face: a small white robot head whose eyes follow the pointer,
 * blink, and change with what the assistant is doing (same design as Aaref on
 * 1zayd1.tech). Styles: `.abot*` in app/globals.css.
 */
export default function AssistantBot({ size = 56, mood = 'idle', follow = true }: { size?: number; mood?: BotMood; follow?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!follow) return;
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 240);
      el.style.setProperty('--px', ((dx / d) * 0.1 * reach).toFixed(3));
      el.style.setProperty('--py', ((dy / d) * 0.1 * reach + 0.02).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [follow]);

  return (
    <span ref={ref} className={`abot is-${mood}`} aria-hidden="true" style={{ ['--s' as string]: `${size}px` }}>
      <span className="abot-head">
        <span className="abot-face">
          <span className="abot-eyes">
            <i className="abot-eye is-l" />
            <i className="abot-eye is-r" />
          </span>
        </span>
      </span>
    </span>
  );
}
