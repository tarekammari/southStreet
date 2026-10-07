import { scfCodeForLedgerCategory, scfCodeForSupplierCategory } from '@/lib/scf-category-map';
import { listScfChartAccounts } from '@/lib/scf-chart-seed';

export type LedgerPostingLine = {
  scf_code: string;
  account_label: string;
  debit: number;
  credit: number;
};

function labelForCode(code: string) {
  const row = listScfChartAccounts({ activeOnly: true }).find((a) => a.code === code);
  return row ? `${code} — ${row.label_ar}` : code;
}

export function treasuryScfFromKind(kind?: string | null) {
  return String(kind || '').toUpperCase() === 'CASH' ? '53' : '512';
}

/** Partie double SCF pour un mouvement `finance_ledger` (expert journal). */
export function buildLedgerPostings(input: {
  type: string;
  direction: 'in' | 'out';
  amount: number;
  category: string;
  ref_table?: string | null;
  entry_kind?: string | null;
  treasury_scf: string;
  treasury_name?: string;
  supplier_scf_expense?: string | null;
  /**
   * SCF credit for pilgrim cash collection (finance_client_payments):
   * 419 advances before departure, 411 after service recognition — never 706 on cash.
   */
  client_scf_credit?: string | null;
  /** SCF م2 revenue recognition: invoice total + advances already in 419. */
  client_revenue_parts?: {
    invoice: number;
    advances: number;
  } | null;
  /** When set, a supplier invoice is split: HT, remise, TVA, other taxes, then 401. */
  invoice_parts?: {
    ht: number;
    discount: number;
    tva: number;
    others: { label: string; amount: number }[];
  } | null;
}): LedgerPostingLine[] {
  const amt = Math.abs(Number(input.amount) || 0);
  if (!amt) return [];

  const treasuryName =
    input.treasury_name?.trim() ||
    (input.treasury_scf === '53' ? 'صندوق — نقد' : 'بنوك — حسابات جارية');
  const treasuryLine = (side: 'debit' | 'credit'): LedgerPostingLine => ({
    scf_code: input.treasury_scf,
    account_label: `${input.treasury_scf} — ${treasuryName}`,
    debit: side === 'debit' ? amt : 0,
    credit: side === 'credit' ? amt : 0,
  });

  const expenseLine = (code: string, side: 'debit' | 'credit'): LedgerPostingLine => ({
    scf_code: code,
    account_label: labelForCode(code),
    debit: side === 'debit' ? amt : 0,
    credit: side === 'credit' ? amt : 0,
  });

  const ref = String(input.ref_table || '');
  const kind = String(input.entry_kind || 'treasury');

  // SCF م2 — اعتراف بإيراد الباقة عند أداء الخدمة: مدين 411 / دائن 706 (+ تسوية 419).
  if (kind === 'accrual' && ref === 'finance_client_revenue') {
    const money = (n: number) => Math.round(Math.max(0, Number(n) || 0) * 100) / 100;
    const invoice = money(input.client_revenue_parts?.invoice ?? amt);
    const advances = money(Math.min(invoice, input.client_revenue_parts?.advances ?? 0));
    const rows: LedgerPostingLine[] = [
      { scf_code: '411', account_label: labelForCode('411'), debit: invoice, credit: 0 },
      { scf_code: '706', account_label: labelForCode('706'), debit: 0, credit: invoice },
    ];
    if (advances > 0) {
      rows.push({ scf_code: '419', account_label: labelForCode('419'), debit: advances, credit: 0 });
      rows.push({ scf_code: '411', account_label: labelForCode('411'), debit: 0, credit: advances });
    }
    return rows;
  }

  if (kind === 'accrual' && ref === 'finance_supplier_invoices') {
    const expenseCode = input.supplier_scf_expense || scfCodeForSupplierCategory('other');
    const parts = input.invoice_parts;
    if (!parts || (!(parts.discount > 0) && !(parts.tva > 0) && !parts.others.some((o) => o.amount > 0))) {
      return [expenseLine(expenseCode, 'debit'), expenseLine('401', 'credit')];
    }
    const money = (n: number) => Math.round(Math.max(0, Number(n) || 0) * 100) / 100;
    const line = (code: string, account_label: string, debit: number, credit: number): LedgerPostingLine => ({
      scf_code: code,
      account_label,
      debit,
      credit,
    });
    const named = (code: string, fallback: string) => {
      const labeled = labelForCode(code);
      return labeled === code ? fallback : labeled;
    };
    const rows: LedgerPostingLine[] = [];
    const ht = money(parts.ht);
    const discount = money(Math.min(ht, parts.discount));
    const tva = money(parts.tva);
    if (ht > 0) rows.push(line(expenseCode, labelForCode(expenseCode), ht, 0));
    if (discount > 0) rows.push(line('609', named('609', '609 — تخفيضات محصلة'), 0, discount));
    if (tva > 0) rows.push(line('445', named('445', '445 — TVA'), tva, 0));
    for (const other of parts.others) {
      const amount = money(other.amount);
      if (!amount) continue;
      const title = String(other.label || 'ضريبة').trim();
      rows.push(line('447', `447 — ${title}`, amount, 0));
    }
    const debit = rows.reduce((s, p) => s + p.debit, 0);
    const credit = rows.reduce((s, p) => s + p.credit, 0);
    const payable = money(debit - credit);
    if (payable > 0) rows.push(line('401', named('401', '401 — موردون'), 0, payable));
    return rows;
  }

  if (input.direction === 'in') {
    // Client cash: SCF 512/53 Dr · 419 (advance) or 411 (receivable) Cr — not revenue 706.
    if (ref === 'finance_client_payments') {
      const creditCode =
        input.client_scf_credit === '411' || input.client_scf_credit === '419'
          ? input.client_scf_credit
          : '419';
      return [treasuryLine('debit'), expenseLine(creditCode, 'credit')];
    }
    const creditCode =
      input.category === 'cash_in' ? '706' : scfCodeForLedgerCategory(input.category || 'cash_in');
    return [treasuryLine('debit'), expenseLine(creditCode, 'credit')];
  }

  let debitCode = scfCodeForLedgerCategory(input.category || 'other');
  if (input.type === 'PURCHASE' || ref === 'finance_supplier_payments') {
    debitCode = '401';
  } else if (input.type === 'SERVICE_SPEND' || ref === 'finance_service_payments') {
    debitCode = '408';
  } else if (input.category === 'payroll_related' || ref === 'finance_staff_salaries') {
    debitCode = '421';
  } else if (input.category === 'capex' || ref === 'finance_assets') {
    debitCode = '21';
  } else if (input.category === 'transfer') {
    debitCode = '581';
  }

  return [expenseLine(debitCode, 'debit'), treasuryLine('credit')];
}

export function formatPostingsSummary(postings: LedgerPostingLine[]) {
  if (!postings.length) return '';
  return postings.map((p) => p.scf_code).join(' ↔ ');
}
