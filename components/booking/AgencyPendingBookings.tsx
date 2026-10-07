'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  CheckCircle,
  ChevronLeft,
  Inbox,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import { AgencyDemand, Reservation } from '@/types';
import { ROOM_LABELS, reservationStatusLabel } from '@/lib/booking-catalog';
import BookingPrintButton from '@/components/booking/BookingPrintButton';
import { authHeaders } from '@/lib/api-client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import ClientPaymentModal from '@/components/accountant/ClientPaymentModal';

/**
 * Umrah request pipeline:
 *   1. demand   — the pilgrim sent a request; the director accepts or rejects it.
 *   2. deposit  — accepted; the accountant records the deposit, which finalises it.
 *   3. done     — confirmed / paid, plus closed outcomes (rejected, cancelled).
 * Permissions come from the server; the UI only hides what the API would refuse.
 */
type Stage = 'demand' | 'deposit' | 'done';

type Permissions = { role: string; canApprove: boolean; canCollectDeposit: boolean };

type DepositPreset = { reservation_id: string; customer_code: string; customer_name: string };

const DEPOSIT_PERCENT_FALLBACK = 0.3;

function money(n: number): string {
  return `${(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function depositDue(res: Reservation): number {
  const total = Number(res.total_amount) || Number(res.invoice?.total) || 0;
  return Number(res.invoice?.depositAmount) || Math.round(total * DEPOSIT_PERCENT_FALLBACK);
}

function loginStatusLabel(demand: AgencyDemand): string {
  if (demand.customer_login_enabled) return 'الدخول مفعّل';
  if (demand.customer_status === 'PENDING_APPROVAL' || demand.customer_status === 'PENDING') {
    return 'بانتظار تفعيل الدخول';
  }
  return demand.customer_status || '—';
}

function outcomeTone(status: string): string {
  const s = status.toUpperCase();
  if (s === 'REJECTED' || s === 'CANCELLED') return 'is-bad';
  if (s === 'PAID' || s === 'READY_FOR_TRAVEL' || s === 'COMPLETED') return 'is-good';
  return 'is-ok';
}

const PRINT_BTN = 'pipe-btn';

/** Collapsed summary row: reference, name, amount. Everything else opens on click. */
function SummaryRow({
  reference,
  name,
  amount,
  badge,
  open,
  onToggle,
  children,
}: {
  reference: string;
  name: string;
  amount: number;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className={`pipe-row${open ? ' is-open' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="pipe-row-head">
        <ChevronLeft className="pipe-row-chev" aria-hidden />
        <span className="pipe-row-avatar" aria-hidden>{(name || '؟').trim().charAt(0)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-sm text-slate-900 truncate">{name}</span>
          <span className="block text-[11px] font-mono text-slate-400">{reference}</span>
        </span>
        {badge}
        <span className="pipe-row-amount">{money(amount)}</span>
      </button>
      {open ? <div className="pipe-row-body">{children}</div> : null}
    </li>
  );
}

export default function AgencyPendingBookings({ compact }: { compact?: boolean }) {
  const [demands, setDemands] = useState<AgencyDemand[]>([]);
  const [awaiting, setAwaiting] = useState<Reservation[]>([]);
  const [recent, setRecent] = useState<Reservation[]>([]);
  const [perms, setPerms] = useState<Permissions>({ role: '', canApprove: false, canCollectDeposit: false });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [openId, setOpenId] = useState('');
  const [depositFor, setDepositFor] = useState<DepositPreset | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/bookings/confirm', { headers: authHeaders(), cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setDemands(Array.isArray(data.demands) ? data.demands : data.pending || []);
        setAwaiting(Array.isArray(data.awaitingDeposit) ? data.awaitingDeposit : []);
        setRecent(Array.isArray(data.recent) ? data.recent : []);
        if (data.permissions) setPerms(data.permissions);
      })
      .catch(() => {
        setDemands([]);
        setAwaiting([]);
        setRecent([]);
        setError('تعذّر تحميل الطلبات');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener('southstreet:bookings-updated', onUpdate);
    return () => window.removeEventListener('southstreet:bookings-updated', onUpdate);
  }, [load]);

  // Open on the stage that is waiting on the current user, else the first with work.
  useEffect(() => {
    if (loading || stage) return;
    if (perms.canApprove && demands.length) setStage('demand');
    else if (perms.canCollectDeposit && awaiting.length) setStage('deposit');
    else if (demands.length) setStage('demand');
    else if (awaiting.length) setStage('deposit');
    else setStage(recent.length ? 'done' : 'demand');
  }, [loading, stage, perms, demands.length, awaiting.length, recent.length]);

  const act = async (reservationId: string, action: 'confirm' | 'reject') => {
    setBusyId(reservationId);
    setError('');
    setFlash('');
    try {
      const res = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reservationId, action, note: note[reservationId] || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذّر معالجة الطلب');
        return;
      }
      setFlash(data.message || 'تم');
      setOpenId('');
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setBusyId('');
    }
  };

  const stages = useMemo(
    () => [
      {
        id: 'demand' as Stage,
        step: 1,
        label: 'طلبات جديدة',
        owner: 'المشرف',
        count: demands.length,
        icon: Inbox,
        mine: perms.canApprove,
      },
      {
        id: 'deposit' as Stage,
        step: 2,
        label: 'بانتظار العربون',
        owner: 'المحاسب',
        count: awaiting.length,
        icon: Wallet,
        mine: perms.canCollectDeposit,
      },
      {
        id: 'done' as Stage,
        step: 3,
        label: 'مؤكدة ومعالجة',
        owner: 'الأرشيف',
        count: recent.length,
        icon: BadgeCheck,
        mine: false,
      },
    ],
    [demands.length, awaiting.length, recent.length, perms]
  );

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? '' : id));
  const current = stage || 'demand';
  const rows = current === 'demand' ? demands.length : current === 'deposit' ? awaiting.length : recent.length;

  return (
    <>
      <div className={`${compact ? '' : 'luxury-card p-4 sm:p-5'} pipe space-y-4 animate-fade-up`} dir="rtl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold font-cairo text-slate-900">مسار طلبات العمرة</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              المعتمر يطلب ← المشرف يقبل ← المحاسب يسجّل العربون فيتأكد الحجز
            </p>
          </div>
          <button type="button" className="pipe-btn" onClick={load} disabled={loading} aria-label="تحديث">
            <RefreshCw className={`w-3.5 h-3.5${loading ? ' animate-spin' : ''}`} /> تحديث
          </button>
        </div>

        <ol className="pipe-steps" role="tablist" aria-label="مراحل الطلب">
          {stages.map((s) => {
            const Icon = s.icon;
            const on = current === s.id;
            return (
              <li key={s.id} className="contents">
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setStage(s.id);
                    setOpenId('');
                  }}
                  className={`pipe-step${on ? ' is-on' : ''}${s.mine && s.count > 0 ? ' is-mine' : ''}`}
                >
                  <span className="pipe-step-icon"><Icon className="w-4 h-4" aria-hidden /></span>
                  <span className="pipe-step-text">
                    <span className="pipe-step-label">{s.label}</span>
                    <span className="pipe-step-owner">
                      {s.step}. {s.owner}
                      {s.mine && s.count > 0 ? ' · دورك' : ''}
                    </span>
                  </span>
                  <span className="pipe-step-count">{s.count}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {error ? <p className="book-error" role="alert">{error}</p> : null}
        {flash ? <p className="pipe-flash" role="status">{flash}</p> : null}

        {loading && !stage ? (
          <p className="text-sm text-slate-500 flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
          </p>
        ) : (
          <ul className="pipe-list">
            {current === 'demand'
              ? demands.map((res) => {
                  const open = openId === res.reservation_id;
                  const busy = busyId === res.reservation_id;
                  return (
                    <SummaryRow
                      key={res.reservation_id}
                      reference={res.reservation_number}
                      name={res.customer_name}
                      amount={res.total_amount}
                      open={open}
                      onToggle={() => toggle(res.reservation_id)}
                    >
                      <dl className="pipe-facts">
                        <div><Mail className="w-3.5 h-3.5" aria-hidden /> {res.customer_email || '—'}</div>
                        <div><Phone className="w-3.5 h-3.5" aria-hidden /> <span dir="ltr">{res.customer_phone || '—'}</span></div>
                        <div><UserRound className="w-3.5 h-3.5" aria-hidden /> {ROOM_LABELS[res.room_type] || res.room_type} · {res.travelers_count || 1} مسافر</div>
                        <div>جواز: <span dir="ltr">{res.passport || '—'}</span></div>
                        <div className="sm:col-span-2 font-bold text-slate-800">{res.package_name}</div>
                        {(res.extras || []).length ? (
                          <div className="sm:col-span-2">إضافات: {(res.extras || []).map((e) => e.title).join(' · ')}</div>
                        ) : null}
                        <div>العربون المطلوب: <b>{money(depositDue(res))}</b></div>
                        <div className={res.customer_login_enabled ? 'text-emerald-700' : 'text-amber-700'}>
                          {loginStatusLabel(res)}
                        </div>
                        <div className="sm:col-span-2 text-slate-400">تاريخ الطلب: {formatDate(res.created_at)}</div>
                      </dl>

                      {perms.canApprove ? (
                        <>
                          <p className="agency-demand-observe">
                            القبول يفعّل حساب المعتمر وينقل الطلب إلى المحاسب. التأكيد النهائي يتم بعد تسجيل العربون.
                          </p>
                          <textarea
                            className="agency-demand-note"
                            rows={2}
                            maxLength={500}
                            placeholder="ملاحظة للمعتمر (اختياري)"
                            value={note[res.reservation_id] || ''}
                            onChange={(e) => setNote((prev) => ({ ...prev, [res.reservation_id]: e.target.value }))}
                          />
                        </>
                      ) : (
                        <p className="pipe-wait">بانتظار قرار المشرف.</p>
                      )}

                      <div className="pipe-actions">
                        {perms.canApprove ? (
                          <>
                            <button
                              type="button"
                              className="pipe-btn is-primary"
                              disabled={busy}
                              onClick={() => act(res.reservation_id, 'confirm')}
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              قبول وتحويل للمحاسب
                            </button>
                            <button
                              type="button"
                              className="pipe-btn is-danger"
                              disabled={busy}
                              onClick={() => setPendingRejectId(res.reservation_id)}
                            >
                              <XCircle className="w-3.5 h-3.5" /> رفض
                            </button>
                          </>
                        ) : null}
                        <BookingPrintButton type="request" label="طلب الحجز" reservationId={res.reservation_id} className={PRINT_BTN} />
                        <BookingPrintButton type="invoice" label="الفاتورة" reservationId={res.reservation_id} className={PRINT_BTN} />
                        <Link href="/portal?tab=chat" className={`${PRINT_BTN} no-underline`}>مراسلة المعتمر</Link>
                      </div>
                    </SummaryRow>
                  );
                })
              : null}

            {current === 'deposit'
              ? awaiting.map((res) => {
                  const open = openId === res.reservation_id;
                  const due = depositDue(res);
                  const paid = Number(res.paid_amount) || 0;
                  return (
                    <SummaryRow
                      key={res.reservation_id}
                      reference={res.reservation_number}
                      name={res.customer_name}
                      amount={due}
                      badge={<span className="pipe-tag is-warn">عربون</span>}
                      open={open}
                      onToggle={() => toggle(res.reservation_id)}
                    >
                      <dl className="pipe-facts">
                        <div className="sm:col-span-2 font-bold text-slate-800">{res.package_name}</div>
                        <div>المجموع: <b>{money(res.total_amount)}</b></div>
                        <div>العربون: <b className="text-amber-700">{money(due)}</b></div>
                        <div>المدفوع: <b>{money(paid)}</b></div>
                        <div>المتبقي: <b>{money(Math.max(0, (Number(res.total_amount) || 0) - paid))}</b></div>
                        <div className="sm:col-span-2 text-slate-500">
                          قبله {res.agency_confirmed_by || 'المدير'} · {formatDate(res.agency_confirmed_at)}
                        </div>
                      </dl>
                      {!perms.canCollectDeposit ? (
                        <p className="pipe-wait">بانتظار تسجيل العربون من المحاسب.</p>
                      ) : null}
                      <div className="pipe-actions">
                        {perms.canCollectDeposit ? (
                          <button
                            type="button"
                            className="pipe-btn is-primary"
                            onClick={() =>
                              setDepositFor({
                                reservation_id: res.reservation_id,
                                customer_code: res.customer_id,
                                customer_name: res.customer_name,
                              })
                            }
                          >
                            <Wallet className="w-3.5 h-3.5" /> تسجيل العربون وتأكيد الحجز
                          </button>
                        ) : null}
                        <BookingPrintButton type="invoice" label="الفاتورة" reservationId={res.reservation_id} className={PRINT_BTN} />
                        <BookingPrintButton type="request" label="طلب الحجز" reservationId={res.reservation_id} className={PRINT_BTN} />
                      </div>
                    </SummaryRow>
                  );
                })
              : null}

            {current === 'done'
              ? recent.map((res) => {
                  const open = openId === res.reservation_id;
                  const status = String(res.status || '');
                  const printable = ['CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(status.toUpperCase());
                  return (
                    <SummaryRow
                      key={res.reservation_id}
                      reference={res.reservation_number}
                      name={res.customer_name}
                      amount={res.total_amount}
                      badge={<span className={`pipe-tag ${outcomeTone(status)}`}>{reservationStatusLabel(status)}</span>}
                      open={open}
                      onToggle={() => toggle(res.reservation_id)}
                    >
                      <dl className="pipe-facts">
                        <div className="sm:col-span-2 font-bold text-slate-800">{res.package_name}</div>
                        <div>المدفوع: <b>{money(res.paid_amount)}</b></div>
                        <div>آخر تحديث: {formatDate(res.updated_at || res.created_at)}</div>
                        {res.agency_note ? (
                          <div className="sm:col-span-2 whitespace-pre-line text-slate-500">{res.agency_note}</div>
                        ) : null}
                      </dl>
                      <div className="pipe-actions">
                        <BookingPrintButton type="request" label="طلب الحجز" reservationId={res.reservation_id} className={PRINT_BTN} />
                        <BookingPrintButton type="invoice" label="الفاتورة" reservationId={res.reservation_id} className={PRINT_BTN} />
                        {printable ? (
                          <BookingPrintButton type="confirmation" label="تأكيد الوكالة" reservationId={res.reservation_id} className={PRINT_BTN} />
                        ) : null}
                      </div>
                    </SummaryRow>
                  );
                })
              : null}

            {rows === 0 ? (
              <li className="pipe-empty">
                {current === 'demand'
                  ? 'لا توجد طلبات جديدة'
                  : current === 'deposit'
                    ? 'لا توجد حجوزات بانتظار العربون'
                    : 'لا توجد طلبات معالجة'}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <AdminConfirmDialog
        open={Boolean(pendingRejectId)}
        title="رفض طلب الحجز؟"
        message="سيتم رفض طلب العمرة وتحرير المقعد. يصل السبب المكتوب في الملاحظة إلى المعتمر."
        confirmLabel="رفض الطلب"
        danger
        busy={Boolean(pendingRejectId && busyId === pendingRejectId)}
        onCancel={() => setPendingRejectId(null)}
        onConfirm={() => {
          const id = pendingRejectId;
          if (!id) return;
          setPendingRejectId(null);
          void act(id, 'reject');
        }}
      />

      {depositFor ? (
        <ClientPaymentModal
          preset={depositFor}
          onClose={() => setDepositFor(null)}
          onSaved={() => {
            setFlash('سُجّل العربون — تأكد الحجز وأُبلغ المعتمر');
            setOpenId('');
            window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
          }}
        />
      ) : null}
    </>
  );
}
