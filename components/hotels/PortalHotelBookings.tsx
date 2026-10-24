'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BedDouble, CalendarDays, Search } from 'lucide-react';
import PrintMenu from '@/components/booking/PrintMenu';
import { authHeaders } from '@/lib/api-client';
import { isClosedReservation, reservationStatusLabel } from '@/lib/booking-catalog';
import { BOARD_LABEL, arDate, formatDzd } from '@/lib/hotels/types';
import type { Reservation } from '@/types';

function tone(status: string) {
  const s = status.toUpperCase();
  if (isClosedReservation(s)) return 'is-bad';
  if (['CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(s)) return 'is-good';
  return '';
}

/** Client portal: the client's hotel-only bookings, with their documents. */
export default function PortalHotelBookings() {
  const [list, setList] = useState<Reservation[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch('/api/bookings', { headers: authHeaders(), cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setList(Array.isArray(d.hotelBookings) ? d.hotelBookings : []))
        .catch(() => setList([]));
    void load();
    window.addEventListener('southstreet:bookings-updated', load);
    return () => window.removeEventListener('southstreet:bookings-updated', load);
  }, []);

  if (!list) return null;
  return (
    <section className="phb" dir="rtl">
      <h3><BedDouble aria-hidden /> حجوزات الفنادق</h3>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          لا حجوزات فنادق بعد. <Link href="/hotels" className="font-bold text-emerald-700"><Search className="inline w-4 h-4" /> ابحث عن فندق</Link>
        </p>
      ) : (
        list.map((r) => {
          const s = r.hotel_stay;
          return (
            <article key={r.reservation_id} className="phb-item">
              <header>
                <strong>{s?.hotel_name || r.package_name}</strong>
                <small dir="ltr">{r.reservation_number}</small>
                <span className={`phb-status ${tone(String(r.status))}`}>{reservationStatusLabel(String(r.status))}</span>
              </header>
              {s ? (
                <small>
                  <CalendarDays className="inline w-3.5 h-3.5" /> {arDate(s.check_in, { day: 'numeric', month: 'long' })} ← {arDate(s.check_out, { day: 'numeric', month: 'long' })} · {s.nights} ليالٍ · {s.city}، {s.country}
                  <br />
                  {s.rooms.map((x) => `${x.room_name} (${BOARD_LABEL[x.board]})`).join(' + ')}
                  {s.free_cancel_until ? ` · إلغاء مجاني حتى ${arDate(s.free_cancel_until, { day: 'numeric', month: 'long' })}` : ' · غير قابل للاسترداد'}
                </small>
              ) : null}
              <small>المجموع {formatDzd(r.total_amount)} · المدفوع {formatDzd(r.paid_amount)}</small>
              <div className="phb-actions">
                <PrintMenu reservationId={r.reservation_id} status={String(r.status)} className="pipe-btn" />
                <Link href={`/my-bookings?id=${encodeURIComponent(r.reservation_id)}`} className="pipe-btn">تابع الحجز</Link>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
