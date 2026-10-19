'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Building2, Download, Globe2, Loader2, MapPin, Percent, RefreshCw, Search, Star } from 'lucide-react';
import { adminFetch } from '@/lib/webauthn-client';
import { jsonAuthHeaders } from '@/lib/api-client';
import { HOTEL_COUNTRIES } from '@/lib/tour';
import { reservationStatusLabel } from '@/lib/booking-catalog';
import { arDate, formatDzd } from '@/lib/hotels/types';
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

      {tab === 'bookings' ? <BookingsTab bookings={bookings} /> : null}
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

function BookingsTab({ bookings }: { bookings: Reservation[] | null }) {
  if (!bookings) return <p className="hadm-muted"><Loader2 className="animate-spin" aria-hidden /> جاري التحميل…</p>;
  if (!bookings.length) return <p className="hadm-muted">لا حجوزات فنادق بعد. الطلبات الجديدة تظهر أيضاً في «طلبات العمرة» لقبولها، ثم عند المحاسب للعربون.</p>;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => (b.hotel_stay?.check_out || '') >= today);
  const past = bookings.filter((b) => (b.hotel_stay?.check_out || '') < today);
  const row = (b: Reservation) => {
    const s = b.hotel_stay;
    return (
      <li key={b.reservation_id} className="hadm-booking">
        <div>
          <strong>{s?.hotel_name || b.package_name}</strong>
          <small>{b.customer_name} · <span dir="ltr">{b.reservation_number}</span></small>
          {s ? <small>{arDate(s.check_in, { day: 'numeric', month: 'short' })} ← {arDate(s.check_out, { day: 'numeric', month: 'short' })} · {s.nights} ليالٍ · {s.rooms.map((r) => r.room_name).join(' + ')}{s.free_cancel_until ? ` · إلغاء مجاني حتى ${arDate(s.free_cancel_until, { day: 'numeric', month: 'short' })}` : ''}</small> : null}
        </div>
        <span className={`hadm-status ${tone(String(b.status))}`}>{reservationStatusLabel(String(b.status))}</span>
        <span className="hadm-money"><b>{formatDzd(b.total_amount)}</b><small>مدفوع {formatDzd(b.paid_amount)}</small></span>
      </li>
    );
  };
  return (
    <>
      <h3 className="hadm-sub">القادمة ({upcoming.length})</h3>
      <ul className="hadm-list">{upcoming.map(row)}</ul>
      {past.length ? (
        <details className="hadm-past">
          <summary>المنتهية ({past.length})</summary>
          <ul className="hadm-list">{past.map(row)}</ul>
        </details>
      ) : null}
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
