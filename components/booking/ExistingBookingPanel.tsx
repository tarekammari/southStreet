'use client';

import Link from 'next/link';
import { Calendar, Clock, Plane, ShieldAlert, Loader2 } from 'lucide-react';
import { Reservation } from '@/types';
import {
  FREE_CANCEL_DAYS,
  canSelfManageReservation,
  daysUntilDeparture,
  ROOM_LABELS,
  isAgencyConfirmed,
} from '@/lib/booking-catalog';
import BookingPrintButton from '@/components/booking/BookingPrintButton';

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ExistingBookingPanel({
  reservation,
  cancelling,
  confirmCancel,
  onAskCancel,
  onAbortCancel,
  onConfirmCancel,
  onModify,
}: {
  reservation: Reservation;
  cancelling?: boolean;
  confirmCancel?: boolean;
  onAskCancel: () => void;
  onAbortCancel: () => void;
  onConfirmCancel: () => void;
  onModify: () => void;
}) {
  const startDate = reservation.program?.start_date;
  const manage = canSelfManageReservation(reservation.status, startDate);
  const days = daysUntilDeparture(startDate);
  const freeCancel = days === null || days >= FREE_CANCEL_DAYS;
  const confirmed = isAgencyConfirmed(reservation.status);

  return (
    <section className="book-manage" dir="rtl">
      <span className={`book-manage-badge ${confirmed ? '' : 'is-pending'}`}>
        {confirmed ? 'مؤكد' : 'بانتظار التأكيد'}
      </span>
      <h2>{confirmed ? 'حجزك جاهز' : 'طلبك وصل'}</h2>
      <p>
        {confirmed
          ? 'يمكنك عرض برنامجك أو تعديل الغرفة.'
          : 'فريق الوكالة يراجعه الآن. لا يمكن فتح طلب جديد قبل التأكيد أو الإلغاء.'}
      </p>

      {!confirmed ? (
        <p className="book-pending-note" role="status">
          <Clock className="w-4 h-4" /> سنخبرك عند تأكيد الطلب
        </p>
      ) : null}

      <div className="book-manage-card">
        <p className="book-manage-code">{reservation.reservation_number}</p>
        <h3>{reservation.package_name}</h3>
        <ul>
          <li><Calendar className="w-3.5 h-3.5" /> {formatDate(startDate)} — {formatDate(reservation.program?.end_date)}</li>
          <li><Plane className="w-3.5 h-3.5" /> {reservation.program?.airline || reservation.program?.room_label || ROOM_LABELS[reservation.room_type]}</li>
        </ul>
        <strong>{money(reservation.total_amount)}</strong>
      </div>

      {!manage.ok ? (
        <p className="book-error" role="status">{manage.reason}</p>
      ) : null}

      {confirmCancel ? (
        <div className="book-cancel-box">
          <p><ShieldAlert className="w-4 h-4" /> إلغاء الطلب؟</p>
          <p>
            {freeCancel
              ? 'الإلغاء مجاني الآن. يمكنك الحجز من جديد بعد ذلك.'
              : `تبقّى ${days} يوماً على السفر. قد تُطبَّق شروط الإلغاء.`}
          </p>
          <div className="book-nav" style={{ border: 0, margin: 0, padding: 0 }}>
            <button type="button" className="book-btn book-btn-ghost" onClick={onAbortCancel} disabled={cancelling}>تراجع</button>
            <button type="button" className="book-btn book-btn-danger" onClick={onConfirmCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              تأكيد الإلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="book-manage-actions">
          {confirmed ? (
            <Link href="/portal?tab=program" className="book-btn book-btn-primary no-underline">عرض برنامجي</Link>
          ) : null}
          <BookingPrintButton type="request" reservationId={reservation.reservation_id} />
          <button type="button" className="book-btn book-btn-ghost" onClick={onModify} disabled={!manage.ok}>تعديل</button>
          <button type="button" className="book-btn book-btn-danger-outline" onClick={onAskCancel} disabled={!manage.ok}>إلغاء</button>
        </div>
      )}
    </section>
  );
}
