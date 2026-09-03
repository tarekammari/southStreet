'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Reservation } from '@/types';
import { reservationStatusLabel } from '@/lib/booking-catalog';
import BookingPrintButton from '@/components/booking/BookingPrintButton';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

export default function AgencyPendingBookings() {
  const [pending, setPending] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/bookings/confirm', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setPending(Array.isArray(data.pending) ? data.pending : []))
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (reservationId: string, action: 'confirm' | 'reject') => {
    setBusyId(reservationId);
    setError('');
    try {
      const res = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reservationId, action, note: note[reservationId] || '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذّر معالجة الطلب');
        return;
      }
      load();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="luxury-card p-6 space-y-4 animate-fade-up" dir="rtl">
      <div>
        <h2 className="text-lg font-bold font-cairo text-slate-900">طلبات بانتظار تأكيد الوكالة</h2>
        <p className="text-sm text-slate-600">راجع الطلب، اطبع الوثائق، ثم أكّد أو ارفض — مثل أنظمة الحجز الكبرى.</p>
      </div>

      {error ? <p className="book-error">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد طلبات معلّقة حالياً.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((res) => (
            <div key={res.reservation_id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/60">
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">{res.reservation_number}</span>
                  <h3 className="font-bold text-slate-900 mt-2">{res.customer_name}</h3>
                  <p className="text-xs text-slate-500">{res.package_name} · {reservationStatusLabel(res.status)}</p>
                </div>
                <strong className="text-emerald-700">{money(res.total_amount)}</strong>
              </div>
              <div className="text-xs text-slate-600 grid sm:grid-cols-2 gap-2">
                <span>الهاتف: {res.customer_phone || '—'}</span>
                <span>البريد: {res.customer_email || '—'}</span>
              </div>
              <textarea
                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white"
                rows={2}
                placeholder="ملاحظة للمعتمر (اختياري)"
                value={note[res.reservation_id] || ''}
                onChange={(e) => setNote((prev) => ({ ...prev, [res.reservation_id]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <BookingPrintButton type="request" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                <BookingPrintButton type="invoice" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                <button
                  type="button"
                  className="portal-tab portal-tab-active text-xs"
                  disabled={busyId === res.reservation_id}
                  onClick={() => act(res.reservation_id, 'confirm')}
                >
                  {busyId === res.reservation_id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <CheckCircle className="w-3.5 h-3.5 inline" />}
                  {' '}تأكيد الوكالة
                </button>
                <button
                  type="button"
                  className="portal-tab text-xs text-red-600 border border-red-200"
                  disabled={busyId === res.reservation_id}
                  onClick={() => act(res.reservation_id, 'reject')}
                >
                  <XCircle className="w-3.5 h-3.5 inline" /> رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
