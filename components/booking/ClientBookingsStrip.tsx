'use client';

import Link from 'next/link';
import { BedDouble, Hotel, MoonStar, Plane, type LucideIcon } from 'lucide-react';
import { isCurrentReservation, reservationStatusLabel } from '@/lib/booking-catalog';
import { BOOKING_KIND_LABEL, bookingDateLabel, bookingHref, bookingKindOf, bookingProgress, type BookingKind } from '@/lib/booking-progress';
import type { Reservation } from '@/types';

const KIND_ICON: Record<BookingKind, LucideIcon> = { umrah: MoonStar, hajj: MoonStar, trip: Plane, hotel: BedDouble };

/**
 * «حجوزاتي» on top of the client's «رحلتي»: every current booking — Umrah,
 * tourist trip, hotel — with its status and four steps. An Umrah / trip card
 * shows that booking below; a hotel card opens it in «حجوزاتي».
 */
export default function ClientBookingsStrip({
  reservations,
  hotelBookings,
  selectedId,
  onSelect,
}: {
  reservations: Reservation[];
  hotelBookings: Reservation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const current = [...reservations, ...hotelBookings]
    .filter((r) => isCurrentReservation(r))
    .sort((a, b) => String(a.hotel_stay?.check_in || a.program?.start_date || '').localeCompare(String(b.hotel_stay?.check_in || b.program?.start_date || '')));
  // One booking is already the page below; the strip only helps when there is a choice.
  if (current.length < 2 && !hotelBookings.some((r) => isCurrentReservation(r))) return null;

  return (
    <section className="cbs" dir="rtl" aria-label="حجوزاتي">
      <div className="cbs-head">
        <b>حجوزاتي</b>
        <span>{current.length} {current.length === 1 ? 'حجز' : 'حجوزات'} — اختر حجزاً لمتابعة حالته</span>
        <Link href="/hotels" className="cbs-add"><Hotel aria-hidden /> فندق</Link>
        <Link href="/packages" className="cbs-add"><Plane aria-hidden /> رحلة</Link>
      </div>
      <ul className="cbs-list">
        {current.map((r) => {
          const kind = bookingKindOf(r);
          const Icon = KIND_ICON[kind];
          const p = bookingProgress(r);
          const on = r.reservation_id === selectedId;
          const body = (
            <>
              <span className="cbs-top">
                <span className={`cbs-kind is-${kind}`}><Icon aria-hidden /> {BOOKING_KIND_LABEL[kind]}</span>
                <span className="cbs-status">{reservationStatusLabel(r.status)}</span>
              </span>
              <strong>{r.hotel_stay?.hotel_name || r.package_name}</strong>
              <small>{bookingDateLabel(r)} · <span dir="ltr">{r.reservation_number}</span></small>
              <span className="cbs-steps" aria-hidden>
                {p.steps.map((s, i) => <i key={s} className={i <= p.done ? 'is-done' : ''} />)}
              </span>
              <small className="cbs-next">{p.next}</small>
            </>
          );
          return (
            <li key={r.reservation_id}>
              {kind === 'hotel' ? (
                <Link href={bookingHref(r)} className={`cbs-card is-${kind}`}>{body}</Link>
              ) : (
                <button type="button" className={`cbs-card is-${kind}${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onSelect(r.reservation_id)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
