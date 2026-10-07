'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SCF_REPORTS_INTRO_AR } from '@/lib/accountant-scf';
import AcctPrintButton from './AcctPrintButton';
import { Disclosure, FilterDrawer, PanelHeader } from './ui';
import ScfEstimatedResultat from './reports/ScfEstimatedResultat';
import ScfEstimatedPosition from './reports/ScfEstimatedPosition';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const defaultFrom = () => iso(new Date(new Date().getFullYear(), 0, 1));
const defaultTo = () => iso(new Date());

export default function ReportsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || defaultFrom();
  const to = searchParams.get('to') || defaultTo();
  const [estimate, setEstimate] = useState<any>(null);

  const setPeriod = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'accountant');
      params.set('section', 'reports');
      if (nextFrom) params.set('from', nextFrom);
      else params.delete('from');
      if (nextTo) params.set('to', nextTo);
      else params.delete('to');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const q = new URLSearchParams({ from, to });
    fetch(`/api/finance/reports/scf-estimate?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEstimate)
      .catch(() => setEstimate(null));
  }, [from, to]);

  return (
    <div className="space-y-4">
      <PanelHeader
        compact
        title="التقارير"
        subtitle="SCF — تحليلات تغذّي القوائم المالية"
        action={
          <AcctPrintButton
            label="معاينة / طباعة"
            disabled={!estimate}
            onClick={() =>
              router.push(
                `/portal/reports/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
              )
            }
          />
        }
      />
      <p className="text-xs acct-top-subtitle px-1">{SCF_REPORTS_INTRO_AR}</p>

      <FilterDrawer label="فترة التقرير" activeCount={0}>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm font-medium">
            من
            <input
              type="date"
              className="acct-input block mt-1"
              value={from}
              onChange={(e) => setPeriod(e.target.value, to)}
            />
          </label>
          <label className="text-sm font-medium">
            إلى
            <input
              type="date"
              className="acct-input block mt-1"
              value={to}
              onChange={(e) => setPeriod(from, e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs acct-top-subtitle">
          الفترة الحالية: {from} → {to}
        </p>
      </FilterDrawer>

      {estimate?.resultat && (
        <Disclosure title="حساب النتائج (تقديري)" defaultOpen={false}>
          <ScfEstimatedResultat {...estimate.resultat} />
        </Disclosure>
      )}

      {estimate?.position && (
        <Disclosure title="الوضعية المالية (تقديري)" defaultOpen={false}>
          <ScfEstimatedPosition {...estimate.position} />
        </Disclosure>
      )}
    </div>
  );
}
