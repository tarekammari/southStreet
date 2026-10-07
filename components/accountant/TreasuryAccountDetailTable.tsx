'use client';

import type { TreasuryAccountMove } from '@/lib/finance';
import { treasuryKindLabel } from '@/lib/finance-categories';
import { fmtCount, fmtMoney, payMethodLabel } from './money';

type AccountSnap = {
  id: string;
  name_ar: string;
  kind: string;
  bank_name?: string;
  account_no?: string;
  status?: string;
  period_opening?: number;
  period_inflow?: number;
  period_outflow?: number;
  period_closing?: number;
  balance?: number;
  movements_count?: number;
};

export default function TreasuryAccountDetailTable({
  account,
  periodFrom,
  periodTo,
  moves,
}: {
  account: AccountSnap;
  periodFrom: string;
  periodTo: string;
  moves: TreasuryAccountMove[];
}) {
  const totalIn = moves.filter((m) => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
  const totalOut = moves.filter((m) => m.direction === 'out').reduce((s, m) => s + m.amount, 0);
  const opening = account.period_opening ?? 0;
  const closing = account.period_closing ?? account.balance ?? opening + totalIn - totalOut;
  const balanceAfter = new Map<string, number>();
  let running = opening;
  for (const m of [...moves].sort((a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0))) {
    running += m.direction === 'in' ? m.amount : -m.amount;
    balanceAfter.set(m.id, running);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm acct-top-subtitle">
        {treasuryKindLabel(account.kind)}
        {account.bank_name ? ` · ${account.bank_name}` : ''}
        {account.account_no ? ` · ${account.account_no}` : ''}
        <span className="block mt-1 tabular-nums">
          الفترة {periodFrom} → {periodTo}
        </span>
      </p>

      <div className="acct-supplier-ledger-summary">
        <div className="acct-supplier-ledger-card">
          <span className="acct-supplier-ledger-label">رصيد {periodFrom}</span>
          <span className="acct-supplier-ledger-value tabular-nums">{fmtMoney(opening)}</span>
        </div>
        <div className="acct-supplier-ledger-card is-paid">
          <span className="acct-supplier-ledger-label">داخل</span>
          <span className="acct-supplier-ledger-value tabular-nums text-emerald-700">{fmtMoney(totalIn)}</span>
        </div>
        <div className="acct-supplier-ledger-card is-balance">
          <span className="acct-supplier-ledger-label">خارج</span>
          <span className="acct-supplier-ledger-value tabular-nums text-rose-600">{fmtMoney(totalOut)}</span>
        </div>
      </div>

      <div className="rounded-xl px-3 py-2 text-sm flex flex-wrap gap-3" style={{ background: 'var(--acct-input)' }}>
        <span>
          <span className="font-bold opacity-60">ختام الفترة </span>
          <span className="font-black tabular-nums text-violet-700">{fmtMoney(closing)}</span>
        </span>
        <span>
          <span className="font-bold opacity-60">حركات </span>
          <span className="font-black tabular-nums">{fmtCount(moves.length)}</span>
        </span>
      </div>

      {moves.length === 0 ? (
        <p className="text-sm opacity-60 py-4 text-center">لا حركات على هذا الحساب في الفترة</p>
      ) : (
        <div className="acct-fin-table-wrap max-h-[min(28rem,55vh)] overflow-auto">
          <table className="acct-fin-table acct-kpi-detail-table text-sm">
            <thead>
              <tr className="acct-fin-detail-head">
                <th>التاريخ</th>
                <th>البيان</th>
                <th>الطرف</th>
                <th>الدفع</th>
                <th className="acct-num">المبلغ</th>
                <th className="acct-num">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              <tr className="acct-kpi-detail-total-row">
                <td className="tabular-nums whitespace-nowrap font-medium">{periodFrom}</td>
                <td colSpan={3}>رصيد أول الفترة</td>
                <td className="acct-num tabular-nums opacity-40">—</td>
                <td className={`acct-num font-black tabular-nums ${opening < 0 ? 'text-rose-600' : ''}`}>{fmtMoney(opening)}</td>
              </tr>
              {moves.map((m) => {
                const solde = balanceAfter.get(m.id) ?? opening;
                return (
                <tr key={m.id}>
                  <td className="tabular-nums whitespace-nowrap font-medium">{m.entry_date}</td>
                  <td className="max-w-[12rem] truncate" title={m.description}>
                    {m.description || '—'}
                  </td>
                  <td className="text-[13px] opacity-85 max-w-[8rem] truncate">{m.counterparty || '—'}</td>
                  <td className="text-[13px] whitespace-nowrap">{payMethodLabel(m.method)}</td>
                  <td
                    className={`acct-num font-black tabular-nums whitespace-nowrap ${
                      m.direction === 'in' ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {m.direction === 'in' ? '+' : '−'}
                    {fmtMoney(m.amount)}
                  </td>
                  <td className={`acct-num font-black tabular-nums whitespace-nowrap ${solde < 0 ? 'text-rose-600' : ''}`}>
                    {fmtMoney(solde)}
                  </td>
                </tr>
              );
              })}
            </tbody>
            <tfoot>
              <tr className="acct-kpi-detail-total-row font-black">
                <td colSpan={4}>صافي الحركات في الفترة</td>
                <td
                  className={`acct-num tabular-nums ${totalIn - totalOut >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                >
                  {totalIn - totalOut >= 0 ? '+' : '−'}
                  {fmtMoney(Math.abs(totalIn - totalOut))}
                </td>
                <td className={`acct-num tabular-nums ${closing < 0 ? 'text-rose-600' : ''}`}>{fmtMoney(closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
