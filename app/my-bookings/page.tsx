'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  Hourglass,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PrintMenu from '@/components/booking/PrintMenu';
import { openLogin } from '@/components/auth/openLogin';
import { authHeaders } from '@/lib/api-client';
import { DEPOSIT_PERCENT, reservationStatusLabel } from '@/lib/booking-catalog';
import { AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_TEL } from '@/lib/agency-contact';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { cityPhoto, destinationPhoto } from '@/lib/destination-photos';
import { BOARD_LABEL, arDate, encodeRooms, formatDzd } from '@/lib/hotels/types';
import type { Reservation } from '@/types';

type Tab = 'upcoming' | 'past' | 'cancelled';
const REFRESH_MS = 30_000;
const PAID_STATES = ['CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL', 'COMPLETED'];

const today = () => new Date().toISOString().slice(0, 10);
const isClosed = (r: Reservation) => ['CANCELLED', 'REJECTED'].includes(String(r.status).toUpperCase());

function photoFor(r: Reservation): string {
  const city = r.hotel_stay?.city || '';
  if (city.includes('مكة')) return destinationPhoto('MAKKAH', 800);
  if (city.includes('المدينة')) return destinationPhoto('MADINAH', 800);
  const country = HOTEL_COUNTRIES.find((c) => c.label === r.hotel_stay?.country)?.id || '';
  return cityPhoto(city) || (country ? destinationPhoto(country, 800) : '');
}

function depositOf(r: Reservation) {
  return r.invoice?.depositAmount ?? Math.round((Number(r.total_amount) || 0) * DEPOSIT_PERCENT);
}

/** Where the booking stands: the four steps a client sees in the big booking apps. */
function progress(r: Reservation) {
  const s = String(r.status).toUpperCase();
  const stay = r.hotel_stay;
  const paid = Number(r.paid_amount) || 0;
  const accepted = !['REQUESTED', 'PENDING'].includes(s) && !isClosed(r);
  const confirmed = PAID_STATES.includes(s) && (paid > 0 || s === 'COMPLETED');
  const now = today();
  const stayed = Boolean(stay && (stay.check_out <= now || s === 'COMPLETED'));
  const staying = Boolean(stay && stay.check_in <= now && !stayed);
  const steps = [
    { id: 'sent', label: 'أُرسل الطلب', when: r.created_at ? arDate(r.created_at.slice(0, 10), { day: 'numeric', month: 'short' }) : '', done: true },
    { id: 'accepted', label: 'قبول الوكالة وتأكيد التوفر', when: r.agency_confirmed_at && accepted ? arDate(r.agency_confirmed_at.slice(0, 10), { day: 'numeric', month: 'short' }) : '', done: accepted },
    { id: 'deposit', label: 'دفع العربون — الحجز مؤكد', when: confirmed ? formatDzd(paid) : '', done: confirmed },
    { id: 'stay', label: staying ? 'الإقامة جارية' : 'الإقامة', when: stay ? arDate(stay.check_in, { day: 'numeric', month: 'short' }) : '', done: stayed },
  ];
  const current = steps.findIndex((x) => !x.done);
  return { steps, current, accepted, confirmed, stayed, staying };
}

function NextStep({ r }: { r: Reservation }) {
  const s = String(r.status).toUpperCase();
  const p = progress(r);
  const stay = r.hotel_stay;
  const remaining = Math.max(0, (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0));
  if (s === 'REJECTED' || s === 'CANCELLED') {
    const reason = String(r.agency_note || '').split('\n')[0];
    return (
      <div className="mbk-next is-bad">
        <X aria-hidden />
        <div>
          <strong>{s === 'REJECTED' ? 'لم تتمكن الوكالة من تأكيد هذا الحجز' : 'أُلغي هذا الحجز'}</strong>
          {reason && s === 'REJECTED' ? <p>السبب: {reason}</p> : <p>لم يُخصم أي مبلغ. يمكنك البحث عن فندق آخر في أي وقت.</p>}
        </div>
      </div>
    );
  }
  if (!p.accepted) {
    return (
      <div className="mbk-next">
        <Hourglass aria-hidden />
        <div>
          <strong>الوكالة تراجع طلبك الآن</strong>
          <p>نتأكد من توفر الغرف مع الفندق ونردّ عليك عادة خلال 24 ساعة. ستصلك رسالة في المحادثة وتتغيّر الحالة هنا تلقائياً.</p>
        </div>
      </div>
    );
  }
  if (!p.confirmed) {
    return (
      <div className="mbk-next is-warn">
        <Wallet aria-hidden />
        <div>
          <strong>قُبل طلبك — ادفع العربون لتأكيد الحجز</strong>
          <p>
            العربون <b>{formatDzd(depositOf(r))}</b> ({Math.round(DEPOSIT_PERCENT * 100)}٪) يُدفع في الوكالة — {AGENCY_ADDRESS}.
            {stay?.free_cancel_until ? ` الإلغاء مجاني حتى ${arDate(stay.free_cancel_until, { day: 'numeric', month: 'long' })}.` : ''}
          </p>
        </div>
      </div>
    );
  }
  if (p.stayed) {
    return (
      <div className="mbk-next is-good">
        <Check aria-hidden />
        <div>
          <strong>انتهت إقامتك — نتمنى أنها كانت ممتعة</strong>
          <p>شكراً لثقتك بساوث ستريت. احجز إقامتك القادمة متى شئت.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mbk-next is-good">
      <ShieldCheck aria-hidden />
      <div>
        <strong>{p.staying ? 'إقامة سعيدة!' : 'حجزك مؤكد'}</strong>
        <p>
          اطبع قسيمة الفندق أو احتفظ بها على هاتفك وقدّمها عند الوصول.
          {remaining > 0 ? ` المتبقي ${formatDzd(remaining)} يُسدَّد في الوكالة قبل السفر.` : ' المبلغ مدفوع بالكامل.'}
        </p>
      </div>
    </div>
  );
}

function BookingCard({ r, focused, onCancel, busy }: { r: Reservation; focused: boolean; onCancel: (r: Reservation) => void; busy: boolean }) {
  const s = r.hotel_stay;
  const p = progress(r);
  const closed = isClosed(r);
  const photo = photoFor(r);
  const paid = Number(r.paid_amount) || 0;
  const canCancel = !closed && paid <= 0 && Boolean(s && s.check_in > today());
  const guests = s ? s.rooms.reduce((n, x) => n + x.adults + x.children, 0) : r.travelers_count;
  const hotelHref = s
    ? `/hotels/${encodeURIComponent(s.hotel_id)}?${new URLSearchParams({
        checkIn: s.check_in,
        checkOut: s.check_out,
        rooms: encodeRooms(s.rooms.map((x) => ({ adults: x.adults, children: x.children, childAges: x.child_ages || [] }))),
      })}`
    : '/hotels';
  const tone = closed ? 'is-bad' : p.confirmed ? 'is-good' : p.accepted ? 'is-warn' : '';

  return (
    <article id={`b-${r.reservation_id}`} className={`mbk-card${focused ? ' is-focused' : ''}${closed ? ' is-closed' : ''}`}>
      <div className="mbk-media">
        {photo ? <img src={photo} alt="" loading="lazy" /> : <BedDouble aria-hidden />}
        <span className={`mbk-status ${tone}`}>{reservationStatusLabel(String(r.status))}</span>
      </div>
      <div className="mbk-main">
        <header className="mbk-head">
          <div>
            <h2><Link href={hotelHref}>{s?.hotel_name || r.package_name}</Link></h2>
            <p><MapPin aria-hidden /> {[s?.city, s?.country].filter(Boolean).join('، ')}</p>
          </div>
          <div className="mbk-ref">
            <small>رقم الحجز</small>
            <b dir="ltr">{r.reservation_number}</b>
          </div>
        </header>

        {s ? (
          <ul className="mbk-facts">
            <li>
              <CalendarDays aria-hidden />
              <span>
                <small>الوصول</small>
                <b>{arDate(s.check_in, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
              </span>
            </li>
            <li>
              <CalendarDays aria-hidden />
              <span>
                <small>المغادرة</small>
                <b>{arDate(s.check_out, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
              </span>
            </li>
            <li>
              <Clock aria-hidden />
              <span>
                <small>المدة</small>
                <b>{s.nights} {s.nights === 1 ? 'ليلة' : 'ليالٍ'}</b>
              </span>
            </li>
            <li>
              <Users aria-hidden />
              <span>
                <small>الضيوف</small>
                <b>{guests} · {s.rooms.length} {s.rooms.length === 1 ? 'غرفة' : 'غرف'}</b>
              </span>
            </li>
          </ul>
        ) : null}

        {closed ? null : (
          <ol className="mbk-track" aria-label="مراحل الحجز">
            {p.steps.map((st, i) => (
              <li key={st.id} className={st.done ? 'is-done' : i === p.current ? 'is-now' : ''}>
                <span className="mbk-dot" aria-hidden>{st.done ? <Check /> : i + 1}</span>
                <span className="mbk-step">
                  <b>{st.label}</b>
                  {st.when ? <small>{st.when}</small> : null}
                </span>
              </li>
            ))}
          </ol>
        )}

        <NextStep r={r} />

        <details className="mbk-more">
          <summary>تفاصيل الحجز والسعر</summary>
          <div className="mbk-more-in">
            {s ? (
              <ul className="mbk-rooms">
                {s.rooms.map((x, i) => (
                  <li key={i}>
                    <span>
                      <b><BedDouble aria-hidden /> {x.room_name}</b>
                      <small>{BOARD_LABEL[x.board]} · {x.adults} بالغ{x.children ? ` + ${x.children} طفل` : ''}{s.guests?.[i]?.name ? ` · ${s.guests[i].name}` : ''}</small>
                    </span>
                    <b>{formatDzd(x.total)}</b>
                  </li>
                ))}
              </ul>
            ) : null}
            <dl className="mbk-money">
              <div><dt>المجموع</dt><dd>{formatDzd(r.total_amount)}</dd></div>
              <div><dt>العربون ({Math.round(DEPOSIT_PERCENT * 100)}٪)</dt><dd>{formatDzd(depositOf(r))}</dd></div>
              <div><dt>المدفوع</dt><dd>{formatDzd(paid)}</dd></div>
              <div className="is-total"><dt>المتبقي</dt><dd>{formatDzd(Math.max(0, (Number(r.total_amount) || 0) - paid))}</dd></div>
            </dl>
            {s ? <p className="mbk-policy">{s.free_cancel_until ? `إلغاء مجاني حتى ${arDate(s.free_cancel_until, { day: 'numeric', month: 'long' })}` : 'هذا السعر غير قابل للاسترداد بعد تأكيد الحجز'}{s.requests ? ` · طلبات خاصة: ${s.requests}` : ''}</p> : null}
          </div>
        </details>

        <div className="mbk-acts">
          <PrintMenu reservationId={r.reservation_id} status={String(r.status)} className="mbk-btn" />
          <Link href="/portal?tab=chat" className="mbk-btn"><MessageCircle aria-hidden /> راسل الوكالة</Link>
          <a href={`tel:${AGENCY_PHONE_TEL}`} className="mbk-btn"><Phone aria-hidden /> <span dir="ltr">{AGENCY_PHONE}</span></a>
          {canCancel ? (
            <button type="button" className="mbk-btn is-danger" disabled={busy} onClick={() => onCancel(r)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />} إلغاء الحجز
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MyBookingsInner() {
  const focus = useSearchParams().get('id') || '';
  const [list, setList] = useState<Reservation[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [busyId, setBusyId] = useState('');
  const [flash, setFlash] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const load = useCallback(() => {
    fetch('/api/bookings', { headers: authHeaders(), cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) {
          setNeedLogin(true);
          setList([]);
          return;
        }
        const d = await r.json();
        setNeedLogin(false);
        setList(Array.isArray(d.hotelBookings) ? d.hotelBookings : []);
        setUpdatedAt(new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(() => setList((l) => l || []));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('southstreet:bookings-updated', load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('southstreet:bookings-updated', load);
    };
  }, [load]);

  const groups = useMemo(() => {
    const now = today();
    const all = list || [];
    const byCheckIn = (a: Reservation, b: Reservation) => String(a.hotel_stay?.check_in || '').localeCompare(String(b.hotel_stay?.check_in || ''));
    return {
      upcoming: all.filter((r) => !isClosed(r) && String(r.hotel_stay?.check_out || '9') > now).sort(byCheckIn),
      past: all.filter((r) => !isClosed(r) && String(r.hotel_stay?.check_out || '9') <= now).sort((a, b) => byCheckIn(b, a)),
      cancelled: all.filter(isClosed),
    };
  }, [list]);

  useEffect(() => {
    if (!list || !focus) return;
    const hit = list.find((r) => r.reservation_id === focus || r.reservation_number === focus);
    if (!hit) return;
    setTab(isClosed(hit) ? 'cancelled' : groups.upcoming.includes(hit) ? 'upcoming' : 'past');
    window.setTimeout(() => document.getElementById(`b-${hit.reservation_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [list, focus, groups]);

  const cancel = async (r: Reservation) => {
    if (!window.confirm(`إلغاء حجز ${r.hotel_stay?.hotel_name || r.package_name} (${r.reservation_number})؟`)) return;
    setBusyId(r.reservation_id);
    setFlash('');
    try {
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(r.reservation_id)}`, { method: 'DELETE', headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'تعذّر إلغاء الحجز');
      setFlash('أُلغي الحجز وأُبلغت الوكالة.');
      load();
    } catch (e: any) {
      setFlash(e.message);
    } finally {
      setBusyId('');
    }
  };

  const shown = groups[tab];
  const tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: 'القادمة' },
    { id: 'past', label: 'السابقة' },
    { id: 'cancelled', label: 'الملغاة' },
  ];

  return (
    <main className="page-main mbk" dir="rtl">
      <header className="mbk-top">
        <div>
          <h1>حجوزاتي</h1>
          <p>تابع حالة كل حجز فندق خطوة بخطوة — تتحدّث الصفحة تلقائياً عند ردّ الوكالة.</p>
        </div>
        <div className="mbk-top-acts">
          {updatedAt ? <small>آخر تحديث {updatedAt}</small> : null}
          <button type="button" className="mbk-btn" onClick={load} aria-label="تحديث"><RefreshCw aria-hidden /></button>
          <Link href="/hotels" className="mbk-btn is-primary"><Search aria-hidden /> حجز جديد</Link>
        </div>
      </header>

      {needLogin ? (
        <div className="mbk-empty">
          <ShieldCheck aria-hidden />
          <strong>سجّل الدخول لمتابعة حجوزاتك</strong>
          <button
            type="button"
            className="mbk-btn is-primary"
            onClick={() => {
              if (!openLogin({ method: 'choose', redirectTo: '/my-bookings' })) window.location.href = '/app?login=1';
            }}
          >
            تسجيل الدخول
          </button>
        </div>
      ) : list === null ? (
        <div className="mbk-loading"><Loader2 className="animate-spin" aria-hidden /> جاري تحميل حجوزاتك…</div>
      ) : (
        <>
          <nav className="mbk-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span>{groups[t.id].length}</span>
              </button>
            ))}
          </nav>
          {flash ? <p className="mbk-flash" role="status">{flash}</p> : null}
          {shown.length ? (
            <div className="mbk-list">
              {shown.map((r) => (
                <BookingCard key={r.reservation_id} r={r} focused={r.reservation_id === focus || r.reservation_number === focus} onCancel={cancel} busy={busyId === r.reservation_id} />
              ))}
            </div>
          ) : (
            <div className="mbk-empty">
              <BedDouble aria-hidden />
              <strong>{tab === 'upcoming' ? 'لا حجوزات قادمة' : tab === 'past' ? 'لا إقامات سابقة بعد' : 'لا حجوزات ملغاة'}</strong>
              {tab === 'upcoming' ? <Link href="/hotels" className="mbk-btn is-primary"><Search aria-hidden /> ابحث عن فندق</Link> : null}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function MyBookingsPage() {
  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar variant="light" />
      <Suspense fallback={<div className="mbk-loading">جاري التحميل…</div>}>
        <MyBookingsInner />
      </Suspense>
      <Footer />
    </div>
  );
}
