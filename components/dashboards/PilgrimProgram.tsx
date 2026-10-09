'use client';

import { useState } from 'react';
import PrintMenu from '@/components/booking/PrintMenu';
import Link from 'next/link';
import {
  Calendar,
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
import TripStatusTimeline from '@/components/booking/TripStatusTimeline';
import PayActions from '@/components/booking/PayActions';
import UmrahCountdown from '@/components/booking/UmrahCountdown';
import UmrahCounter from '@/components/UmrahCounter';
import { authHeaders, getAuthToken, apiFetch, jsonAuthHeaders } from '@/lib/api-client';

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
  const completedPast = reservations.filter((r) => String(r.status || '').toUpperCase() === 'COMPLETED');

  if (!active) {
    return (
      <div className="pilgrim-empty" dir="rtl">
        <Plane className="pilgrim-empty-icon" />
        <h2>{completedPast.length ? 'رحلتك اكتملت' : 'ابدأ عمرتك'}</h2>
        <p>
          {completedPast.length
            ? 'يمكنك ترك تقييم لتجربتك ومساعدة المعتمرين القادمين.'
            : 'اختر البرنامج والغرفة، ثم أرسل الطلب. الوكالة تؤكده هنا.'}
        </p>
        {completedPast.length ? (
          <Link href="/portal?tab=account" className="btn-pro-primary pilgrim-cta leave-review">اترك تقييماً</Link>
        ) : (
          <Link href="/book" className="btn-pro-primary pilgrim-cta">حجز</Link>
        )}
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
      const token = getAuthToken();
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
        <button type="button" className={section === 'trip' ? 'is-on' : ''} onClick={() => setSection('trip')}>
          <span aria-hidden>✈️</span>
          الرحلة
        </button>
        <button type="button" className={section === 'docs' ? 'is-on' : ''} onClick={() => setSection('docs')}>
          <span aria-hidden>📄</span>
          وثائق
        </button>
        <button type="button" className={section === 'pay' ? 'is-on' : ''} onClick={() => setSection('pay')}>
          <span aria-hidden>💳</span>
          دفع
        </button>
        <button type="button" className={section === 'rites' ? 'is-on' : ''} onClick={() => setSection('rites')}>
          <span aria-hidden>🕌</span>
          مناسك
        </button>
      </div>

      {section === 'trip' ? (
        <div className="trip-board">
          <header className="trip-hero">
            <img className="trip-hero-photo" src="/images/kaaba_sharifa_home_page.webp" alt="" />
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

          <TripStatusTimeline status={active.status} paymentStatus={active.payment_status} />

          {confirmed ? (
            <>
              <UmrahCountdown startDate={program?.start_date} packageName={program?.package_name || active.package_name} />
              <div className="trip-docs-confirm">
                <BookingPrintButton type="confirmation" reservationId={active.reservation_id} label="وثيقة التأكيد / طباعة" className="trip-action" />
              </div>
            </>
          ) : (
            <p className="trip-hero-wait">بانتظار تأكيد الوكالة — المقاعد والسفر لا يثبتان بعد</p>
          )}

          <div className="trip-facts">
            <article>
              <div className="trip-fact-icon-wrap">
                <UserRound className="trip-fact-icon" aria-hidden />
              </div>
              <span>المرشد</span>
              <strong>{program?.morshid_name || 'يُحدَّد لاحقاً'}</strong>
              <em dir="ltr">{program?.morshid_phone || '—'}</em>
            </article>
            <article>
              <div className="trip-fact-icon-wrap">
                <MapPin className="trip-fact-icon" aria-hidden />
              </div>
              <span>الإقامة</span>
              <strong>{program?.makkah_hotel_name || '—'}</strong>
              <em>{program?.madinah_hotel_name || 'المدينة'}</em>
            </article>
            <article>
              <div className="trip-fact-icon-wrap">
                <Plane className="trip-fact-icon" aria-hidden />
              </div>
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
              <PrintMenu reservationId={active.reservation_id} status={active.status} className="trip-action" />
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
                    {String(res.status).toUpperCase() === 'REJECTED' && res.agency_note ? (
                      <em className="refusal-reason">السبب: {res.agency_note}</em>
                    ) : null}
                    {String(res.status).toUpperCase() === 'COMPLETED' ? (
                      <Link href="/portal?tab=account" className="leave-review no-underline">اترك تقييماً</Link>
                    ) : null}
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
          <PayActions reservation={active} />
          {receipts.length === 0 ? (
            <p className="pilgrim-muted">لا سندات بعد — استخدم مسار الوكالة أعلاه</p>
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
