/** Shared recap period helpers — keep payroll / P&L aligned with module screens. */

export function normalizeIsoRange(from?: string, to?: string) {
  let f = String(from || '1970-01-01').slice(0, 10);
  let t = String(to || '2999-12-31').slice(0, 10);
  if (f > t) {
    const swap = f;
    f = t;
    t = swap;
  }
  return { from: f, to: t };
}

export type PayrollMonthRange = {
  from_year: number;
  from_month: number;
  to_year: number;
  to_month: number;
};

/** Map recap date filter → same range as `/api/finance/salaries/staff`. */
export function payrollOptsFromIso(from: string, to: string): PayrollMonthRange {
  const { from: f, to: t } = normalizeIsoRange(from, to);
  const [fy, fm] = f.split('-').map((x) => Number(x) || 0);
  const [ty, tm] = t.split('-').map((x) => Number(x) || 0);
  return {
    from_year: fy,
    from_month: fm || 1,
    to_year: ty,
    to_month: tm || 12,
  };
}
