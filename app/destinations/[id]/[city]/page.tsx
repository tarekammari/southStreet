'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Building2, CalendarDays, MapPin, Phone, Star } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import ProgramProductCard from '@/components/ProgramProductCard';
import { defaultDates, searchHref } from '@/components/hotels/HotelSearchBar';
import { STAY_ROOMS, perNight, useDestinationHotels, useDestinationTrips } from '@/components/destinations/useDestination';
import { destinationOf, tourOf, type Destination } from '@/lib/tour';
import { cityPhoto, photoProps } from '@/lib/destination-photos';
import { cityFromSlug, cityInfo, hotelInCity } from '@/lib/destination-cities';
import { AGENCY_PHONE, AGENCY_PHONE_TEL } from '@/lib/agency-contact';
import { BOARD_LABEL, arDate, encodeRooms, formatDzd, normAr, type HotelOffer } from '@/lib/hotels/types';

export default function CityPage() {
  const params = useParams<{ id: string; city: string }>();
  const dest = destinationOf(String(params?.id || '').toUpperCase());
  const city = dest ? cityFromSlug(dest.cities, String(params?.city || '')) : '';
  if (!dest || !city) notFound();
  return <CityView dest={dest} city={city} />;
}

/** One city of a destination: its hotels as photo cards, each opening the hotel with its rooms and prices. */
function CityView({ dest, city }: { dest: Destination; city: string }) {
  const [dates] = useState(defaultDates);
  const all = useDestinationHotels(dest.id, dates);
  const trips = useDestinationTrips(dest.id);
  const info = cityInfo(city);
  const photo = cityPhoto(city);

  const hotels = useMemo(
    () => (all === null ? null : all.filter((h) => hotelInCity(h, city)).sort((a, b) => b.stars - a.stars || a.total_from - b.total_from)),
    [all, city]
  );
  const cityTrips = useMemo(() => (trips || []).filter((p) => tourOf(p).cities.some((c) => normAr(c).includes(normAr(city)))), [trips, city]);
  const others = dest.cities.filter((c) => c !== city);
  const stay = new URLSearchParams({ checkIn: dates.checkIn, checkOut: dates.checkOut, rooms: encodeRooms(STAY_ROOMS) });
  const hotelHref = (h: HotelOffer) => `/hotels/${encodeURIComponent(h.hotel_id)}?${stay}`;

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <main className="page-main dst">
        <section className="dst-hero is-city" style={{ ['--tile' as string]: dest.color }} aria-labelledby="dst-title">
          {photo ? <img {...photoProps(photo)} alt="" fetchPriority="high" decoding="async" /> : null}
          <span className="dst-hero-shade" aria-hidden />
          <div className="dst-hero-in">
            <nav className="dst-crumbs" aria-label="مسار التصفح">
              <Link href="/">الرئيسية</Link>
              <span aria-hidden>/</span>
              <Link href={`/destinations/${dest.id}`}>{dest.label}</Link>
            </nav>
            {info.latin ? <span className="dst-latin" aria-hidden>{info.latin}</span> : null}
            <h1 id="dst-title">{city}</h1>
            {info.blurb ? <p className="dst-lead">{info.blurb}</p> : null}
            <p className="dst-visa"><BadgeCheck aria-hidden /> {dest.visa}</p>
          </div>
        </section>

        <div className="dst-body">
          {cityTrips.length ? (
            <section className="dst-sec" aria-labelledby="dst-trips-title">
              <h2 id="dst-trips-title" className="dst-title">رحلات منظّمة تزور {city}</h2>
              <div className="dst-grid-trips">
                {cityTrips.map((p, i) => <ProgramProductCard key={p.package_id} pkg={p} index={i} />)}
              </div>
            </section>
          ) : null}

          <section className="dst-sec" aria-labelledby="dst-hotels-title">
            <h2 id="dst-hotels-title" className="dst-title">فنادق {city}</h2>
            <p className="dst-note">
              <CalendarDays aria-hidden /> سعر الليلة لغرفة مزدوجة، لإقامة {arDate(dates.checkIn, { day: 'numeric', month: 'long' })} ← {arDate(dates.checkOut, { day: 'numeric', month: 'long' })}.
              {' '}<Link href={searchHref({ dest: city, label: city, ...dates, rooms: STAY_ROOMS })}>تواريخ أخرى</Link>
            </p>

            {hotels === null ? (
              <div className="dst-bighotels">{[0, 1].map((i) => <div key={i} className="dst-skel is-bighotel" />)}</div>
            ) : hotels.length ? (
              <div className="dst-bighotels">
                {hotels.map((h, i) => (
                  <Link key={h.hotel_id} href={hotelHref(h)} className="dst-bighotel" style={{ ['--tile' as string]: dest.color }}>
                    <span className="dst-bighotel-media">
                      {h.photo ? <img {...photoProps(h.photo, '(min-width: 900px) 50vw, 100vw')} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" /> : <Building2 aria-hidden />}
                      {h.stars ? (
                        <span className="dst-bighotel-stars" aria-label={`${h.stars} نجوم`}>
                          {Array.from({ length: h.stars }, (_, k) => <Star key={k} aria-hidden />)}
                        </span>
                      ) : null}
                      <span className="dst-bighotel-price">
                        <small>من</small> {formatDzd(perNight(h))} <small>لليلة</small>
                      </span>
                    </span>
                    <span className="dst-bighotel-body">
                      <strong>{h.name}</strong>
                      <small><MapPin aria-hidden /> {[h.area, h.city_label].filter(Boolean).join(' · ')}</small>
                      <span className="dst-bighotel-tags">
                        <span>{BOARD_LABEL[h.board_from]}</span>
                        {h.free_cancel ? <span className="is-free">إلغاء مجاني</span> : null}
                        {h.amenities.slice(0, 2).map((a) => <span key={a}>{a}</span>)}
                      </span>
                      <span className="dst-bighotel-cta">الغرف والصور والحجز <ArrowLeft aria-hidden /></span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dst-notrip">
                <Building2 aria-hidden />
                <p>
                  <strong>لا فنادق في {city} للحجز من الموقع حالياً</strong>
                  <span>الوكالة تحجز لك الفندق الذي تختاره — اتصل بنا وسنرسل لك العروض.</span>
                </p>
                <a href={`tel:${AGENCY_PHONE_TEL}`} className="dst-call"><Phone aria-hidden /> <span dir="ltr">{AGENCY_PHONE}</span></a>
              </div>
            )}
          </section>

          {others.length ? (
            <section className="dst-sec" aria-labelledby="dst-others-title">
              <h2 id="dst-others-title" className="dst-title">مدن أخرى في {dest.label}</h2>
              <div className="dst-othercities">
                {others.map((c) => {
                  const p = cityPhoto(c);
                  return (
                    <Link key={c} href={`/destinations/${dest.id}/${cityInfo(c).slug}`} className="dst-othercity" style={{ ['--tile' as string]: dest.color }}>
                      {p ? <img {...photoProps(p, '16rem')} alt="" loading="lazy" decoding="async" /> : null}
                      <span>{c}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
      <SakhrAgent />
    </div>
  );
}
