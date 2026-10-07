/** No-break space as the thousands separator: "2 619 500.00". */
const GROUP_SEP = '\u00A0';
/** Isolate the digits so an LTR amount keeps its order inside RTL Arabic text. */
const LRI = '\u2066';
const PDI = '\u2069';

function group(value: number, decimals: number): string {
  const [int, dec] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP);
  return dec ? `${grouped}.${dec}` : grouped;
}

/** Bare amount with no currency, e.g. "2 619 500.00". Safe for CSV and inputs. */
export function fmtAmount(n: number, decimals = 2): string {
  const value = Number(n) || 0;
  return `${value < 0 ? '-' : ''}${group(value, decimals)}`;
}

/** Accounting amount for display: "2 619 500.00 دج". */
export function fmtMoney(n: number): string {
  return `${LRI}${fmtAmount(n)}${PDI} دج`;
}

/** Invoice / LTR tables: western digits, space grouping, optional DZD suffix — no Arabic currency. */
export function fmtAmountEn(n: number, opts?: { currency?: boolean; decimals?: number }): string {
  const body = fmtAmount(n, opts?.decimals ?? 2);
  return opts?.currency === false ? `${LRI}${body}${PDI}` : `${LRI}${body}${PDI} DZD`;
}

export function parseAmountInput(raw: string): number {
  const cleaned = String(raw || '')
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : 0;
}

/** Whole counts (invoices, units) — grouped but without decimals. */
export function fmtCount(n: number): string {
  return `${LRI}${fmtAmount(n, 0)}${PDI}`;
}

export const PAY_METHODS = [
  { value: 'CASH', label: 'نقداً' },
  { value: 'CCP', label: 'CCP' },
  { value: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { value: 'CHECK', label: 'شيك' },
  { value: 'OTHER', label: 'أخرى' },
] as const;

export function payMethodLabel(raw?: string | null): string {
  const v = String(raw || '').trim().toUpperCase();
  if (!v) return '—';
  return PAY_METHODS.find((m) => m.value === v)?.label || String(raw);
}
