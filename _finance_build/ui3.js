const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel, fs.statSync(full).size);
}

w('components/accountant/ReceiptsPanel.tsx', `'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { User, Receipt } from '@/types';
import { fmtMoney } from './money';

type PilgrimAgg = {
  key: string;
  pilgrimName: string;
  pilgrimCode: string;
  totalBilled: number;
  totalPaid: number;
  remaining: number;
  receiptCount: number;
  lastPaymentDate: string;
  status: string;
};

function paidInFull(r: Receipt) {
  return (r.remainingAmount || 0) <= 0 || String(r.status || '').includes('خالص');
}

export default function ReceiptsPanel({ currentUser }: { currentUser: User }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [pilgrimFilter, setPilgrimFilter] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [pilgrimName, setPilgrimName] = useState('');
  const [packageName, setPackageName] = useState('باقة أوت الاقتصادية المميزة (طيران مباشر)');
  const [totalAmount, setTotalAmount] = useState(215000);
  const [paidAmount, setPaidAmount] = useState(215000);
  const [paymentMethod, setPaymentMethod] = useState('تحويل بريدي موب (BaridiMob)');

  const fetchReceipts = async () => {
    try {
      const res = await fetch('/api/receipts');
      if (res.ok) setReceipts(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchReceipts(); }, []);

  const kpis = useMemo(() => {
    const totalRevenue = receipts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
    const outstanding = receipts.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);
    const billed = receipts.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
    const paidFullCount = receipts.filter(paidInFull).length;
    const collectionRate = billed > 0 ? Math.round((totalRevenue / billed) * 1000) / 10 : 0;
    return { totalRevenue, outstanding, billed, receiptCount: receipts.length, paidFullCount, collectionRate };
  }, [receipts]);

  const pilgrimAnalysis: PilgrimAgg[] = useMemo(() => {
    const map = new Map<string, PilgrimAgg>();
    for (const r of receipts) {
      const key = (r.pilgrimCode || r.pilgrimName || r.id || 'unknown').trim();
      const prev = map.get(key) || {
        key, pilgrimName: r.pilgrimName || '—', pilgrimCode: r.pilgrimCode || '',
        totalBilled: 0, totalPaid: 0, remaining: 0, receiptCount: 0, lastPaymentDate: '', status: '',
      };
      prev.totalBilled += r.totalAmount || 0;
      prev.totalPaid += r.paidAmount || 0;
      prev.remaining += r.remainingAmount || 0;
      prev.receiptCount += 1;
      if (!prev.lastPaymentDate || String(r.date) > prev.lastPaymentDate) prev.lastPaymentDate = r.date || prev.lastPaymentDate;
      if (r.pilgrimName) prev.pilgrimName = r.pilgrimName;
      if (r.pilgrimCode) prev.pilgrimCode = r.pilgrimCode;
      map.set(key, prev);
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, status: row.remaining <= 0 ? 'خالص الدفع' : 'متبقي للتحصيل' }))
      .sort((a, b) => b.remaining - a.remaining || b.totalPaid - a.totalPaid);
  }, [receipts]);

  const methodBreakdown = useMemo(() => {
    const map = new Map<string, { method: string; count: number; paid: number }>();
    for (const r of receipts) {
      const method = r.paymentMethod || 'غير محدد';
      const prev = map.get(method) || { method, count: 0, paid: 0 };
      prev.count += 1; prev.paid += r.paidAmount || 0;
      map.set(method, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.paid - a.paid);
  }, [receipts]);

  const visibleReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (pilgrimFilter) {
        const key = (r.pilgrimCode || r.pilgrimName || '').trim();
        if (key !== pilgrimFilter && r.pilgrimName !== pilgrimFilter && r.pilgrimCode !== pilgrimFilter) return false;
      }
      if (methodFilter && (r.paymentMethod || 'غير محدد') !== methodFilter) return false;
      return true;
    });
  }, [receipts, pilgrimFilter, methodFilter]);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const newReceipt: Receipt = {
      id: \`REC-\${Math.floor(1000 + Math.random() * 9000)}\`,
      pilgrimName, pilgrimCode: 'PILGRIM-CUSTOM', packageName, totalAmount, paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount), paymentMethod,
      date: new Date().toISOString().split('T')[0], accountantName: currentUser.name,
      status: totalAmount - paidAmount <= 0 ? 'خالص الدفع' : 'عربون متبقي',
    };
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newReceipt),
      });
      if (res.ok) {
        setIsModalOpen(false); setPilgrimName(''); fetchReceipts(); setSelectedReceipt(newReceipt);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={() => setIsModalOpen(true)} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer">إصدار سند جديد</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="acct-card rounded-2xl p-5 space-y-1 border border-emerald-200/60"><span className="text-sm opacity-70">إجمالي المحصّل</span><div className="text-2xl font-black text-emerald-600">{fmtMoney(kpis.totalRevenue)}</div></div>
        <div className="acct-card rounded-2xl p-5 space-y-1"><span className="text-sm opacity-70">المبالغ المستحقة</span><div className="text-2xl font-black text-amber-600">{fmtMoney(kpis.outstanding)}</div></div>
        <div className="acct-card rounded-2xl p-5 space-y-1"><span className="text-sm opacity-70">عدد السندات</span><div className="text-2xl font-black">{kpis.receiptCount}</div></div>
        <div className="acct-card rounded-2xl p-5 space-y-1"><span className="text-sm opacity-70">خالص بالكامل</span><div className="text-2xl font-black text-emerald-700">{kpis.paidFullCount}</div></div>
        <div className="rounded-2xl p-5 space-y-1 bg-slate-900 text-white"><span className="text-sm text-white/70">نسبة التحصيل</span><div className="text-2xl font-black">{kpis.collectionRate}%</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 acct-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-bold">تحليل المعتمرين</h3>
            {pilgrimFilter ? <button type="button" onClick={() => setPilgrimFilter(null)} className="text-sm font-bold text-emerald-700">× {pilgrimFilter}</button> : <span className="text-sm opacity-70">{pilgrimAnalysis.length}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead><tr className="border-b opacity-70"><th className="py-3 px-2">المعتمر</th><th className="py-3 px-2">المفوتر</th><th className="py-3 px-2">المسدد</th><th className="py-3 px-2">المتبقي</th><th className="py-3 px-2">الحالة</th></tr></thead>
              <tbody className="divide-y divide-black/5">
                {pilgrimAnalysis.map((row) => (
                  <tr key={row.key} className="cursor-pointer hover:bg-emerald-500/10" onClick={() => setPilgrimFilter(row.key === pilgrimFilter ? null : row.key)}>
                    <td className="py-3 px-2 font-bold">{row.pilgrimName}</td>
                    <td className="py-3 px-2">{fmtMoney(row.totalBilled)}</td>
                    <td className="py-3 px-2 text-emerald-600 font-bold">{fmtMoney(row.totalPaid)}</td>
                    <td className="py-3 px-2 text-amber-600 font-bold">{fmtMoney(row.remaining)}</td>
                    <td className="py-3 px-2 text-xs">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="acct-card rounded-2xl p-5 space-y-3">
          <h3 className="text-lg font-bold">طرق الدفع</h3>
          {methodBreakdown.map((m) => {
            const pct = kpis.totalRevenue > 0 ? Math.round((m.paid / kpis.totalRevenue) * 100) : 0;
            return (
              <button key={m.method} type="button" onClick={() => setMethodFilter(methodFilter === m.method ? null : m.method)}
                className={\`w-full text-right rounded-xl border px-3 py-3 \${methodFilter === m.method ? 'border-emerald-400 bg-emerald-500/10' : 'border-black/5'}\`}>
                <div className="flex justify-between text-sm font-bold"><span className="truncate">{m.method}</span><span>{pct}%</span></div>
                <div className="text-xs opacity-70 mt-1">{fmtMoney(m.paid)} · {m.count}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="acct-card rounded-2xl p-5 space-y-4">
        <h3 className="text-lg font-bold">سجل سندات القبض ({visibleReceipts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead><tr className="border-b opacity-70"><th className="py-3 px-3">ID</th><th className="py-3 px-3">المعتمر</th><th className="py-3 px-3">المسدد</th><th className="py-3 px-3">المتبقي</th><th className="py-3 px-3"></th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {visibleReceipts.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700">{r.id}</td>
                  <td className="py-3 px-3 font-bold">{r.pilgrimName}</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">{fmtMoney(r.paidAmount)}</td>
                  <td className="py-3 px-3 text-amber-600 font-bold">{fmtMoney(r.remainingAmount)}</td>
                  <td className="py-3 px-3"><button type="button" onClick={() => setSelectedReceipt(r)} className="px-3 py-1.5 rounded-lg acct-muted font-bold text-sm">معاينة</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="acct-card rounded-2xl p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4">إصدار سند قبض رقمي</h3>
            <form onSubmit={handleCreateReceipt} className="space-y-3.5 text-sm">
              <input required placeholder="اسم المعتمر" value={pilgrimName} onChange={(e) => setPilgrimName(e.target.value)} className="acct-input w-full" />
              <input required value={packageName} onChange={(e) => setPackageName(e.target.value)} className="acct-input w-full" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} className="acct-input w-full" />
                <input type="number" required value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} className="acct-input w-full" />
              </div>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="acct-input w-full">
                <option value="تحويل بريدي موب (BaridiMob)">تحويل بريدي موب (BaridiMob)</option>
                <option value="تحويل حساب جاري CCP">تحويل حساب جاري CCP</option>
                <option value="نقداً في شباك الوكالة">نقداً في شباك الوكالة</option>
                <option value="بطاقة دفع بنكية CIB/Visa">بطاقة دفع بنكية CIB/Visa</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl acct-muted font-bold">إلغاء</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold">اعتماد السند</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedReceipt(null)}>
          <div className="w-full max-w-md acct-card rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center pb-4 border-b mb-4">
              <h3 className="text-lg font-bold">SOUTH STREET</h3>
              <div className="text-sm font-bold text-emerald-700 mt-1">{selectedReceipt.id}</div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between py-1 border-b"><span className="opacity-70">المعتمر</span><strong>{selectedReceipt.pilgrimName}</strong></div>
              <div className="flex justify-between py-1 border-b"><span className="opacity-70">الخدمة</span><strong>{selectedReceipt.packageName}</strong></div>
              <div className="flex justify-between py-1 border-b"><span className="opacity-70">الطريقة</span><strong>{selectedReceipt.paymentMethod}</strong></div>
              <div className="flex justify-between py-1 border-b"><span className="opacity-70">التاريخ</span><strong>{selectedReceipt.date}</strong></div>
            </div>
            <div className="acct-muted p-3.5 rounded-xl space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between"><span>الإجمالي</span><strong>{fmtMoney(selectedReceipt.totalAmount)}</strong></div>
              <div className="flex justify-between text-emerald-600"><span>المسدد</span><strong>{fmtMoney(selectedReceipt.paidAmount)}</strong></div>
              <div className="flex justify-between text-amber-600"><span>المتبقي</span><strong>{fmtMoney(selectedReceipt.remainingAmount)}</strong></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="flex-1 bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm">طباعة</button>
              <button type="button" onClick={() => setSelectedReceipt(null)} className="px-5 acct-muted font-bold py-2.5 rounded-xl text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`);

w('components/dashboards/AccountantDashboard.tsx', `'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User } from '@/types';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';
import OverviewPanel from '@/components/accountant/OverviewPanel';
import LedgerPanel from '@/components/accountant/LedgerPanel';
import SuppliersPanel from '@/components/accountant/SuppliersPanel';
import PayrollPanel from '@/components/accountant/PayrollPanel';
import ReportsPanel from '@/components/accountant/ReportsPanel';
import ReceiptsPanel from '@/components/accountant/ReceiptsPanel';

interface AccountantDashboardProps {
  currentUser: User;
}

export type AccountantSection =
  | 'overview'
  | 'receipts'
  | 'ledger'
  | 'suppliers'
  | 'payroll'
  | 'reports'
  | 'sakhr';

const SECTIONS: { id: AccountantSection; label: string }[] = [
  { id: 'overview', label: 'الملخص' },
  { id: 'receipts', label: 'سندات القبض' },
  { id: 'ledger', label: 'دفتر الحركة' },
  { id: 'suppliers', label: 'الموردون' },
  { id: 'payroll', label: 'الرواتب والخدمات' },
  { id: 'reports', label: 'التقارير' },
  { id: 'sakhr', label: 'تعليم صخر' },
];

const THEME_KEY = 'southstreet.accountantTheme';

function normalizeSection(raw?: string | null): AccountantSection {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'ai_teach' || v === 'sakhr') return 'sakhr';
  if (SECTIONS.some((s) => s.id === v)) return v as AccountantSection;
  return 'overview';
}

export default function AccountantDashboard({ currentUser }: AccountantDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<AccountantSection>(() => normalizeSection(searchParams.get('section')));
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setSection(normalizeSection(searchParams.get('section')));
  }, [searchParams]);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const goSection = (id: AccountantSection) => {
    setSection(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', id === 'sakhr' ? 'sakhr' : id);
    router.replace(\`/portal?\${params.toString()}\`, { scroll: false });
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={\`acct-root space-y-6 text-right text-base rounded-2xl p-1 sm:p-2 \${isDark ? 'acct-theme-dark' : 'acct-theme-light'}\`}
      dir="rtl"
      data-theme={theme}
    >
      <style>{\`
        .acct-theme-light { --acct-fg: #1d1d1f; --acct-muted: #6e6e73; --acct-card: #ffffff; --acct-input: #f5f5f7; --acct-border: rgba(0,0,0,0.08); color: var(--acct-fg); }
        .acct-theme-dark { --acct-fg: #f5f5f7; --acct-muted: #a1a1a6; --acct-card: #1c1c1e; --acct-input: #2c2c2e; --acct-border: rgba(255,255,255,0.12); color: var(--acct-fg); background: #0f0f10; }
        .acct-card { background: var(--acct-card); border: 1px solid var(--acct-border); box-shadow: 0 2px 12px rgba(0,0,0,0.06); color: var(--acct-fg); }
        .acct-input { background: var(--acct-input); border: 1px solid var(--acct-border); border-radius: 0.75rem; padding: 0.6rem 0.85rem; outline: none; color: var(--acct-fg); }
        .acct-muted { background: var(--acct-input); color: var(--acct-fg); }
        .acct-theme-dark .text-emerald-600, .acct-theme-dark .text-emerald-700 { color: #34d399 !important; }
        .acct-theme-dark .text-amber-600, .acct-theme-dark .text-amber-700, .acct-theme-dark .text-amber-800 { color: #fbbf24 !important; }
        .acct-theme-dark .text-rose-600, .acct-theme-dark .text-rose-700 { color: #fb7185 !important; }
        .acct-theme-dark .opacity-70 { color: var(--acct-muted); }
      \`}</style>

      <div className="flex flex-col gap-4 pb-2 border-b" style={{ borderColor: 'var(--acct-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">مكتب المحاسب — Full Office v1</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--acct-muted)' }}>سندات · دفتر · موردون · رواتب · تقارير · تعليم صخر · دج</p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="px-3.5 py-2 rounded-xl text-sm font-bold border cursor-pointer"
            style={{ borderColor: 'var(--acct-border)', background: 'var(--acct-input)' }}
            title="تبديل المظهر"
          >
            {isDark ? '☀︎ فاتح' : '☾ داكن'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl" style={{ background: 'var(--acct-input)' }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goSection(s.id)}
              className={\`px-3 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer \${
                section === s.id ? 'bg-white text-slate-900 shadow-sm dark-active' : 'opacity-70 hover:opacity-100'
              }\`}
              style={section === s.id && isDark ? { background: '#3a3a3c', color: '#fff' } : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'overview' && <OverviewPanel />}
      {section === 'receipts' && <ReceiptsPanel currentUser={currentUser} />}
      {section === 'ledger' && <LedgerPanel />}
      {section === 'suppliers' && <SuppliersPanel />}
      {section === 'payroll' && <PayrollPanel />}
      {section === 'reports' && <ReportsPanel />}
      {section === 'sakhr' && (
        <AiKnowledgeManager
          userRole="accountant"
          userName={currentUser.name || 'المحاسب المالي'}
          allowedCategories={['pricing', 'packages', 'faq']}
          title="تعليم صخر (الأسعار)"
          subtitle="تدريب صخر على حسابات الوكالة"
        />
      )}
    </div>
  );
}
`);

console.log('dashboard ok');