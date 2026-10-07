'use client';

import React from 'react';
import { BALANCE_IFRS, BALANCE_LINE_SECTION } from '@/lib/accountant-sections';
import { BILAN_GROUP_LABELS, BILAN_SUBTOTAL_LABELS, type BilanGroupId } from '@/lib/scf-balance-sheet';
import { fmtMoney } from '../money';
import ScfFootnote from './ScfFootnote';

export type BilanLine = {
  id: string;
  label: string;
  amount: number;
  section?: string;
  scf_code?: string;
  amort_accounts?: string;
  group?: BilanGroupId;
  header?: boolean;
};

export type BalanceSheet = {
  actif: BilanLine[];
  passif: BilanLine[];
  total_actif: number;
  total_passif: number;
  subtotals?: Partial<Record<BilanGroupId, number>>;
};

const ACTIF_GROUPS: BilanGroupId[] = ['actif_immobilise', 'actif_circulant'];
const PASSIF_GROUPS: BilanGroupId[] = ['capitaux_propres', 'passif_non_courant', 'passif_circulant'];

function BilanLineCell({
  row,
  note,
  onOpenSection,
}: {
  row: BilanLine;
  note?: string;
  onOpenSection?: (section: string) => void;
}) {
  const section = row.section || BALANCE_LINE_SECTION[row.id];
  return (
    <>
      {section && onOpenSection && row.id !== 'equity' ? (
        <button type="button" className="acct-fin-link" onClick={() => onOpenSection(section)}>
          {row.label}
        </button>
      ) : (
        row.label
      )}
      {note ? (
        <span className="block text-[0.625rem] font-semibold text-[var(--md-on-surface-variant)] mt-0.5">
          {note}
        </span>
      ) : null}
    </>
  );
}

function renderGroupBlock(
  lines: BilanLine[],
  group: BilanGroupId,
  loading: boolean,
  subtotals: BalanceSheet['subtotals'],
  onOpenSection?: (section: string) => void
) {
  const rows = lines.filter((r) => r.group === group);
  if (!rows.length) return null;
  const valued = rows.filter((r) => !r.header);

  return (
    <React.Fragment key={group}>
      <tr className="acct-fin-section">
        <td colSpan={4} className="font-black">
          {BILAN_GROUP_LABELS[group]}
        </td>
      </tr>
      {rows.map((row, i) =>
        row.header ? (
          <tr key={row.id} className="acct-fin-detail-head">
            <td colSpan={4}>{row.label}</td>
          </tr>
        ) : (
          <tr key={row.id} className={i % 2 === 0 ? 'acct-fin-row-alt' : ''}>
            <td className="acct-fin-label">
              <BilanLineCell row={row} onOpenSection={onOpenSection} />
            </td>
            <td className="acct-fin-code text-[0.65rem] leading-snug whitespace-normal">{row.scf_code || '—'}</td>
            <td className="acct-fin-code text-[0.65rem] leading-snug whitespace-normal opacity-80">
              {row.amort_accounts || '—'}
            </td>
            <td className="acct-fin-num">{loading ? '…' : fmtMoney(row.amount)}</td>
          </tr>
        )
      )}
      <tr className="acct-fin-subtotal">
        <td colSpan={3} className="text-xs font-bold opacity-75">
          {BILAN_SUBTOTAL_LABELS[group]}
        </td>
        <td className="acct-fin-num text-sm font-bold">
          {loading ? '…' : fmtMoney(subtotals?.[group] ?? valued.reduce((s, r) => s + r.amount, 0))}
        </td>
      </tr>
    </React.Fragment>
  );
}

export default function BilanTable({
  balance,
  asOfLabel,
  loading,
  onOpenSection,
  estimatedBanner,
}: {
  balance?: BalanceSheet | null;
  asOfLabel: string;
  loading?: boolean;
  onOpenSection?: (section: string) => void;
  estimatedBanner?: React.ReactNode;
}) {
  const actif = balance?.actif || [];
  const passif = balance?.passif || [];

  const balanced =
    !loading &&
    balance &&
    Math.abs((balance.total_actif || 0) - (balance.total_passif || 0)) < 0.01;

  return (
    <section className="acct-report-card acct-rise" aria-labelledby="bilan-title">
      <header className="acct-report-head acct-fin-head-bilan">
        <div>
          <h3 id="bilan-title" className="acct-report-title">
            {BALANCE_IFRS.title}
          </h3>
          <p className="acct-report-sub">
            {BALANCE_IFRS.subtitle} · {asOfLabel}
          </p>
        </div>
      </header>

      {estimatedBanner}

      <div className="acct-bilan-grid">
        <div className="acct-bilan-col">
          <table className="acct-fin-table acct-fin-table-compact acct-fin-table-bilan">
            <thead>
              <tr>
                <th className="acct-fin-label">الأصول</th>
                <th className="acct-fin-code">الحسابات</th>
                <th className="acct-fin-code">اهتلاكات / أرصدة</th>
                <th className="acct-fin-num">المبلغ (دج)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="acct-fin-section acct-fin-section-actif">
                <td colSpan={4}>{BALANCE_IFRS.assetsHeading}</td>
              </tr>
              <tr className="acct-fin-detail-head">
                <td colSpan={4}>{BALANCE_IFRS.assetsStandard}</td>
              </tr>
              {ACTIF_GROUPS.map((g) =>
                renderGroupBlock(actif, g, !!loading, balance?.subtotals, onOpenSection)
              )}
              <tr className="acct-fin-total acct-fin-total-actif">
                <td colSpan={3} className="acct-fin-label">
                  {BALANCE_IFRS.totalAssets}
                </td>
                <td className="acct-fin-num">{loading ? '…' : fmtMoney(balance?.total_actif ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="acct-bilan-col">
          <table className="acct-fin-table acct-fin-table-compact acct-fin-table-bilan">
            <thead>
              <tr>
                <th className="acct-fin-label">الخصوم</th>
                <th className="acct-fin-code">الحسابات</th>
                <th className="acct-fin-code">ملاحظة</th>
                <th className="acct-fin-num">المبلغ (دج)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="acct-fin-section acct-fin-section-passif">
                <td colSpan={4}>{BALANCE_IFRS.liabilitiesHeading}</td>
              </tr>
              <tr className="acct-fin-detail-head">
                <td colSpan={4}>{BALANCE_IFRS.liabilitiesStandard}</td>
              </tr>
              {PASSIF_GROUPS.map((g) =>
                renderGroupBlock(passif, g, !!loading, balance?.subtotals, onOpenSection)
              )}
              <tr className="acct-fin-total acct-fin-total-passif">
                <td colSpan={3} className="acct-fin-label">
                  {BALANCE_IFRS.totalLiabilities}
                </td>
                <td className="acct-fin-num">{loading ? '…' : fmtMoney(balance?.total_passif ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="acct-fin-footnote-block">
        {BALANCE_IFRS.footnote}
        {balanced ? ' · متوازنة ✓' : !loading && balance ? ` · ${BALANCE_IFRS.imbalanceHint}` : ''}
      </p>
      <ScfFootnote />
    </section>
  );
}
