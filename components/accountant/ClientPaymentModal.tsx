'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, Wallet, X } from 'lucide-react';
import { fmtMoney, PAY_METHODS } from './money';
import { resolveClientAvatarFromIndex } from '@/lib/entity-avatar-display';
import './client-payment.css';

export type Collectible = {
  reservation_id: string;
  reference: string;
  customer_name: string;
  customer_code: string;
  package_name: string;
  trip_type: string;
  total: number;
  paid: number;
  remaining: number;
  credit_available: number;
  date: string;
  customer_avatar?: string;
  status?: string;
  deposit_due?: number;
  awaiting_deposit?: boolean;
};

type AmountMode = 'deposit' | 'full' | 'partial' | 'percent';

export default function ClientPaymentModal({
  onClose,
  onSaved,
  preset,
}: {
  onClose: () => void;
  onSaved: () => void;
  preset?: { customer_name?: string; customer_code?: string; reservation_id?: string } | null;
}) {
  const [accounts, setAccounts] = useState<{ id: string; name_ar: string }[]>([]);
  const [selected, setSelected] = useState<Collectible | null>(null);
  const [avatarIndex, setAvatarIndex] = useState<Record<string, string>>({});

  const [amount, setAmount] = useState(0);
  const [percent, setPercent] = useState(100);
  const [amountMode, setAmountMode] = useState<AmountMode>('full');
  const [method, setMethod] = useState('CASH');
  const [accountId, setAccountId] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Load data: auto-select best matching booking for this client
  useEffect(() => {
    fetch('/api/finance/clients/payments')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل البيانات'))))
      .then((d) => {
        const rows: Collectible[] = d.reservations || [];
        setAvatarIndex(d.avatar_index || {});
        if (!preset) return;
        const exact = preset.reservation_id
          ? rows.find((r) => r.reservation_id === preset.reservation_id && r.remaining > 0)
          : undefined;
        const mine = exact || rows
          .filter(
            (r) =>
              r.remaining > 0 &&
              ((preset.customer_code && r.customer_code === preset.customer_code) ||
                (preset.customer_name && r.customer_name === preset.customer_name))
          )
          .sort((a, b) => b.remaining - a.remaining)[0] || null;
        if (mine) {
          setSelected(mine);
          const cap = mine.awaiting_deposit && mine.deposit_due
            ? Math.min(mine.deposit_due, mine.remaining)
            : mine.remaining;
          setAmount(cap);
          // A booking waiting for its deposit starts on "deposit", otherwise on the full remainder.
          const depositFirst = Boolean(mine.awaiting_deposit && mine.deposit_due && mine.deposit_due < mine.remaining);
          setPercent(depositFirst ? Math.round((cap / mine.remaining) * 100) : 100);
          setAmountMode(depositFirst ? 'deposit' : 'full');
        }
      })
      .catch((e) => setErr(e.message || 'خطأ'));

    fetch('/api/finance/treasury')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAccounts((d.accounts || []).map((a: any) => ({ id: a.id, name_ar: a.name_ar }))))
      .catch(() => setAccounts([]));
  }, [preset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ceiling = selected ? selected.remaining : null;
  const depositDue =
    selected?.awaiting_deposit && selected.deposit_due && selected.deposit_due < selected.remaining ? selected.deposit_due : null;

  const handleModeChange = (mode: AmountMode) => {
    setAmountMode(mode);
    if (!ceiling) return;
    if (mode === 'full') { setAmount(ceiling); setPercent(100); }
    else if (mode === 'deposit' && depositDue) { setAmount(depositDue); setPercent(Math.round((depositDue / ceiling) * 100)); }
    else if (mode === 'percent') { setAmount(Math.round((percent / 100) * ceiling)); }
  };

  const handlePercentChange = (p: number) => {
    const c = Math.min(100, Math.max(0, p));
    setPercent(c);
    if (ceiling) setAmount(Math.round((c / 100) * ceiling));
  };

  const handleAmountChange = (a: number) => {
    setAmount(a);
    if (ceiling && ceiling > 0) setPercent(Math.round((a / ceiling) * 100));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!selected) { setErr('لا يوجد حجز مرتبط بهذا العميل'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/finance/clients/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'INCOME',
          amount,
          method,
          account_id: accountId || null,
          entry_date: entryDate,
          note,
          reservation_id: selected.reservation_id,
          customer_name: selected.customer_name,
          customer_code: selected.customer_code,
          package_name: selected.package_name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || 'تعذّر تسجيل الدفعة'); return; }
      onSaved();
      onClose();
    } catch {
      setErr('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  };

  const paidPercent = selected && selected.total > 0
    ? Math.round((selected.paid / selected.total) * 100)
    : 0;

  const avatar = selected
    ? selected.customer_avatar || resolveClientAvatarFromIndex(avatarIndex, selected.customer_code, selected.customer_name)
    : '';
  const quickPercents = [25, 50, 75, 100];

  // Rendered on <body>: the window looks the same from any dashboard (it no longer
  // depends on the accountant workspace's styles, which other pages do not have).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="cpm-scrim" onClick={onClose}>
      <form className="cpm" onClick={(e) => e.stopPropagation()} onSubmit={submit} dir="rtl" role="dialog" aria-modal="true" aria-labelledby="cpm-title">
        <header className="cpm-head">
          <span className="cpm-head-icon"><Wallet aria-hidden /></span>
          <div>
            <h4 id="cpm-title">تسجيل دفعة</h4>
            <small>تحصيل مبلغ من العميل على حجزه</small>
          </div>
          <button type="button" className="cpm-close" onClick={onClose} aria-label="إغلاق"><X aria-hidden /></button>
        </header>

        <div className="cpm-body">
          {err ? <div className="cpm-error" role="alert">{err}</div> : null}

          {selected ? (
            <section className="cpm-client">
              <div className="cpm-client-top">
                <span className="cpm-avatar">
                  {avatar ? <img src={avatar} alt="" /> : <b>{(selected.customer_name || '؟').charAt(0)}</b>}
                </span>
                <div className="cpm-client-name">
                  <strong>{selected.customer_name}</strong>
                  <small>{selected.package_name}</small>
                </div>
                {selected.reference ? <span className="cpm-ref" dir="ltr">{selected.reference}</span> : null}
              </div>

              {selected.awaiting_deposit ? (
                <p className="cpm-notice">
                  العربون ({fmtMoney(selected.deposit_due || 0)}) غير مدفوع بعد. تسجيل هذه الدفعة يُكمل تأكيد الحجز.
                </p>
              ) : null}

              <div className="cpm-stats">
                <div><span>الإجمالي</span><b>{fmtMoney(selected.total)}</b></div>
                <div><span>المدفوع</span><b>{fmtMoney(selected.paid)}</b></div>
                <div className="is-remaining"><span>المتبقي</span><b>{fmtMoney(selected.remaining)}</b></div>
              </div>
              <div className="cpm-progress" aria-label={`المدفوع ${paidPercent}%`}>
                <span style={{ width: `${paidPercent}%` }} />
              </div>
              <small className="cpm-progress-label">مدفوع {paidPercent}%</small>
            </section>
          ) : (
            <div className="cpm-loading"><Loader2 className="animate-spin" aria-hidden /> جارٍ تحميل الحجز…</div>
          )}

          {ceiling !== null ? (
            <section className="cpm-field">
              <label>المبلغ المُحصَّل</label>
              <div className="cpm-segment" role="tablist" style={{ ['--cpm-n' as string]: depositDue ? 4 : 3 }}>
                {([
                  ...(depositDue ? [{ id: 'deposit', label: 'العربون' }] : []),
                  { id: 'full', label: 'المتبقي كاملاً' },
                  { id: 'partial', label: 'مبلغ محدد' },
                  { id: 'percent', label: 'نسبة %' },
                ] as { id: AmountMode; label: string }[]).map((m) => (
                  <button key={m.id} type="button" role="tab" aria-selected={amountMode === m.id} className={amountMode === m.id ? 'is-on' : ''} onClick={() => handleModeChange(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>

              {amountMode === 'percent' ? (
                <>
                  <div className="cpm-chips">
                    {quickPercents.map((p) => (
                      <button key={p} type="button" className={percent === p ? 'is-on' : ''} onClick={() => handlePercentChange(p)}>{p}%</button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={percent}
                    onChange={(e) => handlePercentChange(Number(e.target.value))}
                    className="cpm-range"
                    aria-label="النسبة"
                  />
                  <div className="cpm-amount is-readonly">
                    <span className="cpm-amount-value">{fmtMoney(amount)}</span>
                    <small>{percent}% من المتبقي</small>
                  </div>
                </>
              ) : (
                <div className={`cpm-amount${amountMode === 'full' || amountMode === 'deposit' ? ' is-readonly' : ''}`}>
                  <input
                    type="number"
                    required
                    min={1}
                    max={ceiling}
                    inputMode="decimal"
                    value={amount}
                    readOnly={amountMode === 'full' || amountMode === 'deposit'}
                    onChange={(e) => {
                      if (amountMode === 'full' || amountMode === 'deposit') setAmountMode('partial');
                      handleAmountChange(Number(e.target.value));
                    }}
                    aria-label="المبلغ"
                    dir="ltr"
                  />
                  <span className="cpm-currency">دج</span>
                </div>
              )}
              {amountMode === 'partial' ? <small className="cpm-hint">الحد الأقصى {fmtMoney(ceiling)}</small> : null}
            </section>
          ) : null}

          <div className="cpm-grid">
            <section className="cpm-field">
              <label htmlFor="cpm-method">طريقة الدفع</label>
              <select id="cpm-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </section>
            <section className="cpm-field">
              <label htmlFor="cpm-account">الخزينة</label>
              <select id="cpm-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">غير محدد</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
              </select>
            </section>
            <section className="cpm-field">
              <label htmlFor="cpm-date">تاريخ الدفع</label>
              <input id="cpm-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </section>
            <section className="cpm-field">
              <label htmlFor="cpm-note">ملاحظة</label>
              <input id="cpm-note" placeholder="اختياري: رقم الوصل…" value={note} onChange={(e) => setNote(e.target.value)} />
            </section>
          </div>
        </div>

        <footer className="cpm-foot">
          <button type="button" className="cpm-cancel" onClick={onClose}>إلغاء</button>
          <button type="submit" className="cpm-submit" disabled={busy || !selected || amount <= 0}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
            {busy ? 'جارٍ التسجيل…' : `تسجيل الدفعة${amount > 0 ? ` · ${fmtMoney(amount)}` : ''}`}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}
