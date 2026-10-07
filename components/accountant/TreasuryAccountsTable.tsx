'use client';

import React from 'react';
import { TREASURY_IFRS } from '@/lib/accountant-sections';
import { TREASURY_KINDS, treasuryKindLabel } from '@/lib/finance-categories';
import { fmtCount, fmtMoney } from './money';

export type TreasuryAccountRow = {
  id: string;
  name_ar: string;
  kind: string;
  bank_name?: string;
  account_no?: string;
  status: string;
  balance: number;
  period_opening?: number;
  period_inflow?: number;
  period_outflow?: number;
  period_closing?: number;
  movements_count?: number;
};

type UnassignedBlock = {
  balance: number;
  count: number;
  period_closing?: number;
  period_opening?: number;
  period_inflow?: number;
  period_outflow?: number;
};

export default function TreasuryAccountsTable({
  accounts,
  unassigned,
  loading,
  periodMode,
  periodTotals,
  onOpenAccount,
  manageLabel,
  onManage,
  showAllKindSections = false,
}: {
  accounts: TreasuryAccountRow[];
  unassigned?: UnassignedBlock | null;
  loading?: boolean;
  /** When true, show opening / in / out / closing columns for the recap period. */
  periodMode?: boolean;
  /** Global treasury totals — should equal the sum of account rows (+ unassigned). */
  periodTotals?: {
    opening: number;
    inflow: number;
    outflow: number;
    closing: number;
  };
  onOpenAccount?: (accountId: string) => void;
  manageLabel?: string;
  onManage?: () => void;
  /** Always list CASH / BANK / CCP / OTHER sections even when empty. */
  showAllKindSections?: boolean;
}) {
  const byKind = (kind: string) =>
    accounts
      .filter((a) => a.kind === kind && a.status === 'ACTIVE')
      .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));

  const hasPeriod = periodMode && accounts.some((a) => a.period_closing != null);
  const active = accounts.filter((a) => a.status === 'ACTIVE');
  const closed = accounts.filter((a) => a.status === 'CLOSED');

  const renderRow = (a: TreasuryAccountRow, alt: boolean) => (
    <tr key={a.id} className={alt ? 'acct-fin-row-alt' : ''}>
      <td className="acct-fin-label">
        {onOpenAccount ? (
          <button type="button" className="acct-fin-link text-right font-medium" onClick={() => onOpenAccount(a.id)}>
            {a.name_ar}
          </button>
        ) : (
          <span className="font-medium">{a.name_ar}</span>
        )}
        {a.status === 'CLOSED' ? (
          <span className="block text-[10px] font-bold opacity-50 mt-0.5">مغلق</span>
        ) : null}
        {a.bank_name || a.account_no ? (
          <span className="block text-[11px] opacity-70 mt-0.5">
            {[a.bank_name, a.account_no].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {a.movements_count != null ? (
          <span className="block text-[10px] opacity-55 mt-0.5">{fmtCount(a.movements_count)} حركة</span>
        ) : null}
      </td>
      <td className="text-sm opacity-85 whitespace-nowrap">{treasuryKindLabel(a.kind)}</td>
      {hasPeriod ? (
        <>
          <td className="acct-fin-num tabular-nums">{loading ? '…' : fmtMoney(a.period_opening ?? 0)}</td>
          <td className="acct-fin-num tabular-nums is-in">{loading ? '…' : fmtMoney(a.period_inflow ?? 0)}</td>
          <td className="acct-fin-num tabular-nums is-out">{loading ? '…' : fmtMoney(a.period_outflow ?? 0)}</td>
          <td className={`acct-fin-num tabular-nums ${(a.period_closing ?? a.balance) >= 0 ? 'is-in' : 'is-out'}`}>
            {loading ? '…' : fmtMoney(a.period_closing ?? a.balance)}
          </td>
        </>
      ) : (
        <td className={`acct-fin-num tabular-nums ${a.balance >= 0 ? 'is-in' : 'is-out'}`}>
          {loading ? '…' : fmtMoney(a.balance)}
        </td>
      )}
    </tr>
  );

  const sections = TREASURY_KINDS.map((k) => ({ kind: k.id, label: k.label, rows: byKind(k.id) }));
  const visibleSections = showAllKindSections
    ? sections
    : sections.filter((s) => s.rows.length > 0);

  const colSpan = hasPeriod ? 6 : 3;

  const sumActive = (field: 'period_opening' | 'period_inflow' | 'period_outflow' | 'period_closing') =>
    active.reduce((s, a) => s + (Number(a[field]) || 0), 0);

  const rowTotals = hasPeriod
    ? {
        opening: sumActive('period_opening') + (unassigned?.period_opening ?? 0),
        inflow: sumActive('period_inflow') + (unassigned?.period_inflow ?? 0),
        outflow: sumActive('period_outflow') + (unassigned?.period_outflow ?? 0),
        closing: sumActive('period_closing') + (unassigned?.period_closing ?? 0),
      }
    : null;

  const footerTotals = periodTotals || rowTotals;

  return (
    <div className="acct-fin-table-wrap">
      <table className="acct-fin-table acct-fin-table-compact acct-fin-table-treso">
        <thead>
          <tr className="acct-fin-detail-head">
            <td colSpan={colSpan}>
              حسابات الخزينة في الوكالة (نقد · بنوك · CCP · أخرى)
              {onManage && manageLabel ? (
                <>
                  {' '}
                  ·{' '}
                  <button type="button" className="acct-fin-link inline" onClick={onManage}>
                    {manageLabel}
                  </button>
                </>
              ) : null}
            </td>
          </tr>
          <tr>
            <th scope="col" className="acct-fin-label">
              {TREASURY_IFRS.colAccount}
            </th>
            <th scope="col">{TREASURY_IFRS.colKind}</th>
            {hasPeriod ? (
              <>
                <th scope="col" className="acct-fin-num">
                  {TREASURY_IFRS.colOpening}
                </th>
                <th scope="col" className="acct-fin-num">
                  {TREASURY_IFRS.colIn}
                </th>
                <th scope="col" className="acct-fin-num">
                  {TREASURY_IFRS.colOut}
                </th>
                <th scope="col" className="acct-fin-num">
                  {TREASURY_IFRS.colClosing}
                </th>
              </>
            ) : (
              <th scope="col" className="acct-fin-num">
                الرصيد
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visibleSections.map((sec) => (
            <React.Fragment key={sec.kind}>
              <tr className="acct-fin-section acct-fin-section-treso">
                <td colSpan={colSpan} className="text-sm font-black">
                  {sec.label}
                  <span className="text-[11px] font-bold opacity-55 mr-2">({fmtCount(sec.rows.length)})</span>
                </td>
              </tr>
              {sec.rows.length > 0 ? (
                sec.rows.map((a, i) => renderRow(a, i % 2 === 0))
              ) : showAllKindSections ? (
                <tr>
                  <td colSpan={colSpan} className="text-xs opacity-50 py-2 px-3">
                    لا حساب مسجّل من نوع {sec.label}
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          ))}

          {closed.length > 0 ? (
            <>
              <tr className="acct-fin-section">
                <td colSpan={colSpan} className="text-sm font-bold opacity-70">
                  حسابات مغلقة
                </td>
              </tr>
              {closed.map((a, i) => renderRow(a, i % 2 === 0))}
            </>
          ) : null}

          {unassigned && unassigned.count > 0 ? (
            <tr className="acct-fin-row-alt text-amber-900">
              <td className="acct-fin-label">
                {onOpenAccount ? (
                  <button
                    type="button"
                    className="acct-fin-link text-amber-900 text-right font-medium"
                    onClick={() => onOpenAccount('unassigned')}
                  >
                    حركات غير مخصّصة لحساب
                  </button>
                ) : (
                  'حركات غير مخصّصة لحساب'
                )}
                <span className="block text-[0.625rem] opacity-70">{fmtCount(unassigned.count)} قيد</span>
              </td>
              <td className="text-sm opacity-85">—</td>
              {hasPeriod ? (
                <>
                  <td className="acct-fin-num tabular-nums">{fmtMoney(unassigned.period_opening ?? 0)}</td>
                  <td className="acct-fin-num tabular-nums is-in">{fmtMoney(unassigned.period_inflow ?? 0)}</td>
                  <td className="acct-fin-num tabular-nums is-out">{fmtMoney(unassigned.period_outflow ?? 0)}</td>
                  <td className="acct-fin-num tabular-nums">{fmtMoney(unassigned.period_closing ?? unassigned.balance)}</td>
                </>
              ) : (
                <td className="acct-fin-num tabular-nums">{fmtMoney(unassigned.balance)}</td>
              )}
            </tr>
          ) : null}

          {active.length === 0 && closed.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="acct-empty py-8">
                لا حسابات خزينة — أضف صندوقاً أو حساباً بنكياً
              </td>
            </tr>
          ) : null}
        </tbody>
        {hasPeriod && footerTotals && active.length > 0 ? (
          <tfoot>
            <tr className="acct-kpi-detail-total-row font-black">
              <td colSpan={2}>{TREASURY_IFRS.total} (= رصيد الخزينة)</td>
              <td className="acct-fin-num tabular-nums">{fmtMoney(footerTotals.opening)}</td>
              <td className="acct-fin-num tabular-nums text-emerald-700">{fmtMoney(footerTotals.inflow)}</td>
              <td className="acct-fin-num tabular-nums text-rose-600">{fmtMoney(footerTotals.outflow)}</td>
              <td className="acct-fin-num tabular-nums text-sky-700">{fmtMoney(footerTotals.closing)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
