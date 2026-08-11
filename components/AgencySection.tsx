'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

const SECTION2_IMAGES = [
  '/images/section2_01.png',
  '/images/section2_02.png',
  '/images/section2_03.png',
  '/images/section2_04.png',
  '/images/section2_05.png',
  '/images/section2_06.png',
  '/images/section2_07.png',
  '/images/section2_08.png',
  '/images/section2_09.png',
  '/images/section2_10.png',
];

const SERVICES = [
  { icon: '✈️', title: 'طيران مباشر', desc: 'من الجزائر، وهران وعنابة مباشرةً' },
  { icon: '🏨', title: 'إقامة فاخرة', desc: '50م – 600م من صحن الحرم الشريف' },
  { icon: '🛡️', title: 'ضمان شامل', desc: 'حجز موثق ودعم طوال مدة الرحلة' },
  { icon: '📑', title: 'تأشيرة وإجراءات', desc: 'نتكفل بكل الإجراءات الرسمية' },
];

export default function AgencySection() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => advance(1), 5500);
  }, []);

  const advance = useCallback((dir: 1 | -1) => {
    if (animating) return;
    setAnimating(true);
    setPrev(current);
    const next = (current + dir + SECTION2_IMAGES.length) % SECTION2_IMAGES.length;
    setCurrent(next);
    setTimeout(() => { setPrev(null); setAnimating(false); }, 800);
  }, [animating, current]);

  useEffect(() => { startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [startTimer]);

  const goTo = (idx: number) => {
    if (idx === current || animating) return;
    setAnimating(true);
    setPrev(current);
    setCurrent(idx);
    setTimeout(() => { setPrev(null); setAnimating(false); }, 800);
    startTimer();
  };

  return (
    <section className="relative w-full overflow-hidden" style={{ height: '95vh', minHeight: 620 }}>

      {/* ── Background images with smooth Ken-Burns crossfade ── */}
      {SECTION2_IMAGES.map((src, i) => {
        const isActive  = i === current;
        const isLeaving = i === prev;
        return (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${src})`,
              opacity: isActive ? 1 : isLeaving ? 0 : 0,
              transform: isActive ? 'scale(1.03)' : 'scale(1)',
              transition: isActive
                ? 'opacity 0.9s ease, transform 8s ease'
                : isLeaving
                ? 'opacity 0.9s ease'
                : 'none',
              zIndex: isActive ? 2 : isLeaving ? 1 : 0,
            }}
          />
        );
      })}

      {/* ── Lighter directional overlay — right side darker, left lighter ── */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: `
            linear-gradient(to bottom, rgba(4,6,18,0.55) 0%, rgba(4,6,18,0.25) 40%, rgba(4,6,18,0.55) 100%),
            linear-gradient(to left,   rgba(4,6,18,0.70) 0%, rgba(4,6,18,0.15) 60%, transparent 100%)
          `,
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-20 h-full flex flex-col justify-center px-10 md:px-16 lg:px-24 max-w-7xl mr-auto gap-8">

        {/* Logo — large and prominent */}
        <div className="flex flex-col items-end gap-1">
          <img
            src="/images/south_street_logo_white_white.png"
            alt="South Street"
            className="w-40 md:w-56 lg:w-64 h-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          />
          {/* Underline accent */}
          <div className="w-16 h-0.5 bg-blue-400 rounded-full mt-1" />
        </div>

        {/* Tagline pill */}
        <div className="inline-flex items-center gap-2 self-end">
          <span className="w-5 h-px bg-blue-400/70" />
          <span
            className="text-blue-300 text-xs tracking-[0.22em] uppercase"
            style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}
          >
            وكالة الرحلات والعمرة والحج
          </span>
        </div>

        {/* Main heading */}
        <div className="space-y-3 max-w-xl text-right">
          <h2
            className="text-white leading-tight"
            style={{
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
              letterSpacing: '-0.01em',
            }}
          >
            نُرافقك في كل خطوة
            <br />
            <span style={{ color: '#60a5fa' }}>نحو البيت الحرام</span>
          </h2>

          <p
            className="text-white/80 leading-relaxed max-w-md"
            style={{
              fontFamily: 'Tajawal, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(0.875rem, 1.5vw, 1.05rem)',
            }}
          >
            وكالة سوث ستريت — متخصصة في تنظيم رحلات العمرة والحج من الجزائر،
            بأعلى معايير الجودة والراحة من الطيران حتى الإقامة الفاخرة بجوار الحرم الشريف.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
          {SERVICES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-4 text-right transition-all duration-300 hover:scale-[1.04] hover:border-white/25 cursor-default"
              style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <span className="text-2xl block mb-2 leading-none">{icon}</span>
              <p
                className="text-white mb-1"
                style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}
              >
                {title}
              </p>
              <p
                className="text-white/60"
                style={{ fontFamily: 'Tajawal, sans-serif', fontWeight: 400, fontSize: '0.72rem', lineHeight: 1.5 }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Slide controls ── */}
      {/* Prev arrow */}
      <button
        onClick={() => { advance(-1); startTimer(); }}
        className="absolute left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full flex items-center justify-center text-white text-xl transition-all duration-200 hover:scale-110 hover:bg-white/20 cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.18)' }}
        aria-label="السابق"
      >‹</button>

      {/* Next arrow */}
      <button
        onClick={() => { advance(1); startTimer(); }}
        className="absolute right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full flex items-center justify-center text-white text-xl transition-all duration-200 hover:scale-110 hover:bg-white/20 cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.18)' }}
        aria-label="التالي"
      >›</button>

      {/* Dots */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 flex gap-2 items-center">
        {SECTION2_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full cursor-pointer transition-all duration-400"
            style={{
              width: i === current ? 28 : 8,
              height: 8,
              background: i === current ? '#3b82f6' : 'rgba(255,255,255,0.3)',
            }}
            aria-label={`صورة ${i + 1}`}
          />
        ))}
      </div>

      {/* Counter */}
      <div
        className="absolute bottom-7 left-8 z-30 tabular-nums"
        style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Tajawal, sans-serif', fontSize: '0.75rem' }}
      >
        {String(current + 1).padStart(2, '0')} / {String(SECTION2_IMAGES.length).padStart(2, '0')}
      </div>

      {/* Top fade connector from hero */}
      <div
        className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(4,6,18,0.55), transparent)' }}
      />
    </section>
  );
}
