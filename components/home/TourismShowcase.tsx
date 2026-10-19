'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Hotel, Plane, ShieldCheck } from 'lucide-react';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { DEPOSIT_PERCENT, parseTripDate } from '@/lib/booking-catalog';
import { isBookable, programAvailability, programMinPrice } from '@/lib/program-display';
import { DESTINATIONS, isTourism, tourOf } from '@/lib/tour';
import ProgramCard from '@/components/ProgramCard';

const PERKS = [
  { icon: ShieldCheck, text: 'الوكالة تتكفّل بالتأشيرة' },
  { icon: CalendarDays, text: 'برنامج يوماً بيوم' },
  { icon: Hotel, text: 'فنادق مختارة' },
  { icon: Plane, text: `عربون ${Math.round(DEPOSIT_PERCENT * 100)}٪ بعد قبول الطلب` },
];

/**
 * Home page: the tourist-trip offer at a glance — six destination tiles
 * (photo of a trip there when one exists, otherwise the destination colour),
 * then up to three upcoming trips. Tiles open the programs page on that
 * destination.
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

  const tiles = useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const here = (trips || []).filter((p) => tourOf(p).country === d.id);
        const prices = here.map(programMinPrice).filter((n) => n > 0);
        const photo = here.find((p) => p.image_url && !/kaaba|maka0/i.test(String(p.image_url)))?.image_url || '';
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

        <div className="tour-show-grid">
          {tiles.map(({ d, count, from, photo }, i) => (
            <motion.div key={d.id} className={`tour-tile-cell${i === 0 ? ' is-lead' : ''}`} {...rise(i)}>
              <Link
                href={`/packages?kind=tourism&dest=${d.id}`}
                className={`tour-tile${photo ? ' has-photo' : ''}${count ? '' : ' is-soon'}`}
                style={{ ['--tile' as string]: d.color }}
              >
                {photo ? <img src={photo} alt="" loading="lazy" /> : null}
                <span className="tour-tile-mark" aria-hidden>{d.latin}</span>
                <span className="tour-tile-body">
                  <strong>{d.label}</strong>
                  <small>{d.cities.slice(0, 3).join(' · ')}</small>
                  <em>
                    {count
                      ? `${count} ${count === 1 ? 'رحلة' : 'رحلات'}${from ? ` · من ${from.toLocaleString('ar-DZ')} دج` : ''}`
                      : 'قريباً'}
                  </em>
                </span>
                <span className="tour-tile-go" aria-hidden><ArrowLeft /></span>
              </Link>
            </motion.div>
          ))}
        </div>

        {trips && trips.length ? (
          <div className="tour-show-trips">
            <h3>الرحلات القادمة</h3>
            <div className="prog-grid">
              {trips.slice(0, 3).map((pkg, i) => (
                <motion.div key={pkg.package_id} className="prog-cell" {...rise(i)}>
                  <ProgramCard pkg={pkg} index={i} />
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
