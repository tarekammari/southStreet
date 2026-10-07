'use client';

import ResultatTable, { type StatementBlock } from '../recap/ResultatTable';

export default function ScfEstimatedResultat({
  disclaimer,
  from,
  to,
  statement,
}: {
  disclaimer: string;
  from: string;
  to: string;
  statement: StatementBlock;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        تقديري — ESTIMATED · {disclaimer}
      </div>
      <ResultatTable statement={statement} periodLabel={`${from} → ${to}`} />
    </div>
  );
}
