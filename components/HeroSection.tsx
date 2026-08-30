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

        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="show"
          className="hero-apple-copy"
          dir="rtl"
        >
          <motion.div variants={heroFadeUp} className="hero-branding">
            <p className="hero-kicker">وكالة ساوث ستريت</p>
            <h1 className="hero-headline">
              <motion.span variants={heroHeadlinePop} className="hero-headline-word">
                عمرة
              </motion.span>
            </h1>
          </motion.div>

          {offer ? (
            <motion.div variants={heroFadeUp} className="hero-offer">
              <div className="hero-offer-copy">
                <p className="hero-offer-label">العرض القادم</p>
                <p className="hero-offer-title">{offer.name}</p>
                {offer.date ? <p className="hero-offer-date">{offer.date}</p> : null}
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
              </div>
              <motion.div variants={heroFadeUp} className="hero-offer-actions">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/portal'; }}
                  className="hero-buy-btn hero-buy-btn-primary"
                >
                  ابدأ
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/packages'; }}
                  className="hero-buy-btn hero-buy-btn-secondary"
                >
                  جميع البرامج والباقات
                </button>
              </motion.div>
            </motion.div>
          ) : null}
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
  const pauseUntil = useRef(0);
  const pointerId = useRef<number | null>(null);
  const dragX = useRef(0);

  const [active, setActive] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 980px)');
    const sync = () => {
      setReduceMotion(motion.matches);
      setIsMobile(mobile.matches);
    };
    sync();
    motion.addEventListener('change', sync);
    mobile.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      mobile.removeEventListener('change', sync);
    };
  }, []);

  const flowEnabled = true;
  const autoPlay = flowEnabled && !reduceMotion && isMobile;
  const isDragging = useRef(false);
  const didDrag = useRef(false);

  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntil.current || isDragging.current) return;
      setActive((i) => (i + 1) % count);
    }, 3500);
    return () => window.clearInterval(id);
  }, [autoPlay, count]);

  const goTo = useCallback((index: number) => {
    pauseUntil.current = Date.now() + 2800;
    setActive(((index % count) + count) % count);
  }, [count]);

  const stepAlbum = useCallback((dir: -1 | 1) => {
    pauseUntil.current = Date.now() + 2800;
    setActive((i) => (i + dir + count) % count);
  }, [count]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!flowEnabled || pointerId.current === null) return;
    const dx = e.clientX - dragX.current;
    if (Math.abs(dx) > 6) didDrag.current = true;
    const threshold = isMobile ? 32 : 40;
    if (Math.abs(dx) > threshold) {
      stepAlbum(dx > 0 ? -1 : 1);
      dragX.current = e.clientX;
    }
  };

  const onCardActivate = (index: number, isFront: boolean) => {
    if (isFront || didDrag.current) return;
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
        className={`hero-postcard-perspective is-flow${flowEnabled ? ' is-interactive' : ''}${isMobile ? ' is-mobile' : ''}`}
      >
        <div
          className="hero-postcard-stage"
          role="region"
          aria-roledescription="معرض ألبومات"
          aria-label="ألبومات صور الحرم الشريف"
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerDown={(e) => {
            isDragging.current = true;
            didDrag.current = false;
            pointerId.current = e.pointerId;
            dragX.current = e.clientX;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={() => {
            pointerId.current = null;
            isDragging.current = false;
          }}
          onPointerCancel={() => {
            pointerId.current = null;
            isDragging.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              stepAlbum(e.key === 'ArrowLeft' ? -1 : 1);
            }
          }}
        >
          <div className="hero-album-reflection" aria-hidden="true" />

          {POSTCARDS.map((card, index) => {
            const offset = circularOffset(index, active, count);
            const isFront = offset === 0;
            const isVisible = Math.abs(offset) <= 2;

            return (
              <article
                key={card.src}
                className={`hero-postcard hero-album-cover${isFront ? ' is-front' : ' is-side'}${isVisible ? '' : ' is-away'}`}
                style={{
                  ['--offset' as string]: offset,
                  zIndex: count - Math.abs(offset),
                }}
                aria-hidden={!isFront}
                role={isFront ? undefined : 'button'}
                tabIndex={isFront || !isVisible ? undefined : 0}
                aria-label={isFront ? undefined : `عرض ${card.place}`}
                onClick={() => onCardActivate(index, isFront)}
                onKeyDown={(e) => {
                  if (!isFront && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    goTo(index);
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
          {isMobile ? 'اسحب أو انقر على صورة للتنقل' : 'اسحب أو انقر على ألبوم جانبي'}
        </span>
        <span className="hero-postcard-hint hero-postcard-hint-active">
          انقر على الصورة أو اسحب للتنقل
        </span>
      </div>
    </motion.div>
  );
}
