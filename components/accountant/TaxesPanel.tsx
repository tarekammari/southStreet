'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtMoney } from './money';
import AcctPrintButton from './AcctPrintButton';
import { TAX_BUCKETS, taxBucketOf, type TaxBucketId } from '@/lib/tax-buckets';

type LedgerRow = {
  id: string;
  entry_date?: string;
  description?: string | null;
  counterparty?: string | null;
  amount?: number;
  category?: string | null;
  scf_code?: string | null;
  status?: string | null;
  type?: string | null;
};

export default function TaxesPanel() {
  const router = useRouter();
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/finance/ledger?from=${from}&to=${to}&status=POSTED`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows((d.items || []) as LedgerRow[]))
      .catch(() => setErr('تعذر تحميل قيود الضرائب'))
      .finally(() => setLoading(false));
  }, [from, to]);

  const grouped = useMemo(() => {
    const map: Record<TaxBucketId, LedgerRow[]> = { activity: [], gov: [], result: [] };
    for (const row of rows) {
      if (String(row.status || 'POSTED').toUpperCase() === 'VOID') continue;
      const bucket = taxBucketOf(row);
      if (bucket) map[bucket].push(row);
    }
    return map;
  }, [rows]);

  const total = TAX_BUCKETS.reduce(
    (sum, b) => sum + grouped[b.id].reduce((s, r) => s + (Number(r.amount) || 0), 0),
    0
  );

  return (
    <div className="space-y-4 acct-rise">
      <div className="acct-card p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="acct-eyebrow">SCF · للعرض</p>
            <p className="text-sm mt-1" style={{ color: 'var(--md-on-surface-variant)' }}>
              القيود تُسجّل من اليومية والرواتب. هذه الشاشة تجمع الضرائب والرسوم الظاهرة في الدفتر.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AcctPrintButton
              label="معاينة / طباعة"
              onClick={() => router.push(`/portal/taxes/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)}
              disabled={loading}
            />
            <div className="text-left">
              <div className="text-xs" style={{ color: 'var(--md-on-surface-variant)' }}>المجموع</div>
              <div className="text-xl font-bold tabular-nums">{fmtMoney(total)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TAX_BUCKETS.map((b) => {
          const amount = grouped[b.id].reduce((s, r) => s + (Number(r.amount) || 0), 0);
          return (
            <div key={b.id} className="acct-card p-4">
              <div className="text-xs font-bold tabular-nums" style={{ color: 'var(--md-primary)' }}>{b.code}</div>
              <div className="font-bold mt-1">{b.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>{b.note}</div>
              <div className="text-lg font-bold tabular-nums mt-3">{fmtMoney(amount)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--md-on-surface-variant)' }}>
                {grouped[b.id].length} قيد
              </div>
            </div>
          );
        })}
      </div>

      {err && <p className="text-sm" style={{ color: 'var(--md-error)' }}>{err}</p>}
      {loading && <p className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>جارٍ التحميل…</p>}

      {!loading && (
        <div className="acct-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--md-on-surface-variant)' }}>
                <th className="text-right font-medium px-4 py-3">التاريخ</th>
                <th className="text-right font-medium px-4 py-3">البيان</th>
                <th className="text-right font-medium px-4 py-3">الحساب</th>
                <th className="text-left font-medium px-4 py-3">المبلغ (دج)</th>
              </tr>
            </thead>
            <tbody>
              {TAX_BUCKETS.flatMap((b) => grouped[b.id]).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--md-on-surface-variant)' }}>
                    لا توجد قيود ضريبية أو رسوم في هذه السنة.
                  </td>
                </tr>
              ) : (
                TAX_BUCKETS.flatMap((b) =>
                  grouped[b.id].map((row) => (
                    <tr key={row.id} className="acct-row border-t" style={{ borderColor: 'var(--md-outline-variant)' }}>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">{row.entry_date || '—'}</td>
                      <td className="px-4 py-3">{row.description || row.counterparty || '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{b.code}</td>
                      <td className="px-4 py-3 text-left tabular-nums font-medium">{fmtMoney(Number(row.amount) || 0)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
