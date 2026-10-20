'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, CalendarDays, Hotel, MapPin, Plane, ShieldCheck } from 'lucide-react';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { DEPOSIT_PERCENT, parseTripDate } from '@/lib/booking-catalog';
import { isBookable, programAvailability, programMinPrice } from '@/lib/program-display';
import { Destination, DESTINATIONS, isTourism, tourOf } from '@/lib/tour';
import { destinationPhoto } from '@/lib/destination-photos';

const PERKS = [
  { icon: ShieldCheck, text: 'الوكالة تتكفّل بالتأشيرة' },
  { icon: CalendarDays, text: 'برنامج يوماً بيوم' },
  { icon: Hotel, text: 'فنادق مختارة' },
  { icon: Plane, text: `عربون ${Math.round(DEPOSIT_PERCENT * 100)}٪ بعد قبول الطلب` },
];

type Tile = { d: Destination; count: number; from: number; photo: string };

/**
 * Home page: the tourist-trip offer — one full-height card per destination
 * (photo of a trip there, else a stock photo, else the destination colour),
 * busiest first. Cards stay pinned and stack: each new one slides over the
 * previous, which shrinks back into the deck.
 */
export default function TourismShowcase() {
  const [trips, setTrips] = useState<Package[] | null>(null);
  const reduce = useReducedMotion();
  const deck = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: deck, offset: ['start start', 'end end'] });

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
        <motion.header className="tour-show-head" {...rise(0)}>
          <div>
            <p className="tour-show-eyebrow"><Plane aria-hidden /> رحلات سياحية منظّمة</p>
            <h2 id="tourism-title">اكتشف العالم مع ساوث ستريت</h2>
            <p className="tour-show-lead">من إسطنبول إلى لندن: الطيران والفنادق والجولات في برنامج واحد منظّم، تحجزه وتتابعه مع الوكالة.</p>
          </div>
          <Link href="/packages?kind=tourism" className="tour-show-all">
            كل الرحلات <ArrowLeft className="w-4 h-4" aria-hidden />
          </Link>
        </motion.header>

        <ul className="tour-show-perks">
          {PERKS.map(({ icon: Icon, text }, i) => (
            <motion.li key={text} {...rise(i + 1)}>
              <Icon aria-hidden /> {text}
            </motion.li>
          ))}
        </ul>

        <div className="tour-show-grid" ref={deck}>
          {tiles.map((tile, i) => (
            <DeckCard key={tile.d.id} tile={tile} index={i} total={tiles.length} progress={scrollYProgress} still={!!reduce} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeckCard({ tile, index, total, progress, still }: { tile: Tile; index: number; total: number; progress: MotionValue<number>; still: boolean }) {
  const { d, count, from, photo } = tile;
  // Shrinks from the moment it is pinned to the end of the deck; cards lower in the deck shrink less.
  const scale = useTransform(progress, [index / total, 1], [1, 1 - (total - index - 1) * 0.035]);

  return (
    <div className="tour-tile-cell" style={{ ['--i' as string]: index }}>
      <motion.div className="tour-tile-frame" style={still ? undefined : { scale }}>
        <Link
          href={`/packages?kind=tourism&dest=${d.id}`}
          className={`tour-tile${photo ? ' has-photo' : ''}${count ? ' is-live' : ' is-soon'}`}
          style={{ ['--tile' as string]: d.color }}
        >
          {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="tour-tile-orb" aria-hidden />}
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
      </motion.div>
    </div>
  );
}
