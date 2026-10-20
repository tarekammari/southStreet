'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Hotel } from '@/types';
import { DESTINATIONS, hotelCityLabel, hotelCountryOf } from '@/lib/tour';
import { defaultDates, searchHref } from '@/components/hotels/HotelSearchBar';
import { destinationPhoto } from '@/lib/destination-photos';

type Card = {
  id: string;
  title: string;
  sub: string;
  dest: string;
  color: string;
  latin: string;
  match: (h: Hotel) => boolean;
};

const CARDS: Card[] = [
  {
    id: 'MAKKAH',
    title: 'مكة المكرمة',
    sub: 'السعودية · قرب المسجد الحرام',
    dest: 'مكة',
    color: '#047857',
    latin: 'MAKKAH',
    match: (h) => hotelCityLabel(h.city) === 'مكة المكرمة',
  },
  {
    id: 'MADINAH',
    title: 'المدينة المنورة',
    sub: 'السعودية · قرب المسجد النبوي',
    dest: 'المدينة',
    color: '#065f46',
    latin: 'MADINAH',
    match: (h) => hotelCityLabel(h.city) === 'المدينة المنورة',
  },
  ...DESTINATIONS.map((d) => ({
    id: d.id,
    title: d.label,
    sub: d.cities.slice(0, 3).join(' · '),
    dest: d.id,
    color: d.color,
    latin: d.latin,
    match: (h: Hotel) => hotelCountryOf(h.city) === d.id,
  })),
];

function hotelsWord(n: number) {
  if (n === 1) return 'فندق واحد';
  if (n === 2) return 'فندقان';
  return `${n} ${n <= 10 ? 'فنادق' : 'فندقاً'}`;
}

/** «وجهات رائجة»: a sliding row of destination cards, each opening the hotel search for it. */
export default function PopularDestinations({ hotels }: { hotels: Hotel[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const pos = Math.abs(el.scrollLeft);
    setEdge({ start: pos < 4, end: pos + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const slide = (forward: boolean) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const step = el.clientWidth * 0.85 * (forward ? 1 : -1) * (rtl ? -1 : 1);
    el.scrollBy({ left: step, behavior: 'smooth' });
  };

  const dates = defaultDates();

  return (
    <section className="hdest" aria-labelledby="hdest-title">
      <header className="hdest-head">
        <div>
          <h2 id="hdest-title">وجهات رائجة</h2>
          <p>الأكثر طلباً عند عملائنا — اختر وجهتك وشاهد فنادقها وأسعارها.</p>
        </div>
        <div className="hdest-nav">
          <button type="button" aria-label="السابق" disabled={edge.start} onClick={() => slide(false)}>
            <ChevronRight aria-hidden />
          </button>
          <button type="button" aria-label="التالي" disabled={edge.end} onClick={() => slide(true)}>
            <ChevronLeft aria-hidden />
          </button>
        </div>
      </header>

      <div className="hdest-track" ref={track} onScroll={measure}>
        {CARDS.map((c) => {
          const n = hotels.filter(c.match).length;
          const photo = broken[c.id] ? '' : destinationPhoto(c.id);
          return (
            <Link
              key={c.id}
              className="hdest-card"
              style={{ '--dest': c.color } as React.CSSProperties}
              href={searchHref({ dest: c.dest, label: c.title, ...dates, rooms: [{ adults: 2, children: 0, childAges: [] }] })}
            >
              {photo ? (
                <img src={photo} alt="" loading="lazy" onError={() => setBroken((b) => ({ ...b, [c.id]: true }))} />
              ) : (
                <span className="hdest-latin" aria-hidden>{c.latin}</span>
              )}
              <span className="hdest-shade" aria-hidden />
              {n > 0 ? <span className="hdest-count">{hotelsWord(n)}</span> : null}
              <span className="hdest-text">
                <strong>{c.title}</strong>
                <small>{c.sub}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
