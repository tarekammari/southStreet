'use client';

import { TREASURY_IFRS } from '@/lib/accountant-sections';
import { SCF_ETATS_FINANCIERS } from '@/lib/accountant-scf';
import { buildOfficialCashFlow } from '@/lib/scf-cash-flow-statement';
import { fmtMoney } from '../money';
import ScfFootnote from './ScfFootnote';
import AcctPrintButton from '../AcctPrintButton';
import { useRouter } from 'next/navigation';

type TreasuryAccount = {
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
};

type CashFlowLine = {
  id: string;
  label: string;
  amount: number;
  kind: 'in' | 'out';
  scf_hint?: string;
  section?: string;
  focus?: string;
};

type TreasuryBlock = {
  accounts: TreasuryAccount[];
  cash_total: number;
  bank_total: number;
  other_total: number;
  total: number;
  period_opening?: number;
  period_inflow?: number;
  period_outflow?: number;
  period_closing?: number;
  cash_flow?: {
    lines: CashFlowLine[];
    total_in: number;
    total_out: number;
    net: number;
  };
  unassigned?: {
    balance: number;
    count: number;
    period_closing?: number;
    period_inflow?: number;
    period_outflow?: number;
  };
};

export default function TresorerieTable({
  treasury,
  loading,
  periodLabel,
  periodFrom,
  periodTo,
  onOpenTreasury,
  onOpenFlowLine,
}: {
  treasury?: TreasuryBlock | null;
  loading?: boolean;
  periodLabel?: string;
  periodFrom?: string;
  periodTo?: string;
  onOpenTreasury?: () => void;
  onOpenAccount?: (accountId: string) => void;
  onOpenFlowLine?: (line: CashFlowLine) => void;
}) {
  const router = useRouter();
  const flow = treasury?.cash_flow;
  const byId = new Map((flow?.lines || []).map((l) => [l.id, l.amount]));
  const official = buildOfficialCashFlow({
    clientIn: byId.get('client_in') || 0,
    supplierOut: byId.get('supplier_out') || 0,
    payrollOut: byId.get('payroll_out') || 0,
    serviceOut: byId.get('service_out') || 0,
    otherOut: byId.get('other_out') || 0,
    opening: treasury?.period_opening ?? 0,
    closing: treasury?.period_closing ?? treasury?.total ?? 0,
  });

  const openRecapPrint = () => {
    if (!periodFrom || !periodTo) return;
    const q = new URLSearchParams({ from: periodFrom, to: periodTo });
    router.push(`/portal/recap/print?${q.toString()}`);
  };

  return (
    <section className="acct-report-card acct-rise" aria-labelledby="treso-title">
      <header className="acct-report-head acct-fin-head-treso">
        <div>
          <h3 id="treso-title" className="acct-report-title">
            جدول سيولة الخزينة
          </h3>
          <p className="acct-report-sub">
            الطريقة المباشرة
            {periodLabel ? ` · ${periodLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 acct-no-print">
          <AcctPrintButton
            label="معاينة / طباعة"
            compact
            onClick={openRecapPrint}
            disabled={loading || !treasury || !periodFrom || !periodTo}
          />
          {onOpenTreasury ? (
            <button type="button" className="acct-btn acct-btn-text" onClick={onOpenTreasury}>
              {TREASURY_IFRS.manage}
            </button>
          ) : null}
        </div>
      </header>

      <div className="acct-fin-table-wrap mb-4">
        <table className="acct-fin-table acct-fin-table-compact">
          <thead>
            <tr>
              <th scope="col" className="acct-fin-label">
                البند
              </th>
              <th scope="col" className="acct-fin-code">
                ملاحظة
              </th>
              <th scope="col" className="acct-fin-num">
                السنة المالية N
              </th>
              <th scope="col" className="acct-fin-num">
                السنة المالية N−1
              </th>
            </tr>
          </thead>
          <tbody>
            {official.map((row) => {
              if (row.kind === 'section') {
                return (
                  <tr key={row.id} className="acct-fin-section acct-fin-section-treso">
                    <td colSpan={4} className="font-black">
                      {row.label}
                    </td>
                  </tr>
                );
              }
              const source = row.flowId ? flow?.lines.find((l) => l.id === row.flowId) : undefined;
              const amount = row.amount ?? 0;
              return (
                <tr key={row.id} className={row.kind === 'total' ? 'acct-fin-subtotal' : ''}>
                  <td className="acct-fin-label">
                    {source && onOpenFlowLine ? (
                      <button type="button" className="acct-fin-link text-right" onClick={() => onOpenFlowLine(source)}>
                        {row.label}
                      </button>
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className="acct-fin-code opacity-40">—</td>
                  <td className={`acct-fin-num ${amount < 0 ? 'is-out' : amount > 0 ? 'is-in' : ''}`}>
                    {loading ? '…' : fmtMoney(amount)}
                  </td>
                  <td className="acct-fin-num opacity-40">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ScfFootnote extra={SCF_ETATS_FINANCIERS.bundleNote} />
    </section>
  );
}
