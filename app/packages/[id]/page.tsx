'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Hotel,
  Loader2,
  MapPin,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import ProgramCard from '@/components/ProgramCard';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { DEPOSIT_PERCENT, ROOM_LABELS } from '@/lib/booking-catalog';
import {
  AVAILABILITY_LABEL,
  formatProgramDate,
  isBookable,
  programAvailability,
  programImage,
  programMinPrice,
  seatFillPercent,
} from '@/lib/program-display';
import { destinationOf, isTourism, tourOf } from '@/lib/tour';

/** One program or tourist trip, everything on one page, with the booking card at hand. */
export default function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [all, setAll] = useState<Package[] | null>(null);

  useEffect(() => {
    publicList<Package>('packages').then((d) => setAll(Array.isArray(d) ? d : [])).catch(() => setAll([]));
  }, []);

  const pkg = useMemo(() => (all || []).find((p) => p.package_id === decodeURIComponent(id)) || null, [all, id]);
  const tourism = pkg ? isTourism(pkg) : false;
  const tour = pkg && tourism ? tourOf(pkg) : null;
  const dest = tour ? destinationOf(tour.country) : null;
  const related = useMemo(
    () =>
      (all || [])
        .filter((p) => pkg && p.package_id !== pkg.package_id && isTourism(p) === tourism && programAvailability(p) !== 'expired')
        .filter((p) => !tour?.country || tourOf(p).country === tour.country || !tourism)
        .slice(0, 3),
    [all, pkg, tourism, tour]
  );

  if (all === null) {
    return (
      <Shell>
        <div className="tdet-loading"><Loader2 className="animate-spin" aria-hidden /> جاري التحميل…</div>
      </Shell>
    );
  }
  if (!pkg) {
    return (
      <Shell>
        <div className="tdet-loading">
          <strong>هذا البرنامج غير متاح</strong>
          <Link href="/packages" className="tdet-cta">كل البرامج</Link>
        </div>
      </Shell>
    );
  }

  const availability = programAvailability(pkg);
  const bookable = isBookable(availability);
  const price = programMinPrice(pkg);
  const fill = seatFillPercent(pkg);
  const ownPhoto = Boolean(pkg.image_url) && !(tourism && /kaaba|maka0/i.test(String(pkg.image_url)));
  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.5, delay: i * 0.05 } });
  const hotels = tour
    ? tour.hotels
    : [
        pkg.makkah_hotel_name ? { city: 'مكة المكرمة', name: pkg.makkah_hotel_name, nights: undefined as number | undefined, stars: undefined as number | undefined, dist: pkg.makkah_hotel_dist } : null,
        pkg.madinah_hotel_name ? { city: 'المدينة المنورة', name: pkg.madinah_hotel_name, nights: undefined, stars: undefined, dist: pkg.madinah_hotel_dist } : null,
      ].filter(Boolean) as { city: string; name: string; nights?: number; stars?: number; dist?: string }[];
  const backHref = tourism ? `/packages?kind=tourism${tour?.country ? `&dest=${tour.country}` : ''}` : '/packages';

  return (
    <Shell>
      <main className="page-main tdet max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <Link href={backHref} className="hdet-back"><ArrowRight aria-hidden /> {tourism ? 'كل الرحلات' : 'كل البرامج'}</Link>

        <section className="tdet-hero" style={{ ['--tile' as string]: dest?.color || '#047857' }}>
          {ownPhoto ? <img src={programImage(pkg, 0)} alt={pkg.name} /> : null}
          <div className="tdet-hero-shade" />
          {!ownPhoto && dest ? <span className="tour-tile-mark tdet-mark" aria-hidden>{dest.latin}</span> : null}
          <div className="tdet-hero-copy">
            <span className="tdet-chip">{tourism ? (dest?.label || tour?.country || 'رحلة سياحية') : /حج/.test(pkg.name) ? 'حج' : 'عمرة'}</span>
            <h1>{pkg.name}</h1>
            <p>
              <CalendarDays aria-hidden /> {formatProgramDate(pkg.start_date)}{pkg.end_date ? ` — ${formatProgramDate(pkg.end_date)}` : ''}
              {pkg.duration_days ? <span><Clock aria-hidden /> {pkg.duration_days} يوماً</span> : null}
            </p>
          </div>
        </section>

        <div className="tdet-layout">
          <div>
            <ul className="tdet-facts">
              {tour?.cities.length ? <li><MapPin aria-hidden /><span><small>المدن</small><b>{tour.cities.join(' · ')}</b></span></li> : null}
              {pkg.airline || pkg.departure_city ? <li><Plane aria-hidden /><span><small>الطيران</small><b>{pkg.airline || 'رحلة جوية'}{pkg.departure_city ? ` · من ${pkg.departure_city}` : ''}</b></span></li> : null}
              {pkg.morshid_name ? <li><Users aria-hidden /><span><small>المرافق</small><b>{pkg.morshid_name}</b></span></li> : null}
              <li><ShieldCheck aria-hidden /><span><small>الحالة</small><b>{AVAILABILITY_LABEL[availability]}</b></span></li>
            </ul>

            {pkg.description ? <motion.p className="tdet-desc" {...rise(0)}>{pkg.description}</motion.p> : null}

            {tour?.highlights.length ? (
              <motion.section className="tdet-block" {...rise(1)}>
                <h2>أبرز ما في الرحلة</h2>
                <ul className="tdet-highlights">{tour.highlights.map((h) => <li key={h}><Sparkles aria-hidden /> {h}</li>)}</ul>
              </motion.section>
            ) : null}

            {tour?.itinerary.length ? (
              <motion.section className="tdet-block" {...rise(2)}>
                <h2>البرنامج يوماً بيوم</h2>
                <ol className="tdet-timeline">
                  {tour.itinerary.map((d, i) => (
                    <motion.li key={d.day} {...rise(i)}>
                      <span className="tdet-day">اليوم {d.day}</span>
                      <strong>{d.title}</strong>
                      {d.details ? <p>{d.details}</p> : null}
                    </motion.li>
                  ))}
                </ol>
              </motion.section>
            ) : null}

            {hotels.length ? (
              <motion.section className="tdet-block" {...rise(3)}>
                <h2>الإقامة</h2>
                <div className="tdet-hotels">
                  {hotels.map((h, i) => (
                    <div key={`${h.name}-${i}`} className="tdet-hotel">
                      <Hotel aria-hidden />
                      <span>
                        <small>{h.city}{h.nights ? ` · ${h.nights} ليالٍ` : ''}</small>
                        <b>{h.name}</b>
                        {h.stars ? <em className="hres-stars">{Array.from({ length: h.stars }, (_, k) => <Star key={k} aria-hidden />)}</em> : null}
                        {'dist' in h && (h as any).dist ? <em>{(h as any).dist}</em> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : null}

            {pkg.included_services?.length || pkg.excluded_services?.length ? (
              <motion.section className="tdet-block tdet-incl" {...rise(4)}>
                {pkg.included_services?.length ? (
                  <div>
                    <h2>يشمل</h2>
                    <ul>{pkg.included_services.map((s) => <li key={s}><Check aria-hidden /> {s}</li>)}</ul>
                  </div>
                ) : null}
                {pkg.excluded_services?.length ? (
                  <div>
                    <h2>لا يشمل</h2>
                    <ul className="is-ex">{pkg.excluded_services.map((s) => <li key={s}><X aria-hidden /> {s}</li>)}</ul>
                  </div>
                ) : null}
              </motion.section>
            ) : null}

            {tour?.visa ? (
              <motion.section className="tdet-block" {...rise(5)}>
                <h2>التأشيرة</h2>
                <p className="tdet-visa"><ShieldCheck aria-hidden /> {tour.visa}</p>
              </motion.section>
            ) : null}

            {pkg.booking_conditions?.length || pkg.cancellation_policy ? (
              <motion.section className="tdet-block" {...rise(6)}>
                <h2>الشروط</h2>
                <ul className="tdet-terms">
                  {(pkg.booking_conditions || []).map((c) => <li key={c}>{c}</li>)}
                  {pkg.cancellation_policy ? <li>{pkg.cancellation_policy}</li> : null}
                </ul>
              </motion.section>
            ) : null}
          </div>

          <aside className="tdet-book">
            <small>ابتداءً من</small>
            <strong>{price ? `${price.toLocaleString('ar-DZ')} دج` : 'السعر عند الطلب'}</strong>
            {pkg.prices?.length ? (
              <ul>
                {pkg.prices.filter((p) => Number(p.amount) > 0).sort((a, b) => Number(a.amount) - Number(b.amount)).map((p) => (
                  <li key={p.room_type}><span>{ROOM_LABELS[p.room_type] || p.room_type}</span><b>{Number(p.amount).toLocaleString('ar-DZ')} دج</b></li>
                ))}
              </ul>
            ) : null}
            {pkg.capacity > 0 ? (
              <div className="pcard-seats">
                <div><span>{pkg.available > 0 ? `${pkg.available} مقعد متبقٍ` : 'لا مقاعد'}</span><span>{fill}٪ محجوز</span></div>
                <i role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill}><s style={{ width: `${Math.max(fill, 4)}%` }} /></i>
              </div>
            ) : null}
            {bookable ? (
              <Link href={`/book?package=${encodeURIComponent(pkg.package_id)}`} className="tdet-cta">احجز الآن</Link>
            ) : (
              <span className="tdet-cta is-off">{availability === 'full' ? 'المقاعد مكتملة' : availability === 'expired' ? 'انتهى هذا البرنامج' : 'يفتح الحجز قريباً'}</span>
            )}
            <p>عربون {Math.round(DEPOSIT_PERCENT * 100)}٪ بعد قبول الوكالة لطلبك{tourism ? '، والوكالة تتكفّل بملف التأشيرة' : ''}.</p>
          </aside>
        </div>

        {related.length ? (
          <section className="tdet-block">
            <h2>{tourism ? `رحلات أخرى${dest ? ` إلى ${dest.label}` : ''}` : 'برامج أخرى'}</h2>
            <div className="prog-grid">
              {related.map((p, i) => <div key={p.package_id} className="prog-cell"><ProgramCard pkg={p} index={i} /></div>)}
            </div>
          </section>
        ) : null}
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      {children}
      <Footer />
      <SakhrAgent />
    </div>
  );
}
