'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageContentRow, pickPageContent } from '@/lib/page-content';

const POSTCARDS = [
  {
    src: '/images/kaaba_sharifa_home_page.png',
    alt: 'الكعبة المشرفة عن قرب',
    place: 'مكة المكرمة',
    line: 'الكعبة المشرفة',
    year: '١٤٤٨',
  },
  {
    src: '/images/kaaba_sharifa_home_page0.jpg',
    alt: 'طواف الليل حول الكعبة',
    place: 'المسجد الحرام',
    line: 'ليلة مباركة',
    year: '١٤٤٨',
  },
  {
    src: '/images/maka01.png',
    alt: 'صحن المطاف من بين الحجاج',
    place: 'صحن المطاف',
    line: 'بين جموع الطائفين',
    year: '١٤٤٨',
  },
  {
    src: '/images/maka06.png',
    alt: 'الكعبة من أروقة الحرم',
    place: 'أروقة الحرم',
    line: 'من بين الأعمدة',
    year: '١٤٤٨',
  },
  {
    src: '/images/maka05.png',
    alt: 'منظر علوي للمسجد الحرام',
    place: 'مكة من الأعلى',
    line: 'الحرم الشريف',
    year: '١٤٤٨',
  },
] as const;

export default function HeroSection({ content }: { content?: PageContentRow[] }) {
  const hero = pickPageContent(content, 'hero_banner', {
    title: 'عمرة تليق بطمأنينتكم.',
    content: 'عرض شهر أوت 2026 — طيران مباشر وإقامة بجوار الحرم.',
  });

  const scrollToAgency = () => {
    const el = document.getElementById('agency-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.section
      id="hero-section"
      className="hero-apple-section"
      dir="ltr"
      aria-label="الصفحة الرئيسية"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="hero-apple-inner">
        <PostcardCoverFlow />

        <motion.div
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="hero-apple-copy"
          dir="rtl"
        >
          <p className="hero-kicker">وكالة ساوث ستريت</p>
          <h1 className="hero-headline">{hero.title}</h1>
          <p className="hero-sub">{hero.content}</p>

          <div className="hero-offer">
            <div className="hero-offer-copy">
              <p className="hero-offer-title">عمرة شهر أوت 2026 المميزة</p>
              <p className="hero-offer-price">
                ابتداءً من <strong>215,000</strong> دج
              </p>
              <p className="hero-offer-meta">
                طيران مباشر • إقامة فاخرة بجوار صحن الحرم المكي الشريف (350م – 600م)
              </p>
            </div>
            <button
              type="button"
              onClick={() => { window.location.href = '/packages'; }}
              className="hero-buy-btn"
            >
              احجز الآن
            </button>
          </div>
        </motion.div>
      </div>

      <button
        type="button"
        onClick={scrollToAgency}
        className="hero-scroll-hint"
        aria-label="اسحب للأسفل لاستكشاف الوكالة"
      >
        <span>اسحب للأسفل لاستكشاف الوكالة</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    </motion.section>
  );
}

function PostcardCoverFlow() {
  const count = POSTCARDS.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const pauseUntil = useRef(0);
  const pointerId = useRef<number | null>(null);
  const dragX = useRef(0);

  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = window.matchMedia('(hover: none)');
    const sync = () => {
      setReduceMotion(motion.matches);
      setCoarsePointer(hover.matches);
    };
    sync();
    motion.addEventListener('change', sync);
    hover.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      hover.removeEventListener('change', sync);
    };
  }, []);

  const browsing = hovered && !reduceMotion;

  useEffect(() => {
    if (reduceMotion) return;
    if (!hovered && !coarsePointer) return;
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      setActive((i) => (i + 1) % count);
    }, hovered ? 1500 : 3200);
    return () => window.clearInterval(id);
  }, [hovered, coarsePointer, reduceMotion, count]);

  const scrubTo = useCallback((clientX: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = Math.round(t * (count - 1));
    pauseUntil.current = Date.now() + 2200;
    setActive(next);
  }, [count]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hovered) return;
    if (pointerId.current !== null) {
      const dx = e.clientX - dragX.current;
      if (Math.abs(dx) > 36) {
        pauseUntil.current = Date.now() + 2200;
        setActive((i) => {
          const dir = dx > 0 ? -1 : 1;
          return (i + dir + count) % count;
        });
        dragX.current = e.clientX;
      }
      return;
    }
    scrubTo(e.clientX);
  };

  const cardStyle = (index: number): React.CSSProperties => {
    if (!browsing) {
      const stack = (index - active + count) % count;
      const tilt = -7 + stack * 3.6;
      return {
        transform: `translate(-50%, -50%) translate(${stack * 11}px, ${stack * 9}px) rotate(${tilt}deg)`,
        zIndex: count - stack,
        opacity: stack > 3 ? 0 : 1,
        filter: stack === 0 ? 'none' : 'brightness(0.96)',
      };
    }

    const offset = index - active;
    const abs = Math.abs(offset);
    return {
      transform: `translate(-50%, -50%) translateX(${offset * 42}%) translateZ(${abs === 0 ? 56 : -140 - abs * 18}px) rotateY(${offset * -58}deg) scale(${abs === 0 ? 1.05 : 0.84})`,
      zIndex: count - abs,
      opacity: abs > 3 ? 0 : 1,
      filter: abs === 0 ? 'none' : 'brightness(0.72) saturate(0.9)',
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="hero-kaaba-side"
    >
      <div
        ref={stageRef}
        className={`hero-postcard-stage${browsing ? ' is-flowing' : ''}`}
        role="region"
        aria-roledescription="معرض بطاقات بريدية"
        aria-label="بطاقات الحرم الشريف"
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          pointerId.current = null;
        }}
        onPointerMove={onPointerMove}
        onPointerDown={(e) => {
          setHovered(true);
          pointerId.current = e.pointerId;
          dragX.current = e.clientX;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        }}
        onPointerUp={() => { pointerId.current = null; }}
        onPointerCancel={() => { pointerId.current = null; }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const dir = e.key === 'ArrowLeft' ? -1 : 1;
            pauseUntil.current = Date.now() + 2200;
            setActive((i) => (i + dir + count) % count);
          }
        }}
      >
        <div className="hero-postcard-desk" aria-hidden="true" />

        {POSTCARDS.map((card, index) => (
          <article
            key={card.src}
            className={`hero-postcard${index === active ? ' is-front' : ''}`}
            style={cardStyle(index)}
            aria-hidden={index !== active}
          >
            <div className="hero-postcard-photo-wrap">
              <img src={card.src} alt={card.alt} className="hero-postcard-photo" draggable={false} />
            </div>
            <div className="hero-postcard-stamp" aria-hidden="true">
              <span>الحرم</span>
            </div>
            <div className="hero-postcard-caption" dir="rtl">
              <p className="hero-postcard-place">{card.place}</p>
              <p className="hero-postcard-line">{card.line} · {card.year}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="hero-postcard-nav" dir="rtl">
        {POSTCARDS.map((card, index) => (
          <button
            key={card.src}
            type="button"
            className={`hero-postcard-dot${index === active ? ' is-active' : ''}`}
            aria-label={card.place}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => {
              pauseUntil.current = Date.now() + 2200;
              setActive(index);
            }}
          />
        ))}
        <span className="hero-postcard-hint">مرّر للتصفح كألبومات الآيبود</span>
      </div>
    </motion.div>
  );
}
