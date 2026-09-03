'use client';

import Link from 'next/link';
import { Calendar, Plane, ShieldAlert, Loader2 } from 'lucide-react';
import { Reservation } from '@/types';
import {
  FREE_CANCEL_DAYS,
  canSelfManageReservation,
  daysUntilDeparture,
  ROOM_LABELS,
  isAgencyConfirmed,
  reservationStatusLabel,
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
        {confirmed ? 'طلب عمرة قائم' : 'بانتظار تأكيد الوكالة'}
      </span>
      <h2>{confirmed ? 'لديك برنامج عمرة مؤكد' : 'طلبك قيد مراجعة الوكالة'}</h2>
      <p>
        {confirmed
          ? 'مثل مواقع الحجز الكبرى: لا نفتح طلباً ثانياً فوق الطلب الحالي. يمكنك عرض برنامجك، تعديل الغرفة والإضافات، أو إلغاء الطلب ثم الحجز من جديد.'
          : 'تم استلام طلبك. فريق الوكالة يراجعه خلال 24–48 ساعة. يمكنك طباعة طلب الحجز أو الفاتورة المؤقتة في أي وقت.'}
      </p>

      {!confirmed ? (
        <p className="book-pending-note" role="status">
          الحالة: {reservationStatusLabel(reservation.status)} · رمز التحقق: {reservation.document_verify_code || '—'}
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
        <small>المدفوع {money(reservation.paid_amount)} · المتبقي {money(Math.max(0, reservation.total_amount - reservation.paid_amount))}</small>
      </div>

      {!manage.ok ? (
        <p className="book-error" role="status">{manage.reason}</p>
      ) : null}

      {confirmCancel ? (
        <div className="book-cancel-box">
          <p><ShieldAlert className="w-4 h-4" /> تأكيد إلغاء الطلب</p>
          <p>
            {freeCancel
              ? `الإلغاء مجاني الآن (أكثر من ${FREE_CANCEL_DAYS} يوماً قبل السفر). المقعد يعود للباقة ويمكنك الحجز من جديد.`
              : `تبقّى ${days} يوماً على السفر. قد تُطبَّق شروط الإلغاء الخاصة بالوكالة. المقعد سيُحرَّر بعد التأكيد.`}
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
          ) : (
            <Link href="/portal?tab=reservations" className="book-btn book-btn-primary no-underline">متابعة الطلب</Link>
          )}
          <BookingPrintButton type="request" reservationId={reservation.reservation_id} />
          <BookingPrintButton type="invoice" reservationId={reservation.reservation_id} />
          {confirmed ? (
            <BookingPrintButton type="confirmation" reservationId={reservation.reservation_id} />
          ) : null}
          <button type="button" className="book-btn book-btn-ghost" onClick={onModify} disabled={!manage.ok}>تعديل الطلب</button>
          <button type="button" className="book-btn book-btn-danger-outline" onClick={onAskCancel} disabled={!manage.ok}>إلغاء الطلب</button>
        </div>
      )}
    </section>
  );
}
