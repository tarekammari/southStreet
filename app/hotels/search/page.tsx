'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Building2, Flame, MapPin, SearchX, SlidersHorizontal, Star, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import HotelSearchBar from '@/components/hotels/HotelSearchBar';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { lightPhoto } from '@/lib/destination-photos';
import { useBrand } from '@/components/social/useAgencyInfo';
import { telHref } from '@/lib/brand';
import {
  BOARD_LABEL,
  arDate,
  decodeRooms,
  encodeRooms,
  formatDzd,
  guestsSummary,
  nightsBetween,
  roomsLeftText,
  type BoardType,
  type HotelOffer,
} from '@/lib/hotels/types';

type Sort = 'price' | 'stars' | 'name';

function Stars({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="hres-stars" aria-label={`${n} نجوم`}>
      {Array.from({ length: n }, (_, i) => <Star key={i} aria-hidden />)}
    </span>
  );
}

function ResultsInner() {
  const brand = useBrand();
  const p = useSearchParams();
  const reduce = useReducedMotion();
  const search = useMemo(
    () => ({ dest: p.get('dest') || '', checkIn: p.get('checkIn') || '', checkOut: p.get('checkOut') || '', rooms: decodeRooms(p.get('rooms')) }),
    [p]
  );
  const label = p.get('label') || search.dest;
  const [hotels, setHotels] = useState<HotelOffer[] | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<Sort>('price');
  const [stars, setStars] = useState<number[]>([]);
  const [boards, setBoards] = useState<BoardType[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setHotels(null);
    setError('');
    const q = new URLSearchParams({ dest: search.dest, checkIn: search.checkIn, checkOut: search.checkOut, rooms: encodeRooms(search.rooms) });
    fetch(`/api/hotels/search?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'تعذّر البحث');
        setHotels(d.hotels || []);
      })
      .catch((e) => {
        setError(e.message || 'تعذّر البحث');
        setHotels([]);
      });
  }, [search]);

  const priceCap = useMemo(() => Math.max(0, ...(hotels || []).map((h) => h.total_from)), [hotels]);
  useEffect(() => setMaxPrice(priceCap), [priceCap]);

  const shown = useMemo(() => {
    const list = (hotels || []).filter(
      (h) =>
        (!stars.length || stars.includes(h.stars)) &&
        (!boards.length || boards.includes(h.board_from)) &&
        (!freeOnly || h.free_cancel) &&
        (!maxPrice || h.total_from <= maxPrice)
    );
    return list.sort((a, b) => (sort === 'stars' ? b.stars - a.stars || a.total_from - b.total_from : sort === 'name' ? a.name.localeCompare(b.name, 'ar') : a.total_from - b.total_from));
  }, [hotels, stars, boards, freeOnly, maxPrice, sort]);

  const nights = nightsBetween(search.checkIn, search.checkOut);
  const detailHref = (h: HotelOffer) =>
    `/hotels/${encodeURIComponent(h.hotel_id)}?${new URLSearchParams({ checkIn: search.checkIn, checkOut: search.checkOut, rooms: encodeRooms(search.rooms) })}`;
  const filtersOn = stars.length || boards.length || freeOnly || (maxPrice && maxPrice < priceCap);
  const reset = () => {
    setStars([]);
    setBoards([]);
    setFreeOnly(false);
    setMaxPrice(priceCap);
  };

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <main className="page-main hres max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="hres-bar">
          <HotelSearchBar key={p.toString()} initial={search} initialLabel={label} variant="compact" />
        </div>

        <header className="hres-head">
          <div>
            <h1>{label ? `فنادق ${label}` : 'الفنادق'}</h1>
            <p>
              {arDate(search.checkIn, { day: 'numeric', month: 'long' })} ← {arDate(search.checkOut, { day: 'numeric', month: 'long' })} · {nights} {nights === 1 ? 'ليلة' : 'ليالٍ'} · {guestsSummary(search.rooms)}
            </p>
          </div>
          <div className="hres-tools">
            <button type="button" className="hres-filter-btn" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal aria-hidden /> الفلاتر{filtersOn ? ' •' : ''}
            </button>
            <label className="hres-sort">
              <span className="sr-only">الترتيب</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="price">الأقل سعراً</option>
                <option value="stars">الأعلى تصنيفاً</option>
                <option value="name">الاسم</option>
              </select>
            </label>
          </div>
        </header>

        <div className="hres-layout">
          <aside className={`hres-filters${showFilters ? ' is-open' : ''}`} aria-label="الفلاتر">
            <div className="hres-filters-head">
              <strong>تصفية النتائج</strong>
              {filtersOn ? <button type="button" onClick={reset}>مسح</button> : null}
              <button type="button" className="hres-filters-close" onClick={() => setShowFilters(false)} aria-label="إغلاق"><X /></button>
            </div>
            {priceCap > 0 ? (
              <section>
                <h3>الميزانية للإقامة</h3>
                <input
                  type="range"
                  min={Math.min(...(hotels || []).map((h) => h.total_from))}
                  max={priceCap}
                  step={500}
                  value={maxPrice || priceCap}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  aria-label="أقصى سعر"
                />
                <p className="hres-range">حتى <b>{formatDzd(maxPrice || priceCap)}</b></p>
              </section>
            ) : null}
            <section>
              <h3>النجوم</h3>
              <div className="hres-chips">
                {[5, 4, 3].map((n) => (
                  <button key={n} type="button" aria-pressed={stars.includes(n)} onClick={() => setStars((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}>
                    {n} <Star aria-hidden />
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3>الوجبات</h3>
              <div className="hres-chips">
                {(Object.keys(BOARD_LABEL) as BoardType[]).filter((b) => (hotels || []).some((h) => h.board_from === b)).map((b) => (
                  <button key={b} type="button" aria-pressed={boards.includes(b)} onClick={() => setBoards((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]))}>
                    {BOARD_LABEL[b]}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <label className="hres-toggle">
                <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
                <span aria-hidden><i /></span>
                إلغاء مجاني فقط
              </label>
            </section>
          </aside>

          <section className="hres-list" aria-live="polite">
            {hotels === null ? (
              [0, 1, 2].map((i) => <div key={i} className="hres-card is-skeleton" />)
            ) : error ? (
              <div className="hres-empty"><SearchX aria-hidden /><strong>{error}</strong></div>
            ) : shown.length === 0 ? (
              <div className="hres-empty">
                <SearchX aria-hidden />
                <strong>{hotels.length ? 'لا نتائج بهذه الفلاتر' : 'لا فنادق متاحة لهذه الوجهة والتواريخ'}</strong>
                <p>
                  {hotels.length ? 'جرّب فلاتر أقل.' : 'جرّب تواريخ أخرى أو وجهة قريبة، أو اتصل بالوكالة لنجد لك فندقاً:'}{' '}
                  {hotels.length ? null : <a href={telHref(brand.phone)} dir="ltr">{brand.phone}</a>}
                </p>
                {hotels.length ? <button type="button" onClick={reset}>مسح الفلاتر</button> : null}
              </div>
            ) : (
              <>
                <p className="hres-count">{shown.length} {shown.length === 1 ? 'فندق' : 'فنادق'} متاحة</p>
                {shown.map((h, i) => {
                  const color = HOTEL_COUNTRIES.find((c) => c.id === h.country)?.color || '#0f766e';
                  return (
                    <motion.article
                      key={h.hotel_id}
                      className={`hres-card${h.supplier === 'test' ? ' is-test' : ''}`}
                      initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.05 }}
                    >
                      <Link href={detailHref(h)} className="hres-media" style={{ ['--tile' as string]: color }}>
                        {h.photo ? <img src={lightPhoto(h.photo, 'sm')} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" /> : <span className="hres-noimg"><Building2 aria-hidden />{h.city_label}</span>}
                        {h.supplier === 'test' ? <span className="hres-test">تجريبي — للموظفين</span> : null}
                      </Link>
                      <div className="hres-body">
                        <div className="hres-title">
                          <Link href={detailHref(h)}><h2>{h.name}</h2></Link>
                          <Stars n={h.stars} />
                        </div>
                        <p className="hres-where"><MapPin aria-hidden /> {[h.area, h.city_label, h.country_label].filter(Boolean).join(' · ')}</p>
                        {h.amenities.length ? (
                          <ul className="hres-amen">{h.amenities.slice(0, 4).map((a) => <li key={a}>{a}</li>)}</ul>
                        ) : null}
                        <div className="hres-badges">
                          <span className="is-board">{BOARD_LABEL[h.board_from]}</span>
                          {h.free_cancel ? <span className="is-free"><BadgeCheck aria-hidden /> إلغاء مجاني</span> : null}
                          {h.rooms_left ? <span className="is-left"><Flame aria-hidden /> {roomsLeftText(h.rooms_left)} بهذا السعر</span> : null}
                        </div>
                      </div>
                      <div className="hres-price">
                        <small>{h.nights} {h.nights === 1 ? 'ليلة' : 'ليالٍ'} · {search.rooms.length} {search.rooms.length === 1 ? 'غرفة' : 'غرف'}</small>
                        <strong>{formatDzd(h.total_from)}</strong>
                        <em>≈ {formatDzd(h.total_from / Math.max(1, h.nights) / search.rooms.length)} لليلة</em>
                        <Link href={detailHref(h)} className="hres-cta">اختر غرفتك</Link>
                      </div>
                    </motion.article>
                  );
                })}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <SakhrAgent />
    </div>
  );
}

export default function HotelResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-shell flex items-center justify-center text-slate-500">جاري البحث…</div>}>
      <ResultsInner />
    </Suspense>
  );
}
