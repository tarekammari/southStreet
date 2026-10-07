'use client';

import { useMemo } from 'react';
import { PNL_IFRS } from '@/lib/accountant-sections';
import { buildOfficialResultat } from '@/lib/scf-result-statement';
import { fmtMoney } from '../money';
import ScfFootnote from './ScfFootnote';

export type StatementLine = {
  id?: string;
  label: string;
  amount: number;
  section?: string;
  scf_code?: string;
  accountingNote?: string;
  paid?: number;
  unpaid?: number;
  detail?: string;
};

export type PaidUnpaidSummary = { total: number; paid: number; unpaid: number };

export type StatementBlock = {
  products: StatementLine[];
  charges: StatementLine[];
  supplier_lines?: StatementLine[];
  payroll_lines?: StatementLine[];
  service_lines?: StatementLine[];
  total_products: number;
  total_charges: number;
  result: number;
  income_summary?: PaidUnpaidSummary;
  charge_summary?: PaidUnpaidSummary;
  services_summary?: PaidUnpaidSummary;
};

export default function ResultatTable({
  statement,
  periodLabel,
  loading,
  onOpenSection,
}: {
  statement?: StatementBlock | null;
  periodLabel: string;
  loading?: boolean;
  onOpenSection?: (section: string, focus?: string, supplierId?: string) => void;
}) {
  const rows = useMemo(
    () =>
      buildOfficialResultat({
        products: statement?.products,
        charges: statement?.charges,
        total_products: statement?.total_products,
        total_charges: statement?.total_charges,
        result: statement?.result,
      }),
    [statement]
  );

  return (
    <section className="acct-report-card acct-rise" aria-labelledby="resultat-title">
      <header className="acct-report-head acct-fin-head-income">
        <div>
          <h3 id="resultat-title" className="acct-report-title">
            {PNL_IFRS.statementTitle}
          </h3>
          <p className="acct-report-sub">
            {PNL_IFRS.statementSubtitle} · {periodLabel}
          </p>
        </div>
      </header>

      <div className="acct-fin-table-wrap">
        <table className="acct-fin-table acct-fin-table-compact">
          <thead>
            <tr>
              <th scope="col" className="acct-fin-label">
                البند
              </th>
              <th scope="col" className="acct-fin-code">
                الحسابات
              </th>
              <th scope="col" className="acct-fin-num">
                المبلغ (دج)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const clickable = row.kind === 'line' && row.section && onOpenSection;
              const negative = row.amount < 0;
              return (
                <tr
                  key={row.id}
                  className={
                    row.kind === 'total'
                      ? row.id === 'X'
                        ? `acct-fin-result ${row.amount >= 0 ? 'is-positive' : 'is-negative'}`
                        : 'acct-fin-subtotal'
                      : ''
                  }
                >
                  <td className="acct-fin-label">
                    {clickable ? (
                      <button type="button" className="acct-fin-link" onClick={() => onOpenSection!(row.section!)}>
                        {row.label}
                      </button>
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className="acct-fin-code text-[0.7rem] whitespace-normal">{row.accounts || '—'}</td>
                  <td
                    className={`acct-fin-num ${
                      row.tone === 'out' ? 'is-out' : row.tone === 'in' ? 'is-in' : ''
                    } ${negative ? 'text-rose-700' : ''}`}
                  >
                    {loading ? '…' : fmtMoney(row.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ScfFootnote extra={PNL_IFRS.footnote} />
    </section>
  );
}
