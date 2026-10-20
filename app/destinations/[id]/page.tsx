'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, BedDouble, Building2, MapPin, Phone, Plane, Star } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import ProgramProductCard from '@/components/ProgramProductCard';
import { defaultDates, searchHref } from '@/components/hotels/HotelSearchBar';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { parseTripDate } from '@/lib/booking-catalog';
import { isBookable, programAvailability } from '@/lib/program-display';
import { destinationOf, isTourism, tourOf, type Destination } from '@/lib/tour';
import { cityPhoto, destinationPhoto } from '@/lib/destination-photos';
import { AGENCY_PHONE, AGENCY_PHONE_TEL } from '@/lib/agency-contact';
import { BOARD_LABEL, arDate, encodeRooms, formatDzd, normAr, roomsLeftText, type HotelDetail, type HotelOffer, type RoomOffer } from '@/lib/hotels/types';

const ROOMS = [{ adults: 2, children: 0, childAges: [] as number[] }];
/** Hotels whose rooms are loaded on the page; the rest open the hotel page. */
const DETAILED = 24;

type HotelCard = HotelOffer & { rooms: RoomOffer[] };

function cheapestPerRoom(detail: HotelDetail): RoomOffer[] {
  const best = new Map<string, RoomOffer>();
  for (const o of detail.offers[0] || []) {
    const had = best.get(o.room_id);
    if (!had || o.total < had.total) best.set(o.room_id, o);
  }
  return [...best.values()].sort((a, b) => a.total - b.total);
}

function Stars({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="dst-stars" aria-label={`${n} نجوم`}>
      {Array.from({ length: n }, (_, i) => <Star key={i} aria-hidden />)}
    </span>
  );
}

export default function DestinationPage() {
  const params = useParams<{ id: string }>();
  const dest = destinationOf(String(params?.id || '').toUpperCase());
  if (!dest) notFound();
  return <DestinationView dest={dest} />;
}

/** One destination: the agency's trips there, its cities and its bookable hotels with their rooms. */
function DestinationView({ dest }: { dest: Destination }) {
  const [dates] = useState(defaultDates);
  const [trips, setTrips] = useState<Package[] | null>(null);
  const [hotels, setHotels] = useState<HotelCard[] | null>(null);

  useEffect(() => {
    let live = true;
    publicList<Package>('packages')
      .then((data) => {
        if (!live) return;
        setTrips(
          (Array.isArray(data) ? data : [])
            .filter((p) => isTourism(p) && programAvailability(p) !== 'expired' && tourOf(p).country === dest.id)
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
  }, [dest.id]);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ dest: dest.id, checkIn: dates.checkIn, checkOut: dates.checkOut, rooms: encodeRooms(ROOMS) });
    fetch(`/api/hotels/search?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { hotels: [] }))
      .then(async (d: { hotels?: HotelOffer[] }) => {
        const list = (d.hotels || []).filter((h) => h.supplier === 'own');
        const detailed = await Promise.all(
          list.slice(0, DETAILED).map((h) =>
            fetch(`/api/hotels/${encodeURIComponent(h.hotel_id)}?${q}`, { cache: 'no-store' })
              .then((r) => (r.ok ? r.json() : null))
              .then((x: { hotel?: HotelDetail } | null) => (x?.hotel ? cheapestPerRoom(x.hotel) : []))
              .catch(() => [] as RoomOffer[])
          )
        );
        if (live) setHotels(list.map((h, i) => ({ ...h, rooms: detailed[i] || [] })));
      })
      .catch(() => live && setHotels([]));
    return () => {
      live = false;
    };
  }, [dest.id, dates]);

  const [cityFilter, setCityFilter] = useState('');
  const cities = useMemo(() => {
    const listed = dest.cities.map((name) => ({ name, photo: cityPhoto(name) }));
    return [...listed.filter((c) => c.photo), ...listed.filter((c) => !c.photo)];
  }, [dest]);
  /** Hotels grouped under the destination's cities, in the order of the city cards; unlisted cities last. */
  const byCity = useMemo(() => {
    const groups = new Map<string, HotelCard[]>();
    for (const h of hotels || []) {
      const listed = cities.find((c) => normAr(h.city_label).includes(normAr(c.name)) || normAr(h.city).includes(normAr(c.name)));
      const key = listed?.name || h.city_label || h.city;
      groups.set(key, [...(groups.get(key) || []), h]);
    }
    const order = cities.map((c) => c.name);
    return [...groups.entries()]
      .sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
      .map(([city, list]) => ({ city, photo: cityPhoto(city), hotels: [...list].sort((a, b) => a.total_from - b.total_from) }));
  }, [hotels, cities]);
  const hotelsIn = (city: string) => byCity.find((g) => g.city === city)?.hotels.length || 0;
  const cityAnchor = (city: string) => `dst-city-${Math.max(0, byCity.findIndex((g) => g.city === city))}`;
  const showCity = (city: string) => {
    setCityFilter(city);
    window.setTimeout(() => document.getElementById(cityAnchor(city))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const hotelHref = (h: HotelOffer) =>
    `/hotels/${encodeURIComponent(h.hotel_id)}?${new URLSearchParams({ checkIn: dates.checkIn, checkOut: dates.checkOut, rooms: encodeRooms(ROOMS) })}`;
  const cover = destinationPhoto(dest.id, 1920);

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <main className="page-main dst">
        <section className="dst-hero" style={{ ['--tile' as string]: dest.color }} aria-labelledby="dst-title">
          {cover ? <img src={cover} alt="" /> : null}
          <span className="dst-hero-shade" aria-hidden />
          <div className="dst-hero-in">
            <nav className="dst-crumbs" aria-label="مسار التصفح">
              <Link href="/">الرئيسية</Link>
              <span aria-hidden>/</span>
              <Link href="/packages?kind=tourism">رحلات سياحية</Link>
            </nav>
            <span className="dst-latin" aria-hidden>{dest.latin}</span>
            <h1 id="dst-title">{dest.label}</h1>
            <p className="dst-cities-line"><MapPin aria-hidden /> {dest.cities.join(' · ')}</p>
            <p className="dst-visa">{dest.visa}</p>
            <div className="dst-jump">
              <a href="#dst-trips">الرحلات المنظّمة</a>
              <a href="#dst-cities">المدن</a>
              <a href="#dst-hotels">الفنادق والغرف</a>
            </div>
          </div>
        </section>

        <div className="dst-body">
          <section id="dst-trips" className="dst-sec" aria-labelledby="dst-trips-title">
            <h2 id="dst-trips-title" className="dst-title">رحلات الوكالة إلى {dest.label}</h2>
            {trips === null ? (
              <div className="dst-grid-trips">{[0, 1, 2].map((i) => <div key={i} className="dst-skel is-trip" />)}</div>
            ) : trips.length ? (
              <div className="dst-grid-trips">
                {trips.map((p, i) => <ProgramProductCard key={p.package_id} pkg={p} index={i} />)}
              </div>
            ) : (
              <div className="dst-empty">
                <Plane aria-hidden />
                <div>
                  <strong>لا توجد رحلة منظّمة إلى {dest.label} حالياً</strong>
                  <p>نجهّز لك رحلة على مقاسك: الطيران، الفنادق والجولات. اتصل بنا أو تصفّح الفنادق أدناه.</p>
                </div>
                <a href={`tel:${AGENCY_PHONE_TEL}`} className="dst-call"><Phone aria-hidden /> <span dir="ltr">{AGENCY_PHONE}</span></a>
              </div>
            )}
          </section>

          <section id="dst-cities" className="dst-sec" aria-labelledby="dst-cities-title">
            <h2 id="dst-cities-title" className="dst-title">مدن {dest.label}</h2>
            <div className="dst-grid-cities">
              {cities.map((c) => {
                const n = hotelsIn(c.name);
                const inner = (
                  <>
                    {c.photo ? <img src={c.photo} alt="" loading="lazy" /> : null}
                    <span className="dst-city-shade" aria-hidden />
                    <span className="dst-city-text">
                      <strong>{c.name}</strong>
                      <small>{n ? `${n} ${n === 1 ? 'فندق' : n === 2 ? 'فندقان' : 'فنادق'} · الغرف والأسعار` : 'فنادق عند الطلب'}</small>
                    </span>
                  </>
                );
                const cls = `dst-city${c.photo ? '' : ' is-plain'}`;
                const style = { ['--tile' as string]: dest.color };
                return n ? (
                  <button key={c.name} type="button" className={cls} style={style} onClick={() => showCity(c.name)}>{inner}</button>
                ) : (
                  <Link key={c.name} href={searchHref({ dest: c.name, label: c.name, ...dates, rooms: ROOMS })} className={cls} style={style}>{inner}</Link>
                );
              })}
            </div>
          </section>

          <section id="dst-hotels" className="dst-sec" aria-labelledby="dst-hotels-title">
            <h2 id="dst-hotels-title" className="dst-title">فنادق {dest.label} وغرفها</h2>
            <p className="dst-note">
              الأسعار لشخصين بالدينار، لإقامة {arDate(dates.checkIn, { day: 'numeric', month: 'long' })} ← {arDate(dates.checkOut, { day: 'numeric', month: 'long' })}، وتتغيّر حسب التاريخ.
            </p>
            {hotels === null ? (
              [0, 1].map((i) => <div key={i} className="dst-skel is-hotel" />)
            ) : hotels.length ? (
              <>
                {byCity.length > 1 ? (
                  <nav className="dst-chips" aria-label="المدن">
                    <button type="button" aria-pressed={!cityFilter} onClick={() => setCityFilter('')}>كل المدن <span>{hotels.length}</span></button>
                    {byCity.map((g) => (
                      <button key={g.city} type="button" aria-pressed={cityFilter === g.city} onClick={() => setCityFilter(g.city)}>
                        {g.city} <span>{g.hotels.length}</span>
                      </button>
                    ))}
                  </nav>
                ) : null}
                {byCity.filter((g) => !cityFilter || g.city === cityFilter).map((g) => (
                  <section key={g.city} id={cityAnchor(g.city)} className="dst-citygroup" aria-label={`فنادق ${g.city}`}>
                    <header className="dst-citygroup-head" style={{ ['--tile' as string]: dest.color }}>
                      {g.photo ? <img src={g.photo} alt="" loading="lazy" /> : null}
                      <span className="dst-citygroup-shade" aria-hidden />
                      <div>
                        <h3>{g.city}</h3>
                        <p>{g.hotels.length} {g.hotels.length === 1 ? 'فندق' : g.hotels.length === 2 ? 'فندقان' : 'فنادق'} · من {formatDzd(Math.min(...g.hotels.map((h) => h.total_from / Math.max(1, h.nights))))} لليلة</p>
                      </div>
                      <Link href={searchHref({ dest: g.city, label: g.city, ...dates, rooms: ROOMS })} className="dst-citygroup-link">
                        تواريخ أخرى <ArrowLeft aria-hidden />
                      </Link>
                    </header>
              {g.hotels.map((h) => (
                <article key={h.hotel_id} className="dst-hotel">
                  <Link href={hotelHref(h)} className="dst-hotel-media" style={{ ['--tile' as string]: dest.color }}>
                    {h.photo ? <img src={h.photo} alt="" loading="lazy" /> : <span className="dst-noimg"><Building2 aria-hidden /></span>}
                  </Link>
                  <div className="dst-hotel-main">
                    <header className="dst-hotel-head">
                      <div>
                        <Link href={hotelHref(h)}><h3>{h.name}</h3></Link>
                        <p><Stars n={h.stars} /> <MapPin aria-hidden /> {[h.area, h.city_label].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="dst-hotel-price">
                        <small>من</small>
                        <strong>{formatDzd(h.total_from / Math.max(1, h.nights))}</strong>
                        <small>لليلة · {BOARD_LABEL[h.board_from]}</small>
                      </div>
                    </header>
                    {h.amenities.length ? <ul className="dst-amen">{h.amenities.slice(0, 5).map((a) => <li key={a}>{a}</li>)}</ul> : null}
                    {h.rooms.length ? (
                      <div className="dst-rooms">
                        {h.rooms.map((r) => (
                          <Link key={r.room_id} href={`${hotelHref(h)}&room=${encodeURIComponent(r.room_id)}`} className="dst-room">
                            <span className="dst-room-media">
                              {r.photos[0] || h.photo ? <img src={r.photos[0] || h.photo} alt="" loading="lazy" /> : <BedDouble aria-hidden />}
                              {r.left <= 3 ? <span className="dst-room-left">{roomsLeftText(r.left)}</span> : null}
                            </span>
                            <span className="dst-room-text">
                              <strong>{r.room_name}</strong>
                              <small>{[r.beds, `حتى ${r.max_adults} بالغ`, BOARD_LABEL[r.board]].filter(Boolean).join(' · ')}</small>
                              <small className={r.free_cancel_until ? 'is-free' : ''}>{r.free_cancel_until ? 'إلغاء مجاني' : 'غير قابل للاسترداد'}</small>
                              <b>{formatDzd(r.per_night)} <em>لليلة</em></b>
                              <span className="dst-room-book">اختر هذه الغرفة</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <Link href={hotelHref(h)} className="dst-hotel-cta">
                      {h.rooms.length ? 'احجز الآن' : 'اختر غرفتك واحجز'} <ArrowLeft aria-hidden />
                    </Link>
                  </div>
                </article>
              ))}
                  </section>
                ))}
              </>
            ) : (
              <div className="dst-empty">
                <Building2 aria-hidden />
                <div>
                  <strong>لا فنادق متاحة للحجز في {dest.label} من الموقع حالياً</strong>
                  <p>الوكالة تحجز لك الفندق الذي تختاره — اتصل بنا وسنرسل لك العروض.</p>
                </div>
                <a href={`tel:${AGENCY_PHONE_TEL}`} className="dst-call"><Phone aria-hidden /> <span dir="ltr">{AGENCY_PHONE}</span></a>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
      <SakhrAgent />
    </div>
  );
}
