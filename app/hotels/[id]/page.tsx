'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  FileText,
  Images,
  Loader2,
  MapPin,
  Plane,
  ShieldAlert,
  Star,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import HotelSearchBar from '@/components/hotels/HotelSearchBar';
import RoomOptions, { amenityIcon } from '@/components/hotels/RoomOptions';
import { openLogin } from '@/components/auth/openLogin';
import { HOTEL_COUNTRIES, destinationOf } from '@/lib/tour';
import { DEPOSIT_PERCENT } from '@/lib/booking-catalog';
import { hotelFacilities } from '@/lib/hotels/facilities';
import { lightPhoto, photoProps } from '@/lib/destination-photos';
import { cityInfo, hotelInCity } from '@/lib/destination-cities';
import {
  BOARD_LABEL,
  arDate,
  decodeRooms,
  encodeRooms,
  formatDzd,
  guestsSummary,
  type HotelDetail,
  type RoomOffer,
} from '@/lib/hotels/types';

type Me = { id?: string; name?: string; role?: string; phone?: string } | null;
type Client = { id: string; name: string; phone?: string; email?: string };

/** Same four steps as the Umrah booking wizard: choose, your details, the agency confirms, the deposit. */
const HOTEL_STEPS = [
  { id: 1, label: 'الغرفة' },
  { id: 2, label: 'بياناتك' },
  { id: 3, label: 'تأكيد الوكالة' },
  { id: 4, label: 'العربون' },
];

const STAFF = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'AGENCY_AGENT', 'admin', 'manager', 'accountant', 'agent']);

function cancelText(o: RoomOffer) {
  return o.free_cancel_until ? `إلغاء مجاني حتى ${arDate(o.free_cancel_until, { day: 'numeric', month: 'long' })}` : 'غير قابل للاسترداد';
}

type Shot = { src: string; caption: string };
const TOUR_GROUPS: { id: string; label: string; test: RegExp }[] = [
  { id: 'rooms', label: 'الغرف والأجنحة', test: /room-|suite-|bathroom/i },
  { id: 'dining', label: 'المطعم والإفطار', test: /restaurant-|breakfast/i },
  { id: 'reception', label: 'الاستقبال والبهو', test: /lobby-|reception-/i },
  { id: 'leisure', label: 'المسبح والسبا', test: /pool|spa|gym/i },
];

/** The hotel's photos sorted into tabs: the hotel, rooms (named after the room), restaurant, reception, leisure. */
function photoTour(hotel: HotelDetail): { id: string; label: string; shots: Shot[] }[] {
  const roomOf = new Map<string, string>();
  for (const o of hotel.offers.flat()) for (const src of o.photos) if (!roomOf.has(src)) roomOf.set(src, o.room_name);
  const groups = new Map<string, Shot[]>([['hotel', []], ...TOUR_GROUPS.map((g) => [g.id, []] as [string, Shot[]])]);
  const seen = new Set<string>();
  const add = (src: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    const g = roomOf.has(src) ? TOUR_GROUPS[0] : TOUR_GROUPS.find((x) => x.test.test(src));
    groups.get(g?.id || 'hotel')!.push({ src, caption: roomOf.get(src) || g?.label || hotel.name });
  };
  hotel.images.forEach(add);
  roomOf.forEach((_, src) => add(src));
  const tabs = [{ id: 'hotel', label: 'الفندق' }, ...TOUR_GROUPS]
    .map((g) => ({ id: g.id, label: g.label, shots: groups.get(g.id) || [] }))
    .filter((g) => g.shots.length);
  const all = [...groups.values()].flat();
  return tabs.length > 1 ? [{ id: 'all', label: 'كل الصور', shots: all }, ...tabs] : [{ id: 'all', label: 'الصور', shots: all }];
}

/** Visa and papers for a stay in the hotel's country. */
function travelPapers(country: string): { visa: string; papers: string } {
  if (country === 'SA') return { visa: 'تأشيرة عمرة أو سياحة — الوكالة تتكفّل بها.', papers: 'جواز سفر ساري 6 أشهر على الأقل بعد تاريخ العودة، وصورة شمسية حديثة.' };
  const d = destinationOf(country);
  if (country === 'DZ') return { visa: d?.visa || 'سياحة داخلية — بدون تأشيرة.', papers: 'بطاقة التعريف الوطنية أو جواز السفر عند الوصول إلى الفندق.' };
  return {
    visa: d?.visa || 'شروط الدخول تؤكّدها الوكالة عند الحجز.',
    papers: 'جواز سفر ساري 6 أشهر على الأقل بعد تاريخ العودة. تُطلب الوثائق نفسها عند الوصول إلى الفندق.',
  };
}

function HotelInner() {
  const { id } = useParams<{ id: string }>();
  const p = useSearchParams();
  const reduce = useReducedMotion();
  const search = useMemo(
    () => ({ dest: '', checkIn: p.get('checkIn') || '', checkOut: p.get('checkOut') || '', rooms: decodeRooms(p.get('rooms')) }),
    [p]
  );
  const [hotel, setHotel] = useState<HotelDetail | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [photo, setPhoto] = useState(0);
  const [tourTab, setTourTab] = useState('all');
  const [step, setStep] = useState<'rooms' | 'guests' | 'done'>('rooms');
  const [me, setMe] = useState<Me>(null);
  const [guests, setGuests] = useState<{ name: string; passport: string }[]>([]);
  const [phone, setPhone] = useState('');
  const [requests, setRequests] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [booked, setBooked] = useState<{ id: string; number: string; total: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('south_street_user');
      const u = raw ? JSON.parse(raw) : null;
      setMe(u);
      if (u?.phone) setPhone(u.phone);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    setHotel(null);
    setError('');
    const q = new URLSearchParams({ checkIn: search.checkIn, checkOut: search.checkOut, rooms: encodeRooms(search.rooms) });
    fetch(`/api/hotels/${encodeURIComponent(id)}?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'تعذّر تحميل الفندق');
        const h: HotelDetail = d.hotel;
        setHotel(h);
        const wanted = p.get('room');
        // `pick` carries the rooms chosen before signing in, so the client comes back to them.
        const kept = (p.get('pick') || '').split(',');
        setPicked(h.offers.map((list, i) =>
          (kept[i] && list.find((o) => o.offer_id === kept[i])?.offer_id)
          || (wanted && list.find((o) => o.room_id === wanted)?.offer_id)
          || list[0]?.offer_id || ''));
        setGuests(search.rooms.map(() => ({ name: '', passport: '' })));
      })
      .catch((e) => setError(e.message));
  }, [id, search, p]);

  const staff = Boolean(me?.role && STAFF.has(String(me.role)));
  const signedIn = Boolean(me?.id || me?.role);

  // Back from the sign-in window with rooms already chosen: go straight to the details.
  useEffect(() => {
    if (hotel && signedIn && p.get('step') === 'guests') setStep('guests');
  }, [hotel, signedIn, p]);

  useEffect(() => {
    if (step !== 'guests' || !me?.name || staff) return;
    setGuests((gs) => gs.map((g, i) => (i === 0 && !g.name ? { ...g, name: String(me.name) } : g)));
  }, [step, me, staff]);
  useEffect(() => {
    if (!staff || step !== 'guests' || clients) return;
    fetch('/api/admin/users', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const list = (d.users || d.members || d || []) as any[];
        setClients(
          (Array.isArray(list) ? list : [])
            .filter((u) => String(u.role || '').toUpperCase() === 'PILGRIM_USER')
            .map((u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email }))
        );
      })
      .catch(() => setClients([]));
  }, [staff, step, clients]);

  const chosen = hotel ? picked.map((oid, i) => hotel.offers[i]?.find((o) => o.offer_id === oid)).filter(Boolean) as RoomOffer[] : [];
  const total = chosen.reduce((s, o) => s + o.total, 0);
  const complete = Boolean(hotel && chosen.length === search.rooms.length);
  const color = HOTEL_COUNTRIES.find((c) => c.id === hotel?.country)?.color || '#0f766e';
  const homeDest = hotel ? destinationOf(hotel.country) : null;
  const homeCity = hotel && homeDest ? homeDest.cities.find((c) => hotelInCity(hotel, c)) : '';
  const backHref = homeDest && homeCity
    ? `/destinations/${homeDest.id}/${cityInfo(homeCity).slug}`
    : `/hotels/search?${new URLSearchParams({ dest: hotel?.city_label || '', checkIn: search.checkIn, checkOut: search.checkOut, rooms: encodeRooms(search.rooms) })}`;

  /** Hotel bookings live in the client's account like Umrah bookings: sign in (or sign up) before the details. */
  const continueToGuests = () => {
    if (!signedIn) {
      const q = new URLSearchParams(window.location.search);
      q.set('pick', picked.join(','));
      q.set('step', 'guests');
      const back = `${window.location.pathname}?${q}`;
      if (!openLogin({ method: 'choose', redirectTo: back })) window.location.href = `/app?login=1`;
      return;
    }
    setStep('guests');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const book = async () => {
    setFormError('');
    if (!me?.id && !me?.role) {
      if (!openLogin({ method: 'choose', redirectTo: window.location.pathname + window.location.search })) window.location.href = '/app?login=1';
      return;
    }
    if (guests.some((g, i) => i === 0 && g.name.trim().length < 4)) return setFormError('اكتب الاسم الكامل للضيف الأول كما في جواز السفر');
    if (staff && !client) return setFormError('اختر العميل الذي تحجز له');
    if (phone.replace(/\D/g, '').length < 8) return setFormError('رقم الهاتف مطلوب');
    setBusy(true);
    try {
      const res = await fetch('/api/hotels/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelId: hotel!.hotel_id,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          rooms: encodeRooms(search.rooms),
          offerIds: picked,
          guests: guests.filter((g) => g.name.trim()),
          phone,
          requests,
          customerId: staff ? client?.id : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) {
        openLogin({ method: 'choose', redirectTo: window.location.pathname + window.location.search });
        return;
      }
      if (!res.ok) throw new Error(d.error || 'تعذّر إرسال الحجز');
      setBooked({ id: d.reservation?.reservation_id, number: d.reservation?.reservation_number, total: d.reservation?.total_amount });
      setStep('done');
      const clean = new URLSearchParams(window.location.search);
      clean.delete('pick');
      clean.delete('step');
      window.history.replaceState(null, '', `${window.location.pathname}?${clean}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="hdet-error">
        <ShieldAlert aria-hidden />
        <strong>{error}</strong>
        <Link href="/hotels">العودة للبحث</Link>
      </div>
    );
  }
  if (!hotel) {
    return (
      <main className="page-main hdet max-w-7xl mx-auto px-4 sm:px-6 pb-16" aria-busy="true" aria-label="جاري تحميل الفندق">
        <div className="hdet-skel hdet-skel-gallery" />
        <div className="hdet-layout">
          <div className="hdet-main-col">
            <div className="hdet-skel hdet-skel-line is-title" />
            <div className="hdet-skel hdet-skel-line" />
            <div className="hdet-skel hdet-skel-card" />
            <div className="hdet-skel hdet-skel-card" />
          </div>
          <div className="hdet-skel hdet-skel-aside" />
        </div>
      </main>
    );
  }

  const tour = photoTour(hotel);
  const tab = tour.find((t) => t.id === tourTab) || tour[0];
  const shots = tab.shots;
  const shot = shots[Math.min(photo, shots.length - 1)];
  const papers = travelPapers(hotel.country);
  const facilities = hotelFacilities(hotel.hotel_id, hotel.amenities, hotel.offers.flat().map((o) => o.board));
  const filteredClients = (clients || []).filter((c) => !clientQuery || `${c.name} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(clientQuery.toLowerCase())).slice(0, 8);

  return (
    <main className="page-main hdet max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <Link href={backHref} className="hdet-back"><ArrowRight aria-hidden /> {homeCity ? `فنادق ${homeCity}` : 'كل الفنادق'}</Link>

      {hotel.supplier !== 'test' ? (
        <ol className="book-steps hdet-flow" aria-label="خطوات الحجز">
          {HOTEL_STEPS.map((item) => {
            const current = step === 'rooms' ? 1 : step === 'guests' ? 2 : 3;
            return (
              <li key={item.id} className={`book-step${current === item.id ? ' is-current' : ''}${current > item.id ? ' is-done' : ''}`} aria-current={current === item.id ? 'step' : undefined}>
                <span className="book-step-num">{current > item.id ? <Check className="w-3.5 h-3.5" /> : item.id}</span>
                <span className="book-step-label">{item.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {step === 'done' && booked ? (
        <motion.section className="hdet-done" initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
          <span className="hdet-done-ico"><Check aria-hidden /></span>
          <h1>أُرسل طلب الحجز</h1>
          <p>رقم الطلب <b dir="ltr">{booked.number}</b> — {hotel.name}، {arDate(search.checkIn, { day: 'numeric', month: 'long' })} ← {arDate(search.checkOut, { day: 'numeric', month: 'long' })}.</p>
          <ol className="hdet-steps">
            <li className="is-done">أُرسل الطلب</li>
            <li>تؤكد الوكالة التوفر مع الفندق</li>
            <li>دفع العربون {Math.round(DEPOSIT_PERCENT * 100)}٪ ({formatDzd(Math.round(booked.total * DEPOSIT_PERCENT))})</li>
            <li>قسيمة الفندق في حسابك</li>
          </ol>
          <div className="hdet-done-acts">
            {staff ? <Link href="/admin" className="hdet-cta">لوحة الطلبات</Link> : <Link href={`/my-bookings?id=${encodeURIComponent(booked.id)}`} className="hdet-cta">تابع حالة الحجز</Link>}
            <Link href="/hotels" className="hdet-ghost">بحث جديد</Link>
          </div>
        </motion.section>
      ) : (
        <>
          {/* Gallery */}
          {tour.length > 1 ? (
            <nav className="hdet-tour-tabs" aria-label="صور الفندق">
              {tour.map((t) => (
                <button key={t.id} type="button" aria-pressed={t.id === tab.id} onClick={() => { setTourTab(t.id); setPhoto(0); }}>
                  {t.id === 'all' ? <Images aria-hidden /> : null} {t.label} <span>{t.shots.length}</span>
                </button>
              ))}
            </nav>
          ) : null}
          <section className="hdet-gallery" style={{ ['--tile' as string]: color }}>
            {shot ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.img key={shot.src} {...photoProps(shot.src)} alt={shot.caption} className="hdet-main" decoding="async" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} />
                </AnimatePresence>
                <span className="hdet-caption">{shot.caption} <small>{Math.min(photo, shots.length - 1) + 1} / {shots.length}</small></span>
                {shots.length > 1 ? (
                  <div className="hdet-thumbs">
                    {shots.map((s, i) => (
                      <button key={s.src} type="button" aria-label={s.caption} aria-pressed={s.src === shot.src} onClick={() => setPhoto(i)}><img src={lightPhoto(s.src, 'sm')} alt="" loading="lazy" decoding="async" /></button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="hdet-noimg"><Building2 aria-hidden /><b>{hotel.name}</b><small>{hotel.city_label} · {hotel.country_label}</small></div>
            )}
          </section>

          <div className="hdet-layout">
            <div className="hdet-main-col">
              <header className="hdet-head">
                {hotel.supplier === 'test' ? <span className="hres-test is-inline">مزوّد تجريبي — للموظفين فقط، لا يُحجز</span> : null}
                <h1>{hotel.name}</h1>
                <p className="hdet-sub">
                  {hotel.stars ? <span className="hres-stars">{Array.from({ length: hotel.stars }, (_, i) => <Star key={i} aria-hidden />)}</span> : null}
                  <span><MapPin aria-hidden /> {[hotel.address || hotel.area, hotel.city_label, hotel.country_label].filter(Boolean).join(' · ')}</span>
                </p>
                <ul className="hdet-facts">
                  <li><CalendarDays aria-hidden /> {arDate(search.checkIn, { weekday: 'short', day: 'numeric', month: 'short' })} ← {arDate(search.checkOut, { weekday: 'short', day: 'numeric', month: 'short' })} · {hotel.nights} {hotel.nights === 1 ? 'ليلة' : 'ليالٍ'}</li>
                  <li><Users aria-hidden /> {guestsSummary(search.rooms)}</li>
                  {hotel.check_in_time ? <li><Clock aria-hidden /> الدخول من {hotel.check_in_time}{hotel.check_out_time ? ` · المغادرة قبل ${hotel.check_out_time}` : ''}</li> : null}
                </ul>
              </header>

              <details className="hdet-change">
                <summary>تغيير التواريخ أو الضيوف</summary>
                <HotelSearchBar
                  variant="compact"
                  initial={{ ...search, dest: hotel.city_label }}
                  initialLabel={hotel.city_label}
                  onSearch={(s) => {
                    window.location.href = `/hotels/${encodeURIComponent(hotel.hotel_id)}?${new URLSearchParams({ checkIn: s.checkIn, checkOut: s.checkOut, rooms: encodeRooms(s.rooms) })}`;
                  }}
                />
              </details>

              {step === 'rooms' ? (
                <section className="hdet-block" id="rooms">
                  <h2>اختر غرفتك ونوع الإقامة</h2>
                  {hotel.offers.map((list, i) => (
                    <div key={i} className="hdet-roomset">
                      {search.rooms.length > 1 ? (
                        <h3>الغرفة {i + 1} · {search.rooms[i].adults} بالغ{search.rooms[i].children ? ` + ${search.rooms[i].children} طفل` : ''}</h3>
                      ) : null}
                      {list.length === 0 ? (
                        <p className="hdet-none">لا توجد غرفة تناسب هذا العدد في هذه التواريخ.</p>
                      ) : (
                        <RoomOptions
                          offers={list}
                          picked={picked[i]}
                          fallbackPhoto={hotel.images[0]}
                          onPick={(offerId) => setPicked((ps) => ps.map((x, j) => (j === i ? offerId : x)))}
                        />
                      )}
                    </div>
                  ))}
                </section>
              ) : (
                <section className="hdet-block hdet-checkout">
                  <h2>بيانات الحجز</h2>
                  {staff ? (
                    <div className="hdet-client">
                      <label>العميل
                        <input value={client ? client.name : clientQuery} placeholder="ابحث بالاسم أو الهاتف" onChange={(e) => { setClient(null); setClientQuery(e.target.value); }} />
                      </label>
                      {!client && clientQuery ? (
                        <ul>
                          {clients === null ? <li className="is-muted">جاري التحميل…</li> : filteredClients.length ? filteredClients.map((c) => (
                            <li key={c.id}><button type="button" onClick={() => { setClient(c); if (c.phone) setPhone(c.phone); setGuests((g) => g.map((x, i) => (i === 0 && !x.name ? { ...x, name: c.name } : x))); }}>{c.name}<small dir="ltr">{c.phone || c.email || ''}</small></button></li>
                          )) : <li className="is-muted">لا عميل بهذا الاسم — أضفه من «الفريق والحسابات»</li>}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  {guests.map((g, i) => (
                    <div key={i} className="hdet-guest">
                      <h3>{search.rooms.length > 1 ? `ضيف الغرفة ${i + 1}` : 'الضيف الرئيسي'}</h3>
                      <div className="hdet-grid">
                        <label>الاسم الكامل (كما في الجواز)
                          <input value={g.name} required={i === 0} onChange={(e) => setGuests((gs) => gs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        </label>
                        <label>رقم الجواز (اختياري)
                          <input value={g.passport} dir="ltr" onChange={(e) => setGuests((gs) => gs.map((x, j) => (j === i ? { ...x, passport: e.target.value } : x)))} />
                        </label>
                      </div>
                    </div>
                  ))}
                  <div className="hdet-grid">
                    <label>الهاتف
                      <input value={phone} dir="ltr" inputMode="tel" placeholder="05xx xx xx xx" onChange={(e) => setPhone(e.target.value)} />
                    </label>
                    <label>طلبات خاصة (اختياري)
                      <input value={requests} placeholder="طابق مرتفع، سرير إضافي…" onChange={(e) => setRequests(e.target.value)} />
                    </label>
                  </div>
                  {formError ? <p className="hdet-form-error" role="alert">{formError}</p> : null}
                </section>
              )}

              {facilities.length ? (
                <section className="hdet-block">
                  <h2>المطعم والمرافق</h2>
                  <div className="hdet-facilities">
                    {facilities.map((f) => (
                      <figure key={f.id} className="hdet-facility">
                        <img src={lightPhoto(f.photo, 'sm')} alt={f.title} loading="lazy" decoding="async" />
                        <figcaption>
                          <b>{f.title}</b>
                          <small>{f.text}</small>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ) : null}

              {hotel.amenities.length ? (
                <section className="hdet-block">
                  <h2>خدمات الفندق</h2>
                  <ul className="hdet-amen">
                    {hotel.amenities.map((a) => {
                      const Icon = amenityIcon(a);
                      return <li key={a}><span><Icon aria-hidden /></span> {a}</li>;
                    })}
                  </ul>
                </section>
              ) : null}

              <section className="hdet-block" id="conditions">
                <h2>شروط الحجز والسفر</h2>
                <ul className="hdet-conds">
                  <li><Plane aria-hidden /><b>التأشيرة</b><span>{papers.visa}</span></li>
                  <li><FileText aria-hidden /><b>الوثائق</b><span>{papers.papers}</span></li>
                  <li>
                    <Clock aria-hidden /><b>الدخول والمغادرة</b>
                    <span>الدخول من الساعة {hotel.check_in_time || '14:00'} · المغادرة قبل {hotel.check_out_time || '12:00'}</span>
                  </li>
                  <li>
                    <BadgeCheck aria-hidden /><b>الإلغاء</b>
                    <span>{chosen.length ? [...new Set(chosen.map(cancelText))].join(' · ') : 'حسب الغرفة: يظهر مع كل خيار أعلاه.'}</span>
                  </li>
                  <li>
                    <CreditCard aria-hidden /><b>الدفع</b>
                    <span>لا دفع على الموقع. بعد أن تؤكّد الوكالة التوفّر مع الفندق تدفع عربون {Math.round(DEPOSIT_PERCENT * 100)}٪{complete ? ` (${formatDzd(Math.round(total * DEPOSIT_PERCENT))})` : ''} في الوكالة.</span>
                  </li>
                  <li><Users aria-hidden /><b>الأسعار</b><span>السعر نهائي بالدينار الجزائري للإقامة كاملة، ويتغيّر حسب التاريخ وعدد الضيوف.</span></li>
                </ul>
              </section>

              {hotel.description ? (
                <section className="hdet-block">
                  <h2>عن الفندق</h2>
                  <p className="hdet-desc">{hotel.description}</p>
                </section>
              ) : null}
              {hotel.policies ? (
                <section className="hdet-block">
                  <h2>شروط الفندق</h2>
                  <p className="hdet-desc">{hotel.policies}</p>
                </section>
              ) : null}
              {hotel.latitude != null && hotel.longitude != null ? (
                <section className="hdet-block">
                  <h2>الموقع</h2>
                  <iframe
                    className="hdet-map"
                    title="خريطة الفندق"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${hotel.longitude - 0.01}%2C${hotel.latitude - 0.006}%2C${hotel.longitude + 0.01}%2C${hotel.latitude + 0.006}&layer=mapnik&marker=${hotel.latitude}%2C${hotel.longitude}`}
                  />
                </section>
              ) : null}
            </div>

            {/* Sticky summary */}
            <aside className="hdet-summary">
              <h2>ملخص الحجز</h2>
              <p className="hdet-sum-hotel">{hotel.name}</p>
              <p className="hdet-sum-dates">{arDate(search.checkIn, { day: 'numeric', month: 'short' })} ← {arDate(search.checkOut, { day: 'numeric', month: 'short' })} · {hotel.nights} {hotel.nights === 1 ? 'ليلة' : 'ليالٍ'}</p>
              <ul>
                {chosen.map((o, i) => (
                  <li key={i}>
                    <span>{o.room_name}<small>{BOARD_LABEL[o.board]} · {cancelText(o)}</small></span>
                    <b>{formatDzd(o.total)}</b>
                  </li>
                ))}
              </ul>
              <div className="hdet-total">
                <span>المجموع</span>
                <strong>{complete ? formatDzd(total) : '—'}</strong>
              </div>
              {complete ? <p className="hdet-deposit">العربون {Math.round(DEPOSIT_PERCENT * 100)}٪ بعد تأكيد الوكالة: <b>{formatDzd(Math.round(total * DEPOSIT_PERCENT))}</b></p> : null}
              {step === 'rooms' ? (
                <button type="button" className="hdet-cta" disabled={!complete || hotel.supplier === 'test'} onClick={continueToGuests}>
                  {hotel.supplier === 'test' ? 'تجريبي — لا يُحجز' : signedIn ? 'متابعة الحجز' : 'سجّل الدخول وتابع الحجز'}
                </button>
              ) : (
                <>
                  <button type="button" className="hdet-cta" disabled={busy} onClick={book}>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} {signedIn ? 'تأكيد طلب الحجز' : 'سجّل الدخول للتأكيد'}
                  </button>
                  <button type="button" className="hdet-ghost" onClick={() => setStep('rooms')}>تغيير الغرف</button>
                </>
              )}
              <p className="hdet-fine">لن يُطلب منك الدفع الآن. تؤكد الوكالة التوفر مع الفندق ثم تدفع العربون في الوكالة.</p>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

export default function HotelPage() {
  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <Suspense fallback={<div className="hdet-loading">جاري التحميل…</div>}>
        <HotelInner />
      </Suspense>
      <Footer />
      <SakhrAgent />
    </div>
  );
}
