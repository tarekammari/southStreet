const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel, fs.statSync(full).size);
}

w('components/accountant/money.ts', `export function fmtMoney(n: number) {
  return \`\${(n || 0).toLocaleString('ar-DZ')} دج\`;
}

export const PAY_METHODS = [
  { value: 'CASH', label: 'نقداً' },
  { value: 'CCP', label: 'CCP' },
  { value: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { value: 'CHECK', label: 'شيك' },
  { value: 'OTHER', label: 'أخرى' },
] as const;
`);

w('components/accountant/OverviewPanel.tsx', `'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from './money';

type Summary = {
  cash_in: number;
  cash_out: number;
  supplier_debt: number;
  payroll_pending: number;
  service_due: number;
  net: number;
  running_balance: number;
};

export default function OverviewPanel() {
  const [s, setS] = useState<Summary | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/finance/reports/summary')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'يلزم تسجيل الدخول' : 'تعذر التحميل');
        return r.json();
      })
      .then(setS)
      .catch((e) => setErr(e.message || 'خطأ'));
  }, []);

  if (err) return <div className="acct-card p-4 text-amber-700 text-sm">{err}</div>;
  if (!s) return <div className="acct-card p-6 text-sm opacity-70">جاري تحميل الملخص…</div>;

  const cards = [
    { label: 'الداخل (CASH_IN)', value: s.cash_in, tone: 'text-emerald-600' },
    { label: 'الخارج', value: s.cash_out, tone: 'text-rose-600' },
    { label: 'صافي الفترة', value: s.net, tone: s.net >= 0 ? 'text-emerald-700' : 'text-rose-700' },
    { label: 'رصيد جاري', value: s.running_balance, tone: 'text-sky-700' },
    { label: 'دين الموردين', value: s.supplier_debt, tone: 'text-amber-700' },
    { label: 'رواتب معلّقة', value: s.payroll_pending, tone: 'text-violet-700' },
    { label: 'خدمات مستحقة (30ي)', value: s.service_due, tone: 'text-orange-700' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="acct-card rounded-2xl p-5 space-y-1">
          <div className="text-sm opacity-70 font-medium">{c.label}</div>
          <div className={\`text-2xl font-black tracking-tight \${c.tone}\`}>{fmtMoney(c.value)}</div>
        </div>
      ))}
    </div>
  );
}
`);

w('components/accountant/LedgerPanel.tsx', `'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtMoney } from './money';

type Row = {
  id: string;
  type: string;
  direction: string;
  amount: number;
  description: string;
  entry_date: string;
  status: string;
  counterparty?: string;
  method?: string;
  running_balance: number;
};

const TYPES = ['EXPENSE', 'PURCHASE', 'SERVICE_SPEND', 'CASH_IN', 'CASH_OUT'];

export default function LedgerPanel() {
  const [items, setItems] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('EXPENSE');
  const [amount, setAmount] = useState(10000);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/finance/ledger')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/finance/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount, description }),
      });
      if (res.ok) {
        setOpen(false);
        setDescription('');
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className="text-lg font-bold">دفتر الحركة</h3>
        <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">قيد جديد</button>
      </div>
      <div className="acct-card rounded-2xl overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-black/10 opacity-70">
              <th className="py-3 px-3">التاريخ</th>
              <th className="py-3 px-3">النوع</th>
              <th className="py-3 px-3">الوصف</th>
              <th className="py-3 px-3">المبلغ</th>
              <th className="py-3 px-3">الرصيد</th>
              <th className="py-3 px-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {items.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 px-3">{r.entry_date}</td>
                <td className="py-2.5 px-3 font-mono text-xs">{r.type}</td>
                <td className="py-2.5 px-3">{r.description || r.counterparty || '—'}</td>
                <td className={\`py-2.5 px-3 font-bold \${r.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}\`}>
                  {r.direction === 'in' ? '+' : '−'}{fmtMoney(r.amount)}
                </td>
                <td className="py-2.5 px-3 font-semibold">{fmtMoney(r.running_balance)}</td>
                <td className="py-2.5 px-3 text-xs">{r.status}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center opacity-60">لا قيود بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form className="acct-card rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h4 className="font-bold text-base">إضافة قيد (POSTED)</h4>
            <label className="block text-sm font-bold">النوع
              <select className="acct-input mt-1 w-full" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">المبلغ (دج)
              <input type="number" required className="acct-input mt-1 w-full" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
            <label className="block text-sm font-bold">الوصف
              <input className="acct-input mt-1 w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" className="flex-1 py-2 rounded-xl acct-muted font-bold" onClick={() => setOpen(false)}>إلغاء</button>
              <button type="submit" disabled={busy} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold">{busy ? '…' : 'اعتماد'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
`);

console.log('part1 ok');