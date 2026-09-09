'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Loader2, Mail, Phone, UserRound, XCircle } from 'lucide-react';
import { AgencyDemand, Reservation } from '@/types';
import { ROOM_LABELS, reservationStatusLabel } from '@/lib/booking-catalog';
import { toPortalRole } from '@/lib/roles';
import BookingPrintButton from '@/components/booking/BookingPrintButton';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(n: number): string {
  return `${(n || 0).toLocaleString('ar-DZ')} دج`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function loginStatusLabel(demand: AgencyDemand): string {
  if (demand.customer_login_enabled) return 'الدخول مفعّل';
  if (demand.customer_status === 'PENDING_APPROVAL' || demand.customer_status === 'PENDING') {
    return 'بانتظار تفعيل الدخول';
  }
  return demand.customer_status || '—';
}

export default function AgencyPendingBookings({ compact }: { compact?: boolean }) {
  const [pending, setPending] = useState<AgencyDemand[]>([]);
  const [recent, setRecent] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [canAct, setCanAct] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('south_street_user');
      if (!raw) return;
      const u = JSON.parse(raw);
      const role = toPortalRole(u.role, { email: u.email, roleName: u.roleName });
      setCanAct(role === 'admin' || role === 'manager' || role === 'agent');
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/bookings/confirm', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setPending(Array.isArray(data.demands) ? data.demands : data.pending || []);
        setRecent(Array.isArray(data.recent) ? data.recent : []);
      })
      .catch(() => {
        setPending([]);
        setRecent([]);
      })
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
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
      load();
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className={`${compact ? '' : 'luxury-card p-6'} space-y-4 animate-fade-up`} dir="rtl">
      <div>
        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-bold font-cairo text-slate-900`}>
          طلبات العمرة — بانتظار الموافقة
        </h2>
        <p className="text-sm text-slate-600">
          راجع طلب المعتمر، تحقق من بياناته، ثم أكّد الطلب وفعّل دخوله — كما في مواقع الحجز الكبرى.
        </p>
      </div>

      {error ? <p className="book-error">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
        </p>
      ) : pending.length === 0 && recent.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد طلبات حالياً.</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800">بانتظار التأكيد ({pending.length})</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد طلبات معلّقة حالياً.</p>
            ) : (
              pending.map((res) => (
                <article key={res.reservation_id} className="agency-demand-card">
                  <header className="agency-demand-head">
                    <div>
                      <span className="agency-demand-ref">{res.reservation_number}</span>
                      <h3 className="agency-demand-name">{res.customer_name}</h3>
                      <p className="agency-demand-sub">{res.package_name}</p>
                    </div>
                    <div className="agency-demand-price">
                      <strong>{money(res.total_amount)}</strong>
                      <span>{reservationStatusLabel(res.status)}</span>
                    </div>
                  </header>

                  <div className="agency-demand-grid">
                    <span><Mail className="w-3.5 h-3.5" /> {res.customer_email || '—'}</span>
                    <span><Phone className="w-3.5 h-3.5" /> {res.customer_phone || '—'}</span>
                    <span><UserRound className="w-3.5 h-3.5" /> {ROOM_LABELS[res.room_type] || res.room_type}</span>
                    <span>جواز: {res.passport || '—'}</span>
                    <span>كود: {res.customer_code || '—'}</span>
                    <span className={res.customer_login_enabled ? 'text-emerald-700' : 'text-amber-700'}>
                      {loginStatusLabel(res)}
                    </span>
                  </div>

                  {(res.extras || []).length ? (
                    <p className="agency-demand-extras">
                      إضافات: {(res.extras || []).map((e) => e.title).join(' · ')}
                    </p>
                  ) : null}

                  <p className="agency-demand-date">تاريخ الطلب: {formatDate(res.created_at)}</p>

                  <textarea
                    className="agency-demand-note"
                    rows={2}
                    placeholder="ملاحظة للمعتمر (اختياري)"
                    value={note[res.reservation_id] || ''}
                    onChange={(e) => setNote((prev) => ({ ...prev, [res.reservation_id]: e.target.value }))}
                  />

                  <div className="agency-demand-actions">
                    <BookingPrintButton type="request" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                    <BookingPrintButton type="invoice" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                    {canAct ? (
                      <>
                        <button
                          type="button"
                          className="portal-tab portal-tab-active text-xs"
                          disabled={busyId === res.reservation_id}
                          onClick={() => act(res.reservation_id, 'confirm')}
                        >
                          {busyId === res.reservation_id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <CheckCircle className="w-3.5 h-3.5 inline" />}
                          {' '}تأكيد الطلب + تفعيل الدخول
                        </button>
                        <button
                          type="button"
                          className="portal-tab text-xs text-red-600 border border-red-200"
                          disabled={busyId === res.reservation_id}
                          onClick={() => act(res.reservation_id, 'reject')}
                        >
                          <XCircle className="w-3.5 h-3.5 inline" /> رفض
                        </button>
                      </>
                    ) : null}
                    <Link href="/portal?tab=chat" className="portal-tab portal-tab-inactive text-xs no-underline">
                      مراسلة المعتمر
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          {recent.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800">آخر الطلبات المعالجة ({recent.length})</h3>
              {recent.map((res) => (
                <div key={res.reservation_id} className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="flex justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{res.reservation_number}</span>
                      <h3 className="font-bold text-slate-900 mt-2">{res.customer_name}</h3>
                      <p className="text-xs text-slate-500">{res.package_name} · {reservationStatusLabel(res.status)}</p>
                    </div>
                    <strong className="text-emerald-700">{money(res.total_amount)}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BookingPrintButton type="request" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                    <BookingPrintButton type="invoice" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                    {res.status === 'CONFIRMED' || res.status === 'PAID' || res.status === 'READY_FOR_TRAVEL' ? (
                      <BookingPrintButton type="confirmation" reservationId={res.reservation_id} className="portal-tab portal-tab-inactive text-xs" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
