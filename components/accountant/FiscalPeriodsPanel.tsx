'use client';

import { useCallback, useEffect, useState } from 'react';
import { Disclosure, PanelHeader, PrimaryButton } from './ui';

type Period = {
  year: number;
  month: number;
  status: string;
  closed_by: string | null;
  closed_at: string | null;
};

const MONTHS = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'];

export default function FiscalPeriodsPanel() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [items, setItems] = useState<Period[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    fetch(`/api/finance/periods?year=${year}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: 'close' | 'reopen', month: number) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch(`/api/finance/periods/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'فشل');
      setMsg(path === 'close' ? `أُقفل ${year}/${month}` : `أُعيد فتح ${year}/${month}`);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'خطأ');
    } finally {
      setBusy(false);
    }
  };

  const byMonth = new Map(items.map((p) => [p.month, p]));

  return (
    <div className="space-y-4">
      <PanelHeader compact title="الفترات المحاسبية" subtitle="إقفال شهري — تحذير فقط في المرحلة 1" />
      <p className="text-xs acct-top-subtitle px-1">
        إقفال الشهر: محاسب أو مسؤول عام. إعادة الفتح: مسؤول عام فقط. التسجيل في شهر مقفل يظهر شارة تحذير دون منع الحفظ.
      </p>

      <div className="flex items-center gap-2">
        <label className="text-sm font-bold">
          السنة
          <input
            type="number"
            className="acct-input block mt-1 w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </label>
      </div>

      {msg && <p className="text-xs font-bold text-emerald-700">{msg}</p>}
      {err && <p className="text-xs font-bold text-rose-600">{err}</p>}

      <Disclosure title="الأشهر" defaultOpen>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {MONTHS.map((label, i) => {
            const month = i + 1;
            const p = byMonth.get(month);
            const closed = p?.status === 'closed';
            return (
              <div
                key={month}
                className="rounded-xl border p-3 space-y-2"
                style={{ borderColor: closed ? 'rgba(217,119,6,0.5)' : 'var(--acct-border)' }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold">{label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${closed ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
                    {closed ? 'مقفل' : 'مفتوح'}
                  </span>
                </div>
                {closed && p?.closed_by && (
                  <p className="text-[10px] opacity-60">بواسطة {p.closed_by}</p>
                )}
                <div className="flex gap-1">
                  {!closed ? (
                    <PrimaryButton type="button" disabled={busy} className="text-xs py-1.5 flex-1" onClick={() => void act('close', month)}>
                      إقفال
                    </PrimaryButton>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold acct-muted cursor-pointer disabled:opacity-40"
                      onClick={() => void act('reopen', month)}
                    >
                      إعادة فتح
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Disclosure>
    </div>
  );
}
