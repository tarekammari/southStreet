'use client';

import React, { useEffect, useState } from 'react';
import { fmtMoney, PAY_METHODS } from './money';
import { EntityNameCell } from './EntityAvatar';
import { resolveClientAvatarFromIndex } from '@/lib/entity-avatar-display';

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

type AmountMode = 'full' | 'partial' | 'percent';

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
          setPercent(100);
          setAmountMode('full');
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

  const handleModeChange = (mode: AmountMode) => {
    setAmountMode(mode);
    if (!ceiling) return;
    if (mode === 'full') { setAmount(ceiling); setPercent(100); }
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <form
        className="acct-card rounded-2xl w-full max-w-md acct-modal"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        dir="rtl"
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>تحصيل</h4>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: 0.4, lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Error */}
          {err && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#dc2626', fontWeight: 600,
            }}>
              {err}
            </div>
          )}

          {/* Client / booking card */}
          {selected ? (
            <div style={{ background: 'var(--acct-input)', borderRadius: 12, padding: 14 }}>
              {selected.awaiting_deposit && (
                <div style={{
                  fontSize: 11, fontWeight: 600, color: '#92400e',
                  background: 'rgba(251,191,36,0.15)', borderRadius: 8,
                  padding: '6px 10px', marginBottom: 10,
                }}>
                  ملاحظة: العربون ({fmtMoney(selected.deposit_due || 0)}) غير مدفوع — تسجيل هذه الدفعة يُكمِل التأكيد النهائي.
                </div>
              )}
              <EntityNameCell
                variant="client"
                name={selected.customer_name}
                imageUrl={
                  selected.customer_avatar ||
                  resolveClientAvatarFromIndex(avatarIndex, selected.customer_code, selected.customer_name)
                }
                meta={selected.package_name}
              />
              {/* Progress bar */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
                  <span>المدفوع · {paidPercent}%</span>
                  <span>{fmtMoney(selected.paid)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: 'var(--acct-border, rgba(0,0,0,0.1))' }}>
                  <div style={{
                    height: '100%', borderRadius: 5,
                    background: 'var(--acct-emerald, #10b981)',
                    width: `${paidPercent}%`, transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
              {/* Remaining badge */}
              <div style={{
                marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: 'rgba(16,185,129,0.08)',
                borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)',
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>المتبقي</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--acct-emerald, #10b981)' }}>
                  {fmtMoney(selected.remaining)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', opacity: 0.5, fontSize: 12 }}>
              جاري التحميل…
            </div>
          )}

          {/* Amount */}
          {ceiling !== null && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 8 }}>المبلغ</label>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {([
                  { id: 'full', label: 'الكل' },
                  { id: 'partial', label: 'مبلغ محدد' },
                  { id: 'percent', label: 'نسبة %' },
                ] as { id: AmountMode; label: string }[]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeChange(m.id)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--acct-border, rgba(0,0,0,0.1))',
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: amountMode === m.id ? 'var(--acct-emerald, #10b981)' : 'var(--acct-input)',
                      color: amountMode === m.id ? '#fff' : 'inherit',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {amountMode === 'percent' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={1} max={100}
                      className="acct-input"
                      style={{ width: 64, textAlign: 'center' }}
                      value={percent}
                      onChange={(e) => handlePercentChange(Number(e.target.value))}
                    />
                    <span style={{ fontSize: 16, fontWeight: 700, opacity: 0.4 }}>%</span>
                    <input
                      type="range" min={1} max={100} value={percent}
                      onChange={(e) => handlePercentChange(Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--acct-emerald, #10b981)' }}
                    />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginTop: 6, opacity: 0.65 }}>= {fmtMoney(amount)}</p>
                </div>
              ) : (
                <input
                  type="number" required min={1} max={ceiling}
                  className="acct-input w-full"
                  value={amount}
                  readOnly={amountMode === 'full'}
                  onChange={(e) => {
                    if (amountMode === 'full') setAmountMode('partial');
                    handleAmountChange(Number(e.target.value));
                  }}
                />
              )}

              {amountMode !== 'full' && (
                <p style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>الحد الأقصى {fmtMoney(ceiling)}</p>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>التاريخ</label>
            <input
              type="date"
              className="acct-input w-full"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          {/* Method + Treasury */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>طريقة الدفع</label>
              <select className="acct-input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>الخزينة</label>
              <select className="acct-input w-full" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">غير محدد</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
              </select>
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 6 }}>ملاحظة</label>
            <input
              className="acct-input w-full"
              placeholder="اختياري"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
            <button
              type="button"
              className="acct-muted"
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy || !selected}
              style={{
                flex: 2, padding: '11px 0', borderRadius: 10,
                background: 'var(--acct-emerald, #10b981)', color: '#fff',
                fontWeight: 700, fontSize: 13, border: 'none',
                cursor: busy || !selected ? 'not-allowed' : 'pointer',
                opacity: busy || !selected ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              {busy ? '…' : `تسجيل${amount > 0 ? ' · ' + fmtMoney(amount) : ''}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

