import { normalizeSupplierCategory, supplierCategoryLabel } from '@/lib/finance-categories';

/** Row shape from `supplierStatusList()` / aging API. */
export type SupplierStatusRow = {
  supplier_id: string;
  name_ar: string;
  category?: string | null;
  total_remaining: number;
  total_invoiced: number;
  total_paid: number;
  overdue_amount: number;
  open_count: number;
  invoice_count: number;
  settlement: string;
};

export type SupplierPortfolioTotals = {
  totalInvoiced: number;
  totalPaid: number;
  totalUnpaid: number;
  overdue: number;
  dueSoon: number;
  settledCount: number;
  openInvoices: number;
};

export function supplierTotalsFromStatus(rows: SupplierStatusRow[]): SupplierPortfolioTotals {
  const totalInvoiced = rows.reduce((s, r) => s + (Number(r.total_invoiced) || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (Number(r.total_paid) || 0), 0);
  const totalUnpaid = rows.reduce((s, r) => s + (Number(r.total_remaining) || 0), 0);
  const overdue = rows.reduce((s, r) => s + (Number(r.overdue_amount) || 0), 0);
  const dueSoon = rows
    .filter((r) => r.settlement === 'DUE_SOON')
    .reduce((s, r) => s + (Number(r.total_remaining) || 0), 0);
  const settledCount = rows.filter((r) => r.settlement === 'PAID_FULL').length;
  const openInvoices = rows.reduce((s, r) => s + (Number(r.open_count) || 0), 0);
  return {
    totalInvoiced,
    totalPaid,
    totalUnpaid,
    overdue,
    dueSoon,
    settledCount,
    openInvoices,
  };
}

/** @deprecated use totalUnpaid */
export function supplierTotalDebtFromStatus(rows: SupplierStatusRow[]) {
  return supplierTotalsFromStatus(rows).totalUnpaid;
}

export function supplierDebtByCategory(rows: SupplierStatusRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const cat = normalizeSupplierCategory(r.category);
    m.set(cat, (m.get(cat) || 0) + (Number(r.total_remaining) || 0));
  }
  return [...m.entries()]
    .map(([id, amount]) => ({ id, label: supplierCategoryLabel(id), amount }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function suppliersInCategory(rows: SupplierStatusRow[], categoryId: string) {
  return rows
    .filter((r) => normalizeSupplierCategory(r.category) === categoryId && (r.total_remaining || 0) > 0)
    .sort((a, b) => b.total_remaining - a.total_remaining);
}
