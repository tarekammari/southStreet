'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Building2, MapPin, Phone, Plane } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import ProgramProductCard from '@/components/ProgramProductCard';
import { defaultDates } from '@/components/hotels/HotelSearchBar';
import { hotelsCount, perNight, useDestinationHotels, useDestinationTrips } from '@/components/destinations/useDestination';
import { destinationOf, type Destination } from '@/lib/tour';
import { cityPhoto, destinationPhoto, photoProps } from '@/lib/destination-photos';
import { cityInfo, hotelInCity } from '@/lib/destination-cities';
import { useBrand } from '@/components/social/useAgencyInfo';
import { telHref } from '@/lib/brand';
import { formatDzd } from '@/lib/hotels/types';

export default function DestinationPage() {
  const params = useParams<{ id: string }>();
  const dest = destinationOf(String(params?.id || '').toUpperCase());
  if (!dest) notFound();
  return <DestinationView dest={dest} />;
}

/** One destination: the agency's trips there on top, then its cities, each opening its hotels. */
function DestinationView({ dest }: { dest: Destination }) {
  const brand = useBrand();
  const [dates] = useState(defaultDates);
  const trips = useDestinationTrips(dest.id);
  const hotels = useDestinationHotels(dest.id, dates);

  const cities = useMemo(
    () =>
      dest.cities
        .map((name) => {
          const here = (hotels || []).filter((h) => hotelInCity(h, name));
          return { name, photo: cityPhoto(name), info: cityInfo(name), count: here.length, from: here.length ? Math.min(...here.map(perNight)) : 0 };
        })
        .sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)) || b.count - a.count),
    [dest, hotels]
  );
  const cover = destinationPhoto(dest.id, 1600);

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <main className="page-main dst">
        <section className="dst-hero is-short" style={{ ['--tile' as string]: dest.color }} aria-labelledby="dst-title">
          {cover ? <img {...photoProps(cover)} alt="" fetchPriority="high" decoding="async" /> : null}
          <span className="dst-hero-shade" aria-hidden />
          <div className="dst-hero-in">
            <nav className="dst-crumbs" aria-label="مسار التصفح">
              <Link href="/">الرئيسية</Link>
              <span aria-hidden>/</span>
              <Link href="/packages?kind=tourism">رحلات سياحية</Link>
            </nav>
            <span className="dst-latin" aria-hidden>{dest.latin}</span>
            <h1 id="dst-title">{dest.label}</h1>
            <p className="dst-visa"><BadgeCheck aria-hidden /> {dest.visa}</p>
          </div>
        </section>

        <div className="dst-body">
          {trips === null ? (
            <section className="dst-sec" aria-hidden>
              <div className="dst-grid-trips">{[0, 1, 2].map((i) => <div key={i} className="dst-skel is-trip" />)}</div>
            </section>
          ) : trips.length ? (
            <section id="dst-trips" className="dst-sec" aria-labelledby="dst-trips-title">
              <h2 id="dst-trips-title" className="dst-title">رحلات منظّمة إلى {dest.label}</h2>
              <div className="dst-grid-trips">
                {trips.map((p, i) => <ProgramProductCard key={p.package_id} pkg={p} index={i} />)}
              </div>
            </section>
          ) : (
            <section className="dst-sec is-tight" aria-label="الرحلات المنظّمة">
              <div className="dst-notrip">
                <Plane aria-hidden />
                <p>
                  <strong>لا توجد رحلة منظّمة إلى {dest.label} حالياً</strong>
                  <span>اختر مدينتك واحجز فندقك، أو اتصل بنا لنجهّز لك رحلة على مقاسك.</span>
                </p>
                <a href={telHref(brand.phone)} className="dst-call"><Phone aria-hidden /> <span dir="ltr">{brand.phone}</span></a>
              </div>
            </section>
          )}

          <section id="dst-cities" className="dst-sec" aria-labelledby="dst-cities-title">
            <h2 id="dst-cities-title" className="dst-title">اختر مدينتك واحجز فندقك</h2>
            <div className="dst-bigcities">
              {cities.map((c, i) => (
                <Link
                  key={c.name}
                  href={`/destinations/${dest.id}/${c.info.slug}`}
                  className={`dst-bigcity${c.photo ? '' : ' is-plain'}`}
                  style={{ ['--tile' as string]: dest.color }}
                >
                  {c.photo ? <img {...photoProps(c.photo, '(min-width: 900px) 50vw, 100vw')} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" /> : null}
                  <span className="dst-bigcity-shade" aria-hidden />
                  {c.info.latin ? <span className="dst-bigcity-latin" aria-hidden>{c.info.latin}</span> : null}
                  <span className="dst-bigcity-body">
                    <strong>{c.name}</strong>
                    {c.info.blurb ? <span className="dst-bigcity-blurb">{c.info.blurb}</span> : null}
                    <span className="dst-bigcity-foot">
                      <span className="dst-bigcity-meta">
                        <Building2 aria-hidden />
                        {hotels === null ? 'الفنادق…' : c.count ? <>{hotelsCount(c.count)} · من <b>{formatDzd(c.from)}</b> لليلة</> : 'فنادق عند الطلب'}
                      </span>
                      <span className="dst-bigcity-cta">الفنادق والحجز <ArrowLeft aria-hidden /></span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="dst-sec" aria-labelledby="dst-before-title">
            <h2 id="dst-before-title" className="dst-title">قبل السفر</h2>
            <ul className="dst-before">
              <li><BadgeCheck aria-hidden /> {dest.visa}</li>
              <li><MapPin aria-hidden /> {dest.id === 'DZ' ? 'بطاقة التعريف الوطنية أو جواز السفر عند الوصول إلى الفندق.' : 'جواز سفر ساري المفعول 6 أشهر على الأقل بعد تاريخ العودة.'}</li>
              <li><Phone aria-hidden /> الوكالة تؤكّد الحجز مع الفندق ثم تدفع العربون في الوكالة — لا دفع على الموقع.</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
      <SakhrAgent />
    </div>
  );
}
