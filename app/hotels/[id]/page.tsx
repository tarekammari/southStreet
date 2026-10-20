'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  MapPin,
  Maximize2,
  ShieldAlert,
  Star,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import HotelSearchBar from '@/components/hotels/HotelSearchBar';
import { openLogin } from '@/components/auth/openLogin';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { DEPOSIT_PERCENT } from '@/lib/booking-catalog';
import {
  BOARD_LABEL,
  arDate,
  decodeRooms,
  encodeRooms,
  formatDzd,
  guestsSummary,
  roomsLeftText,
  type HotelDetail,
  type RoomOffer,
} from '@/lib/hotels/types';

type Me = { id?: string; name?: string; role?: string; phone?: string } | null;
type Client = { id: string; name: string; phone?: string; email?: string };

const STAFF = new Set(['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'AGENCY_AGENT', 'admin', 'manager', 'accountant', 'agent']);

function cancelText(o: RoomOffer) {
  return o.free_cancel_until ? `إلغاء مجاني حتى ${arDate(o.free_cancel_until, { day: 'numeric', month: 'long' })}` : 'غير قابل للاسترداد';
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
        setPicked(h.offers.map((list) => (wanted && list.find((o) => o.room_id === wanted)?.offer_id) || list[0]?.offer_id || ''));
        setGuests(search.rooms.map(() => ({ name: '', passport: '' })));
      })
      .catch((e) => setError(e.message));
  }, [id, search, p]);

  const staff = Boolean(me?.role && STAFF.has(String(me.role)));
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
  const backHref = `/hotels/search?${new URLSearchParams({ dest: hotel?.city_label || '', checkIn: search.checkIn, checkOut: search.checkOut, rooms: encodeRooms(search.rooms) })}`;

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
  if (!hotel) return <div className="hdet-loading"><Loader2 className="animate-spin" aria-hidden /> جاري تحميل الفندق…</div>;

  const images = hotel.images.length ? hotel.images : [];
  const filteredClients = (clients || []).filter((c) => !clientQuery || `${c.name} ${c.phone || ''} ${c.email || ''}`.toLowerCase().includes(clientQuery.toLowerCase())).slice(0, 8);

  return (
    <main className="page-main hdet max-w-7xl mx-auto px-4 sm:px-6 pb-16">
      <Link href={backHref} className="hdet-back"><ArrowRight aria-hidden /> كل الفنادق</Link>

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
          <section className="hdet-gallery" style={{ ['--tile' as string]: color }}>
            {images.length ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.img key={images[photo]} src={images[photo]} alt={hotel.name} className="hdet-main" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} />
                </AnimatePresence>
                {images.length > 1 ? (
                  <div className="hdet-thumbs">
                    {images.slice(0, 6).map((src, i) => (
                      <button key={src} type="button" aria-pressed={i === photo} onClick={() => setPhoto(i)}><img src={src} alt="" loading="lazy" /></button>
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

              {hotel.amenities.length ? (
                <section className="hdet-block">
                  <h2>المرافق</h2>
                  <ul className="hdet-amen">{hotel.amenities.map((a) => <li key={a}><Check aria-hidden /> {a}</li>)}</ul>
                </section>
              ) : null}

              {step === 'rooms' ? (
                <section className="hdet-block" id="rooms">
                  <h2>اختر غرفتك</h2>
                  {hotel.offers.map((list, i) => (
                    <div key={i} className="hdet-roomset">
                      {search.rooms.length > 1 ? (
                        <h3>الغرفة {i + 1} · {search.rooms[i].adults} بالغ{search.rooms[i].children ? ` + ${search.rooms[i].children} طفل` : ''}</h3>
                      ) : null}
                      {list.length === 0 ? (
                        <p className="hdet-none">لا توجد غرفة تناسب هذا العدد في هذه التواريخ.</p>
                      ) : (
                        <div className="hdet-offers" role="radiogroup">
                          {list.map((o) => {
                            const on = picked[i] === o.offer_id;
                            return (
                              <button
                                key={o.offer_id}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                className={`hdet-offer${on ? ' is-on' : ''}`}
                                onClick={() => setPicked((ps) => ps.map((x, j) => (j === i ? o.offer_id : x)))}
                              >
                                <span className="hdet-radio" aria-hidden>{on ? <Check /> : null}</span>
                                <span className="hdet-offer-main">
                                  <b><BedDouble aria-hidden /> {o.room_name}</b>
                                  <small>
                                    {o.beds ? `${o.beds} · ` : ''}حتى {o.max_adults} بالغ{o.max_children ? ` + ${o.max_children} طفل` : ''}
                                    {o.size_m2 ? <> · <Maximize2 aria-hidden /> {o.size_m2} م²</> : null}
                                  </small>
                                  <span className="hdet-tags">
                                    <span className="is-board"><UtensilsCrossed aria-hidden /> {BOARD_LABEL[o.board]}</span>
                                    <span className={o.free_cancel_until ? 'is-free' : 'is-nonref'}>{o.free_cancel_until ? <BadgeCheck aria-hidden /> : null} {cancelText(o)}</span>
                                    {o.left <= 3 ? <span className="is-left">{roomsLeftText(o.left)}</span> : null}
                                  </span>
                                </span>
                                <span className="hdet-offer-price">
                                  <strong>{formatDzd(o.total)}</strong>
                                  <small>{formatDzd(o.per_night)} لليلة</small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
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
                <button type="button" className="hdet-cta" disabled={!complete || hotel.supplier === 'test'} onClick={() => { setStep('guests'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  {hotel.supplier === 'test' ? 'تجريبي — لا يُحجز' : 'متابعة الحجز'}
                </button>
              ) : (
                <>
                  <button type="button" className="hdet-cta" disabled={busy} onClick={book}>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} {me?.role ? 'تأكيد طلب الحجز' : 'سجّل الدخول للتأكيد'}
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
