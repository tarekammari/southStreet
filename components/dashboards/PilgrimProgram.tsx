'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Plane,
  Upload,
  UserRound,
  ChevronDown,
} from 'lucide-react';
import { User, Reservation, CustomerDocument, Receipt } from '@/types';
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

function formatLongDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortRange(start?: string, end?: string): string {
  const a = start ? new Date(start) : null;
  const b = end ? new Date(end) : null;
  if (!a || Number.isNaN(a.getTime())) return '—';
  const left = a.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
  if (!b || Number.isNaN(b.getTime())) return left;
  const right = b.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
  return `${left} — ${right}`;
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
  const past = reservations.filter((r) => r.reservation_id !== active.reservation_id);

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
      <div className="pilgrim-seg" role="tablist" aria-label="أقسام الرحلة">
        <button type="button" className={section === 'trip' ? 'is-on' : ''} onClick={() => setSection('trip')}>الرحلة</button>
        <button type="button" className={section === 'docs' ? 'is-on' : ''} onClick={() => setSection('docs')}>وثائق</button>
        <button type="button" className={section === 'pay' ? 'is-on' : ''} onClick={() => setSection('pay')}>دفع</button>
        <button type="button" className={section === 'rites' ? 'is-on' : ''} onClick={() => setSection('rites')}>مناسك</button>
      </div>

      {section === 'trip' ? (
        <div className="trip-board">
          <header className="trip-hero">
            <img className="trip-hero-photo" src="/images/kaaba_sharifa_home_page.png" alt="" />
            <div className="trip-hero-veil" />
            <div className="trip-hero-body">
              <div className="trip-hero-top">
                <span className={`trip-hero-badge ${confirmed ? 'is-ok' : 'is-wait'}`}>
                  {confirmed ? 'مؤكدة' : reservationStatusLabel(active.status)}
                </span>
                <b className="trip-hero-ref">{active.reservation_number}</b>
              </div>
              <h1>{program?.package_name || active.package_name}</h1>
              <p className="trip-hero-dates">
                <Calendar className="w-3.5 h-3.5" aria-hidden />
                {formatShortRange(program?.start_date, program?.end_date)}
                {program?.duration_days ? <em>· {program.duration_days} يوماً</em> : null}
                <em>· {program?.room_label || active.room_type}</em>
              </p>
            </div>
          </header>

          {confirmed ? (
            <UmrahCountdown startDate={program?.start_date} packageName={program?.package_name || active.package_name} />
          ) : (
            <p className="trip-hero-wait">بانتظار تأكيد الوكالة — المقاعد والسفر لا يثبتان بعد</p>
          )}

          <div className="trip-facts">
            <article>
              <UserRound className="trip-fact-icon" aria-hidden />
              <span>المرشد</span>
              <strong>{program?.morshid_name || 'يُحدَّد لاحقاً'}</strong>
              <em dir="ltr">{program?.morshid_phone || '—'}</em>
            </article>
            <article>
              <MapPin className="trip-fact-icon" aria-hidden />
              <span>الإقامة</span>
              <strong>{program?.makkah_hotel_name || '—'}</strong>
              <em>{program?.madinah_hotel_name || 'المدينة'}</em>
            </article>
            <article>
              <Plane className="trip-fact-icon" aria-hidden />
              <span>الطيران</span>
              <strong>{program?.airline || '—'}</strong>
              <em>{program?.departure_city || 'الجزائر'} ➜ المدينة</em>
            </article>
          </div>

          <div className="trip-price-bar">
            <span>إجمالي البرنامج</span>
            <strong>{money(active.total_amount)}</strong>
          </div>

          {appointments.length ? (
            <details className="trip-fold" open={confirmed}>
              <summary>
                جدول المواعيد
                <ChevronDown className="trip-fold-chevron" aria-hidden />
              </summary>
              <ol className="trip-timeline">
                {appointments.map((item, index) => (
                  <li key={item.id}>
                    <i aria-hidden>{index + 1}</i>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.when}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          <details className="trip-fold">
            <summary>
              وثائق وإدارة الحجز
              <ChevronDown className="trip-fold-chevron" aria-hidden />
            </summary>
            <div className="trip-manage">
              <BookingPrintButton type="request" reservationId={active.reservation_id} label="طباعة الطلب" className="trip-action" />
              <BookingPrintButton type="invoice" reservationId={active.reservation_id} label="الفاتورة" className="trip-action" />
              {confirmed ? (
                <BookingPrintButton type="confirmation" reservationId={active.reservation_id} label="التأكيد" className="trip-action" />
              ) : null}
              {manage.ok ? (
                <>
                  <Link href={`/book?edit=${encodeURIComponent(active.reservation_id)}`} className="trip-action no-underline">تعديل</Link>
                  <button type="button" className="trip-action is-danger" onClick={() => setConfirmCancel(true)}>إلغاء</button>
                </>
              ) : null}
            </div>
          </details>

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

          {past.length ? (
            <details className="trip-fold">
              <summary>
                رحلات سابقة
                <ChevronDown className="trip-fold-chevron" aria-hidden />
              </summary>
              <div className="trip-past">
                {past.map((res) => (
                  <p key={res.reservation_id}>
                    <b>{res.reservation_number}</b>
                    <span>{reservationStatusLabel(res.status)}</span>
                  </p>
                ))}
              </div>
            </details>
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
