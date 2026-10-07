'use client';

import BilanTable, { type BalanceSheet } from '../recap/BilanTable';

export default function ScfEstimatedPosition({
  disclaimer,
  balance_sheet,
  total_actif,
  total_passif,
  balanced,
  note_ar,
  from,
  to,
}: {
  disclaimer: string;
  balance_sheet?: BalanceSheet;
  total_actif: number;
  total_passif: number;
  balanced: boolean;
  note_ar: string;
  from: string;
  to: string;
}) {
  const sheet: BalanceSheet | null = balance_sheet
    ? balance_sheet
    : {
        actif: [],
        passif: [],
        total_actif,
        total_passif,
      };

  return (
    <div className="space-y-3">
      <BilanTable
        balance={sheet}
        asOfLabel={`نهاية الفترة ${to}`}
        estimatedBanner={
          <div className="mx-4 mb-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
            تقديري — ESTIMATED · {disclaimer}
            {!balanced ? (
              <span className="block mt-1 text-rose-700">عدم توازن تقريبي — راجع الخزينة والذمم.</span>
            ) : null}
            <span className="block mt-1 font-semibold opacity-90">{note_ar}</span>
          </div>
        }
      />
    </div>
  );
}
