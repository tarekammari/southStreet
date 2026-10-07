'use client';

import { fmtMoney } from './money';

export default function TreasuryPrintLetterhead({
  title,
  periodFrom,
  periodTo,
  globalSolde,
}: {
  title: string;
  periodFrom: string;
  periodTo: string;
  globalSolde: number | null;
}) {
  const printedAt = new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <header className="acct-print-only acct-treasury-letterhead mb-4 pb-3 border-b border-black/15">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">South Street · وكالة ساوث ستريت</p>
          <h1 className="text-lg font-black mt-0.5">{title}</h1>
          <p className="text-xs opacity-70 tabular-nums mt-1">
            الفترة {periodFrom} → {periodTo}
          </p>
        </div>
        <div className="text-left text-[10px] opacity-60 tabular-nums">
          <div>{printedAt}</div>
          {globalSolde != null ? (
            <div className="font-black text-sm text-violet-900 mt-1">{fmtMoney(globalSolde)}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
