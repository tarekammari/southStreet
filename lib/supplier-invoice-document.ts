import { fmtAmount } from '@/components/accountant/money';
import { amountInWordsFrDzd, type InvoiceDiscountKind } from '@/lib/algerian-invoice-decree';

export const SUPPLIER_INVOICE_AGENCY_COPY_AR =
  'نسخة محاسبية للوكالة — ليست الفاتورة الأصلية الصادرة عن المورد';
export const SUPPLIER_INVOICE_AGENCY_COPY_FR =
  'Copie agence — document comptable interne, non substitut à la facture originale du fournisseur';

export type SupplierInvoiceLine = {
  id: string;
  designation: string;
  quantity: number;
  unitPriceHt: number;
};

export type TaxMode = 'percent' | 'amount';

export type SupplierInvoiceTax = {
  id: string;
  label: string;
  /** TVA is always a rate on Net HT. Other taxes may be a rate or a fixed amount. */
  role: 'tva' | 'other';
  mode: TaxMode;
  rate: number;
  amount: number;
};

export type SupplierInvoiceDetail = {
  v: 1;
  kind: 'agency_copy';
  lines: SupplierInvoiceLine[];
  taxes: SupplierInvoiceTax[];
  discountKind: InvoiceDiscountKind;
  paymentMethod: string;
  vatExempt: boolean;
  sellerRc?: string;
  sellerNif?: string;
  buyerRc?: string;
  buyerNif?: string;
};

export type SupplierInvoiceTotals = {
  ht: number;
  discount: number;
  net: number;
  taxLines: { id: string; label: string; rate: number; amount: number; mode: TaxMode; role: 'tva' | 'other' }[];
  tax: number;
  ttc: number;
  /** Stored on DB row for legacy screens */
  taxRate: number;
};

export function newLineId(): string {
  return `ln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newTaxId(): string {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultInvoiceLine(partial?: Partial<SupplierInvoiceLine>): SupplierInvoiceLine {
  return {
    id: partial?.id || newLineId(),
    designation: partial?.designation ?? '',
    quantity: partial?.quantity ?? 1,
    unitPriceHt: partial?.unitPriceHt ?? 0,
  };
}

export function defaultInvoiceTax(partial?: Partial<SupplierInvoiceTax>): SupplierInvoiceTax {
  const role = partial?.role ?? 'tva';
  return {
    id: partial?.id || newTaxId(),
    label: partial?.label ?? (role === 'tva' ? 'TVA' : ''),
    role,
    mode: role === 'tva' ? 'percent' : partial?.mode ?? 'percent',
    rate: partial?.rate ?? (role === 'tva' ? 19 : 0),
    amount: partial?.amount ?? 0,
  };
}

export function taxAmountOnNet(tax: SupplierInvoiceTax, net: number, vatExempt: boolean): number {
  if (tax.role === 'tva') {
    if (vatExempt) return 0;
    const rate = Math.max(0, Number(tax.rate) || 0);
    return Math.round((net * rate) / 100 * 100) / 100;
  }
  if (tax.mode === 'amount') return Math.round(Math.max(0, Number(tax.amount) || 0) * 100) / 100;
  const rate = Math.max(0, Number(tax.rate) || 0);
  return Math.round((net * rate) / 100 * 100) / 100;
}

export function lineTotalHt(line: SupplierInvoiceLine): number {
  const q = Math.max(0, Number(line.quantity) || 0);
  const u = Math.max(0, Number(line.unitPriceHt) || 0);
  return Math.round(q * u * 100) / 100;
}

export function computeSupplierInvoiceTotals(input: {
  lines: SupplierInvoiceLine[];
  discount: number;
  taxes: SupplierInvoiceTax[];
  vatExempt: boolean;
}): SupplierInvoiceTotals {
  const ht = Math.round(input.lines.reduce((s, l) => s + lineTotalHt(l), 0) * 100) / 100;
  const discount = Math.min(ht, Math.max(0, Number(input.discount) || 0));
  const net = Math.max(0, Math.round((ht - discount) * 100) / 100);
  const taxLines: SupplierInvoiceTotals['taxLines'] = [];
  let tax = 0;
  for (const t of input.taxes) {
    const amount = taxAmountOnNet(t, net, input.vatExempt);
    if (!amount) continue;
    taxLines.push({
      id: t.id,
      label: t.label || (t.role === 'tva' ? 'TVA' : 'ضريبة'),
      rate: t.mode === 'percent' ? Math.max(0, Number(t.rate) || 0) : 0,
      amount,
      mode: t.role === 'tva' ? 'percent' : t.mode,
      role: t.role,
    });
    tax += amount;
  }
  tax = Math.round(tax * 100) / 100;
  const ttc = Math.round((net + tax) * 100) / 100;
  const taxRate = net > 0 ? Math.round((tax / net) * 10000) / 100 : 0;
  return { ht, discount, net, taxLines, tax, ttc, taxRate };
}

export function parseSupplierInvoiceDetail(raw: unknown): SupplierInvoiceDetail | null {
  if (!raw) return null;
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || o.v !== 1 || o.kind !== 'agency_copy') return null;
    const lines = Array.isArray(o.lines) ? o.lines : [];
    const taxes = Array.isArray(o.taxes) ? o.taxes : [];
    return {
      v: 1,
      kind: 'agency_copy',
      lines: lines.map((l: SupplierInvoiceLine) =>
        defaultInvoiceLine({
          id: String(l.id || newLineId()),
          designation: String(l.designation || ''),
          quantity: Number(l.quantity) || 0,
          unitPriceHt: Number(l.unitPriceHt) || 0,
        })
      ),
      taxes: taxes.map((t: SupplierInvoiceTax, index: number) => {
        const label = String(t.label || '');
        const role =
          t.role === 'other' || t.role === 'tva'
            ? t.role
            : index === 0 || /^tva$/i.test(label.trim())
              ? 'tva'
              : 'other';
        return defaultInvoiceTax({
          id: String(t.id || newTaxId()),
          label: label || (role === 'tva' ? 'TVA' : ''),
          role,
          mode: role === 'tva' ? 'percent' : t.mode === 'amount' ? 'amount' : 'percent',
          rate: Number(t.rate) || 0,
          amount: Number(t.amount) || 0,
        });
      }),
      discountKind: (o.discountKind || 'none') as InvoiceDiscountKind,
      paymentMethod: String(o.paymentMethod || 'BANK_TRANSFER'),
      vatExempt: Boolean(o.vatExempt),
      sellerRc: o.sellerRc ? String(o.sellerRc) : undefined,
      sellerNif: o.sellerNif ? String(o.sellerNif) : undefined,
      buyerRc: o.buyerRc ? String(o.buyerRc) : undefined,
      buyerNif: o.buyerNif ? String(o.buyerNif) : undefined,
    };
  } catch {
    return null;
  }
}

export function detailFromLegacyInvoice(row: {
  amount_ht?: number | null;
  discount?: number | null;
  tax_rate?: number | null;
  note?: string | null;
}): SupplierInvoiceDetail {
  const ht = Number(row.amount_ht) > 0 ? Number(row.amount_ht) : 0;
  const rate = Number(row.tax_rate) || 0;
  const noteFirst = String(row.note || '').split('\n\n')[0]?.trim() || '';
  return {
    v: 1,
    kind: 'agency_copy',
    lines: [defaultInvoiceLine({ designation: noteFirst, quantity: 1, unitPriceHt: ht })],
    taxes: [defaultInvoiceTax({ role: 'tva', rate: rate > 0 ? rate : 19 })],
    discountKind: 'none',
    paymentMethod: 'BANK_TRANSFER',
    vatExempt: rate === 0 && ht > 0,
  };
}

export type SupplierInvoiceJournalParts = {
  ht: number;
  discount: number;
  tva: number;
  others: { label: string; amount: number }[];
};

/** Pieces of a supplier invoice for a split journal entry (HT, remise, TVA, other taxes). */
export function supplierInvoiceJournalParts(row: {
  amount?: number | null;
  amount_ht?: number | null;
  discount?: number | null;
  tax_amount?: number | null;
  detail_json?: string | null;
}): SupplierInvoiceJournalParts {
  const detail = parseSupplierInvoiceDetail(row.detail_json);
  if (detail) {
    const totals = computeSupplierInvoiceTotals({
      lines: detail.lines,
      discount: Number(row.discount) || 0,
      taxes: detail.taxes,
      vatExempt: detail.vatExempt,
    });
    const tva = totals.taxLines.filter((t) => t.role === 'tva').reduce((s, t) => s + t.amount, 0);
    const others = totals.taxLines
      .filter((t) => t.role !== 'tva')
      .map((t) => ({ label: t.label || 'ضريبة', amount: t.amount }));
    return {
      ht: totals.ht,
      discount: totals.discount,
      tva: Math.round(tva * 100) / 100,
      others,
    };
  }
  return {
    ht: Math.max(0, Number(row.amount_ht) || Number(row.amount) || 0),
    discount: Math.max(0, Number(row.discount) || 0),
    tva: Math.max(0, Number(row.tax_amount) || 0),
    others: [],
  };
}

export function serializeSupplierInvoiceDetail(detail: SupplierInvoiceDetail): string {
  return JSON.stringify(detail);
}

/** Human-readable note + structured payload reference (detail lives in detail_json). */
export function composeSupplierInvoiceNote(input: {
  detail: SupplierInvoiceDetail;
  totals: SupplierInvoiceTotals;
  paymentMethodLabel: string;
  dueDate: string;
}): string {
  const lines = input.detail.lines
    .filter((l) => l.designation.trim() || lineTotalHt(l) > 0)
    .map(
      (l) =>
        `${l.designation.trim() || '—'} · Qté ${l.quantity} × ${fmtAmount(l.unitPriceHt)} = ${fmtAmount(lineTotalHt(l))} DZD`
    );
  const meta: string[] = [
    SUPPLIER_INVOICE_AGENCY_COPY_AR,
    ...lines,
    `Remise: ${fmtAmount(input.totals.discount)} DZD · Net HT: ${fmtAmount(input.totals.net)} DZD`,
  ];
  if (input.detail.vatExempt) {
    meta.push('Exonéré TVA');
  } else {
    for (const t of input.totals.taxLines) {
      meta.push(`${t.label} ${t.rate}%: ${fmtAmount(t.amount)} DZD`);
    }
  }
  meta.push(`Total TTC: ${fmtAmount(input.totals.ttc)} DZD`);
  meta.push(`Échéance: ${input.dueDate} · ${input.paymentMethodLabel}`);
  meta.push(`Montant en lettres: ${amountInWordsFrDzd(input.totals.ttc)}`);
  return meta.join('\n');
}
