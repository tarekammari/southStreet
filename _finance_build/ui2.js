const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel, fs.statSync(full).size);
}

w('components/accountant/SuppliersPanel.tsx', `'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtMoney, PAY_METHODS } from './money';

type Supplier = { id: string; code: string; name_ar: string; contact: string; payment_terms_days: number; status: string };
type Aging = { supplier_id: string; name_ar: string; total_remaining: number; bucket_current: number; bucket_1_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number };
type Invoice = { id: string; invoice_no: string; amount: number; remaining: number; status: string; due_date: string };

export default function SuppliersPanel() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [aging, setAging] = useState<Aging[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState('CASH');
  const [invoiceId, setInvoiceId] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch('/api/finance/suppliers').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setItems(d.items || [])).catch(() => setItems([]));
    fetch('/api/finance/suppliers/aging').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setAging(d.items || [])).catch(() => setAging([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) { setInvoices([]); return; }
    fetch(\`/api/finance/suppliers/\${selected}/invoices\`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setInvoices(d.items || []))
      .catch(() => setInvoices([]));
  }, [selected]);

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/finance/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name_ar: nameAr }),
    });
    if (res.ok) { setAddOpen(false); setNameAr(''); load(); }
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch(\`/api/finance/suppliers/\${selected}/payments\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, invoice_id: invoiceId || null }),
    });
    if (res.ok) { setPayOpen(false); load(); setSelected(selected); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2 flex-wrap items-center">
        <h3 className="text-lg font-bold">الموردون وأعمار الديون</h3>
        <div className="flex gap-2">
          <button type="button" className="px-3 py-2 rounded-xl acct-muted text-sm font-bold" onClick={() => setAddOpen(true)}>مورد جديد</button>
          <button type="button" disabled={!selected} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40" onClick={() => setPayOpen(true)}>تسجيل دفعة</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="acct-card rounded-2xl overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead><tr className="border-b opacity-70"><th className="p-3">الرمز</th><th className="p-3">الاسم</th><th className="p-3">الأجل</th><th className="p-3">الحالة</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {items.map((s) => (
                <tr key={s.id} className={\`cursor-pointer \${selected === s.id ? 'bg-emerald-500/10' : 'hover:bg-black/5'}\`} onClick={() => setSelected(s.id)}>
                  <td className="p-3 font-mono text-xs">{s.code}</td>
                  <td className="p-3 font-bold">{s.name_ar}</td>
                  <td className="p-3">{s.payment_terms_days}ي</td>
                  <td className="p-3 text-xs">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="acct-card rounded-2xl overflow-x-auto">
          <h4 className="font-bold p-3 border-b">أعمار الديون</h4>
          <table className="w-full text-sm text-right">
            <thead><tr className="opacity-70 text-xs"><th className="p-2">مورد</th><th className="p-2">حالي</th><th className="p-2">1-30</th><th className="p-2">+90</th><th className="p-2">الإجمالي</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {aging.map((a) => (
                <tr key={a.supplier_id} className="cursor-pointer" onClick={() => setSelected(a.supplier_id)}>
                  <td className="p-2 font-bold">{a.name_ar}</td>
                  <td className="p-2">{fmtMoney(a.bucket_current)}</td>
                  <td className="p-2">{fmtMoney(a.bucket_1_30)}</td>
                  <td className="p-2 text-rose-600">{fmtMoney(a.bucket_90_plus)}</td>
                  <td className="p-2 font-bold text-amber-700">{fmtMoney(a.total_remaining)}</td>
                </tr>
              ))}
              {aging.length === 0 && <tr><td colSpan={5} className="p-6 text-center opacity-60">لا ديون مفتوحة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="acct-card rounded-2xl p-4 space-y-2">
          <h4 className="font-bold">فواتير المورد المحدد</h4>
          <ul className="text-sm space-y-1">
            {invoices.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 border-b border-black/5 py-2">
                <span>{i.invoice_no} · {i.status} · استحقاق {i.due_date}</span>
                <span className="font-bold">{fmtMoney(i.remaining)} / {fmtMoney(i.amount)}</span>
              </li>
            ))}
            {invoices.length === 0 && <li className="opacity-60">لا فواتير</li>}
          </ul>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <form className="acct-card rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={addSupplier}>
            <h4 className="font-bold">مورد جديد</h4>
            <input required className="acct-input w-full" placeholder="الاسم بالعربية" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold">حفظ</button>
          </form>
        </div>
      )}

      {payOpen && selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPayOpen(false)}>
          <form className="acct-card rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={pay}>
            <h4 className="font-bold">دفعة مورد (بدون بطاقة)</h4>
            <input type="number" required className="acct-input w-full" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <select className="acct-input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="acct-input w-full" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">بدون فاتورة</option>
              {invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOID').map((i) => (
                <option key={i.id} value={i.id}>{i.invoice_no} — متبقي {fmtMoney(i.remaining)}</option>
              ))}
            </select>
            <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold">تسجيل وترحيل للدفتر</button>
          </form>
        </div>
      )}
    </div>
  );
}
`);

w('components/accountant/PayrollPanel.tsx', `'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtMoney, PAY_METHODS } from './money';

type Salary = { id: string; staff_name: string; period_year: number; period_month: number; amount: number; status: string; morshid_id?: string };
type Service = { id: string; name_ar: string; frequency: string; amount: number; next_due_date: string; provider: string; status: string };

export default function PayrollPanel() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [upcoming, setUpcoming] = useState<Service[]>([]);
  const [svcPayId, setSvcPayId] = useState('');
  const [method, setMethod] = useState('CASH');

  const load = useCallback(() => {
    fetch('/api/finance/salaries').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setSalaries(d.items || [])).catch(() => setSalaries([]));
    fetch('/api/finance/services').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setServices(d.items || [])).catch(() => setServices([]));
    fetch('/api/finance/services/upcoming').then((r) => r.ok ? r.json() : Promise.reject()).then((d) => setUpcoming(d.items || [])).catch(() => setUpcoming([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id: string) => {
    const res = await fetch('/api/finance/salaries', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'mark-paid' }),
    });
    if (res.ok) load();
  };

  const payService = async (service_id: string, amount: number) => {
    const res = await fetch('/api/finance/services/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id, amount, method }),
    });
    if (res.ok) { setSvcPayId(''); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="acct-card rounded-2xl overflow-x-auto">
        <div className="p-4 border-b font-bold text-lg">الرواتب</div>
        <table className="w-full text-sm text-right">
          <thead><tr className="opacity-70"><th className="p-3">الموظف</th><th className="p-3">الفترة</th><th className="p-3">المبلغ</th><th className="p-3">الحالة</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-black/5">
            {salaries.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-bold">{s.staff_name}{s.morshid_id ? <span className="text-xs opacity-60 block">مرشد: {s.morshid_id}</span> : null}</td>
                <td className="p-3">{s.period_year}/{s.period_month}</td>
                <td className="p-3 font-bold">{fmtMoney(s.amount)}</td>
                <td className="p-3"><span className={\`px-2 py-0.5 rounded-full text-xs font-bold \${s.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-800'}\`}>{s.status}</span></td>
                <td className="p-3">
                  {s.status === 'PENDING' && (
                    <button type="button" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold" onClick={() => markPaid(s.id)}>تعليم كمدفوع</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="acct-card rounded-2xl overflow-x-auto">
          <div className="p-4 border-b font-bold">تكاليف الخدمات</div>
          <ul className="divide-y divide-black/5 text-sm">
            {services.map((s) => (
              <li key={s.id} className="p-3 flex justify-between gap-2 items-center">
                <div>
                  <div className="font-bold">{s.name_ar}</div>
                  <div className="text-xs opacity-70">{s.frequency} · {s.provider} · استحقاق {s.next_due_date}</div>
                </div>
                <div className="text-left space-y-1">
                  <div className="font-bold">{fmtMoney(s.amount)}</div>
                  <button type="button" className="text-xs font-bold text-emerald-700" onClick={() => setSvcPayId(s.id)}>دفع</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="acct-card rounded-2xl p-4 space-y-2">
          <h4 className="font-bold">قادم قريباً</h4>
          {upcoming.map((u) => (
            <div key={u.id} className="flex justify-between text-sm border-b border-black/5 py-2">
              <span>{u.name_ar} · {u.next_due_date}</span>
              <span className="font-bold text-amber-700">{fmtMoney(u.amount)}</span>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm opacity-60">لا استحقاقات قريبة</p>}
        </div>
      </div>

      {svcPayId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSvcPayId('')}>
          <div className="acct-card rounded-2xl p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold">دفع خدمة</h4>
            <select className="acct-input w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button type="button" className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold"
              onClick={() => {
                const svc = services.find((x) => x.id === svcPayId);
                if (svc) payService(svc.id, svc.amount);
              }}>تأكيد الدفع وترحيل للدفتر</button>
          </div>
        </div>
      )}
    </div>
  );
}
`);

w('components/accountant/ReportsPanel.tsx', `'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from './money';

export default function ReportsPanel() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const q = new URLSearchParams({ from, to });
    fetch(\`/api/finance/reports/summary?\${q}\`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData(null));
  }, [from, to]);

  const cards = data ? [
    { label: 'الداخل', value: data.cash_in, color: 'border-emerald-400' },
    { label: 'الخارج', value: data.cash_out, color: 'border-rose-400' },
    { label: 'الصافي', value: data.net, color: 'border-sky-400' },
    { label: 'دين الموردين', value: data.supplier_debt, color: 'border-amber-400' },
    { label: 'رواتب معلّقة', value: data.payroll_pending, color: 'border-violet-400' },
    { label: 'خدمات مستحقة', value: data.service_due, color: 'border-orange-400' },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm font-bold">من
          <input type="date" className="acct-input block mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm font-bold">إلى
          <input type="date" className="acct-input block mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={\`acct-card rounded-2xl p-5 border-r-4 \${c.color}\`}>
            <div className="text-sm opacity-70">{c.label}</div>
            <div className="text-2xl font-black mt-1">{fmtMoney(c.value)}</div>
          </div>
        ))}
      </div>
      {!data && <p className="text-sm opacity-60">تعذر تحميل التقرير — تحقق من الجلسة.</p>}
    </div>
  );
}
`);

console.log('ui2 ok');