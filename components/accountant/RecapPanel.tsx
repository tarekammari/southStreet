'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Disclosure, PanelHeader } from './ui';
import RecapCharts, { RecapChartsSkeleton } from './recap/RecapCharts';
import AcctPrintButton from './AcctPrintButton';
import { SCF_CLOSING_CONTROLS, SCF_ETATS_FINANCIERS, SCF_PRINCIPLES_AR } from '@/lib/accountant-scf';
import ScfFootnote from './recap/ScfFootnote';
import ResultatTable, { type StatementBlock } from './recap/ResultatTable';
import BilanTable, { type BalanceSheet } from './recap/BilanTable';
import TresorerieTable from './recap/TresorerieTable';

type RecapPayload = {
  from: string;
  to: string;
  income: number;
  spending: number;
  net: number;
  agency_income?: { total: number; paid: number; unpaid: number };
  agency_charges?: { total: number; paid: number; unpaid: number };
  statement?: StatementBlock;
  balance_sheet?: BalanceSheet;
  treasury?: {
    accounts: {
      id: string;
      name_ar: string;
      kind: string;
      bank_name?: string;
      status: string;
      balance: number;
      period_opening?: number;
      period_inflow?: number;
      period_outflow?: number;
      period_closing?: number;
    }[];
    cash_total: number;
    bank_total: number;
    other_total: number;
    total: number;
    period_opening?: number;
    period_inflow?: number;
    period_outflow?: number;
    period_closing?: number;
    cash_flow?: {
      lines: {
        id: string;
        label: string;
        amount: number;
        kind: 'in' | 'out';
        section?: string;
        focus?: string;
        scf_hint?: string;
      }[];
      total_in: number;
      total_out: number;
      net: number;
    };
    unassigned?: { balance: number; count: number; period_closing?: number };
  };
  monthly?: { month: string; income: number; spending: number }[];
  spending_by_category?: { id: string; label: string; amount: number }[];
};

/** Local calendar date (avoid UTC shift from toISOString). */
function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const defaultFrom = () => localIso(new Date(new Date().getFullYear(), 0, 1));
const defaultTo = () => localIso(new Date());

export default function RecapPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<RecapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const from = searchParams.get('from') || defaultFrom();
  const to = searchParams.get('to') || defaultTo();

  const setPeriod = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'accountant');
      params.set('section', 'overview');
      if (nextFrom) params.set('from', nextFrom);
      else params.delete('from');
      if (nextTo) params.set('to', nextTo);
      else params.delete('to');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ from, to });
    fetch(`/api/finance/reports/recap?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'يلزم تسجيل الدخول' : 'تعذر تحميل الملخص');
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        // Keep previous totals/charts visible when a refresh fails.
        if (!data) setErr(e.message || 'تعذر التحميل');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep prior payload while refreshing
  }, [from, to]);

  const go = (
    section: string,
    focus?: string,
    supplierId?: string,
    treasuryFlow?: string,
    treasuryAccount?: string
  ) => {
    let target = section;
    if (target === 'services' || (target === 'payroll' && focus === 'services')) target = 'suppliers';
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', target);
    if (section === 'services' || focus === 'services' || focus === 'recurring') {
      params.set('focus', 'recurring');
    } else {
      params.delete('focus');
    }
    if (supplierId) params.set('supplier', supplierId);
    else params.delete('supplier');
    if (treasuryFlow) params.set('treasury_flow', treasuryFlow);
    else params.delete('treasury_flow');
    if (treasuryAccount) params.set('treasury_account', treasuryAccount);
    else params.delete('treasury_account');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  };

  const net = data?.net ?? null;
  const periodLabel = `${from} → ${to}`;

  const statement: StatementBlock | null = data?.statement ?? null;
  const inc = data?.agency_income;
  const chg = data?.agency_charges;
  const treasurySolde = data?.treasury?.period_closing ?? data?.treasury?.total ?? 0;
  const incomeAmt = inc?.total ?? data?.income ?? 0;
  const chargeAmt = chg?.total ?? data?.spending ?? 0;

  const printBtn = (
    <AcctPrintButton
      onClick={() => router.push(`/portal/recap/print?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)}
      disabled={loading || !data}
    />
  );

  return (
    <div className="acct-recap acct-recap-atlas">
      {err ? <p className="acct-alert is-error mb-2">{err}</p> : null}

      <PanelHeader compact title="الملخص" action={printBtn} />

      {data ? (
        <RecapCharts
          income={incomeAmt}
          charges={chargeAmt}
          result={net ?? 0}
          year={Number(to.slice(0, 4)) || new Date().getFullYear()}
          periodTo={to}
          monthly={data.monthly || []}
          categories={data.spending_by_category || []}
          accounts={data.treasury?.accounts || []}
          treasuryTotal={treasurySolde}
          refreshing={loading}
          from={from}
          to={to}
          onFromChange={(v) => setPeriod(v, to)}
          onToChange={(v) => setPeriod(from, v)}
          onIncome={() => go('receipts')}
          onCharges={() => go('suppliers')}
          onAccount={(id) => go('treasury', undefined, undefined, undefined, id)}
        />
      ) : loading ? (
        <RecapChartsSkeleton />
      ) : null}

      <p className="acct-recap-footnote">{SCF_ETATS_FINANCIERS.bundleNote}</p>

      <div className="acct-recap-stack acct-stagger">
        <Disclosure title="حساب النتائج" defaultOpen={false}>
          <ResultatTable
            statement={statement}
            periodLabel={periodLabel}
            loading={loading}
            onOpenSection={(section, focus, supplierId) => go(section, focus, supplierId)}
          />
        </Disclosure>
        <Disclosure title="الميزانية" defaultOpen={false}>
          <BilanTable
            balance={data?.balance_sheet}
            asOfLabel={`نهاية الفترة ${to}`}
            loading={loading}
            onOpenSection={(section) => go(section)}
          />
        </Disclosure>
        <Disclosure title="جدول سيولة الخزينة" defaultOpen={false}>
          <TresorerieTable
            treasury={data?.treasury}
            loading={loading}
            periodLabel={periodLabel}
            periodFrom={from}
            periodTo={to}
            onOpenTreasury={() => go('treasury')}
            onOpenAccount={(id) => go('treasury', undefined, undefined, undefined, id)}
            onOpenFlowLine={(line) => {
              if (line.section === 'receipts') go('receipts');
              else if (line.section === 'treasury') go('treasury', line.focus, undefined, line.focus || line.id);
              else go('treasury', undefined, undefined, line.id);
            }}
          />
        </Disclosure>
      </div>

      <Disclosure title="مرجع SCF — مبادئ التطبيق" defaultOpen={false}>
        <ul className="text-xs space-y-1.5 list-disc list-inside opacity-90 px-1">
          {SCF_PRINCIPLES_AR.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <ScfFootnote />
      </Disclosure>

      <Disclosure title="ضوابط نهاية الفترة (SCF)" defaultOpen={false}>
        <ul className="text-xs space-y-2 px-1">
          {SCF_CLOSING_CONTROLS.map((c) => (
            <li key={c.id}>
              {c.section ? (
                <button type="button" className="acct-fin-link text-right w-full" onClick={() => go(c.section!)}>
                  {c.label}
                </button>
              ) : (
                c.label
              )}
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
