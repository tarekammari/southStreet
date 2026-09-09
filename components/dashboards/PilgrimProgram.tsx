'use client';

import { User, Reservation } from '@/types';
import Link from 'next/link';
import { useState } from 'react';
import { Calendar, MapPin, Plane, UserRound, Clock, MessageCircle, Compass, Loader2 } from 'lucide-react';
import { canSelfManageReservation, isActiveReservation, isAgencyConfirmed, reservationStatusLabel } from '@/lib/booking-catalog';
import BookingPrintButton from '@/components/booking/BookingPrintButton';
import UmrahCountdown from '@/components/booking/UmrahCountdown';

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PilgrimProgram({
  currentUser,
  reservation,
  onChanged,
}: {
  currentUser: User;
  reservation: Reservation | null;
  onChanged?: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  if (!reservation || !isActiveReservation(reservation.status)) {
    return (
      <div className="luxury-card p-8 text-center space-y-3">
        <h2 className="text-lg font-bold font-cairo">لا يوجد برنامج عمرة بعد</h2>
        <p className="text-sm text-slate-500">أكّد باقة العمرة أولاً لعرض الطيران والفنادق والمرشد والمواعيد هنا.</p>
        <Link href="/book" className="btn-pro-primary text-sm py-2.5 px-5 inline-flex">ابدأ الحجز</Link>
      </div>
    );
  }

  const program = reservation.program;
  const appointments = reservation.appointments || [];
  const manage = canSelfManageReservation(reservation.status, program?.start_date);
  const confirmed = isAgencyConfirmed(reservation.status);

  const cancelBooking = async () => {
    setCancelling(true);
    setError('');
    try {
      const token = localStorage.getItem('south_street_token');
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(reservation.reservation_id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر إلغاء الطلب');
        return;
      }
      onChanged?.();
    } catch {
      setError('تعذّر إلغاء الطلب. حاول مرة أخرى.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up" dir="rtl">
      {confirmed ? (
        <UmrahCountdown startDate={program?.start_date} packageName={program?.package_name || reservation.package_name} />
      ) : null}
      <div className="luxury-card p-6 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full inline-block mb-2 ${
            confirmed ? 'text-emerald-700 bg-emerald-soft' : 'text-amber-800 bg-amber-50'
          }`}>
            {confirmed ? 'برنامجك المعتمد' : reservationStatusLabel(reservation.status)}
          </span>
          <h2 className="text-xl font-black font-cairo text-slate-900">{program?.package_name || reservation.package_name}</h2>
          <p className="text-xs text-slate-500 mt-1">
            رقم الحجز {reservation.reservation_number} · كود المعتمر {currentUser.code}
          </p>
          {!confirmed ? (
            <p className="text-xs text-amber-700 mt-2">
              انتظر تأكيد الوكالة لتفعيل البرنامج بالكامل والعدّ التنازلي لموعد العمرة.
            </p>
          ) : null}
        </div>
        <div className="text-sm text-slate-600 space-y-2">
          <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" /> {formatDate(program?.start_date)} — {formatDate(program?.end_date)}</p>
          <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> {program?.duration_days || '—'} يوماً · {program?.room_label || reservation.room_type}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <BookingPrintButton type="request" reservationId={reservation.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
            <BookingPrintButton type="invoice" reservationId={reservation.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
            {confirmed ? (
              <BookingPrintButton type="confirmation" reservationId={reservation.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
            ) : null}
          </div>
          {manage.ok ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/book?edit=${encodeURIComponent(reservation.reservation_id)}`} className="portal-tab portal-tab-inactive no-underline text-xs">تعديل الطلب</Link>
              <button type="button" className="portal-tab text-xs text-red-600 border border-red-200" onClick={() => setConfirmCancel(true)}>إلغاء الطلب</button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">{manage.reason}</p>
          )}
        </div>
      </div>

      {error ? <p className="book-error">{error}</p> : null}
      {confirmCancel ? (
        <div className="book-cancel-box">
          <p>تأكيد إلغاء برنامج العمرة</p>
          <p>سيُلغى الطلب ويُحرَّر المقعد. يمكنك الحجز من جديد بعد ذلك.</p>
          <div className="book-nav" style={{ border: 0, margin: 0, paddingTop: 8 }}>
            <button type="button" className="book-btn book-btn-ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>تراجع</button>
            <button type="button" className="book-btn book-btn-danger" onClick={cancelBooking} disabled={cancelling}>
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              تأكيد الإلغاء
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="luxury-card-static p-5 space-y-2">
          <span className="text-[11px] font-bold text-slate-400">الطيران</span>
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><Plane className="w-4 h-4 text-indigo-500" /> {program?.airline || '—'}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {program?.departure_airport || program?.departure_city || 'الجزائر'} ➜ {program?.arrival_airport || 'الأراضي المقدسة'}
          </p>
          <p className="text-[11px] text-emerald-700 font-bold">إقلاع {formatDate(program?.start_date)} · عودة {formatDate(program?.end_date)}</p>
        </div>
        <div className="luxury-card-static p-5 space-y-2">
          <span className="text-[11px] font-bold text-slate-400">الإقامة</span>
          <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> مكة: {program?.makkah_hotel_name}</p>
          <p className="text-[11px] text-slate-500">{program?.makkah_hotel_dist}</p>
          <p className="text-sm font-bold text-slate-900 mt-2">المدينة: {program?.madinah_hotel_name}</p>
          <p className="text-[11px] text-slate-500">{program?.madinah_hotel_dist}</p>
        </div>
        <div className="luxury-card-static p-5 space-y-2">
          <span className="text-[11px] font-bold text-slate-400">مرشد الفوج</span>
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><UserRound className="w-4 h-4 text-teal-600" /> {program?.morshid_name || 'يُحدَّد من الوكالة'}</h3>
          {program?.morshid_phone ? <p className="text-xs text-slate-600" dir="ltr">{program.morshid_phone}</p> : null}
          <p className="text-[11px] text-slate-500">يستقبلك عند الوصول ويرافق الفوج في المناسك والمواعيد.</p>
        </div>
      </div>

      <div className="luxury-card p-6 space-y-4">
        <h3 className="font-bold font-cairo text-slate-900">المواعيد</h3>
        <ol className="space-y-3">
          {appointments.map((item) => (
            <li key={item.id} className="flex gap-3 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <span className="w-2 h-2 rounded-full bg-emerald-600 mt-2 shrink-0" />
              <div>
                <strong className="text-slate-900 block">{item.title}</strong>
                <span className="text-xs text-slate-500">{item.when} · {item.place}</span>
                {item.note ? <p className="text-xs text-slate-500 mt-0.5">{item.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {program?.included_services?.length ? (
        <div className="luxury-card-static p-6">
          <h3 className="font-bold font-cairo text-slate-900 mb-3">مشمول في برنامجك</h3>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
            {program.included_services.map((svc) => (
              <li key={svc}>• {svc}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/portal?tab=chat" className="luxury-card-static p-5 flex items-center gap-3 no-underline hover:border-emerald-300">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <strong className="block text-sm text-slate-900">محادثة الوكالة</strong>
            <span className="text-xs text-slate-500">رسائل خدمة العملاء والمرشد تظهر هنا</span>
          </div>
        </Link>
        <Link href="/portal?tab=rituals" className="luxury-card-static p-5 flex items-center gap-3 no-underline hover:border-emerald-300">
          <Compass className="w-5 h-5 text-indigo-500" />
          <div>
            <strong className="block text-sm text-slate-900">دليل المناسك</strong>
            <span className="text-xs text-slate-500">عداد الطواف والسعي أثناء العمرة</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
