import { isClosedReservation, parseTripDate } from '@/lib/booking-catalog';
import type { Reservation } from '@/types';

/**
 * One way to show any booking — Umrah, Hajj, tourist trip or hotel — to the
 * client: its kind, where to follow it, and the same four steps everywhere
 * (navbar bag, «رحلتي», «حجوزاتي»).
 */
export type BookingKind = 'umrah' | 'hajj' | 'trip' | 'hotel';

type KindSource = Pick<Reservation, 'booking_kind' | 'trip_kind'>;

export function bookingKindOf(res: KindSource): BookingKind {
  if (res.booking_kind === 'HOTEL') return 'hotel';
  if (res.trip_kind === 'TOURISM') return 'trip';
  if (res.trip_kind === 'HAJJ') return 'hajj';
  return 'umrah';
}

export const BOOKING_KIND_LABEL: Record<BookingKind, string> = {
  umrah: 'عمرة',
  hajj: 'حج',
  trip: 'رحلة سياحية',
  hotel: 'فندق',
};

/** Where the client follows this booking. */
export function bookingHref(res: KindSource & Pick<Reservation, 'reservation_id'>): string {
  const id = encodeURIComponent(res.reservation_id);
  return bookingKindOf(res) === 'hotel' ? `/my-bookings?id=${id}` : `/portal?tab=program&res=${id}`;
}

/** Arrival / departure day of the booking (hotel check-in or programme start). */
export function bookingStart(res: Pick<Reservation, 'hotel_stay' | 'program'>): string {
  return res.hotel_stay?.check_in || res.program?.start_date || '';
}

export function bookingDateLabel(res: Pick<Reservation, 'hotel_stay' | 'program'>): string {
  const d = parseTripDate(bookingStart(res));
  return d ? d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

const ACCEPTED = ['CONFIRMED', 'PAYMENT_PENDING', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL', 'COMPLETED'];

export type BookingProgress = {
  /** 0 sent · 1 accepted · 2 deposit paid · 3 travelled / stayed. */
  done: number;
  closed: boolean;
  steps: string[];
  /** One short line: what happens next. */
  next: string;
};

export function bookingProgress(res: Reservation): BookingProgress {
  const kind = bookingKindOf(res);
  const s = String(res.status || '').toUpperCase();
  const paid = Number(res.paid_amount) || 0;
  const steps = ['أُرسل الطلب', 'قبول الوكالة', 'العربون — مؤكد', kind === 'hotel' ? 'الإقامة' : 'السفر'];
  if (isClosedReservation(s)) {
    const next = s === 'REJECTED' ? 'لم تتمكن الوكالة من قبوله' : s === 'EXPIRED' ? 'حلّ الموعد قبل التأكيد' : 'أُلغي الطلب';
    return { done: 0, closed: true, steps, next };
  }
  const accepted = ACCEPTED.includes(s);
  const deposit = accepted && (paid > 0 || ['PAID', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(s));
  const start = parseTripDate(bookingStart(res));
  const gone = s === 'COMPLETED' || Boolean(deposit && start && start.getTime() <= Date.now());
  const done = gone ? 3 : deposit ? 2 : accepted ? 1 : 0;
  const next = [
    'الوكالة تراجع طلبك — الرد عادة خلال 24 ساعة',
    'قُبل طلبك — ادفع العربون في الوكالة لتأكيده',
    kind === 'hotel' ? 'الحجز مؤكد — قسيمة الفندق في حسابك' : 'الحجز مؤكد — جهّز وثائق السفر',
    kind === 'hotel' ? 'الإقامة جارية أو انتهت' : 'الرحلة جارية أو انتهت',
  ][done];
  return { done, closed: false, steps, next };
}
