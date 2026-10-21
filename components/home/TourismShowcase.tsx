'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { parseTripDate } from '@/lib/booking-catalog';
import { isBookable, programAvailability, programMinPrice } from '@/lib/program-display';
import { Destination, DESTINATIONS, isTourism, tourOf } from '@/lib/tour';
import { destinationPhoto, photoProps } from '@/lib/destination-photos';

type Tile = { d: Destination; count: number; from: number; photo: string };

/**
 * Home page: the tourist-trip offer — one full-height card per destination
 * (photo of a trip there, else a stock photo, else the destination colour),
 * busiest first. Cards stay pinned and each new one slides over the previous,
 * covering it. A card opens its destination page.
 */
export default function TourismShowcase() {
  const [trips, setTrips] = useState<Package[] | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let live = true;
    publicList<Package>('packages')
      .then((data) => {
        if (!live) return;
        setTrips(
          (Array.isArray(data) ? data : [])
            .filter((p) => isTourism(p) && programAvailability(p) !== 'expired')
            .sort((a, b) => {
              const ba = isBookable(programAvailability(a)) ? 0 : 1;
              const bb = isBookable(programAvailability(b)) ? 0 : 1;
              if (ba !== bb) return ba - bb;
              return (parseTripDate(a.start_date)?.getTime() ?? Infinity) - (parseTripDate(b.start_date)?.getTime() ?? Infinity);
            })
        );
      })
      .catch(() => live && setTrips([]));
    return () => {
      live = false;
    };
  }, []);

  const tiles: Tile[] = useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const here = (trips || []).filter((p) => tourOf(p).country === d.id);
        const prices = here.map(programMinPrice).filter((n) => n > 0);
        const photo = here.find((p) => p.image_url && !/kaaba|maka0/i.test(String(p.image_url)))?.image_url || destinationPhoto(d.id, 1600);
        return { d, count: here.length, from: prices.length ? Math.min(...prices) : 0, photo };
      }).sort((a, b) => b.count - a.count),
    [trips]
  );

  const rise = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 26 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.2 },
          transition: { duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section id="tourism-section" className="tour-show" aria-labelledby="tourism-title">
      <div className="tour-show-inner">
        <motion.h2 id="tourism-title" className="tour-show-title" {...rise(0)}>
          اكتشف العالم مع ساوث ستريت
        </motion.h2>

        <div className="tour-show-grid">
          {tiles.map((tile, i) => (
            <DeckCard key={tile.d.id} tile={tile} index={i} total={tiles.length} />
          ))}
          <div className="tour-deck-tail" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function DeckCard({ tile, index, total }: { tile: Tile; index: number; total: number }) {
  const { d, count, from, photo } = tile;

  return (
    <div className="tour-tile-cell">
      <div className="tour-tile-frame">
        <Link
          href={`/destinations/${d.id}`}
          className={`tour-tile${photo ? ' has-photo' : ''}${count ? ' is-live' : ' is-soon'}`}
          style={{ ['--tile' as string]: d.color }}
        >
          {photo ? <img {...photoProps(photo)} alt="" loading="lazy" decoding="async" /> : <span className="tour-tile-orb" aria-hidden />}
          <span className="tour-tile-mark" aria-hidden>{d.latin}</span>
          <span className="tour-tile-top">
            <span className="tour-tile-num" aria-hidden>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
            <span className={`tour-tile-badge${count ? ' is-live' : ''}`}>
              {count ? <><i aria-hidden /> {count} {count === 1 ? 'رحلة متاحة' : 'رحلات متاحة'}</> : 'قريباً'}
            </span>
          </span>
          <span className="tour-tile-body">
            <strong>{d.label}</strong>
            <small><MapPin aria-hidden /> {d.cities.join(' · ')}</small>
            <span className="tour-tile-foot">
              {from ? <b>من {from.toLocaleString('ar-DZ')} <em>دج</em></b> : <b className="is-ask">{count ? 'السعر عند الطلب' : 'برامج قريباً'}</b>}
              <span className="tour-tile-cta">استكشف الرحلات <ArrowLeft aria-hidden /></span>
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
