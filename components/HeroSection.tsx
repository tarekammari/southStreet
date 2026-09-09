'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow } from '@/lib/page-content';

type HeroOffer = {
  id: string;
  name: string;
  date: string;
  priceFrom: number | null;
};

function formatOfferDate(value?: string, seasonName?: string): string {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  return seasonName || '';
}

function lowestOfferPrice(prices: { amount?: number }[] | undefined): number | null {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const amounts = prices.map((p) => Number(p.amount)).filter((n) => Number.isFinite(n) && n > 0);
  if (amounts.length === 0) return null;
  return Math.min(...amounts);
}

function isAvailablePackage(pkg: { status?: string; published?: boolean }): boolean {
  const status = String(pkg.status || '').toUpperCase();
  if (status === 'UPCOMING' || status === 'DRAFT' || status === 'CLOSED') return false;
  return pkg.published !== false && (status === 'PUBLISHED' || status === 'OPEN' || status === 'CURRENT' || !status);
}

function startOfTodayMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isUpcomingPackage(pkg: { start_date?: string; end_date?: string }): boolean {
  const today = startOfTodayMs();
  if (pkg.end_date) {
    const end = new Date(pkg.end_date);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (end.getTime() < today) return false;
    }
  }
  if (pkg.start_date) {
    const start = new Date(pkg.start_date);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      return start.getTime() >= today;
    }
  }
  return true;
}

function pickNearestOffer(packages: any[]): HeroOffer | null {
  if (!packages.length) return null;

  const withDate = packages
    .filter((pkg) => pkg.published !== false && (pkg.start_date || pkg.season_name))
    .sort((a, b) => {
      const ta = a.start_date ? new Date(a.start_date).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.start_date ? new Date(b.start_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

  const upcoming = withDate.filter((pkg) => isUpcomingPackage(pkg));
  const available = upcoming.filter((pkg) => isAvailablePackage(pkg));
  const chosen = available[0] || upcoming[0] || withDate.find((pkg) => isAvailablePackage(pkg));
  if (!chosen) return null;

  return {
    id: chosen.package_id,
    name: chosen.name,
    date: formatOfferDate(chosen.start_date, chosen.season_name),
    priceFrom: lowestOfferPrice(chosen.prices),
  };
}

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

const heroEase = [0.16, 1, 0.3, 1] as const;

/** Shortest-path offset so cards never wrap through illogical positions. */
function circularOffset(index: number, active: number, total: number): number {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

const heroStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.11, delayChildren: 0.2 },
  },
};

const heroFadeUp = {
  hidden: { opacity: 0, y: 22, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: heroEase },
  },
};

const heroHeadlinePop = {
  hidden: { opacity: 0, scale: 0.82, y: 28 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.9, ease: heroEase },
  },
};

const heroPricePop = {
  hidden: { opacity: 0, scale: 0.88 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.65, ease: heroEase },
  },
};

export default function HeroSection({ content: _content }: { content?: PageContentRow[] }) {
  const [offer, setOffer] = useState<HeroOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJsonList<any>('/api/admin/packages')
      .then((data) => {
        if (cancelled) return;
        setOffer(pickNearestOffer(data));
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

        <div className="hero-apple-copy-col">
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="show"
            className="hero-apple-copy"
            dir="rtl"
          >
            <motion.div variants={heroFadeUp} className="hero-branding">
              <h1 className="hero-headline">
                <motion.span variants={heroHeadlinePop} className="hero-headline-word">
                  عمرة
                </motion.span>
              </h1>
              {offer?.date ? <p className="hero-offer-date">{offer.date}</p> : null}
            </motion.div>

            {offer ? (
              <motion.div variants={heroFadeUp} className="hero-offer">
                {offer.priceFrom != null ? (
                  <motion.p variants={heroPricePop} className="hero-offer-price">
                    <span className="hero-offer-price-from">ابتداءً من</span>
                    <span className="hero-offer-price-amount">
                      {offer.priceFrom.toLocaleString('ar-DZ')}
                    </span>
                    <span className="hero-offer-price-currency">دج</span>
                  </motion.p>
                ) : (
                  <p className="hero-offer-price">السعر عند الطلب</p>
                )}
              </motion.div>
            ) : null}
          </motion.div>

          {offer ? (
            <motion.div
              variants={heroFadeUp}
              initial="hidden"
              animate="show"
              className="hero-offer-actions"
              dir="rtl"
            >
              <button
                type="button"
                onClick={() => { window.location.href = offer.id ? `/book?package=${encodeURIComponent(offer.id)}` : '/book'; }}
                className="hero-buy-btn hero-buy-btn-primary"
              >
                ابدأ
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/packages'; }}
                className="hero-buy-btn hero-buy-btn-secondary"
              >
                جميع الرحلات و العروض
              </button>
            </motion.div>
          ) : null}
        </div>
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

type CoverSlot = { x: number; z: number; ry: number; s: number; o: number; bright: number };

function coverSlots(mobile: boolean): CoverSlot[] {
  return mobile
    ? [
        { x: 0, z: 90, ry: 0, s: 1.04, o: 1, bright: 1.04 },
        { x: 138, z: 4, ry: -52, s: 0.88, o: 1, bright: 0.86 },
        { x: 236, z: -50, ry: -64, s: 0.76, o: 0.72, bright: 0.72 },
        { x: 290, z: -90, ry: -72, s: 0.68, o: 0, bright: 0.6 },
      ]
    : [
        { x: 0, z: 140, ry: 0, s: 1.08, o: 1, bright: 1.04 },
        { x: 198, z: 8, ry: -58, s: 0.9, o: 1, bright: 0.86 },
        { x: 338, z: -70, ry: -70, s: 0.78, o: 0.72, bright: 0.72 },
        { x: 410, z: -120, ry: -78, s: 0.7, o: 0, bright: 0.6 },
      ];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function coverStyle(offset: number, mobile: boolean): React.CSSProperties {
  const slots = coverSlots(mobile);
  const abs = Math.abs(offset);
  const dir = offset < 0 ? -1 : 1;
  const i = Math.min(Math.floor(abs), slots.length - 2);
  const t = Math.min(1, abs - i);
  const from = slots[i];
  const to = slots[i + 1];
  const x = lerp(from.x, to.x, t) * dir;
  const z = lerp(from.z, to.z, t);
  const ry = lerp(from.ry, to.ry, t) * dir;
  const s = lerp(from.s, to.s, t);
  const o = lerp(from.o, to.o, t);
  const bright = lerp(from.bright, to.bright, t);
  return {
    transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${s})`,
    opacity: o,
    filter: `brightness(${bright}) saturate(${0.82 + 0.22 * (1 - Math.min(abs, 2) / 2)})`,
    zIndex: 20 - Math.round(abs * 8),
    visibility: abs > 2.35 ? 'hidden' : 'visible',
    pointerEvents: abs > 2.1 ? 'none' : 'auto',
  };
}

function PostcardCoverFlow() {
  const count = POSTCARDS.length;
  const pointerId = useRef<number | null>(null);
  const dragStartX = useRef(0);
  const shiftRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState(0);
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    shiftRef.current = shift;
  }, [shift]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 980px)');
    const sync = () => setIsMobile(mobile.matches);
    sync();
    mobile.addEventListener('change', sync);
    return () => mobile.removeEventListener('change', sync);
  }, []);

  const goTo = useCallback((index: number) => {
    setShift(0);
    setActive(((index % count) + count) % count);
  }, [count]);

  const stepAlbum = useCallback((dir: -1 | 1) => {
    setShift(0);
    setActive((i) => (i + dir + count) % count);
  }, [count]);

  const snapShift = useCallback((value: number) => {
    const snapped = Math.round(value);
    setActive((i) => ((i - snapped) % count + count) % count);
    setShift(0);
    setDragging(false);
  }, [count]);

  const unitFor = () => (isMobile ? 92 : 150);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current === e.pointerId) {
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 4) setDragging(true);
      const next = dx / unitFor();
      shiftRef.current = next;
      setShift(next);
      return;
    }
    if (isMobile || dragging) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = (e.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width / 2);
    const next = Math.max(-1, Math.min(1, nx)) * 0.38;
    shiftRef.current = next;
    setShift(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    snapShift(shiftRef.current);
  };

  const onCardActivate = (index: number, isFront: boolean) => {
    if (dragging) return;
    if (isFront) {
      if (isMobile) stepAlbum(-1);
      return;
    }
    goTo(index);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.85, ease: heroEase, delay: 0.1 }}
      className="hero-kaaba-side"
    >
      <div
        className={`hero-postcard-perspective is-flow is-live-flow is-interactive${dragging ? ' is-dragging' : ''}${isMobile ? ' is-mobile' : ''}`}
      >
        <div
          ref={stageRef}
          className="hero-postcard-stage"
          role="region"
          aria-roledescription="معرض ألبومات"
          aria-label="ألبومات صور الحرم الشريف"
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerDown={(e) => {
            pointerId.current = e.pointerId;
            dragStartX.current = e.clientX;
            setDragging(false);
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            if (pointerId.current !== null) return;
            setShift(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              stepAlbum(e.key === 'ArrowRight' ? -1 : 1);
            }
          }}
        >
          <div className="hero-album-reflection" aria-hidden="true" />

          {POSTCARDS.map((card, index) => {
            const offset = circularOffset(index, active, count) + shift;
            const isFront = Math.abs(offset) < 0.45;
            const isVisible = Math.abs(offset) <= 2.2;

            return (
              <article
                key={card.src}
                className={`hero-postcard hero-album-cover${isFront ? ' is-front' : ' is-side'}${isVisible ? '' : ' is-away'}`}
                style={coverStyle(offset, isMobile)}
                aria-hidden={!isFront}
                role="button"
                tabIndex={isVisible ? 0 : undefined}
                aria-label={isFront ? `الصورة التالية بعد ${card.place}` : `عرض ${card.place}`}
                onClick={() => onCardActivate(index, isFront)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardActivate(index, isFront);
                  }
                }}
              >
                <div className="hero-postcard-photo-wrap">
                  <img src={card.src} alt={card.alt} className="hero-postcard-photo" draggable={false} />
                </div>
                <div className="hero-album-label" dir="rtl">
                  <p className="hero-postcard-place">{card.place}</p>
                  <p className="hero-postcard-line">{card.line}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="hero-postcard-nav" dir="rtl">
        {POSTCARDS.map((card, index) => (
          <button
            key={card.src}
            type="button"
            className={`hero-postcard-dot${index === active ? ' is-active' : ''}`}
            aria-label={card.place}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => goTo(index)}
          />
        ))}
        <span className="hero-postcard-hint hero-postcard-hint-idle">
          {isMobile ? 'اسحب مع الإصبع بنفس الاتجاه' : 'حرّك المؤشر أو اسحب بنفس الاتجاه'}
        </span>
        <span className="hero-postcard-hint hero-postcard-hint-active">
          حرّك المؤشر أو اسحب بنفس الاتجاه
        </span>
      </div>
    </motion.div>
  );
}
