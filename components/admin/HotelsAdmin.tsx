'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BedDouble,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Percent,
  Phone,
  RefreshCw,
  Search,
  Star,
  XCircle,
} from 'lucide-react';
import PrintMenu from '@/components/booking/PrintMenu';
import { adminFetch } from '@/lib/webauthn-client';
import { jsonAuthHeaders } from '@/lib/api-client';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { DEPOSIT_PERCENT, reservationStatusLabel } from '@/lib/booking-catalog';
import { waLink } from '@/lib/social';
import { BOARD_LABEL, arDate, formatDzd } from '@/lib/hotels/types';
import type { Reservation } from '@/types';

type Tab = 'bookings' | 'hotels' | 'import' | 'prices';
type HotelSummary = { hotel_id: string; name: string; city_label: string; country_label: string; stars: number; bookable: boolean; rooms: number; rates: number; source_type: string; shown: boolean };
type Candidate = { osm_id: string; name: string; name_local?: string; stars: number; address: string; latitude: number; longitude: number; website?: string; imported: boolean };

const openHotelsTable = () => window.dispatchEvent(new CustomEvent('ss:open-table', { detail: { table: 'hotels' } }));

/**
 * Admin «الفنادق والحجوزات»: hotel-only bookings, the hotels and whether
 * they can be booked, OpenStreetMap import (Super Admin) and the margin /
 * exchange rate for supplier prices (Super Admin).
 */
export default function HotelsAdmin({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>('bookings');
  const [bookings, setBookings] = useState<Reservation[] | null>(null);
  const [hotels, setHotels] = useState<HotelSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    fetch('/api/admin/hotel-bookings', { headers: jsonAuthHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setBookings(d.bookings || []))
      .catch(() => setBookings([]));
    fetch('/api/admin/hotel-inventory', { headers: jsonAuthHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHotels(d.hotels || []))
      .catch(() => setHotels([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'bookings', label: `حجوزات الفنادق${bookings ? ` (${bookings.length})` : ''}`, show: true },
    { id: 'hotels', label: `الفنادق${hotels ? ` (${hotels.length})` : ''}`, show: true },
    { id: 'import', label: 'استيراد من الخريطة', show: isSuperAdmin },
    { id: 'prices', label: 'الهامش والصرف', show: isSuperAdmin },
  ];

  return (
    <section className="inn-panel hadm" dir="rtl">
      <header className="hadm-head">
        <div>
          <h2><BedDouble aria-hidden /> الفنادق والحجوزات</h2>
          <p>حجوزات الفنادق، الفنادق القابلة للحجز، واستيراد فنادق مدينة من الخريطة.</p>
        </div>
        <div className="hadm-head-acts">
          <Link href="/hotels" target="_blank" className="hadm-btn"><Search aria-hidden /> بحث الفنادق</Link>
          <button type="button" className="hadm-btn" onClick={load} aria-label="تحديث"><RefreshCw aria-hidden /></button>
        </div>
      </header>
      <nav className="hadm-tabs" role="tablist">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {error ? <p className="pkg-offer-error">{error}</p> : null}

      {tab === 'bookings' ? <BookingsTab bookings={bookings} onChanged={load} /> : null}
      {tab === 'hotels' ? <HotelsTab hotels={hotels} /> : null}
      {tab === 'import' && isSuperAdmin ? <ImportTab onImported={load} /> : null}
      {tab === 'prices' && isSuperAdmin ? <PricesTab /> : null}
    </section>
  );
}

function tone(status: string) {
  const s = status.toUpperCase();
  if (s === 'REJECTED' || s === 'CANCELLED') return 'is-bad';
  if (['CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(s)) return 'is-good';
  if (s === 'PAYMENT_PENDING') return 'is-warn';
  return '';
}

type BookingFilter = 'new' | 'deposit' | 'confirmed' | 'past' | 'closed';

const PAID_STATES = ['CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL', 'COMPLETED'];

function bookingStage(b: Reservation, today: string): BookingFilter {
  const s = String(b.status).toUpperCase();
  if (s === 'REJECTED' || s === 'CANCELLED') return 'closed';
  if (s === 'REQUESTED' || s === 'PENDING') return 'new';
  if ((b.hotel_stay?.check_out || '9') <= today) return 'past';
  if (PAID_STATES.includes(s) && (Number(b.paid_amount) || 0) > 0) return 'confirmed';
  return 'deposit';
}

function BookingsTab({ bookings, onChanged }: { bookings: Reservation[] | null; onChanged: () => void }) {
  const [filter, setFilter] = useState<BookingFilter | null>(null);
  const [openId, setOpenId] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [rejectFor, setRejectFor] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch('/api/bookings/confirm', { headers: jsonAuthHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCanApprove(Boolean(d.permissions?.canApprove)))
      .catch(() => setCanApprove(false));
  }, []);

  const groups = useMemo(() => {
    const g: Record<BookingFilter, Reservation[]> = { new: [], deposit: [], confirmed: [], past: [], closed: [] };
    for (const b of bookings || []) g[bookingStage(b, today)].push(b);
    const byCheckIn = (a: Reservation, b: Reservation) => String(a.hotel_stay?.check_in || '').localeCompare(String(b.hotel_stay?.check_in || ''));
    g.new.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    g.deposit.sort(byCheckIn);
    g.confirmed.sort(byCheckIn);
    g.past.sort((a, b) => byCheckIn(b, a));
    g.closed.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return g;
  }, [bookings, today]);

  if (!bookings) return <p className="hadm-muted"><Loader2 className="animate-spin" aria-hidden /> جاري التحميل…</p>;
  if (!bookings.length) return <p className="hadm-muted">لا حجوزات فنادق بعد. كل طلب جديد من صفحة الفنادق يظهر هنا لقبوله، ثم عند المحاسب للعربون.</p>;

  const active = filter || (groups.new.length ? 'new' : groups.deposit.length ? 'deposit' : 'confirmed');
  const filters: { id: BookingFilter; label: string }[] = [
    { id: 'new', label: 'طلبات جديدة' },
    { id: 'deposit', label: 'بانتظار العربون' },
    { id: 'confirmed', label: 'مؤكدة قادمة' },
    { id: 'past', label: 'منتهية' },
    { id: 'closed', label: 'ملغاة / مرفوضة' },
  ];

  const act = async (b: Reservation, action: 'confirm' | 'reject') => {
    if (action === 'reject' && reason.trim().length < 3) {
      setMsg('اكتب سبب الرفض — يصل إلى العميل');
      return;
    }
    setBusyId(b.reservation_id);
    setMsg('');
    try {
      const r = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ reservationId: b.reservation_id, action, note: action === 'reject' ? reason.trim() : '' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'تعذّر معالجة الطلب');
      setMsg(`${b.reservation_number}: ${d.message || 'تم'}`);
      setRejectFor('');
      setReason('');
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
      onChanged();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusyId('');
    }
  };

  const row = (b: Reservation) => {
    const s = b.hotel_stay;
    const open = openId === b.reservation_id;
    const stage = bookingStage(b, today);
    const guests = s ? s.rooms.reduce((n, r) => n + r.adults + r.children, 0) : b.travelers_count;
    const remaining = Math.max(0, (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0));
    const wa = waLink(b.customer_phone || '', `مرحباً ${b.customer_name}، بخصوص حجز الفندق ${b.reservation_number} — ${s?.hotel_name || ''}`);
    return (
      <li key={b.reservation_id} className={`hadm-booking${open ? ' is-open' : ''}${stage === 'new' ? ' is-new' : ''}`}>
        <button type="button" className="hadm-booking-row" aria-expanded={open} onClick={() => setOpenId(open ? '' : b.reservation_id)}>
          <div>
            <strong>{s?.hotel_name || b.package_name}</strong>
            <small>{b.customer_name} · <span dir="ltr">{b.reservation_number}</span>{s ? ` · ${s.city}` : ''}</small>
            {s ? <small><CalendarDays aria-hidden /> {arDate(s.check_in, { day: 'numeric', month: 'short' })} ← {arDate(s.check_out, { day: 'numeric', month: 'short' })} · {s.nights} ليالٍ · {guests} ضيوف · {s.rooms.map((r) => r.room_name).join(' + ')}</small> : null}
          </div>
          <span className={`hadm-status ${tone(String(b.status))}`}>{reservationStatusLabel(String(b.status))}</span>
          <span className="hadm-money"><b>{formatDzd(b.total_amount)}</b><small>مدفوع {formatDzd(b.paid_amount)}</small></span>
          <ChevronDown className="hadm-chev" aria-hidden />
        </button>
        {open ? (
          <div className="hadm-booking-more">
            <div className="hadm-booking-grid">
              <section>
                <h4>العميل</h4>
                <p><b>{b.customer_name}</b></p>
                {b.customer_phone ? (
                  <p className="hadm-contact">
                    <a href={`tel:${b.customer_phone}`} dir="ltr"><Phone aria-hidden /> {b.customer_phone}</a>
                    {wa ? <a href={wa} target="_blank" rel="noreferrer"><MessageCircle aria-hidden /> واتساب</a> : null}
                  </p>
                ) : null}
                {b.customer_email ? <p dir="ltr" className="hadm-dim">{b.customer_email}</p> : null}
                {s?.guests?.length ? <p className="hadm-dim">الضيوف: {s.guests.map((g) => `${g.name}${g.passport ? ` (${g.passport})` : ''}`).join('، ')}</p> : null}
              </section>
              <section>
                <h4>الغرف</h4>
                <ul className="hadm-rooms">
                  {s?.rooms.map((r, i) => (
                    <li key={i}><span>{r.room_name} · {BOARD_LABEL[r.board]} · {r.adults} بالغ{r.children ? ` + ${r.children} طفل` : ''}</span><b>{formatDzd(r.total)}</b></li>
                  ))}
                </ul>
                <p className="hadm-dim">{s?.free_cancel_until ? `إلغاء مجاني حتى ${arDate(s.free_cancel_until, { day: 'numeric', month: 'long' })}` : 'غير قابل للاسترداد'}</p>
                {s?.requests ? <p className="hadm-req">طلبات خاصة: {s.requests}</p> : null}
              </section>
              <section>
                <h4>المبالغ</h4>
                <p>المجموع <b>{formatDzd(b.total_amount)}</b></p>
                <p>العربون <b>{formatDzd(b.invoice?.depositAmount ?? Math.round((Number(b.total_amount) || 0) * DEPOSIT_PERCENT))}</b></p>
                <p>المتبقي <b>{formatDzd(remaining)}</b></p>
                <p className="hadm-dim">أُرسل {b.created_at ? arDate(b.created_at.slice(0, 10), { day: 'numeric', month: 'short' }) : ''}{b.agency_confirmed_by ? ` · عالجه ${b.agency_confirmed_by}` : ''}</p>
              </section>
            </div>
            {stage === 'closed' && b.agency_note ? <p className="hadm-req">{b.agency_note.split('\n')[0]}</p> : null}
            <div className="hadm-booking-acts">
              {stage === 'new' && canApprove ? (
                rejectFor === b.reservation_id ? (
                  <>
                    <input value={reason} autoFocus placeholder="سبب الرفض (يصل إلى العميل) — مثلاً: الفندق ممتلئ في هذه التواريخ" onChange={(e) => setReason(e.target.value)} />
                    <button type="button" className="hadm-btn is-danger" disabled={busyId === b.reservation_id} onClick={() => act(b, 'reject')}>
                      {busyId === b.reservation_id ? <Loader2 className="animate-spin" aria-hidden /> : <XCircle aria-hidden />} تأكيد الرفض
                    </button>
                    <button type="button" className="hadm-btn" onClick={() => { setRejectFor(''); setReason(''); }}>تراجع</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="hadm-btn is-primary" disabled={busyId === b.reservation_id} onClick={() => act(b, 'confirm')}>
                      {busyId === b.reservation_id ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />} قبول — الغرف متوفرة
                    </button>
                    <button type="button" className="hadm-btn is-danger" onClick={() => { setRejectFor(b.reservation_id); setReason(''); }}>
                      <XCircle aria-hidden /> رفض
                    </button>
                  </>
                )
              ) : null}
              {stage === 'new' && !canApprove ? <p className="hadm-dim">قبول الطلب أو رفضه من صلاحية المشرف.</p> : null}
              {stage === 'deposit' ? <p className="hadm-dim">مقبول — يسجّل المحاسب العربون من «الطلبات ← بانتظار العربون» فيتأكد الحجز تلقائياً ويُبلَّغ العميل.</p> : null}
              <PrintMenu reservationId={b.reservation_id} status={String(b.status)} className="hadm-btn" />
            </div>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <nav className="hadm-filters" aria-label="تصفية الحجوزات">
        {filters.map((f) => (
          <button key={f.id} type="button" aria-pressed={active === f.id} className={f.id === 'new' && groups.new.length ? 'has-new' : ''} onClick={() => setFilter(f.id)}>
            {f.label} <span>{groups[f.id].length}</span>
          </button>
        ))}
      </nav>
      {msg ? <p className="hadm-msg">{msg}</p> : null}
      {groups[active].length ? <ul className="hadm-list">{groups[active].map(row)}</ul> : <p className="hadm-muted">لا حجوزات في هذه القائمة.</p>}
    </>
  );
}

function HotelsTab({ hotels }: { hotels: HotelSummary[] | null }) {
  if (!hotels) return <p className="hadm-muted"><Loader2 className="animate-spin" aria-hidden /> جاري التحميل…</p>;
  const ready = hotels.filter((h) => h.bookable && h.rooms && h.rates);
  return (
    <>
      <p className="hadm-muted">
        {ready.length} فندق يُحجز الآن من الموقع. لتفعيل فندق: افتح «الجداول ← الفنادق»، ثم في بطاقة الفندق قسم «الحجز عبر الموقع» أضف الغرف والأسعار وفعّل الحجز.
      </p>
      <button type="button" className="hadm-btn is-primary" onClick={openHotelsTable}><Building2 aria-hidden /> فتح جدول الفنادق</button>
      <ul className="hadm-list">
        {hotels.map((h) => (
          <li key={h.hotel_id} className="hadm-hotel">
            <div>
              <strong>{h.name} {h.stars ? <em className="hres-stars">{Array.from({ length: h.stars }, (_, i) => <Star key={i} aria-hidden />)}</em> : null}</strong>
              <small><MapPin aria-hidden /> {h.city_label}{h.country_label ? ` · ${h.country_label}` : ''}{h.source_type === 'osm' ? ' · من الخريطة' : ''}</small>
            </div>
            <span className="hadm-chips">
              <span className={h.rooms ? 'is-ok' : ''}>{h.rooms} غرف</span>
              <span className={h.rates ? 'is-ok' : ''}>{h.rates} أسعار</span>
              <span className={h.bookable && h.rooms && h.rates ? 'is-good' : 'is-off'}>{h.bookable ? (h.rooms && h.rates ? 'يُحجز' : 'مفعّل — ناقص') : 'غير مفعّل'}</span>
              <span className={h.shown ? 'is-ok' : 'is-off'}>{h.shown ? 'ظاهر في صفحة الفنادق' : 'مخفي'}</span>
              {h.source_type === 'sample' ? <span className="is-sample">نموذجي — راجع الاسم والأسعار</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ImportTab({ onImported }: { onImported: () => void }) {
  const [country, setCountry] = useState('TR');
  const [city, setCity] = useState('إسطنبول');
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const cities = HOTEL_COUNTRIES.find((c) => c.id === country)?.cities.filter((c) => !/^[A-Z]+$/.test(c)) || [];

  const search = async () => {
    setBusy(true);
    setMsg('');
    setItems(null);
    setPicked(new Set());
    try {
      const r = await fetch(`/api/admin/hotel-import?${new URLSearchParams({ city, country })}`, { headers: jsonAuthHeaders(), cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setItems(d.items || []);
      setMsg(`${(d.items || []).length} فندق في الخريطة — ${d.place || city}`);
    } catch (e: any) {
      setMsg(e.message || 'تعذّر البحث');
    } finally {
      setBusy(false);
    }
  };

  const importNow = async () => {
    if (!items) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/hotel-import', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ city, country, items: items.filter((i) => picked.has(i.osm_id)) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(d.message);
      setItems((list) => (list || []).map((i) => (picked.has(i.osm_id) ? { ...i, imported: true } : i)));
      setPicked(new Set());
      onImported();
    } catch (e: any) {
      setMsg(e.message || 'تعذّر الاستيراد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hadm-import">
      <p className="hadm-muted">
        <Globe2 aria-hidden /> يجلب أسماء الفنادق ونجومها وعناوينها ومواقعها من OpenStreetMap (بيانات مفتوحة ومجانية — بدون أسعار). تُضاف مخفية وغير قابلة للحجز حتى تضيف الصور والغرف والأسعار.
      </p>
      <div className="hadm-import-bar">
        <select value={country} onChange={(e) => { setCountry(e.target.value); const c = HOTEL_COUNTRIES.find((x) => x.id === e.target.value)?.cities.find((x) => !/^[A-Z]+$/.test(x)); if (c) setCity(c); }}>
          {HOTEL_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input list="hadm-cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="المدينة" />
        <datalist id="hadm-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        <button type="button" className="hadm-btn is-primary" disabled={busy || city.trim().length < 2} onClick={search}>
          {busy && !items ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} ابحث في الخريطة
        </button>
      </div>
      {msg ? <p className="hadm-msg">{msg}</p> : null}
      {items && items.length ? (
        <>
          <div className="hadm-import-acts">
            <button type="button" onClick={() => setPicked(new Set(items.filter((i) => !i.imported).slice(0, 60).map((i) => i.osm_id)))}>تحديد الكل</button>
            <button type="button" onClick={() => setPicked(new Set())}>إلغاء التحديد</button>
            <span>{picked.size} محدد</span>
            <button type="button" className="hadm-btn is-primary" disabled={busy || !picked.size} onClick={importNow}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} استيراد المحدد
            </button>
          </div>
          <ul className="hadm-list hadm-cands">
            {items.map((i) => (
              <li key={i.osm_id} className={i.imported ? 'is-imported' : ''}>
                <label>
                  <input type="checkbox" disabled={i.imported} checked={picked.has(i.osm_id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(i.osm_id); else n.delete(i.osm_id); return n; })} />
                  <span>
                    <strong>{i.name} {i.stars ? <em className="hres-stars">{Array.from({ length: i.stars }, (_, k) => <Star key={k} aria-hidden />)}</em> : null}</strong>
                    <small>{i.name_local ? `${i.name_local} · ` : ''}{i.address || `${i.latitude.toFixed(4)}, ${i.longitude.toFixed(4)}`}{i.imported ? ' · مستورد' : ''}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="hadm-attr">بيانات الخريطة © OpenStreetMap contributors</p>
        </>
      ) : null}
    </div>
  );
}

function PricesTab() {
  const [margin, setMargin] = useState('');
  const [rate, setRate] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/hotel-settings', { headers: jsonAuthHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setMargin(String(d.margin_percent ?? 10));
        setRate(d.supplier_rate_eur ? String(d.supplier_rate_eur) : '');
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await adminFetch('/api/admin/hotel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ margin_percent: Number(margin), supplier_rate_eur: rate ? Number(rate) : null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg('حُفظت الإعدادات ✓');
    } catch (e: any) {
      setMsg(e.message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hadm-prices">
      <p className="hadm-muted">
        <Percent aria-hidden /> أسعار فنادقكم (العقود) تُدخل بالدينار كما تُباع. الهامش وسعر الصرف يُطبّقان على أسعار المزوّدين (Hotelbeds / RateHawk عند ربطهما، والمزوّد التجريبي الآن).
      </p>
      <div className="hadm-import-bar">
        <label>هامش الوكالة %<input type="number" min={0} max={100} step={0.5} value={margin} onChange={(e) => setMargin(e.target.value)} /></label>
        <label>سعر 1 يورو بالدينار<input type="number" min={0} step={0.5} value={rate} placeholder="مثال: 250" onChange={(e) => setRate(e.target.value)} /></label>
        <button type="button" className="hadm-btn is-primary" disabled={busy} onClick={save}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : null} حفظ</button>
      </div>
      {msg ? <p className="hadm-msg">{msg}</p> : null}
    </div>
  );
}
