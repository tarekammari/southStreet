'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, Reservation, CustomerDocument, Receipt } from '@/types';
import {
  Calendar,
  MapPin,
  Plane,
  UserRound,
  Loader2,
  FileText,
  CreditCard,
  Upload,
} from 'lucide-react';
import {
  canSelfManageReservation,
  isActiveReservation,
  isAgencyConfirmed,
  reservationStatusLabel,
} from '@/lib/booking-catalog';
import { PilgrimHomeSection } from '@/lib/roles';
import BookingPrintButton from '@/components/booking/BookingPrintButton';
import UmrahCountdown from '@/components/booking/UmrahCountdown';
import UmrahCounter from '@/components/UmrahCounter';

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' });
}

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

export default function PilgrimProgram({
  currentUser,
  reservation,
  reservations = [],
  documents = [],
  receipts = [],
  initialSection = 'trip',
  onChanged,
  onUploadDocument,
  uploading,
}: {
  currentUser: User;
  reservation: Reservation | null;
  reservations?: Reservation[];
  documents?: CustomerDocument[];
  receipts?: Receipt[];
  initialSection?: PilgrimHomeSection;
  onChanged?: () => void;
  onUploadDocument?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
}) {
  const [section, setSection] = useState<PilgrimHomeSection>(initialSection);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const active = reservation && isActiveReservation(reservation.status) ? reservation : null;

  if (!active) {
    return (
      <div className="pilgrim-empty" dir="rtl">
        <Plane className="pilgrim-empty-icon" />
        <h2>ابدأ عمرتك</h2>
        <p>اختر البرنامج والغرفة، ثم أرسل الطلب. الوكالة تؤكده هنا.</p>
        <Link href="/book" className="btn-pro-primary pilgrim-cta">حجز</Link>
      </div>
    );
  }

  const program = active.program;
  const appointments = active.appointments || [];
  const manage = canSelfManageReservation(active.status, program?.start_date);
  const confirmed = isAgencyConfirmed(active.status);

  const cancelBooking = async () => {
    setCancelling(true);
    setError('');
    try {
      const token = localStorage.getItem('south_street_token');
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(active.reservation_id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر الإلغاء');
        return;
      }
      onChanged?.();
    } catch {
      setError('تعذّر الإلغاء');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="pilgrim-home" dir="rtl">
      <div className="pilgrim-seg" role="tablist">
        <button type="button" className={section === 'trip' ? 'is-on' : ''} onClick={() => setSection('trip')}>الرحلة</button>
        <button type="button" className={section === 'docs' ? 'is-on' : ''} onClick={() => setSection('docs')}>وثائق</button>
        <button type="button" className={section === 'pay' ? 'is-on' : ''} onClick={() => setSection('pay')}>دفع</button>
        <button type="button" className={section === 'rites' ? 'is-on' : ''} onClick={() => setSection('rites')}>مناسك</button>
      </div>

      {section === 'trip' ? (
        <div className="space-y-4">
          {confirmed ? (
            <UmrahCountdown startDate={program?.start_date} />
          ) : (
            <p className="pilgrim-wait">بانتظار تأكيد الوكالة</p>
          )}

          <article className="pilgrim-trip">
            <div className="pilgrim-trip-top">
              <span className={`pilgrim-chip ${confirmed ? 'is-ok' : 'is-wait'}`}>
                {confirmed ? 'مؤكد' : reservationStatusLabel(active.status)}
              </span>
              <b>{active.reservation_number}</b>
            </div>
            <h2>{program?.package_name || active.package_name}</h2>
            <p className="pilgrim-meta">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(program?.start_date)} — {formatDate(program?.end_date)}
              <span>·</span>
              {program?.room_label || active.room_type}
            </p>
          </article>

          <div className="pilgrim-facts">
            <div>
              <Plane className="w-4 h-4" />
              <strong>{program?.airline || '—'}</strong>
              <span>{program?.departure_city || 'الجزائر'} ➜ المدينة</span>
            </div>
            <div>
              <MapPin className="w-4 h-4" />
              <strong>{program?.makkah_hotel_name || '—'}</strong>
              <span>{program?.madinah_hotel_name || ''}</span>
            </div>
            <div>
              <UserRound className="w-4 h-4" />
              <strong>{program?.morshid_name || 'المرشد'}</strong>
              <span dir="ltr">{program?.morshid_phone || ''}</span>
            </div>
          </div>

          {appointments.length ? (
            <ol className="pilgrim-times">
              {appointments.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.when}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="pilgrim-actions">
            <BookingPrintButton type="request" reservationId={active.reservation_id} label="طلب" className="pilgrim-ghost" />
            <BookingPrintButton type="invoice" reservationId={active.reservation_id} label="فاتورة" className="pilgrim-ghost" />
            {confirmed ? (
              <BookingPrintButton type="confirmation" reservationId={active.reservation_id} label="تأكيد" className="pilgrim-ghost" />
            ) : null}
            {manage.ok ? (
              <>
                <Link href={`/book?edit=${encodeURIComponent(active.reservation_id)}`} className="pilgrim-ghost no-underline">تعديل</Link>
                <button type="button" className="pilgrim-ghost is-danger" onClick={() => setConfirmCancel(true)}>إلغاء</button>
              </>
            ) : null}
          </div>

          {error ? <p className="book-error">{error}</p> : null}
          {confirmCancel ? (
            <div className="book-cancel-box">
              <p>إلغاء الطلب؟</p>
              <div className="book-nav" style={{ border: 0, margin: 0, paddingTop: 8 }}>
                <button type="button" className="book-btn book-btn-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>لا</button>
                <button type="button" className="book-btn book-btn-danger" onClick={cancelBooking} disabled={cancelling}>
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  نعم
                </button>
              </div>
            </div>
          ) : null}

          {reservations.filter((r) => r.reservation_id !== active.reservation_id).length ? (
            <div className="pilgrim-past">
              {reservations.filter((r) => r.reservation_id !== active.reservation_id).map((res) => (
                <p key={res.reservation_id}>
                  <b>{res.reservation_number}</b>
                  <span>{reservationStatusLabel(res.status)}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'docs' ? (
        <div className="pilgrim-panel">
          <label className="pilgrim-cta-ghost">
            <Upload className="w-4 h-4" />
            {uploading ? '...' : 'رفع جواز'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onUploadDocument} className="hidden" />
          </label>
          {documents.length === 0 ? (
            <p className="pilgrim-muted">لا وثائق بعد</p>
          ) : documents.map((doc) => (
            <div key={doc.document_id} className="pilgrim-row">
              <FileText className="w-4 h-4" />
              <span>{doc.file_name}</span>
              <b>{doc.status === 'VERIFIED' ? 'تم' : 'قيد المراجعة'}</b>
            </div>
          ))}
        </div>
      ) : null}

      {section === 'pay' ? (
        <div className="pilgrim-panel">
          <div className="pilgrim-row">
            <CreditCard className="w-4 h-4" />
            <span>المجموع</span>
            <b>{money(active.total_amount)}</b>
          </div>
          <div className="pilgrim-row">
            <span>المدفوع</span>
            <b>{money(active.paid_amount)}</b>
          </div>
          {receipts.length === 0 ? (
            <p className="pilgrim-muted">لا سندات بعد</p>
          ) : receipts.map((rcp) => (
            <div key={rcp.id} className="pilgrim-row">
              <span>{rcp.id}</span>
              <BookingPrintButton type="receipt" receiptId={rcp.id} reservationId={active.reservation_id} label="سند" className="pilgrim-ghost" />
            </div>
          ))}
        </div>
      ) : null}

      {section === 'rites' ? (
        <div className="pilgrim-panel">
          <UmrahCounter />
        </div>
      ) : null}
    </div>
  );
}
