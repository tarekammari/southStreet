'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';

/**
 * Salary section of a staff card. It reads and writes the accountant's payroll
 * table (finance_staff_salaries) through /api/finance/salaries, so there is a single
 * source of truth. Paying a salary (treasury account, ledger entry) stays in the
 * accountant's Payroll panel; here a new salary is recorded as «معلّق» (pending).
 */

type SalaryLine = {
  id: string;
  morshid_id: string | null;
  staff_name: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: string;
  paid_at?: string | null;
  note?: string | null;
  kind?: string | null;
};

const MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const fmt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
const isPaid = (s: string) => String(s || '').toUpperCase() === 'PAID';

export default function StaffSalaryPanel({ morshidId, staffName }: { morshidId: string; staffName: string }) {
  const now = useMemo(() => new Date(), []);
  const [lines, setLines] = useState<SalaryLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    note: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/finance/salaries', { headers: jsonAuthHeaders(), cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر تحميل الرواتب');
      const items: SalaryLine[] = Array.isArray(data.items) ? data.items : [];
      setLines(items.filter((l) => String(l.morshid_id || '') === morshidId));
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الرواتب');
    } finally {
      setLoading(false);
    }
  }, [morshidId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const l of lines) {
      if (String(l.kind || 'salary').toLowerCase() === 'advance') continue;
      if (isPaid(l.status)) paid += Number(l.amount) || 0;
      else pending += Number(l.amount) || 0;
    }
    return { paid, pending };
  }, [lines]);

  const addSalary = async () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/finance/salaries', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          kind: 'salary',
          morshid_id: morshidId,
          staff_name: staffName,
          period_year: Number(form.year),
          period_month: Number(form.month),
          amount,
          note: form.note.trim() || undefined,
          pay_now: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الراتب');
      setForm((f) => ({ ...f, amount: '', note: '' }));
      await load();
    } catch (err: any) {
      setError(err?.message || 'فشل حفظ الراتب');
    } finally {
      setSaving(false);
    }
  };

  const removePending = async (id: string) => {
    setError('');
    try {
      const res = await fetch('/api/finance/salaries', {
        method: 'PATCH',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ id, action: 'void' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'فشل حذف السجل');
      setRemoving(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'فشل حذف السجل');
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4" dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <Wallet className="h-4 w-4 text-emerald-700" /> الراتب الشهري
        </h4>
        <div className="flex gap-3 text-[12px] text-slate-600">
          <span>المدفوع: <strong className="text-emerald-700">{fmt(totals.paid)}</strong></span>
          <span>المعلّق: <strong className="text-amber-700">{fmt(totals.pending)}</strong></span>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {loading ? (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل…
        </p>
      ) : lines.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">لا توجد رواتب مسجّلة لهذا العضو بعد.</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-100">
          {lines.slice(0, 12).map((l) => {
            const advance = String(l.kind || 'salary').toLowerCase() === 'advance';
            const paid = isPaid(l.status);
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-slate-800">
                  {MONTHS[l.period_month - 1] || l.period_month} {l.period_year}
                  {advance && <em className="mr-1 text-[12px] text-slate-500">(تسبيق)</em>}
                  {l.note ? <span className="mr-2 text-[12px] text-slate-500">— {l.note}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <strong className="text-slate-900">{fmt(l.amount)}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {paid ? 'مدفوع' : 'معلّق'}
                  </span>
                  {!paid && !advance && (
                    removing === l.id ? (
                      <button
                        type="button"
                        onClick={() => removePending(l.id)}
                        className="rounded-lg bg-red-600 px-2 py-1 text-[11px] text-white"
                      >
                        تأكيد الحذف
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemoving(l.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="حذف الراتب المعلّق"
                        title="حذف الراتب المعلّق"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select
          value={form.month}
          onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
          className="luxury-form-input"
          aria-label="الشهر"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={form.year}
          onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
          className="luxury-form-input"
          aria-label="السنة"
          min={2020}
          max={2100}
        />
        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="المبلغ (دج)"
          className="luxury-form-input"
          min={0}
        />
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder="ملاحظة (اختياري)"
          className="luxury-form-input"
        />
        <button
          type="button"
          onClick={addSalary}
          disabled={saving}
          className="btn-pro-primary flex items-center justify-center gap-1.5 py-2 text-[13px] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة راتب
        </button>
      </div>
      <p className="mt-2 text-[12px] text-slate-500">
        يُسجَّل الراتب «معلّقاً»؛ صرفه وربطه بحساب الخزينة يتمّان من لوحة المحاسبة (الرواتب).
      </p>
    </section>
  );
}
