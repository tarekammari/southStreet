'use client';

import { useEffect, useState } from 'react';
import { CountUp } from '@/components/about/effects';
import { publicList, publicReviews } from '@/lib/public-catalog';

/**
 * Bottom of the agency hero: a strip of real numbers from the catalogue
 * (programs, partner hotels, guides, rating). Numbers count up once when they
 * come into view; an item with no data is left out.
 * Styles: components/about/agency-hero.css (.hs-*).
 */
export default function HeroShowcase() {
  const [n, setN] = useState({ programs: 0, hotels: 0, team: 0, rating: 0, reviews: 0 });

  useEffect(() => {
    Promise.all([publicList<unknown>('packages'), publicList<unknown>('hotels'), publicList<unknown>('staff'), publicReviews()])
      .then(([programs, hotels, team, r]) =>
        setN({
          programs: programs.length,
          hotels: hotels.length,
          team: team.length,
          rating: Number(r?.summary?.average) || 0,
          reviews: Number(r?.summary?.count) || 0,
        })
      )
      .catch(() => {});
  }, []);

  const stats = [
    { value: n.programs, decimals: 0, suffix: '', label: 'برامج العمرة والرحلات' },
    { value: n.hotels, decimals: 0, suffix: '+', label: 'فنادق شريكة' },
    { value: n.team, decimals: 0, suffix: '', label: 'مرشدون وطاقم' },
    { value: n.rating, decimals: 1, suffix: '', label: n.reviews ? `تقييم المعتمرين (${n.reviews})` : 'تقييم المعتمرين' },
  ].filter((s) => s.value > 0);

  if (!stats.length) return null;
  return (
    <dl className="hs-stats hs-in" style={{ animationDelay: '450ms' }}>
      {stats.map((s) => (
        <div key={s.label} className="hs-stat">
          <dd dir="ltr"><CountUp value={s.value} decimals={s.decimals} />{s.suffix}</dd>
          <dt>{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
