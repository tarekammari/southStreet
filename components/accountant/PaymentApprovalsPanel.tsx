'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { fmtMoney } from './money';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { jsonAuthHeaders } from '@/lib/api-client';

/**
 * Maker / checker queue for client money (lib/finance-approvals.ts).
 *  - Accountant: validates payments others recorded; prepares above-threshold ones.
 *  - Super Admin: approves what the accountant prepared, or «تجاوز الإدارة»
 *    (written reason + security key) — the accountant is told.
 * The server enforces every rule; the buttons only mirror them.
 */

type Req = {
  id: string;
  request_type: 'PAYMENT' | 'VOID_PAYMENT' | 'VOID_RECEIPT';
  status: 'PENDING' | 'AWAITING_APPROVAL' | 'VALIDATED' | 'REJECTED';
  amount: number;
  customer_name: string;
  recorded_by_id: string;
  recorded_by_name: string;
  recorded_ts: number;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
  decided_by_name: string | null;
  decided_ts: number | null;
  decision_type: string | null;
  reason: string | null;
  payload?: { package_name?: string | null; method?: string | null; note?: string | null } | null;
};

type Data = { open: Req[]; recent: Req[]; threshold: number; me: { id: string; role: string } };

const TYPE_LABEL: Record<Req['request_type'], string> = {
  PAYMENT: 'دفعة عميل',
  VOID_PAYMENT: 'إلغاء دفعة (استرجاع)',
  VOID_RECEIPT: 'إلغاء سند قبض (استرجاع)',
};

const DECISION_LABEL: Record<string, string> = {
  ACCOUNTANT: 'اعتمدها المحاسب',
  SUPER_ADMIN_APPROVAL: 'وافق عليها المشرف العام',
  SUPER_ADMIN_OVERRIDE: 'تجاوز الإدارة',
  REJECTED: 'مرفوضة',
};

function when(ts?: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' });
}

type Dialog = { kind: 'override' | 'reject'; req: Req } | { kind: 'threshold' } | null;

export default function PaymentApprovalsPanel({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');

  const load = useCallback(() => {
    fetch('/api/finance/clients/payments?view=approvals', { headers: jsonAuthHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d.approvals || null))
      .catch(() => setError('تعذّر تحميل طلبات الاعتماد'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (key: string, body: Record<string, unknown>, keyStep = false) => {
    setBusy(key);
    setError('');
    setFlash('');
    try {
      const init: RequestInit = { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body) };
      const res = keyStep ? await adminFetch('/api/finance/clients/payments', init) : await fetch('/api/finance/clients/payments', init);
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'تعذّر تنفيذ العملية');
      setFlash(out.message || (out.threshold ? 'حُفظ الحد' : 'تم'));
      setDialog(null);
      setText('');
      load();
      onChanged?.();
      window.dispatchEvent(new CustomEvent('southstreet:bookings-updated'));
    } catch (e) {
      setError(keyStep ? keyErrorMessage(e) : (e as Error)?.message || 'تعذّر تنفيذ العملية');
    } finally {
      setBusy('');
    }
  };

  if (!data) {
    return error ? <p className="text-sm text-rose-700 p-3">{error}</p> : null;
  }

  const { me } = data;
  const isAccountant = me.role === 'ACCOUNTANT';
  const isSuper = me.role === 'SUPER_ADMIN';

  const actionsFor = (r: Req) => {
    const out: React.ReactNode[] = [];
    const btn = 'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50';
    const mine = r.recorded_by_id === me.id;
    if (r.status === 'PENDING' && isAccountant && !mine) {
      out.push(
        <button key="v" type="button" className={`${btn} bg-emerald-600 text-white`} disabled={Boolean(busy)} onClick={() => send(r.id, { action: 'validate_request', id: r.id })}>
          {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} اعتماد
        </button>
      );
    }
    if (r.status === 'AWAITING_APPROVAL' && isSuper) {
      out.push(
        <button key="a" type="button" className={`${btn} bg-emerald-600 text-white`} disabled={Boolean(busy)} onClick={() => send(r.id, { action: 'approve_request', id: r.id }, true)}>
          {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} موافقة (مفتاح الأمان)
        </button>
      );
    }
    if (r.status === 'PENDING' && isSuper && !mine) {
      out.push(
        <button key="o" type="button" className={`${btn} bg-amber-100 text-amber-900 border border-amber-300`} disabled={Boolean(busy)} onClick={() => { setText(''); setDialog({ kind: 'override', req: r }); }}>
          <ShieldAlert className="w-3.5 h-3.5" /> تجاوز الإدارة
        </button>
      );
    }
    const canReject =
      (r.status === 'PENDING' && (isAccountant || mine)) ||
      (r.status === 'AWAITING_APPROVAL' && (isSuper || r.prepared_by_id === me.id));
    if (canReject) {
      out.push(
        <button key="r" type="button" className={`${btn} bg-white text-rose-700 border border-rose-200`} disabled={Boolean(busy)} onClick={() => { setText(''); setDialog({ kind: 'reject', req: r }); }}>
          <XCircle className="w-3.5 h-3.5" /> {mine || r.prepared_by_id === me.id ? 'سحب' : 'رفض'}
        </button>
      );
    }
    if (r.status === 'PENDING' && isAccountant && mine) {
      out.push(<small key="m" className="text-slate-500">سجّلتها بنفسك — يعتمدها محاسب آخر</small>);
    }
    return out;
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" dir="rtl">
      <header className="flex flex-wrap items-center gap-2">
        <BadgeCheck className="w-5 h-5 text-emerald-600" aria-hidden />
        <h3 className="font-bold text-slate-900">اعتماد الدفعات</h3>
        <span className="text-xs text-slate-500">
          فوق {fmtMoney(data.threshold)} يوافق المشرف العام
        </span>
        {isSuper ? (
          <button type="button" className="text-xs font-bold text-emerald-700 underline" onClick={() => { setText(String(data.threshold)); setDialog({ kind: 'threshold' }); }}>
            تعديل الحد
          </button>
        ) : null}
        <button type="button" className="ms-auto text-slate-500" onClick={load} aria-label="تحديث">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
      {flash ? <p className="text-sm text-emerald-700">{flash}</p> : null}

      {data.open.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد دفعات بانتظار الاعتماد.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.open.map((r) => (
            <li key={r.id} className="py-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <b className="text-slate-900">{TYPE_LABEL[r.request_type]}</b>
                <span className="font-bold text-emerald-800">{fmtMoney(r.amount)}</span>
                <span className="text-slate-700">{r.customer_name || '—'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === 'PENDING' ? 'bg-sky-50 text-sky-800' : 'bg-amber-50 text-amber-800'}`}>
                  {r.status === 'PENDING' ? 'بانتظار المحاسب' : 'بانتظار موافقة المشرف العام'}
                </span>
              </div>
              <small className="text-slate-500">
                سجّلها {r.recorded_by_name} · {when(r.recorded_ts)}
                {r.prepared_by_name && r.prepared_by_id !== r.recorded_by_id ? ` · حضّرها ${r.prepared_by_name}` : ''}
                {r.payload?.package_name ? ` · ${r.payload.package_name}` : ''}
                {r.reason ? ` · ${r.reason}` : ''}
              </small>
              <div className="flex flex-wrap items-center gap-2">{actionsFor(r)}</div>
            </li>
          ))}
        </ul>
      )}

      {data.recent.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-slate-600">آخر القرارات ({data.recent.length})</summary>
          <ul className="mt-2 space-y-1">
            {data.recent.map((r) => (
              <li key={r.id} className="text-slate-600">
                <span className={r.decision_type === 'SUPER_ADMIN_OVERRIDE' ? 'font-bold text-amber-800' : r.decision_type === 'REJECTED' ? 'text-rose-700' : 'text-emerald-800'}>
                  {DECISION_LABEL[r.decision_type || ''] || r.decision_type}
                </span>
                {' — '}{TYPE_LABEL[r.request_type]} {fmtMoney(r.amount)} · {r.customer_name || '—'} · {r.decided_by_name} · {when(r.decided_ts)}
                {r.reason ? <span className="text-slate-500"> · السبب: {r.reason}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {dialog ? (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => (busy ? undefined : setDialog(null))}>
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3 shadow-xl"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (dialog.kind === 'threshold') void send('threshold', { action: 'set_threshold', threshold: Number(text) }, true);
              else if (dialog.kind === 'override') void send(dialog.req.id, { action: 'override_request', id: dialog.req.id, override_reason: text.trim() }, true);
              else void send(dialog.req.id, { action: 'reject_request', id: dialog.req.id, reason: text.trim() });
            }}
          >
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              {dialog.kind === 'override' ? <ShieldAlert className="w-5 h-5 text-amber-600" /> : null}
              {dialog.kind === 'threshold' ? 'حد موافقة المشرف العام' : dialog.kind === 'override' ? 'تجاوز الإدارة' : 'سبب الرفض'}
            </h4>
            {dialog.kind === 'override' ? (
              <p className="text-sm text-slate-600">
                اعتماد استثنائي لـ{TYPE_LABEL[dialog.req.request_type]} {fmtMoney(dialog.req.amount)} — {dialog.req.customer_name}. يُطلب مفتاح الأمان،
                ويُسجَّل «اعتمدها المشرف العام (تجاوز الإدارة)» مع السبب في سجل التدقيق ويُبلَّغ المحاسب.
              </p>
            ) : null}
            {dialog.kind === 'threshold' ? (
              <label className="block text-sm">
                المبلغ (دج) — كل دفعة أو استرجاع فوقه يحتاج موافقتك
                <input type="number" min={1000} step={1000} required dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} />
              </label>
            ) : (
              <textarea
                required
                minLength={dialog.kind === 'override' ? 5 : 3}
                maxLength={500}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={dialog.kind === 'override' ? 'سبب التجاوز (إلزامي)' : 'سبب الرفض'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600" onClick={() => setDialog(null)} disabled={Boolean(busy)}>
                إلغاء
              </button>
              <button type="submit" className="rounded-lg px-3 py-2 text-sm font-bold text-white bg-emerald-600 disabled:opacity-50" disabled={Boolean(busy)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{' '}
                {dialog.kind === 'threshold' ? 'حفظ (مفتاح الأمان)' : dialog.kind === 'override' ? 'تجاوز الإدارة (مفتاح الأمان)' : 'رفض'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
