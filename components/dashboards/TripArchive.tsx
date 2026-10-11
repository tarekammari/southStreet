'use client';

/**
 * A client's finished trips, read-only: what they booked, where they stayed,
 * who guided them, what they paid, and their documents to print. Nothing can
 * be edited, cancelled, paid or uploaded here — the trip is over.
 */
import Link from 'next/link';
import { Archive, Calendar, MapPin, Plane, Star, UserRound } from 'lucide-react';
import type { Receipt, Reservation } from '@/types';
import PrintMenu from '@/components/booking/PrintMenu';
import BookingPrintButton from '@/components/booking/BookingPrintButton';
import { parseTripDate } from '@/lib/booking-catalog';

function range(start?: string, end?: string): string {
  const a = parseTripDate(start);
  const b = parseTripDate(end);
  if (!a) return '—';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return b ? `${a.toLocaleDateString('ar-DZ', opts)} — ${b.toLocaleDateString('ar-DZ', opts)}` : a.toLocaleDateString('ar-DZ', opts);
}

const money = (n: number) => `${Math.round(n || 0).toLocaleString('ar-DZ')} دج`;

export default function TripArchive({ trips, receipts = [] }: { trips: Reservation[]; receipts?: Receipt[] }) {
  return (
    <div className="trip-archive" dir="rtl">
      <header className="trip-archive-head">
        <span className="trip-archive-icon"><Archive className="w-5 h-5" /></span>
        <div>
          <h2>رحلاتك السابقة</h2>
          <p>تقبّل الله منكم. هذا أرشيف رحلاتك للاطلاع والطباعة فقط.</p>
        </div>
      </header>

      {trips.map((res) => {
        const p = res.program;
        const remaining = Math.max(0, (res.total_amount || 0) - (res.paid_amount || 0));
        const mine = receipts.filter((r) => r.packageName === (p?.package_name || res.package_name));
        return (
          <article key={res.reservation_id} className="trip-archive-card">
            <div className="trip-archive-top">
              <div>
                <span className="trip-archive-badge">رحلة منتهية</span>
                <h3>{p?.package_name || res.package_name}</h3>
                <p><Calendar className="w-3.5 h-3.5" /> {range(p?.start_date, p?.end_date)}{p?.duration_days ? ` · ${p.duration_days} يوماً` : ''}</p>
              </div>
              <b className="trip-archive-ref" dir="ltr">{res.reservation_number}</b>
            </div>

            <dl className="trip-archive-facts">
              <div><dt><MapPin className="w-3.5 h-3.5" /> الإقامة</dt><dd>{[p?.makkah_hotel_name, p?.madinah_hotel_name].filter(Boolean).join(' · ') || '—'}</dd></div>
              <div><dt><UserRound className="w-3.5 h-3.5" /> المرشد</dt><dd>{p?.morshid_name || '—'}</dd></div>
              <div><dt><Plane className="w-3.5 h-3.5" /> الطيران</dt><dd>{p?.airline || '—'}</dd></div>
              <div><dt>الغرفة والمسافرون</dt><dd>{p?.room_label || res.room_type} · {res.travelers_count || 1}</dd></div>
              <div><dt>الإجمالي</dt><dd>{money(res.total_amount)}</dd></div>
              <div><dt>المدفوع</dt><dd>{money(res.paid_amount)}{remaining > 0 ? <em className="trip-archive-due"> · متبقٍ {money(remaining)}</em> : null}</dd></div>
            </dl>

            <div className="trip-archive-actions">
              <PrintMenu reservationId={res.reservation_id} status={res.status} className="trip-action" />
              {mine.map((rcp) => (
                <BookingPrintButton key={rcp.id} type="receipt" receiptId={rcp.id} reservationId={res.reservation_id} label={`سند ${rcp.id}`} className="trip-action" />
              ))}
              <Link href="/portal?tab=account" className="trip-action no-underline"><Star className="w-3.5 h-3.5" /> قيّم رحلتك</Link>
            </div>
            {remaining > 0 ? <p className="trip-archive-note">لتسوية المبلغ المتبقي تواصل مع الوكالة.</p> : null}
          </article>
        );
      })}

      <div className="trip-archive-next">
        <p>تشتاق للعودة إلى الحرمين؟</p>
        <Link href="/packages" className="btn-pro-primary pilgrim-cta">اختر رحلتك القادمة</Link>
      </div>
    </div>
  );
}
