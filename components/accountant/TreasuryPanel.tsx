'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtCount, fmtMoney } from './money';
import type { TreasuryFlowMove } from '@/lib/finance';
import TreasuryFlowDetailTable from './TreasuryFlowDetailTable';
import TreasuryAccountsTable from './TreasuryAccountsTable';
import TreasuryAccountsDirectory from './TreasuryAccountsDirectory';
import TreasuryAccountDetailTable from './TreasuryAccountDetailTable';
import type { TreasuryAccountMove } from '@/lib/finance';
import { TREASURY_IFRS } from '@/lib/accountant-sections';
import { treasuryKindLabel } from '@/lib/finance-categories';
import { Alert, Disclosure, FilterDrawer, PanelHeader } from './ui';
import type { TreasuryView } from './recap/TreasuryCard';
import AcctPrintButton from './AcctPrintButton';
import TreasuryPrintLetterhead from './TreasuryPrintLetterhead';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultPeriodFrom = () => isoDay(new Date(new Date().getFullYear(), 0, 1));
const defaultPeriodTo = () => isoDay(new Date());

const FLOW_LABELS: Record<string, string> = {
  client_in: 'تحصيلات من العملاء',
  supplier_out: 'مدفوعات الموردين',
  service_out: 'خدمات دورية (مدفوعة)',
  payroll_out: 'أجور ورواتب',
  other_out: 'مصاريف أخرى (خزينة)',
};

export default function TreasuryPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const treasuryFlow = searchParams.get('treasury_flow')?.trim() || '';
  const treasuryAccountId = searchParams.get('treasury_account')?.trim() || '';
  const periodFrom = searchParams.get('from')?.slice(0, 10) || defaultPeriodFrom();
  const periodTo = searchParams.get('to')?.slice(0, 10) || defaultPeriodTo();

  const setPeriod = useCallback(
    (nextFrom: string, nextTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'accountant');
      params.set('section', 'treasury');
      if (nextFrom) params.set('from', nextFrom);
      else params.delete('from');
      if (nextTo) params.set('to', nextTo);
      else params.delete('to');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const [data, setData] = useState<TreasuryView | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams({ from: periodFrom, to: periodTo });
    if (treasuryFlow) q.set('flow', treasuryFlow);
    if (treasuryAccountId) q.set('account', treasuryAccountId);
    fetch(`/api/finance/treasury?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('تعذر تحميل الخزينة'))))
      .then(setData)
      .catch((e) => setErr(e.message || 'خطأ'));
  }, [periodFrom, periodTo, treasuryFlow, treasuryAccountId]);

  const flowDetailMoves: TreasuryFlowMove[] = (data?.flow_moves as TreasuryFlowMove[] | undefined) || [];

  const openSupplierFromFlow = (supplierId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', 'suppliers');
    params.set('supplier', supplierId);
    params.delete('treasury_flow');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  };

  const openAccount = (accountId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', 'treasury');
    params.set('treasury_account', accountId);
    params.delete('treasury_flow');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  };

  const closeAccount = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('treasury_account');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const openFlowLine = (flowId: string, section?: string) => {
    if (flowId === 'client_in' || section === 'receipts') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'accountant');
      params.set('section', 'receipts');
      params.delete('treasury_flow');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', 'treasury');
    params.set('treasury_flow', flowId);
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (treasuryAccountId) closeAccount();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [treasuryAccountId, closeAccount]);

  const selectedAccount =
    data?.selected_account ||
    (treasuryAccountId ? data?.accounts.find((a) => a.id === treasuryAccountId) : undefined);
  const accountMoves: TreasuryAccountMove[] = (data?.account_moves as TreasuryAccountMove[] | undefined) || [];

  const accounts = data?.accounts || [];
  const globalSolde =
    data?.period_closing != null ? data.period_closing : data?.total != null ? data.total : null;

  const openPrintPreview = (mode: 'full' | 'account', accountId?: string) => {
    const q = new URLSearchParams({ from: periodFrom, to: periodTo, mode });
    if (accountId) q.set('account', accountId);
    router.push(`/portal/treasury/print?${q.toString()}`);
  };

  return (
    <div className="acct-treasury-print-root space-y-4">
      <PanelHeader
        compact
        title="الخزينة"
        subtitle="عرض ومراقبة — بدون إدخال حركات من هنا"
        action={
          <AcctPrintButton
            label="معاينة / طباعة"
            onClick={() => openPrintPreview('full')}
            disabled={!data}
          />
        }
      />

      <TreasuryPrintLetterhead
        title="تقرير الخزينة"
        periodFrom={periodFrom}
        periodTo={periodTo}
        globalSolde={globalSolde}
      />

      <p className="text-xs acct-top-subtitle px-0.5 -mt-2 leading-relaxed acct-screen-only">
        التحصيلات والمدفوعات تُسجَّل من <strong className="font-bold">المداخيل</strong>،{' '}
        <strong className="font-bold">الموردون</strong>، <strong className="font-bold">الرواتب</strong>،{' '}
        <strong className="font-bold">الخدمات</strong> و<strong className="font-bold">اليومية</strong>. هذه الشاشة
        تعرض أرصدة الحسابات وحركاتها فقط.
      </p>

      <div className="acct-no-print">
      <FilterDrawer label="فترة الحركات" activeCount={0}>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm font-medium">
            من
            <input
              type="date"
              className="acct-input block mt-1 text-sm"
              value={periodFrom}
              onChange={(e) => setPeriod(e.target.value, periodTo)}
            />
          </label>
          <label className="text-sm font-medium">
            إلى
            <input
              type="date"
              className="acct-input block mt-1 text-sm"
              value={periodTo}
              onChange={(e) => setPeriod(periodFrom, e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs acct-top-subtitle mt-2">
          الفترة {periodFrom} → {periodTo} · {TREASURY_IFRS.movementStandard}
        </p>
      </FilterDrawer>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--acct-border)', background: 'var(--acct-card)' }}
      >
        <div
          className="px-4 py-3 border-b text-center"
          style={{ borderColor: 'var(--acct-border)', background: 'var(--acct-muted-bg, rgba(99,102,241,0.06))' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-55">Solde global · {TREASURY_IFRS.total}</p>
        </div>
        <div className="px-4 py-6 sm:py-7 text-center">
          <p
            className={`text-3xl sm:text-[2.35rem] font-black tabular-nums tracking-tight ${
              globalSolde != null && globalSolde < 0 ? 'text-rose-700' : 'text-violet-900'
            }`}
          >
            {globalSolde != null ? fmtMoney(globalSolde) : '—'}
          </p>
          <p className="text-xs opacity-55 mt-2 tabular-nums">
            {data?.period_closing != null
              ? `رصيد ختام · ${periodFrom} → ${periodTo}`
              : 'إجمالي أرصدة حسابات الخزينة'}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
          <h3 className="text-sm font-black">
            دليل الحسابات · {fmtCount(accounts.filter((a) => a.status === 'ACTIVE').length)} نشط
          </h3>
          <span className="text-[11px] opacity-50 acct-screen-only">اضغط حساباً لاستعراض حركات الفترة</span>
        </div>
        <TreasuryAccountsDirectory accounts={accounts} onOpenAccount={openAccount} />
      </section>

      {treasuryFlow && data ? (
        <Disclosure title={`تفاصيل: ${FLOW_LABELS[treasuryFlow] || treasuryFlow}`} defaultOpen>
          <TreasuryFlowDetailTable
            flowId={treasuryFlow}
            periodFrom={periodFrom}
            periodTo={periodTo}
            moves={flowDetailMoves}
            onOpenSupplier={treasuryFlow === 'supplier_out' ? openSupplierFromFlow : undefined}
          />
        </Disclosure>
      ) : null}

      {data?.cash_flow ? (
        <Disclosure title="تدفقات الخزينة (SCF — مباشر)" defaultOpen={false}>
          <p className="text-xs acct-top-subtitle mb-2">
            مدفوعات وتحصيلات فعلية · {periodFrom} → {periodTo} — لا تشمل المفوتر غير المسدّد.
          </p>
          <table className="acct-kpi-detail-table text-sm">
            <tbody>
              <tr className="acct-kpi-detail-total-row">
                <td className="font-black">{TREASURY_IFRS.colOpening} · {periodFrom}</td>
                <td className="acct-num font-black tabular-nums text-violet-700">
                  {fmtMoney(data.period_opening ?? 0)}
                </td>
              </tr>
              {data.cash_flow.lines.filter((l) => l.amount > 0).map((line) => (
                <tr key={line.id}>
                  <td>
                    <button
                      type="button"
                      className="acct-fin-link text-right font-medium"
                      onClick={() => openFlowLine(line.id, line.section)}
                    >
                      {line.label}
                    </button>
                  </td>
                  <td className={`acct-num font-bold ${line.kind === 'in' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {line.kind === 'out' ? '−' : '+'}
                    {fmtMoney(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="font-black border-t border-black/10">
                <td>صافي التغيّر بالفترة</td>
                <td className={`acct-num ${data.cash_flow.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {data.cash_flow.net >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(data.cash_flow.net))}
                </td>
              </tr>
              <tr className="acct-kpi-detail-total-row">
                <td className="font-black">{TREASURY_IFRS.colClosing} (الرصيد النهائي)</td>
                <td className="acct-num font-black tabular-nums text-sky-700">
                  {fmtMoney(data.period_closing ?? (data.period_opening ?? 0) + data.cash_flow.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </Disclosure>
      ) : null}

      {err && <Alert tone="error">{err}</Alert>}

      <Disclosure title={`جدول الحسابات والحركات (${accounts.length})`} defaultOpen={false}>
        <TreasuryAccountsTable
          accounts={accounts}
          unassigned={data?.unassigned}
          periodMode
          periodTotals={data?.accounts_period_totals}
          onOpenAccount={openAccount}
          showAllKindSections
        />
        {accounts.length > 0 ? (
          <p className="text-xs acct-top-subtitle mt-2 px-1">
            {TREASURY_IFRS.movementStandard} · مجموع «ختام» كل الحسابات = رصيد الخزينة · اضغط حساباً لحركاته
          </p>
        ) : null}
      </Disclosure>

      {data && data.unassigned.count > 0 ? (
        <Disclosure title={`حركات غير مخصّصة (${fmtCount(data.unassigned.count)})`} defaultOpen={false}>
          <p className="text-[11px] opacity-60 px-1">
            {fmtCount(data.unassigned.count)} قيد بدون حساب خزينة — داخل {fmtMoney(data.unassigned.inflow)}، خارج{' '}
            {fmtMoney(data.unassigned.outflow)}، الصافي {fmtMoney(data.unassigned.balance)}. حدّد حساب الخزينة عند
            إدخال القيد ليُحتسب داخل الأرصدة.
          </p>
        </Disclosure>
      ) : null}

      {treasuryAccountId && selectedAccount && (
        <div className="fixed inset-0 z-50 flex justify-start acct-treasury-drawer-shell" dir="rtl">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 acct-drawer-backdrop cursor-pointer border-0"
            aria-label="إغلاق"
            onClick={closeAccount}
          />
          <aside
            className="relative z-10 h-full w-full max-w-2xl acct-card shadow-2xl flex flex-col acct-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="treasury-account-drawer-title"
          >
            <div className="p-4 border-b space-y-2" style={{ borderColor: 'var(--acct-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 id="treasury-account-drawer-title" className="text-lg font-black truncate">
                    {selectedAccount.name_ar}
                  </h4>
                  <div className="text-xs mt-1 flex flex-wrap gap-2 opacity-70">
                    <span>{treasuryKindLabel(selectedAccount.kind)}</span>
                    {selectedAccount.status === 'CLOSED' ? <span>مغلق</span> : null}
                    {selectedAccount.bank_name ? <span>{selectedAccount.bank_name}</span> : null}
                    {selectedAccount.account_no ? (
                      <span className="font-mono">{selectedAccount.account_no}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 acct-no-print">
                  <AcctPrintButton
                    label="معاينة / طباعة"
                    onClick={() => openPrintPreview('account', treasuryAccountId)}
                  />
                  <button
                    type="button"
                    className="px-2.5 py-1.5 rounded-lg acct-muted text-sm font-bold cursor-pointer"
                    onClick={closeAccount}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 acct-treasury-account-print">
              <TreasuryPrintLetterhead
                title={`كشف حساب — ${selectedAccount.name_ar}`}
                periodFrom={periodFrom}
                periodTo={periodTo}
                globalSolde={selectedAccount.period_closing ?? selectedAccount.balance ?? null}
              />
              <TreasuryAccountDetailTable
                account={selectedAccount}
                periodFrom={periodFrom}
                periodTo={periodTo}
                moves={accountMoves}
              />
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}
