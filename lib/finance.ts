/**
 * Finance domain helpers — ledger, suppliers, salaries, services (cash-based, no double-entry).
 */
import { getSqliteDb } from '@/lib/sqlite';
import {
  ASSET_CATEGORIES,
  TRIP_TYPES,
  assetCategoryLife,
  classifyTripType,
  ledgerCategoryLabel,
  normalizeAssetCategory,
  normalizeSupplierCategory,
  normalizeTreasuryKind,
  supplierCategoryLabel,
  type TripTypeId,
} from '@/lib/finance-categories';
import { isAgencyConfirmed } from '@/lib/booking-catalog';
import { ACCOUNTANT_NAV, PNL_EXPENSE_LINES } from '@/lib/accountant-sections';
import { normalizeIsoRange, payrollOptsFromIso } from '@/lib/finance-period';
import { computeSupplierInvoiceTotals, parseSupplierInvoiceDetail, supplierInvoiceJournalParts } from '@/lib/supplier-invoice-document';
import { buildScfBalanceSheet } from '@/lib/scf-balance-sheet';
import {
  aggregateReceiptContracts,
  billedByProgramFromContracts,
  buildReceiptContractContext,
  receiptContractTotals,
} from '@/lib/receipt-contracts';
import { randomUUID } from 'crypto';
import {
  scfCodeForSupplierCategory,
  scfCodeForSupplierRecord,
  SUPPLIER_CATEGORY_SCF,
} from '@/lib/scf-category-map';
import { listScfChartAccounts } from '@/lib/scf-chart-seed';
import {
  buildLedgerPostings,
  formatPostingsSummary,
  treasuryScfFromKind,
} from '@/lib/ledger-journal-lines';
import {
  formatClientCollectionJournalDescription,
  formatClientRevenueJournalDescription,
  parseReservationProgramStart,
  scfClientCollectionCredit,
  shouldRecognizeClientRevenue,
} from '@/lib/scf-client-collection';
import { resolveClientAvatar } from '@/lib/finance-avatars-server';

export type LedgerType = 'EXPENSE' | 'PURCHASE' | 'SERVICE_SPEND' | 'CASH_IN' | 'CASH_OUT';
export type LedgerStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type LedgerDirection = 'in' | 'out';
export type PaymentMethod = 'CASH' | 'CCP' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
export type ServiceFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_OFF';

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function directionForType(type: LedgerType): LedgerDirection {
  return type === 'CASH_IN' ? 'in' : 'out';
}

function signedAmount(direction: LedgerDirection, amount: number) {
  return direction === 'in' ? Math.abs(amount) : -Math.abs(amount);
}

export function recomputeRunningBalances() {
  const db = getSqliteDb();
  // entry_date is encrypted at rest, so chronological order has to be applied
  // after the rows come back decrypted — SQL ORDER BY would sort ciphertext.
  const rows = (
    db
      .prepare(
        `SELECT id, direction, amount, entry_date, created_at, entry_kind FROM finance_ledger
         WHERE status = 'POSTED'`
      )
      .all() as {
        id: string;
        direction: LedgerDirection;
        amount: number;
        entry_date: string;
        created_at: string;
        entry_kind?: string;
      }[]
  ).sort((a, b) => {
    const da = String(a.entry_date || '').slice(0, 10);
    const dbb = String(b.entry_date || '').slice(0, 10);
    if (da !== dbb) return da < dbb ? -1 : 1;
    const ca = String(a.created_at || '');
    const cb = String(b.created_at || '');
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
  let bal = 0;
  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');
  for (const r of rows) {
    if (String(r.entry_kind || 'treasury') !== 'accrual') {
      bal += signedAmount(r.direction, r.amount);
    }
    upd.run(bal, r.id);
  }
  return bal;
}

export function listLedger(opts?: { from?: string; to?: string; status?: string; category?: string }) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts?.from) { where.push('entry_date >= ?'); params.push(opts.from); }
  if (opts?.to) { where.push('entry_date <= ?'); params.push(opts.to); }
  if (opts?.status) { where.push('status = ?'); params.push(opts.status); }
  if (opts?.category) { where.push('category = ?'); params.push(opts.category); }
  const sql = `SELECT * FROM finance_ledger ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY entry_date DESC, created_at DESC, id DESC`;
  return db.prepare(sql).all(...params);
}

export function createLedgerEntry(input: {
  type: LedgerType;
  amount: number;
  description?: string;
  entry_date?: string;
  receipt_id?: string | null;
  counterparty?: string | null;
  method?: string | null;
  category?: string | null;
  ref_table?: string | null;
  ref_id?: string | null;
  account_id?: string | null;
  created_by?: string | null;
  status?: LedgerStatus;
  entry_kind?: 'treasury' | 'accrual';
}) {
  const db = getSqliteDb();
  const type = input.type;
  const direction = directionForType(type);
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('المبلغ مطلوب');
  const id = newId('led');
  const entry_date = input.entry_date || todayISO();
  const status: LedgerStatus = input.status || 'POSTED';
  const created_at = new Date().toISOString();
  const entry_kind = input.entry_kind || 'treasury';
  db.prepare(`
    INSERT INTO finance_ledger (
      id, type, direction, amount, description, entry_date, status, receipt_id,
      counterparty, method, category, ref_table, ref_id, account_id, entry_kind, running_balance, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id, type, direction, amount, input.description || '', entry_date, status,
    input.receipt_id || null, input.counterparty || null, input.method || null,
    input.category || 'other', input.ref_table || null, input.ref_id || null,
    input.account_id || null, entry_kind, input.created_by || null, created_at
  );
  if (status === 'POSTED') recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_ledger WHERE id = ?').get(id);
}

export function normalizeScfExpenseCode(code?: string | null, fallback = '613') {
  const c = String(code || '').trim();
  if (!c) return fallback;
  const row = listScfChartAccounts({ activeOnly: true }).find((a) => a.code === c && a.class === 6);
  return row?.code || fallback;
}

export function serviceScfCode(serviceId: string, fallback = '613') {
  const svc = getService(serviceId) as { scf_code?: string | null } | null;
  return normalizeScfExpenseCode(svc?.scf_code, fallback);
}

export function listSuppliers(opts?: { category?: string }) {
  ensureServiceSupplierLinks();
  const db = getSqliteDb();
  if (opts?.category) {
    return db.prepare(
      "SELECT * FROM finance_suppliers WHERE COALESCE(category,'other') = ? ORDER BY name_ar COLLATE NOCASE"
    ).all(opts.category);
  }
  return db.prepare('SELECT * FROM finance_suppliers ORDER BY name_ar COLLATE NOCASE').all();
}

export function createSupplier(input: {
  code?: string;
  name_ar: string;
  contact?: string;
  payment_terms_days?: number;
  status?: string;
  category?: string;
  scf_code?: string | null;
  image_url?: string | null;
}) {
  const db = getSqliteDb();
  const id = newId('sup');
  const code = (input.code || `SUP-${Math.floor(100 + Math.random() * 900)}`).trim();
  const created_at = new Date().toISOString();
  const category = (input.category || 'other').trim() || 'other';
  const scf_code = normalizeScfExpenseCode(
    input.scf_code || scfCodeForSupplierCategory(category),
    scfCodeForSupplierCategory(category)
  );
  const image_url = String(input.image_url || '').trim();
  db.prepare(`
    INSERT INTO finance_suppliers (id, code, name_ar, contact, payment_terms_days, status, category, scf_code, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, code, input.name_ar, input.contact || '', Number(input.payment_terms_days) || 30,
    input.status || 'ACTIVE', category, scf_code, image_url || null, created_at
  );
  return db.prepare('SELECT * FROM finance_suppliers WHERE id = ?').get(id);
}

export function getSupplier(id: string) {
  return getSqliteDb().prepare('SELECT * FROM finance_suppliers WHERE id = ?').get(id) || null;
}

export function updateSupplier(id: string, patch: {
  name_ar?: string;
  code?: string;
  contact?: string;
  payment_terms_days?: number;
  status?: string;
  category?: string;
  scf_code?: string | null;
  image_url?: string | null;
}) {
  const db = getSqliteDb();
  if (!getSupplier(id)) throw new Error('المورد غير موجود');
  const sets: string[] = [];
  const params: any[] = [];
  const set = (col: string, value: any) => { sets.push(`${col} = ?`); params.push(value); };

  if (patch.name_ar !== undefined) {
    const name = String(patch.name_ar).trim();
    if (!name) throw new Error('اسم المورد مطلوب');
    set('name_ar', name);
  }
  if (patch.code !== undefined) {
    const code = String(patch.code).trim();
    if (!code) throw new Error('رمز المورد مطلوب');
    set('code', code);
  }
  if (patch.contact !== undefined) set('contact', String(patch.contact).trim());
  if (patch.payment_terms_days !== undefined) {
    const days = Number(patch.payment_terms_days);
    if (!Number.isFinite(days) || days < 0 || days > 365) throw new Error('أجل السداد غير صالح');
    set('payment_terms_days', Math.round(days));
  }
  if (patch.status !== undefined) {
    const status = String(patch.status).trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error('حالة المورد غير مدعومة');
    set('status', status);
  }
  if (patch.category !== undefined) set('category', String(patch.category).trim() || 'other');
  if (patch.scf_code !== undefined) {
    const cat = patch.category !== undefined ? String(patch.category) : (getSupplier(id) as { category?: string })?.category;
    set(
      'scf_code',
      normalizeScfExpenseCode(patch.scf_code, scfCodeForSupplierCategory(String(cat || 'other')))
    );
  }
  if (patch.image_url !== undefined) set('image_url', String(patch.image_url || '').trim() || null);

  if (!sets.length) throw new Error('لا توجد حقول للتحديث');
  db.prepare(`UPDATE finance_suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  return getSupplier(id);
}

export function listSupplierInvoices(supplierId: string) {
  return getSqliteDb()
    .prepare('SELECT * FROM finance_supplier_invoices WHERE supplier_id = ? ORDER BY invoice_date DESC')
    .all(supplierId);
}

/** ref_table is encrypted at rest — match in app after decrypt, not in SQL. */
function supplierInvoiceLedgerPosts(invoiceId: string) {
  const db = getSqliteDb();
  const rows = db
    .prepare(`SELECT id, ref_table, status, created_at FROM finance_ledger WHERE ref_id = ?`)
    .all(invoiceId) as { id: string; ref_table?: string; status?: string; created_at?: string }[];
  return rows
    .filter(
      (r) =>
        String(r.status || '').toUpperCase() === 'POSTED' &&
        String(r.ref_table || '') === 'finance_supplier_invoices'
    )
    .sort((a, b) => String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)));
}

/** Keep one accrual line per invoice; void duplicates from earlier backfill bug. */
export function dedupeSupplierInvoiceLedger() {
  const db = getSqliteDb();
  const invoices = db
    .prepare("SELECT id FROM finance_supplier_invoices WHERE status != 'VOID'")
    .all() as { id: string }[];
  let changed = false;
  for (const inv of invoices) {
    const posted = supplierInvoiceLedgerPosts(inv.id);
    if (posted.length <= 1) continue;
    for (const extra of posted.slice(1)) {
      db.prepare(`UPDATE finance_ledger SET status = 'VOID' WHERE id = ?`).run(extra.id);
      changed = true;
    }
  }
  if (changed) recomputeRunningBalances();
}

function postSupplierInvoiceAccrual(inv: {
  id: string;
  supplier_id: string;
  invoice_no?: string;
  invoice_date?: string;
  amount: number;
}) {
  if (supplierInvoiceLedgerPosts(inv.id).length > 0) return;

  const supplier = getSupplier(inv.supplier_id) as { name_ar?: string } | null;
  const invoice_date = String(inv.invoice_date || todayISO()).slice(0, 10);
  const invoice_no = inv.invoice_no || inv.id;
  const amount = Math.abs(Number(inv.amount) || 0);
  if (!amount) return;

  createLedgerEntry({
    type: 'EXPENSE',
    amount,
    description: `فاتورة مورد: ${supplier?.name_ar || inv.supplier_id} — ${invoice_no}`,
    entry_date: invoice_date,
    counterparty: supplier?.name_ar || null,
    category: 'supplier_purchase',
    ref_table: 'finance_supplier_invoices',
    ref_id: inv.id,
    status: 'POSTED',
    entry_kind: 'accrual',
  });
}

/** SCF م2 — post 411/706 (and 419→411 settlement) when the package product is performed. */
function clientRevenueLedgerPosts(reservationId: string) {
  const db = getSqliteDb();
  return db
    .prepare(
      `SELECT * FROM finance_ledger
       WHERE ref_table = 'finance_client_revenue' AND ref_id = ? AND status = 'POSTED'`
    )
    .all(reservationId) as any[];
}

export function postClientRevenueRecognition(reservation: {
  reservation_id: string;
  customer_name?: string | null;
  package_name?: string | null;
  total_price?: number | null;
  paid_amount?: number | null;
  reservation_status?: string | null;
  program?: string | null;
}) {
  const reservation_id = String(reservation.reservation_id || '').trim();
  if (!reservation_id) return null;
  if (!shouldRecognizeClientRevenue(reservation)) return null;
  if (clientRevenueLedgerPosts(reservation_id).length > 0) return null;

  const invoice = Math.max(0, Number(reservation.total_price) || 0);
  if (!invoice) return null;
  const advances = Math.min(invoice, Math.max(0, Number(reservation.paid_amount) || 0));
  const customer_name = String(reservation.customer_name || '').trim() || 'عميل';
  const package_name = String(reservation.package_name || '').trim();
  const start = parseReservationProgramStart(reservation);
  const entry_date = (start || todayISO()).slice(0, 10);

  return createLedgerEntry({
    type: 'CASH_IN',
    amount: invoice,
    description: formatClientRevenueJournalDescription({
      customer_name,
      package_name,
      invoice_total: invoice,
      advances,
    }),
    entry_date,
    counterparty: customer_name,
    category: 'cash_in',
    ref_table: 'finance_client_revenue',
    ref_id: reservation_id,
    status: 'POSTED',
    entry_kind: 'accrual',
  });
}

/** Ensure departed / performed packages have SCF 706 on اليومية العامة. */
export function ensureClientRevenueRecognitions() {
  const db = getSqliteDb();
  const rows = db
    .prepare(
      `SELECT reservation_id, customer_name, package_name, total_price, paid_amount,
              reservation_status, program
       FROM reservations`
    )
    .all() as any[];
  let posted = 0;
  for (const r of rows) {
    if (!isAgencyConfirmed(r.reservation_status)) continue;
    try {
      if (postClientRevenueRecognition(r)) posted += 1;
    } catch (err) {
      console.warn('[finance] client revenue recognition', r?.reservation_id, err);
    }
  }
  return { posted };
}

/** Invoices created before journal posting — ensure each has an accrual line in اليومية. */
/** One-time repair: post missing accrual lines only (not on every journal load). */
export function backfillSupplierInvoiceLedger() {
  dedupeSupplierInvoiceLedger();
  const db = getSqliteDb();
  const invoices = db
    .prepare("SELECT * FROM finance_supplier_invoices WHERE status != 'VOID'")
    .all() as any[];
  for (const inv of invoices) {
    try {
      postSupplierInvoiceAccrual(inv);
    } catch (err) {
      console.warn('[finance] backfill invoice ledger', inv?.id, err);
    }
  }
}

/** HT, remise, and tax → payable total (TTC). A bare `amount` stays the total when no breakdown is sent. */
export function supplierInvoiceFigures(input: {
  amount_ht?: number | null;
  discount?: number | null;
  tax_rate?: number | null;
  amount?: number | null;
}) {
  const htGiven = input.amount_ht != null && Number.isFinite(Number(input.amount_ht)) && Number(input.amount_ht) > 0;
  const discountGiven = Math.abs(Number(input.discount) || 0) > 0;
  const rate = Math.max(0, Number(input.tax_rate) || 0);
  if (!htGiven && !discountGiven && rate === 0) {
    const amount = Math.abs(Number(input.amount) || 0);
    return { amount_ht: amount, discount: 0, tax_rate: 0, tax_amount: 0, amount };
  }
  const ht = Math.abs(Number(htGiven ? input.amount_ht : input.amount) || 0);
  const discount = Math.min(ht, Math.abs(Number(input.discount) || 0));
  const base = Math.max(0, ht - discount);
  const tax_amount = Math.round(base * rate) / 100;
  const amount = Math.round((base + tax_amount) * 100) / 100;
  return { amount_ht: ht, discount, tax_rate: rate, tax_amount, amount };
}

function supplierInvoiceFiguresResolved(input: {
  amount?: number | null;
  amount_ht?: number | null;
  discount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  detail_json?: string | null;
}) {
  const detailRaw = input.detail_json?.trim();
  if (detailRaw) {
    try {
      const detail = parseSupplierInvoiceDetail(detailRaw);
      if (detail) {
        const totals = computeSupplierInvoiceTotals({
          lines: detail.lines,
          discount: Number(input.discount) || 0,
          taxes: detail.taxes,
          vatExempt: detail.vatExempt,
        });
        return {
          amount_ht: totals.ht,
          discount: totals.discount,
          tax_rate: totals.taxRate,
          tax_amount: totals.tax,
          amount: totals.ttc,
        };
      }
    } catch {
      /* fall through */
    }
  }
  const base = supplierInvoiceFigures(input);
  if (input.tax_amount != null && Number.isFinite(Number(input.tax_amount))) {
    const tax_amount = Math.round(Number(input.tax_amount) * 100) / 100;
    const net = Math.max(0, base.amount_ht - base.discount);
    const amount = Math.round((net + tax_amount) * 100) / 100;
    const tax_rate = net > 0 ? Math.round((tax_amount / net) * 10000) / 100 : base.tax_rate;
    return { ...base, tax_amount, amount, tax_rate };
  }
  return base;
}

export function createSupplierInvoice(input: {
  supplier_id: string; invoice_no?: string; invoice_date?: string; due_date?: string;
  amount?: number; amount_ht?: number | null; discount?: number | null; tax_rate?: number | null;
  tax_amount?: number | null; detail_json?: string | null; note?: string;
}) {
  const db = getSqliteDb();
  const figures = supplierInvoiceFiguresResolved(input);
  const amount = figures.amount;
  if (!amount) throw new Error('مبلغ الفاتورة مطلوب');
  const id = newId('sinv');
  const invoice_date = input.invoice_date || todayISO();
  const due = input.due_date || invoice_date;
  const invoice_no = input.invoice_no || `INV-${Date.now().toString().slice(-6)}`;
  const created_at = new Date().toISOString();

  const run = db.transaction(() => {
    db.prepare(`
      INSERT INTO finance_supplier_invoices (
        id, supplier_id, invoice_no, invoice_date, due_date,
        amount, amount_ht, discount, tax_rate, tax_amount,
        paid_amount, remaining, status, note, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'OPEN', ?, ?, ?)
    `).run(
      id, input.supplier_id, invoice_no, invoice_date, due,
      amount, figures.amount_ht, figures.discount, figures.tax_rate, figures.tax_amount,
      amount, input.note || '', input.detail_json || null, created_at
    );

    postSupplierInvoiceAccrual({
      id,
      supplier_id: input.supplier_id,
      invoice_no,
      invoice_date,
      amount,
    });
  });
  run();

  return db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(id);
}

/** Cancel an unpaid invoice. Partially/fully settled invoices stay auditable. */
export function voidSupplierInvoice(invoiceId: string) {
  const db = getSqliteDb();
  const inv = db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(invoiceId) as any;
  if (!inv) throw new Error('الفاتورة غير موجودة');
  if (inv.status === 'VOID') return inv;
  if (Number(inv.paid_amount || 0) > 0) throw new Error('لا يمكن إلغاء فاتورة سُدّد جزء منها');
  db.prepare("UPDATE finance_supplier_invoices SET status = 'VOID', remaining = 0 WHERE id = ?").run(invoiceId);
  for (const row of supplierInvoiceLedgerPosts(invoiceId)) {
    db.prepare(`UPDATE finance_ledger SET status = 'VOID' WHERE id = ?`).run(row.id);
  }
  recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(invoiceId);
}

export function listSupplierPayments(supplierId: string) {
  return getSqliteDb()
    .prepare('SELECT * FROM finance_supplier_payments WHERE supplier_id = ? ORDER BY payment_date DESC')
    .all(supplierId);
}

export function createSupplierPayment(input: {
  supplier_id: string; invoice_id?: string | null; amount: number;
  method: PaymentMethod; payment_date?: string; note?: string; account_id?: string | null; created_by?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الدفعة مطلوب');
  const method = input.method;
  if (!['CASH', 'CCP', 'BANK_TRANSFER', 'CHECK', 'OTHER'].includes(method)) {
    throw new Error('طريقة الدفع غير مدعومة');
  }
  const id = newId('spay');
  const payment_date = input.payment_date || todayISO();
  const created_at = new Date().toISOString();

  (() => {
    db.prepare(`
      INSERT INTO finance_supplier_payments (
        id, supplier_id, invoice_id, amount, method, payment_date, note, ledger_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id, input.supplier_id, input.invoice_id || null, amount, method, payment_date,
      input.note || '', input.created_by || null, created_at
    );

    if (input.invoice_id) {
      const inv = db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(input.invoice_id) as any;
      if (inv && inv.status !== 'VOID') {
        const paid = Math.min(Number(inv.amount), Number(inv.paid_amount || 0) + amount);
        const remaining = Math.max(0, Number(inv.amount) - paid);
        const status = remaining <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OPEN';
        db.prepare('UPDATE finance_supplier_invoices SET paid_amount = ?, remaining = ?, status = ? WHERE id = ?')
          .run(paid, remaining, status, inv.id);
      }
    }

    const supplier = db.prepare('SELECT name_ar FROM finance_suppliers WHERE id = ?').get(input.supplier_id) as any;
    const led = createLedgerEntry({
      type: 'PURCHASE',
      amount,
      description: `دفعة مورد: ${supplier?.name_ar || input.supplier_id}`,
      entry_date: payment_date,
      counterparty: supplier?.name_ar || null,
      method,
      category: 'supplier_purchase',
      ref_table: 'finance_supplier_payments',
      ref_id: id,
      account_id: resolveTreasuryAccountId(input.account_id),
      created_by: input.created_by || null,
      status: 'POSTED',
    }) as any;
    db.prepare('UPDATE finance_supplier_payments SET ledger_id = ? WHERE id = ?').run(led.id, id);
  })();
  return db.prepare('SELECT * FROM finance_supplier_payments WHERE id = ?').get(id);
}

function applyPaymentDeltaToInvoice(db: ReturnType<typeof getSqliteDb>, invoiceId: string, delta: number) {
  if (!invoiceId || !delta) return;
  const inv = db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(invoiceId) as any;
  if (!inv || inv.status === 'VOID') return;
  const paid = Math.min(Number(inv.amount), Math.max(0, Number(inv.paid_amount || 0) + delta));
  const remaining = Math.max(0, Number(inv.amount) - paid);
  const status = remaining <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OPEN';
  db.prepare('UPDATE finance_supplier_invoices SET paid_amount = ?, remaining = ?, status = ? WHERE id = ?').run(
    paid,
    remaining,
    status,
    invoiceId
  );
}

/** Remove a supplier payment and void its treasury ledger line. */
export function voidSupplierPayment(paymentId: string) {
  const db = getSqliteDb();
  const pay = db.prepare('SELECT * FROM finance_supplier_payments WHERE id = ?').get(paymentId) as any;
  if (!pay) throw new Error('الدفعة غير موجودة');
  if (String(pay.status || '').toUpperCase() === 'VOID') return pay;
  const amount = Number(pay.amount) || 0;
  const run = db.transaction(() => {
    if (pay.ledger_id) {
      db.prepare(`UPDATE finance_ledger SET status = 'VOID' WHERE id = ?`).run(pay.ledger_id);
    }
    if (pay.invoice_id) {
      applyPaymentDeltaToInvoice(db, String(pay.invoice_id), -amount);
    }
    db.prepare(`UPDATE finance_supplier_payments SET status = 'VOID' WHERE id = ?`).run(paymentId);
  });
  run();
  recomputeRunningBalances();
  return { id: paymentId, deleted: true };
}

/** Edit amount, date, method, invoice allocation, or note on an existing payment. */
export function updateSupplierPayment(
  paymentId: string,
  patch: {
    amount?: number;
    method?: PaymentMethod;
    payment_date?: string;
    note?: string;
    invoice_id?: string | null;
  }
) {
  const db = getSqliteDb();
  const pay = db.prepare('SELECT * FROM finance_supplier_payments WHERE id = ?').get(paymentId) as any;
  if (!pay) throw new Error('الدفعة غير موجودة');
  if (String(pay.status || '').toUpperCase() === 'VOID') throw new Error('لا يمكن تعديل دفعة ملغاة');

  const nextAmount = patch.amount != null ? Math.abs(Number(patch.amount) || 0) : Number(pay.amount) || 0;
  if (!nextAmount) throw new Error('مبلغ الدفعة مطلوب');
  const method = (patch.method || pay.method) as PaymentMethod;
  if (!['CASH', 'CCP', 'BANK_TRANSFER', 'CHECK', 'OTHER'].includes(String(method))) {
    throw new Error('طريقة الدفع غير مدعومة');
  }
  const payment_date = String(patch.payment_date || pay.payment_date || todayISO()).slice(0, 10);
  const note = patch.note !== undefined ? String(patch.note || '') : String(pay.note || '');
  const oldInvoiceId = pay.invoice_id ? String(pay.invoice_id) : '';
  const newInvoiceId =
    patch.invoice_id !== undefined ? (patch.invoice_id ? String(patch.invoice_id) : '') : oldInvoiceId;
  const oldAmount = Number(pay.amount) || 0;

  const run = db.transaction(() => {
    if (oldInvoiceId) applyPaymentDeltaToInvoice(db, oldInvoiceId, -oldAmount);
    db.prepare(`
      UPDATE finance_supplier_payments
      SET amount = ?, method = ?, payment_date = ?, note = ?, invoice_id = ?
      WHERE id = ?
    `).run(nextAmount, method, payment_date, note, newInvoiceId || null, paymentId);
    if (newInvoiceId) applyPaymentDeltaToInvoice(db, newInvoiceId, nextAmount);

    if (pay.ledger_id) {
      const supplier = db.prepare('SELECT name_ar FROM finance_suppliers WHERE id = ?').get(pay.supplier_id) as any;
      db.prepare(`
        UPDATE finance_ledger
        SET amount = ?, method = ?, entry_date = ?, description = ?, counterparty = ?
        WHERE id = ?
      `).run(
        nextAmount,
        method,
        payment_date,
        `دفعة مورد: ${supplier?.name_ar || pay.supplier_id}`,
        supplier?.name_ar || null,
        pay.ledger_id
      );
    }
  });
  run();
  recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_supplier_payments WHERE id = ?').get(paymentId);
}

/** Update invoice header fields; sync accrual line when unpaid portion allows. */
export function updateSupplierInvoice(
  invoiceId: string,
  patch: {
    invoice_no?: string;
    invoice_date?: string;
    due_date?: string;
    amount?: number;
    amount_ht?: number | null;
    discount?: number | null;
    tax_rate?: number | null;
    tax_amount?: number | null;
    detail_json?: string | null;
    note?: string;
  }
) {
  const db = getSqliteDb();
  const inv = db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(invoiceId) as any;
  if (!inv) throw new Error('الفاتورة غير موجودة');
  if (inv.status === 'VOID') throw new Error('لا يمكن تعديل فاتورة ملغاة');

  const paid = Number(inv.paid_amount || 0);
  const figures = supplierInvoiceFiguresResolved({
    amount_ht: patch.amount_ht !== undefined ? patch.amount_ht : inv.amount_ht,
    discount: patch.discount !== undefined ? patch.discount : inv.discount,
    tax_rate: patch.tax_rate !== undefined ? patch.tax_rate : inv.tax_rate,
    tax_amount: patch.tax_amount !== undefined ? patch.tax_amount : inv.tax_amount,
    amount: patch.amount !== undefined ? patch.amount : inv.amount,
    detail_json: patch.detail_json !== undefined ? patch.detail_json : inv.detail_json,
  });
  const nextAmount = figures.amount;
  if (!nextAmount) throw new Error('مبلغ الفاتورة مطلوب');
  if (nextAmount < paid) throw new Error('المبلغ أقل من المدفوع على الفاتورة');

  const invoice_no = patch.invoice_no != null ? String(patch.invoice_no || inv.invoice_no) : inv.invoice_no;
  const invoice_date = String(patch.invoice_date || inv.invoice_date || todayISO()).slice(0, 10);
  const due_date = String(patch.due_date || inv.due_date || invoice_date).slice(0, 10);
  const note = patch.note !== undefined ? String(patch.note || '') : String(inv.note || '');
  const detail_json =
    patch.detail_json !== undefined ? patch.detail_json || null : inv.detail_json || null;
  const remaining = Math.max(0, nextAmount - paid);
  const status = remaining <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'OPEN';

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE finance_supplier_invoices
      SET invoice_no = ?, invoice_date = ?, due_date = ?,
          amount = ?, amount_ht = ?, discount = ?, tax_rate = ?, tax_amount = ?,
          remaining = ?, status = ?, note = ?, detail_json = ?
      WHERE id = ?
    `).run(
      invoice_no, invoice_date, due_date,
      nextAmount, figures.amount_ht, figures.discount, figures.tax_rate, figures.tax_amount,
      remaining, status, note, detail_json, invoiceId
    );

    const accrual = supplierInvoiceLedgerPosts(invoiceId)[0];
    if (accrual) {
      const supplier = getSupplier(inv.supplier_id) as { name_ar?: string } | null;
      db.prepare(`
        UPDATE finance_ledger
        SET amount = ?, entry_date = ?, description = ?, counterparty = ?
        WHERE id = ?
      `).run(
        nextAmount,
        invoice_date,
        `فاتورة مورد: ${supplier?.name_ar || inv.supplier_id} — ${invoice_no}`,
        supplier?.name_ar || null,
        accrual.id
      );
    } else if (paid === 0) {
      postSupplierInvoiceAccrual({
        id: invoiceId,
        supplier_id: inv.supplier_id,
        invoice_no,
        invoice_date,
        amount: nextAmount,
      });
    }
  });
  run();
  recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(invoiceId);
}

export type SupplierStatementLine = {
  id: string;
  kind: 'INVOICE' | 'PAYMENT';
  date: string;
  ref: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
  due_date?: string | null;
  method?: string | null;
};

function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${String(fromISO).slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${String(toISO).slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Account statement for one supplier: invoices as debit, payments as credit,
 * chronological with a running balance, plus payment-discipline indicators.
 */
export function supplierStatement(supplierId: string) {
  const invoices = listSupplierInvoices(supplierId) as any[];
  const payments = (listSupplierPayments(supplierId) as any[]).filter(
    (p) => String(p.status || 'POSTED').toUpperCase() !== 'VOID'
  );
  const invoiceNoById = new Map<string, string>(invoices.map((i) => [i.id, i.invoice_no]));
  const today = todayISO();

  const lines: SupplierStatementLine[] = [
    ...invoices
      .filter((i) => i.status !== 'VOID')
      .map((i) => ({
        id: i.id,
        kind: 'INVOICE' as const,
        date: String(i.invoice_date || '').slice(0, 10),
        ref: i.invoice_no || '—',
        label: 'فاتورة',
        debit: Number(i.amount) || 0,
        credit: 0,
        balance: 0,
        status: i.status,
        due_date: i.due_date || null,
      })),
    ...payments.map((p) => ({
      id: p.id,
      kind: 'PAYMENT' as const,
      date: String(p.payment_date || '').slice(0, 10),
      ref: p.invoice_id ? invoiceNoById.get(p.invoice_id) || '—' : 'دفعة على الحساب',
      label: 'دفعة',
      debit: 0,
      credit: Number(p.amount) || 0,
      balance: 0,
      status: 'PAID',
      method: p.method || null,
    })),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'INVOICE' ? -1 : 1;
    return 0;
  });

  let balance = 0;
  for (const line of lines) {
    balance += line.debit - line.credit;
    line.balance = balance;
  }

  const openInvoices = invoices.filter(
    (i) => (i.status === 'OPEN' || i.status === 'PARTIAL') && Number(i.remaining) > 0
  );
  const overdueInvoices = openInvoices.filter((i) => i.due_date && String(i.due_date).slice(0, 10) < today);

  // Average days from invoice date to final settlement, over fully paid invoices.
  const settlementSpans: number[] = [];
  for (const inv of invoices.filter((i) => i.status === 'PAID')) {
    const last = payments
      .filter((p) => p.invoice_id === inv.id)
      .map((p) => String(p.payment_date || '').slice(0, 10))
      .sort()
      .pop();
    if (last && inv.invoice_date) settlementSpans.push(Math.max(0, daysBetween(inv.invoice_date, last)));
  }

  return {
    lines,
    totals: {
      total_invoiced: lines.reduce((s, l) => s + l.debit, 0),
      total_paid: lines.reduce((s, l) => s + l.credit, 0),
      balance,
      open_count: openInvoices.length,
      overdue_count: overdueInvoices.length,
      overdue_amount: overdueInvoices.reduce((s, i) => s + (Number(i.remaining) || 0), 0),
      oldest_overdue_days: overdueInvoices.reduce(
        (max, i) => Math.max(max, daysBetween(String(i.due_date).slice(0, 10), today)),
        0
      ),
      next_due_date:
        openInvoices
          .map((i) => String(i.due_date || '').slice(0, 10))
          .filter(Boolean)
          .sort()[0] || null,
      avg_settlement_days: settlementSpans.length
        ? Math.round(settlementSpans.reduce((s, d) => s + d, 0) / settlementSpans.length)
        : null,
      last_payment_date:
        payments
          .map((p) => String(p.payment_date || '').slice(0, 10))
          .filter(Boolean)
          .sort()
          .pop() || null,
    },
  };
}

/** Days until a due date: negative once the term has been exceeded. */
function daysUntil(due: string, today: string) {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

/** A supplier's settlement standing against its agreed payment terms. */
export type SettlementState = 'PAID_FULL' | 'OVERDUE' | 'DUE_SOON' | 'OPEN' | 'NO_INVOICES';

/** Invoices whose term lands inside this window count as "due soon". */
export const DUE_SOON_DAYS = 7;

/**
 * Aging buckets per supplier. Due dates are encrypted at rest, so the
 * comparisons run in JS on decrypted rows — SQL `julianday(due_date)` would be
 * reading ciphertext and silently bucket everything as zero.
 */
export function supplierAging() {
  return supplierStatusList().filter((s) => s.total_remaining > 0);
}

/**
 * Every supplier with its invoiced / paid / outstanding position and where it
 * stands against its payment terms — including suppliers settled in full, which
 * the aging view alone would drop.
 */
export function supplierStatusList() {
  const db = getSqliteDb();
  const today = todayISO();
  const suppliers = db.prepare('SELECT * FROM finance_suppliers').all() as any[];
  const invoices = db.prepare('SELECT * FROM finance_supplier_invoices').all() as any[];

  const bySupplier = new Map<string, any[]>();
  for (const inv of invoices) {
    const list = bySupplier.get(inv.supplier_id) || [];
    list.push(inv);
    bySupplier.set(inv.supplier_id, list);
  }

  return suppliers
    .map((s) => {
      const all = bySupplier.get(s.id) || [];
      const live = all.filter((i) => String(i.status || '').toUpperCase() !== 'VOID');
      const open = live.filter(
        (i) => ['OPEN', 'PARTIAL'].includes(String(i.status || '').toUpperCase()) && Number(i.remaining) > 0
      );

      const dueDays = open
        .map((i) => String(i.due_date || '').slice(0, 10))
        .filter(Boolean)
        .map((d) => ({ date: d, days: daysUntil(d, today) }));

      const overdue = dueDays.filter((d) => d.days < 0);
      const bucketOf = (i: any) => {
        const due = String(i.due_date || '').slice(0, 10);
        if (!due) return 'current';
        const late = -daysUntil(due, today);
        if (late <= 0) return 'current';
        if (late <= 30) return 'b1_30';
        if (late <= 60) return 'b31_60';
        if (late <= 90) return 'b61_90';
        return 'b90_plus';
      };
      const sumBucket = (key: string) =>
        open.filter((i) => bucketOf(i) === key).reduce((acc, i) => acc + (Number(i.remaining) || 0), 0);

      const totalInvoiced = live.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
      const totalPaid = live.reduce((acc, i) => acc + (Number(i.paid_amount) || 0), 0);
      const remaining = open.reduce((acc, i) => acc + (Number(i.remaining) || 0), 0);
      const overdueAmount = open
        .filter((i) => bucketOf(i) !== 'current')
        .reduce((acc, i) => acc + (Number(i.remaining) || 0), 0);

      const upcoming = dueDays.filter((d) => d.days >= 0).sort((a, b) => a.days - b.days)[0] || null;
      const oldestOverdue = overdue.sort((a, b) => a.days - b.days)[0] || null;

      let settlement: SettlementState = 'NO_INVOICES';
      if (live.length === 0) settlement = 'NO_INVOICES';
      else if (remaining <= 0) settlement = 'PAID_FULL';
      else if (overdueAmount > 0) settlement = 'OVERDUE';
      else if (upcoming && upcoming.days <= DUE_SOON_DAYS) settlement = 'DUE_SOON';
      else settlement = 'OPEN';

      return {
        id: s.id,
        supplier_id: s.id,
        code: s.code || '',
        name_ar: s.name_ar,
        category: s.category || 'other',
        payment_terms_days: Number(s.payment_terms_days) || 0,
        bucket_current: sumBucket('current'),
        bucket_1_30: sumBucket('b1_30'),
        bucket_31_60: sumBucket('b31_60'),
        bucket_61_90: sumBucket('b61_90'),
        bucket_90_plus: sumBucket('b90_plus'),
        overdue_amount: overdueAmount,
        overdue_count: overdue.length,
        open_count: open.length,
        invoice_count: live.length,
        oldest_due_date: oldestOverdue?.date || null,
        oldest_overdue_days: oldestOverdue ? -oldestOverdue.days : 0,
        next_due_date: upcoming?.date || null,
        days_to_next_due: upcoming ? upcoming.days : null,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_remaining: remaining,
        settlement,
        paid_ratio: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0,
      };
    })
    .sort((a, b) => b.total_remaining - a.total_remaining || a.name_ar.localeCompare(b.name_ar, 'ar'));
}

export function supplierDebtSummary() {
  const db = getSqliteDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status != 'VOID' THEN amount ELSE 0 END), 0) as total_invoiced,
      COALESCE(SUM(CASE WHEN status != 'VOID' THEN paid_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN status IN ('OPEN','PARTIAL') THEN remaining ELSE 0 END), 0) as total_debt,
      COALESCE(SUM(CASE WHEN status='OPEN' THEN remaining ELSE 0 END),0) as open_debt,
      COALESCE(SUM(CASE WHEN status='PARTIAL' THEN remaining ELSE 0 END),0) as partial_debt,
      COUNT(CASE WHEN status IN ('OPEN','PARTIAL') AND remaining > 0 THEN 1 END) as open_invoices
    FROM finance_supplier_invoices
  `).get() as any;
  const total_invoiced = Number(row?.total_invoiced) || 0;
  const total_paid = Number(row?.total_paid) || 0;
  const total_debt = Number(row?.total_debt) || 0;
  return {
    total_invoiced,
    total_paid,
    total_debt,
    total_unpaid: total_debt,
    open_debt: Number(row?.open_debt) || 0,
    partial_debt: Number(row?.partial_debt) || 0,
    open_invoices: Number(row?.open_invoices) || 0,
  };
}

export function listSalaries(opts?: { year?: number; month?: number }) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts?.year) { where.push('period_year = ?'); params.push(opts.year); }
  if (opts?.month) { where.push('period_month = ?'); params.push(opts.month); }
  return db.prepare(`
    SELECT * FROM finance_staff_salaries
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY period_year DESC, period_month DESC, staff_name COLLATE NOCASE
  `).all(...params);
}

export type SalaryKind = 'salary' | 'advance';

function normalizeSalaryKind(raw?: string | null): SalaryKind {
  return String(raw || '').trim().toLowerCase() === 'advance' ? 'advance' : 'salary';
}

function salaryLedgerDescription(row: {
  staff_name?: string;
  period_year?: number;
  period_month?: number;
  kind?: string | null;
}) {
  const kind = normalizeSalaryKind(row.kind);
  const prefix = kind === 'advance' ? 'تسبيق راتب' : 'راتب';
  const y = Number(row.period_year) || 0;
  const m = Number(row.period_month) || 0;
  return `${prefix}: ${row.staff_name || '—'} — ${y}/${String(m).padStart(2, '0')}`;
}

export function createSalary(input: {
  morshid_id?: string | null;
  staff_name: string;
  period_year: number;
  period_month: number;
  amount: number;
  note?: string;
  kind?: SalaryKind;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الراتب مطلوب');
  const kind = normalizeSalaryKind(input.kind);
  const id = newId('sal');
  db.prepare(`
    INSERT INTO finance_staff_salaries (
      id, morshid_id, staff_name, period_year, period_month, amount, status, paid_at, note, ledger_id, kind, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NULL, ?, NULL, ?, ?)
  `).run(
    id,
    input.morshid_id || null,
    input.staff_name,
    input.period_year,
    input.period_month,
    amount,
    input.note || '',
    kind,
    new Date().toISOString()
  );
  return db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id);
}

/** Salary advance — optional immediate treasury payout (default: pay now). */
export function createSalaryAdvance(input: {
  morshid_id?: string | null;
  staff_name: string;
  period_year: number;
  period_month: number;
  amount: number;
  note?: string;
  pay_now?: boolean;
  created_by?: string;
  account_id?: string | null;
}) {
  const row = createSalary({
    ...input,
    kind: 'advance',
    note: input.note || 'تسبيق راتب',
  }) as any;
  if (input.pay_now === false) return row;
  return markSalaryPaid(String(row.id), input.created_by, input.account_id, {
    payment_date: todayISO(),
  });
}

export function markSalaryPaid(
  id: string,
  created_by?: string,
  account_id?: string | null,
  opts?: { payment_date?: string; method?: PaymentMethod }
) {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id) as any;
  if (!row) throw new Error('الراتب غير موجود');
  if (row.status === 'PAID') return row;
  const payment_date = String(opts?.payment_date || todayISO()).slice(0, 10);
  const paid_at = `${payment_date}T12:00:00.000Z`;
  const method = opts?.method || 'CASH';
  const led = createLedgerEntry({
    type: 'CASH_OUT',
    amount: row.amount,
    description: salaryLedgerDescription(row),
    entry_date: payment_date,
    counterparty: row.staff_name,
    method,
    category: 'payroll_related',
    ref_table: 'finance_staff_salaries',
    ref_id: id,
    account_id: resolveTreasuryAccountId(account_id),
    created_by: created_by || null,
    status: 'POSTED',
  }) as any;
  db.prepare(`UPDATE finance_staff_salaries SET status = 'PAID', paid_at = ?, ledger_id = ? WHERE id = ?`).run(
    paid_at,
    led.id,
    id
  );
  return db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id);
}

export function updateSalary(
  id: string,
  patch: {
    amount?: number;
    period_year?: number;
    period_month?: number;
    note?: string;
    kind?: SalaryKind;
    payment_date?: string;
    method?: PaymentMethod;
  }
) {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id) as any;
  if (!row) throw new Error('الراتب غير موجود');

  const nextAmount = patch.amount != null ? Math.abs(Number(patch.amount) || 0) : Number(row.amount) || 0;
  if (!nextAmount) throw new Error('المبلغ مطلوب');
  const period_year = patch.period_year != null ? Number(patch.period_year) : Number(row.period_year);
  const period_month = patch.period_month != null ? Number(patch.period_month) : Number(row.period_month);
  if (!period_year || period_month < 1 || period_month > 12) throw new Error('الفترة غير صالحة');
  const note = patch.note !== undefined ? String(patch.note || '') : String(row.note || '');
  const kind = patch.kind != null ? normalizeSalaryKind(patch.kind) : normalizeSalaryKind(row.kind);
  const status = String(row.status || '').toUpperCase();
  const payment_date =
    patch.payment_date != null
      ? String(patch.payment_date).slice(0, 10)
      : String(row.paid_at || '').slice(0, 10) || todayISO();
  const method = (patch.method || 'CASH') as PaymentMethod;

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE finance_staff_salaries
      SET amount = ?, period_year = ?, period_month = ?, note = ?, kind = ?
      WHERE id = ?
    `).run(nextAmount, period_year, period_month, note, kind, id);

    if (status === 'PAID' && row.ledger_id) {
      const updated = db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id) as any;
      db.prepare(`
        UPDATE finance_ledger
        SET amount = ?, entry_date = ?, method = ?, description = ?, counterparty = ?
        WHERE id = ?
      `).run(
        nextAmount,
        payment_date,
        method,
        salaryLedgerDescription(updated),
        updated.staff_name,
        row.ledger_id
      );
      db.prepare(`UPDATE finance_staff_salaries SET paid_at = ? WHERE id = ?`).run(
        `${payment_date}T12:00:00.000Z`,
        id
      );
    }
  });
  run();
  if (status === 'PAID') recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id);
}

export function voidSalary(id: string) {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id) as any;
  if (!row) throw new Error('الراتب غير موجود');
  const run = db.transaction(() => {
    if (row.ledger_id) {
      db.prepare(`UPDATE finance_ledger SET status = 'VOID' WHERE id = ?`).run(row.ledger_id);
    }
    db.prepare('DELETE FROM finance_staff_salaries WHERE id = ?').run(id);
  });
  run();
  recomputeRunningBalances();
  return { id, deleted: true };
}

/**
 * Payroll rolled up per employee over a period, so the first screen is one line
 * per person with what they were actually paid, rather than one line per month.
 * staff_name is encrypted at rest, so grouping happens after decryption.
 */
export function payrollByStaff(opts?: { from_year?: number; from_month?: number; to_year?: number; to_month?: number }) {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM finance_staff_salaries').all() as any[];
  const morshidPhoto = new Map<string, string>();
  try {
    for (const m of db.prepare('SELECT morshid_id, image, avatar FROM morshids').all() as any[]) {
      const id = String(m.morshid_id || '').trim();
      if (!id) continue;
      const url = String(m.image || m.avatar || '').trim();
      if (url) morshidPhoto.set(id, url);
    }
  } catch {
    /* morshids table optional in some envs */
  }

  const stamp = (y: number, m: number) => y * 12 + (m - 1);
  const lo = opts?.from_year ? stamp(opts.from_year, opts.from_month || 1) : -Infinity;
  const hi = opts?.to_year ? stamp(opts.to_year, opts.to_month || 12) : Infinity;

  const inPeriod = rows.filter((r) => {
    const s = stamp(Number(r.period_year) || 0, Number(r.period_month) || 1);
    return s >= lo && s <= hi;
  });

  const groups = new Map<string, any>();
  for (const r of inPeriod) {
    const name = String(r.staff_name || 'غير مسمى').trim() || 'غير مسمى';
    const key = String(r.morshid_id || '') || `name:${name}`;
    const amount = Number(r.amount) || 0;
    const paid = String(r.status || '').toUpperCase() === 'PAID';
    const entry = groups.get(key) || {
      key,
      staff_name: name,
      morshid_id: r.morshid_id || '',
      staff_photo: r.morshid_id ? morshidPhoto.get(String(r.morshid_id)) || '' : '',
      total: 0,
      paid_total: 0,
      pending_total: 0,
      months: 0,
      paid_months: 0,
      pending_months: 0,
      last_paid_at: '',
      lines: [] as any[],
    };
    entry.total += amount;
    entry.months += 1;
    if (paid) {
      entry.paid_total += amount;
      entry.paid_months += 1;
      const at = String(r.paid_at || '').slice(0, 10);
      if (at > entry.last_paid_at) entry.last_paid_at = at;
    } else {
      entry.pending_total += amount;
      entry.pending_months += 1;
    }
    entry.lines.push({
      id: r.id,
      period_year: Number(r.period_year) || 0,
      period_month: Number(r.period_month) || 0,
      amount,
      status: paid ? 'PAID' : 'PENDING',
      paid_at: String(r.paid_at || '').slice(0, 10),
      note: r.note || '',
      kind: normalizeSalaryKind(r.kind),
    });
    groups.set(key, entry);
  }

  const staff = [...groups.values()]
    .map((g) => ({
      ...g,
      lines: g.lines.sort((a: any, b: any) =>
        a.period_year !== b.period_year ? b.period_year - a.period_year : b.period_month - a.period_month
      ),
    }))
    .sort((a, b) => b.total - a.total);

  // Every year/month present in the table, so the filter only offers real periods.
  const years = [...new Set(rows.map((r) => Number(r.period_year) || 0))].filter(Boolean).sort((a, b) => b - a);

  return {
    staff,
    years,
    total: staff.reduce((s, g) => s + g.total, 0),
    paid_total: staff.reduce((s, g) => s + g.paid_total, 0),
    pending_total: staff.reduce((s, g) => s + g.pending_total, 0),
    staff_count: staff.length,
    lines_count: inPeriod.length,
  };
}

export function listServices(opts?: { supplier_id?: string }) {
  const db = getSqliteDb();
  if (opts?.supplier_id) {
    return db
      .prepare('SELECT * FROM finance_service_costs WHERE supplier_id = ? ORDER BY name_ar COLLATE NOCASE')
      .all(opts.supplier_id);
  }
  return db.prepare('SELECT * FROM finance_service_costs ORDER BY name_ar COLLATE NOCASE').all();
}

export function createService(input: {
  name_ar: string;
  frequency: ServiceFrequency;
  amount: number;
  next_due_date?: string;
  provider?: string;
  supplier_id?: string | null;
  scf_code?: string | null;
  status?: string;
  note?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الخدمة مطلوب');
  const supplier_id = input.supplier_id ? String(input.supplier_id).trim() : null;
  if (supplier_id && !getSupplier(supplier_id)) throw new Error('المورد غير موجود');
  const scf_code = normalizeScfExpenseCode(input.scf_code, '613');
  const id = newId('svc');
  db.prepare(`
    INSERT INTO finance_service_costs (
      id, name_ar, frequency, amount, next_due_date, provider, supplier_id, scf_code, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name_ar,
    input.frequency,
    amount,
    input.next_due_date || todayISO(),
    input.provider || '',
    supplier_id,
    scf_code,
    input.status || 'ACTIVE',
    input.note || '',
    new Date().toISOString()
  );
  return db.prepare('SELECT * FROM finance_service_costs WHERE id = ?').get(id);
}

export function getService(id: string) {
  return getSqliteDb().prepare('SELECT * FROM finance_service_costs WHERE id = ?').get(id) || null;
}

export function updateService(
  id: string,
  patch: {
    name_ar?: string;
    frequency?: ServiceFrequency;
    amount?: number;
    next_due_date?: string;
    provider?: string;
    supplier_id?: string | null;
    scf_code?: string | null;
    status?: string;
    note?: string;
  }
) {
  const db = getSqliteDb();
  if (!getService(id)) throw new Error('الخدمة غير موجودة');
  const sets: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };

  if (patch.name_ar !== undefined) {
    const name = String(patch.name_ar).trim();
    if (!name) throw new Error('اسم الخدمة مطلوب');
    set('name_ar', name);
  }
  if (patch.frequency !== undefined) {
    const frequency = String(patch.frequency).toUpperCase() as ServiceFrequency;
    if (!['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_OFF'].includes(frequency)) {
      throw new Error('دورية الخدمة غير مدعومة');
    }
    set('frequency', frequency);
  }
  if (patch.amount !== undefined) {
    const amount = Math.abs(Number(patch.amount) || 0);
    if (!amount) throw new Error('مبلغ الخدمة مطلوب');
    set('amount', amount);
  }
  if (patch.next_due_date !== undefined) {
    set('next_due_date', String(patch.next_due_date || '').slice(0, 10));
  }
  if (patch.provider !== undefined) set('provider', String(patch.provider || '').trim());
  if (patch.supplier_id !== undefined) {
    const sid = patch.supplier_id ? String(patch.supplier_id).trim() : null;
    if (sid && !getSupplier(sid)) throw new Error('المورد غير موجود');
    set('supplier_id', sid);
  }
  if (patch.scf_code !== undefined) set('scf_code', normalizeScfExpenseCode(patch.scf_code, '613'));
  if (patch.status !== undefined) {
    const status = String(patch.status).trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new Error('حالة الخدمة غير مدعومة');
    set('status', status);
  }
  if (patch.note !== undefined) set('note', String(patch.note || '').trim());

  if (!sets.length) throw new Error('لا توجد حقول للتحديث');
  db.prepare(`UPDATE finance_service_costs SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  return getService(id);
}

export function listServicePayments(serviceId?: string) {
  const db = getSqliteDb();
  if (serviceId) {
    return db.prepare('SELECT * FROM finance_service_payments WHERE service_id = ? ORDER BY payment_date DESC').all(serviceId);
  }
  return db.prepare('SELECT * FROM finance_service_payments ORDER BY payment_date DESC LIMIT 100').all();
}

export function createServicePayment(input: {
  service_id: string; amount: number; method: PaymentMethod;
  payment_date?: string; note?: string; account_id?: string | null; created_by?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الدفع مطلوب');
  const method = input.method;
  if (!['CASH', 'CCP', 'BANK_TRANSFER', 'CHECK', 'OTHER'].includes(method)) {
    throw new Error('طريقة الدفع غير مدعومة');
  }
  const svc = db.prepare('SELECT * FROM finance_service_costs WHERE id = ?').get(input.service_id) as any;
  if (!svc) throw new Error('الخدمة غير موجودة');
  const id = newId('svcp');
  const payment_date = input.payment_date || todayISO();
  const created_at = new Date().toISOString();

  (() => {
    db.prepare(`
      INSERT INTO finance_service_payments (
        id, service_id, amount, method, payment_date, note, ledger_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(id, input.service_id, amount, method, payment_date, input.note || '', input.created_by || null, created_at);

    const led = createLedgerEntry({
      type: 'SERVICE_SPEND',
      amount,
      description: `خدمة: ${svc.name_ar}`,
      entry_date: payment_date,
      counterparty: svc.provider || svc.name_ar,
      method,
      category: 'services',
      ref_table: 'finance_service_payments',
      ref_id: id,
      account_id: resolveTreasuryAccountId(input.account_id),
      created_by: input.created_by || null,
      status: 'POSTED',
    }) as any;
    db.prepare('UPDATE finance_service_payments SET ledger_id = ? WHERE id = ?').run(led.id, id);

    if (svc.frequency !== 'ONE_OFF') {
      const d = new Date(payment_date);
      if (svc.frequency === 'MONTHLY') d.setMonth(d.getMonth() + 1);
      else if (svc.frequency === 'QUARTERLY') d.setMonth(d.getMonth() + 3);
      else if (svc.frequency === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
      const next = d.toISOString().slice(0, 10);
      db.prepare('UPDATE finance_service_costs SET next_due_date = ? WHERE id = ?').run(next, svc.id);
    }
  })();
  return db.prepare('SELECT * FROM finance_service_payments WHERE id = ?').get(id);
}

export function upcomingServices(withinDays = 45) {
  const db = getSqliteDb();
  return db.prepare(`
    SELECT * FROM finance_service_costs
    WHERE status = 'ACTIVE'
      AND next_due_date IS NOT NULL
      AND julianday(next_due_date) <= julianday('now') + ?
    ORDER BY next_due_date ASC
  `).all(withinDays);
}

export function reportsSummary(from?: string, to?: string) {
  const db = getSqliteDb();
  const fromDate = from || '1970-01-01';
  const toDate = to || '2999-12-31';

  const cash_in = (db.prepare(`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_ledger
    WHERE status='POSTED' AND type='CASH_IN' AND entry_date BETWEEN ? AND ?
      AND COALESCE(entry_kind, 'treasury') != 'accrual'
  `).get(fromDate, toDate) as any).v;

  const cash_out = (db.prepare(`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_ledger
    WHERE status='POSTED' AND type IN ('EXPENSE','PURCHASE','SERVICE_SPEND','CASH_OUT')
      AND entry_date BETWEEN ? AND ?
      AND COALESCE(entry_kind, 'treasury') != 'accrual'
  `).get(fromDate, toDate) as any).v;

  const debt = supplierDebtSummary();
  const payroll_pending = (db.prepare(`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_staff_salaries WHERE status='PENDING'
  `).get() as any).v;
  const service_due = (db.prepare(`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_service_costs
    WHERE status='ACTIVE' AND next_due_date IS NOT NULL AND julianday(next_due_date) <= julianday('now') + 30
  `).get() as any).v;

  const net = Number(cash_in) - Number(cash_out);
  const balRow = db.prepare(`
    SELECT running_balance FROM finance_ledger WHERE status='POSTED'
    ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT 1
  `).get() as any;

  return {
    from: fromDate,
    to: toDate,
    cash_in: Number(cash_in),
    cash_out: Number(cash_out),
    supplier_debt: Number(debt.total_debt || 0),
    payroll_pending: Number(payroll_pending),
    service_due: Number(service_due),
    net,
    running_balance: balRow ? Number(balRow.running_balance) : 0,
    debt_detail: debt,
  };
}

/* ------------------------------------------------------------------ *
 * Client collections: money taken from a client, or drawn from the
 * credit that client already has on account with the agency.
 * ------------------------------------------------------------------ */

export type ClientPaymentSource =
  /** New money received and applied to a booking. */
  | 'INCOME'
  /** New money received and parked on the client's account, not yet applied. */
  | 'DEPOSIT'
  /** No new money: the client's existing credit is applied to a booking. */
  | 'CLIENT_ACCOUNT';

const CLIENT_SOURCES: ClientPaymentSource[] = ['INCOME', 'DEPOSIT', 'CLIENT_ACCOUNT'];

/** Clients are keyed by reservation customer id when known, else by name. */
function clientKey(code?: string | null, name?: string | null) {
  const c = String(code || '').trim();
  return c ? `code:${c}` : `name:${String(name || '').trim()}`;
}

function isClientPaymentVoid(status?: string | null) {
  return String(status || '').toUpperCase() === 'VOID';
}

export function isIncomeReceiptVoid(status?: string | null) {
  const s = String(status || '').trim();
  if (!s) return false;
  const u = s.toUpperCase();
  return u === 'VOID' || /ملغ/.test(s);
}

function reverseReservationPayment(reservationId: string, amount: number) {
  const db = getSqliteDb();
  const reservation = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  if (!reservation || !(amount > 0)) return;
  const total = Number(reservation.total_price) || 0;
  const paid = Math.max(0, (Number(reservation.paid_amount) || 0) - amount);
  const paymentStatus = paid <= 0 ? 'UNPAID' : paid >= total ? 'PAID' : 'PARTIALLY_PAID';
  let reservationStatus = String(reservation.reservation_status || '').toUpperCase();
  let deposit = Math.round(total * 0.3);
  try {
    const inv = reservation.invoice ? JSON.parse(String(reservation.invoice)) : null;
    if (inv?.depositAmount != null) deposit = Number(inv.depositAmount) || deposit;
  } catch {
    /* keep default */
  }
  // If deposit falls below the threshold, reopen accountant confirmation.
  if (['CONFIRMED', 'PAID', 'PARTIALLY_PAID'].includes(reservationStatus) && paid < deposit) {
    reservationStatus = 'PAYMENT_PENDING';
  } else if (reservationStatus === 'PAID' && paid < total && paid >= deposit) {
    reservationStatus = 'CONFIRMED';
  }
  db.prepare(
    'UPDATE reservations SET paid_amount = ?, payment_status = ?, reservation_status = ?, updated_at = ? WHERE reservation_id = ?'
  ).run(paid, paymentStatus, reservationStatus, new Date().toISOString(), reservationId);
}

export function listClientPayments(opts?: {
  reservation_id?: string;
  from?: string;
  to?: string;
  include_void?: boolean;
}) {
  const db = getSqliteDb();
  const rows = (
    opts?.reservation_id
      ? (db.prepare('SELECT * FROM finance_client_payments WHERE reservation_id = ?').all(opts.reservation_id) as any[])
      : (db.prepare('SELECT * FROM finance_client_payments').all() as any[])
  ).map((r) => ({
    id: r.id,
    reservation_id: r.reservation_id || '',
    customer_name: r.customer_name || '',
    customer_code: r.customer_code || '',
    package_name: r.package_name || '',
    amount: Number(r.amount) || 0,
    source_type: String(r.source_type || 'INCOME').toUpperCase(),
    method: r.method || '',
    account_id: r.account_id || '',
    entry_date: String(r.entry_date || '').slice(0, 10),
    note: r.note || '',
    ledger_id: r.ledger_id || '',
    receipt_id: r.receipt_id || '',
    status: isClientPaymentVoid(r.status) ? 'VOID' : 'POSTED',
  }));

  return rows
    .filter((r) => {
      if (!opts?.include_void && r.status === 'VOID') return false;
      if (opts?.from && r.entry_date < opts.from) return false;
      if (opts?.to && r.entry_date > opts.to) return false;
      return true;
    })
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
}

/** Soft-void a client payment: leave the row for audit, remove from totals/treasury. */
export function voidClientPayment(paymentId: string) {
  const db = getSqliteDb();
  const pay = db.prepare('SELECT * FROM finance_client_payments WHERE id = ?').get(paymentId) as any;
  if (!pay) throw new Error('الدفعة غير موجودة');
  if (isClientPaymentVoid(pay.status)) return { id: paymentId, deleted: true, already: true };

  const amount = Math.abs(Number(pay.amount) || 0);
  const source = String(pay.source_type || 'INCOME').toUpperCase();
  const run = db.transaction(() => {
    if (pay.ledger_id) {
      db.prepare(`UPDATE finance_ledger SET status = 'VOID' WHERE id = ?`).run(pay.ledger_id);
    }
    if (pay.receipt_id) {
      db.prepare(`UPDATE receipts SET status = ? WHERE id = ?`).run('ملغاة', pay.receipt_id);
    }
    if (pay.reservation_id && (source === 'INCOME' || source === 'CLIENT_ACCOUNT')) {
      reverseReservationPayment(String(pay.reservation_id), amount);
    }
    db.prepare(`UPDATE finance_client_payments SET status = 'VOID' WHERE id = ?`).run(paymentId);
  });
  run();
  recomputeRunningBalances();
  return { id: paymentId, deleted: true };
}

/** Soft-void an income receipt (سند). Reverses linked client payment / booking when present. */
export function voidIncomeReceipt(receiptId: string) {
  const db = getSqliteDb();
  const id = String(receiptId || '').trim();
  if (!id) throw new Error('معرّف السند مطلوب');
  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
  if (!receipt) throw new Error('السند غير موجود');
  if (isIncomeReceiptVoid(receipt.status)) return { id, deleted: true, already: true };

  const linked = db.prepare('SELECT id FROM finance_client_payments WHERE receipt_id = ?').all(id) as { id: string }[];
  if (linked.length) {
    for (const row of linked) voidClientPayment(row.id);
    return { id, deleted: true };
  }

  const amount = Math.abs(Number(receipt.paidAmount) || 0);
  const run = db.transaction(() => {
    db.prepare(`UPDATE receipts SET status = ? WHERE id = ?`).run('ملغاة', id);
    // Legacy fake “first payment after agency confirm” rows: undo booking paid amount.
    if (amount > 0) {
      const code = String(receipt.pilgrimCode || '').trim();
      const name = String(receipt.pilgrimName || '').trim();
      const pkg = String(receipt.packageName || '').trim();
      const reservation = (
        code
          ? db.prepare(
              `SELECT reservation_id FROM reservations
               WHERE customer_id = ? AND package_name = ?
               ORDER BY updated_at DESC LIMIT 1`
            ).get(code, pkg)
          : db.prepare(
              `SELECT reservation_id FROM reservations
               WHERE customer_name = ? AND package_name = ?
               ORDER BY updated_at DESC LIMIT 1`
            ).get(name, pkg)
      ) as { reservation_id?: string } | undefined;
      if (reservation?.reservation_id) {
        reverseReservationPayment(reservation.reservation_id, amount);
      }
    }
  });
  run();
  recomputeRunningBalances();
  return { id, deleted: true };
}

function ensureHiddenClientsTable(db: { exec: (sql: string) => unknown; prepare: (sql: string) => any }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_hidden_clients (
      client_key TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      hidden_at TEXT,
      hidden_by TEXT,
      status TEXT DEFAULT 'hidden'
    );
  `);
  try {
    const cols = (db.prepare('PRAGMA table_info(finance_hidden_clients)').all() as { name: string }[]).map(
      (c) => c.name
    );
    if (cols.length && !cols.includes('name')) db.exec('ALTER TABLE finance_hidden_clients ADD COLUMN name TEXT');
    if (cols.length && !cols.includes('code')) db.exec('ALTER TABLE finance_hidden_clients ADD COLUMN code TEXT');
    if (cols.length && !cols.includes('status')) {
      db.exec(`ALTER TABLE finance_hidden_clients ADD COLUMN status TEXT DEFAULT 'hidden'`);
    }
  } catch {
    /* older sqlite path */
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_purged_clients (
      client_key TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      purged_at TEXT,
      purged_by TEXT
    );
  `);
}

export function listHiddenIncomeClients() {
  const db = getSqliteDb();
  try {
    ensureHiddenClientsTable(db);
    return (
      db
        .prepare(
          `SELECT client_key, name, code, hidden_at, hidden_by, status
           FROM finance_hidden_clients
           WHERE IFNULL(status,'hidden') = 'hidden'`
        )
        .all() as any[]
    ).map((r) => ({
      key: String(r.client_key || ''),
      name: String(r.name || ''),
      code: String(r.code || ''),
      hidden_at: r.hidden_at || '',
      hidden_by: r.hidden_by || '',
    }));
  } catch {
    return [];
  }
}

export function listPurgedIncomeClientKeys() {
  const db = getSqliteDb();
  try {
    ensureHiddenClientsTable(db);
    return (db.prepare('SELECT client_key FROM finance_purged_clients').all() as { client_key?: string }[])
      .map((r) => String(r.client_key || ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function setIncomeClientHidden(
  clientKey: string,
  hidden: boolean,
  hiddenBy?: string | null,
  meta?: { name?: string | null; code?: string | null }
) {
  const db = getSqliteDb();
  ensureHiddenClientsTable(db);
  const key = String(clientKey || '').trim();
  if (!key) throw new Error('معرّف العميل مطلوب');
  if (hidden) {
    db.prepare(`
      INSERT INTO finance_hidden_clients (client_key, name, code, hidden_at, hidden_by, status)
      VALUES (?, ?, ?, ?, ?, 'hidden')
      ON CONFLICT(client_key) DO UPDATE SET
        name = COALESCE(NULLIF(excluded.name, ''), finance_hidden_clients.name),
        code = COALESCE(NULLIF(excluded.code, ''), finance_hidden_clients.code),
        hidden_at = excluded.hidden_at,
        hidden_by = excluded.hidden_by,
        status = 'hidden'
    `).run(
      key,
      String(meta?.name || '').trim(),
      String(meta?.code || '').trim(),
      new Date().toISOString(),
      hiddenBy || ''
    );
    // Restoring visibility path clears purge mark if present.
    db.prepare('DELETE FROM finance_purged_clients WHERE client_key = ?').run(key);
  } else {
    db.prepare('DELETE FROM finance_hidden_clients WHERE client_key = ?').run(key);
  }
  return { key, hidden, name: meta?.name || '', code: meta?.code || '' };
}

/** Hide list → permanent remove: void income docs and keep client out of both directories. */
export function purgeIncomeClient(
  clientKey: string,
  opts?: { name?: string | null; code?: string | null; purged_by?: string | null }
) {
  const db = getSqliteDb();
  ensureHiddenClientsTable(db);
  const key = String(clientKey || '').trim();
  if (!key) throw new Error('معرّف العميل مطلوب');

  const code = String(opts?.code || (key.startsWith('code:') ? key.slice(5) : '')).trim();
  const name = String(opts?.name || (key.startsWith('name:') ? key.slice(5) : '')).trim();

  const receiptIds = (
    code
      ? (db.prepare('SELECT id FROM receipts WHERE TRIM(IFNULL(pilgrimCode,\'\')) = ?').all(code) as { id: string }[])
      : (db
          .prepare('SELECT id FROM receipts WHERE lower(trim(IFNULL(pilgrimName,\'\'))) = lower(?)')
          .all(name) as { id: string }[])
  ).map((r) => r.id);

  for (const id of receiptIds) {
    try {
      voidIncomeReceipt(id);
    } catch {
      /* continue */
    }
  }

  const payIds = (
    code
      ? (db
          .prepare(
            `SELECT id FROM finance_client_payments
             WHERE TRIM(IFNULL(customer_code,'')) = ? AND IFNULL(status,'POSTED') != 'VOID'`
          )
          .all(code) as { id: string }[])
      : (db
          .prepare(
            `SELECT id FROM finance_client_payments
             WHERE lower(trim(IFNULL(customer_name,''))) = lower(?) AND IFNULL(status,'POSTED') != 'VOID'`
          )
          .all(name) as { id: string }[])
  ).map((r) => r.id);

  for (const id of payIds) {
    try {
      voidClientPayment(id);
    } catch {
      /* continue */
    }
  }

  db.prepare('DELETE FROM finance_hidden_clients WHERE client_key = ?').run(key);
  db.prepare(`
    INSERT INTO finance_purged_clients (client_key, name, code, purged_at, purged_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(client_key) DO UPDATE SET
      name = excluded.name,
      code = excluded.code,
      purged_at = excluded.purged_at,
      purged_by = excluded.purged_by
  `).run(key, name, code, new Date().toISOString(), opts?.purged_by || '');

  return { key, purged: true, voided_receipts: receiptIds.length, voided_payments: payIds.length };
}

/**
 * Credit the agency holds for a client: deposits paid in, less whatever has
 * already been drawn down against bookings.
 */
export function clientAccountBalance(opts: { customer_code?: string | null; customer_name?: string | null }) {
  const key = clientKey(opts.customer_code, opts.customer_name);
  const rows = listClientPayments().filter((r) => clientKey(r.customer_code, r.customer_name) === key);
  const deposits = rows.filter((r) => r.source_type === 'DEPOSIT').reduce((s, r) => s + r.amount, 0);
  const drawn = rows.filter((r) => r.source_type === 'CLIENT_ACCOUNT').reduce((s, r) => s + r.amount, 0);
  return { deposits, drawn, available: deposits - drawn };
}

/** Credit balances for every client that has any account movement. */
export function clientAccountBalances() {
  const map = new Map<string, { key: string; customer_name: string; customer_code: string; deposits: number; drawn: number; available: number }>();
  for (const r of listClientPayments()) {
    if (r.source_type === 'INCOME') continue;
    const key = clientKey(r.customer_code, r.customer_name);
    const entry = map.get(key) || {
      key,
      customer_name: r.customer_name,
      customer_code: r.customer_code,
      deposits: 0,
      drawn: 0,
      available: 0,
    };
    if (r.source_type === 'DEPOSIT') entry.deposits += r.amount;
    else entry.drawn += r.amount;
    entry.available = entry.deposits - entry.drawn;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.available - a.available);
}

/**
 * Record a client payment. `INCOME` and `DEPOSIT` are real cash arriving, so they
 * post a CASH_IN entry into the journal and the treasury account. `CLIENT_ACCOUNT`
 * moves no cash — it only draws down credit the client already paid in — so it is
 * deliberately kept out of the journal to avoid counting the same money twice.
 */
export function recordClientPayment(input: {
  reservation_id?: string | null;
  customer_name?: string | null;
  customer_code?: string | null;
  package_name?: string | null;
  amount: number;
  source: ClientPaymentSource;
  method?: string | null;
  account_id?: string | null;
  entry_date?: string;
  note?: string | null;
  created_by?: string | null;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('المبلغ مطلوب');
  const source = String(input.source || 'INCOME').toUpperCase() as ClientPaymentSource;
  if (!CLIENT_SOURCES.includes(source)) throw new Error('مصدر الدفعة غير مدعوم');

  const reservation = input.reservation_id
    ? (db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(input.reservation_id) as any)
    : null;
  if (input.reservation_id && !reservation) throw new Error('الحجز غير موجود');

  const customer_name = String(input.customer_name || reservation?.customer_name || '').trim();
  if (!customer_name) throw new Error('اسم العميل مطلوب');
  const customer_code = String(input.customer_code || reservation?.customer_id || '').trim();
  const package_name = String(input.package_name || reservation?.package_name || '').trim();
  const entry_date = (input.entry_date || todayISO()).slice(0, 10);

  if (source !== 'DEPOSIT') {
    if (!reservation) throw new Error('اختر الحجز الذي تُخصم منه الدفعة');
    const remaining = Math.max(
      0,
      (Number(reservation.total_price) || 0) - (Number(reservation.paid_amount) || 0)
    );
    if (amount > remaining) {
      throw new Error(`المبلغ يتجاوز المتبقي على الحجز (${Math.round(remaining)})`);
    }
  }

  if (source === 'CLIENT_ACCOUNT') {
    const { available } = clientAccountBalance({ customer_code, customer_name });
    if (amount > available) {
      throw new Error(`رصيد حساب العميل غير كافٍ (المتوفر ${Math.round(available)})`);
    }
  }

  const id = newId('cpay');
  let ledgerId: string | null = null;
  let receiptId: string | null = null;

  if (source === 'INCOME' || source === 'DEPOSIT') {
    const credit_scf = scfClientCollectionCredit(reservation);
    const invoice_total =
      source === 'DEPOSIT'
        ? amount
        : Math.max(0, Number(reservation?.total_price) || amount);
    const paid_before =
      source === 'DEPOSIT' ? 0 : Math.max(0, Number(reservation?.paid_amount) || 0);
    const description = formatClientCollectionJournalDescription({
      customer_name,
      package_name:
        source === 'DEPOSIT' ? 'إيداع في حساب العميل' : package_name || null,
      invoice_total,
      payment_amount: amount,
      paid_before,
      credit_scf,
      source,
    });
    const led = createLedgerEntry({
      type: 'CASH_IN',
      amount,
      description,
      entry_date,
      counterparty: customer_name,
      method: input.method || 'CASH',
      category: 'cash_in',
      account_id: input.account_id || null,
      ref_table: 'finance_client_payments',
      ref_id: id,
      created_by: input.created_by || null,
      status: 'POSTED',
    }) as any;
    ledgerId = led.id;

    // Mirror it as a receipt so it shows up in the incomes register.
    receiptId = `RCP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
    const billed = source === 'DEPOSIT' ? amount : Number(reservation?.total_price) || amount;
    const paidSoFar = source === 'DEPOSIT' ? amount : (Number(reservation?.paid_amount) || 0) + amount;
    db.prepare(`
      INSERT INTO receipts (
        id, pilgrimName, pilgrimCode, packageName, totalAmount, paidAmount,
        remainingAmount, paymentMethod, date, accountantName, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receiptId,
      customer_name,
      customer_code,
      source === 'DEPOSIT' ? 'إيداع في حساب العميل' : package_name || '—',
      billed,
      amount,
      Math.max(0, billed - paidSoFar),
      input.method || 'CASH',
      entry_date,
      input.created_by || '',
      source === 'DEPOSIT' ? 'إيداع' : billed - paidSoFar <= 0 ? 'خالص الدفع' : 'دفعة جزئية'
    );
  }

  db.prepare(`
    INSERT INTO finance_client_payments (
      id, reservation_id, customer_name, customer_code, package_name, amount,
      source_type, method, account_id, entry_date, note, ledger_id, receipt_id, created_by, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED')
  `).run(
    id, input.reservation_id || null, customer_name, customer_code, package_name, amount,
    source, input.method || null, input.account_id || null, entry_date, input.note || '',
    ledgerId, receiptId, input.created_by || null, new Date().toISOString()
  );

  // Applying money to a booking reduces what the client still owes.
  if (reservation && (source === 'INCOME' || source === 'CLIENT_ACCOUNT')) {
    const total = Number(reservation.total_price) || 0;
    const paid = (Number(reservation.paid_amount) || 0) + amount;
    const status = paid <= 0 ? 'UNPAID' : paid >= total ? 'PAID' : 'PARTIALLY_PAID';
    db.prepare(
      'UPDATE reservations SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE reservation_id = ?'
    ).run(paid, status, new Date().toISOString(), reservation.reservation_id);

    // Demand was accepted by admin earlier — accountant finishes confirmation with the deposit.
    try {
      const { completeConfirmationAfterDeposit } = require('@/lib/booking') as typeof import('@/lib/booking');
      completeConfirmationAfterDeposit(reservation.reservation_id, {
        name: input.created_by || 'المحاسب',
      });
    } catch {
      /* confirmation promotion is best-effort */
    }

    // SCF م2: if the trip/product has started, ensure 706 is on اليومية العامة.
    try {
      const refreshed = db
        .prepare(
          `SELECT reservation_id, customer_name, package_name, total_price, paid_amount,
                  reservation_status, program
           FROM reservations WHERE reservation_id = ?`
        )
        .get(reservation.reservation_id) as any;
      postClientRevenueRecognition(refreshed || { ...reservation, paid_amount: paid });
    } catch {
      /* revenue accrual is best-effort */
    }
  }

  return {
    id,
    source_type: source,
    amount,
    ledger_id: ledgerId,
    receipt_id: receiptId,
    reservation_id: input.reservation_id || null,
    client_account: clientAccountBalance({ customer_code, customer_name }),
  };
}

/** Open bookings with what is still owed, for the collection form. */
export function collectibleReservations() {
  const rows = getSqliteDb().prepare('SELECT * FROM reservations').all() as any[];
  const credits = new Map(clientAccountBalances().map((c) => [c.key, c.available]));

  return rows
    .filter((r) => !['CANCELLED', 'REJECTED'].includes(String(r.reservation_status || '').toUpperCase()))
    .map((r) => {
      const total = Number(r.total_price) || 0;
      const paid = Number(r.paid_amount) || 0;
      let depositDue = 0;
      try {
        const inv = r.invoice ? JSON.parse(String(r.invoice)) : null;
        depositDue = Number(inv?.depositAmount) || Math.round(total * 0.3);
      } catch {
        depositDue = Math.round(total * 0.3);
      }
      const status = String(r.reservation_status || '').toUpperCase();
      const awaiting_deposit = status === 'PAYMENT_PENDING' || (status === 'CONFIRMED' && paid <= 0);
      return {
        reservation_id: r.reservation_id,
        reference: r.reservation_number || '',
        customer_name: r.customer_name || '',
        customer_code: r.customer_id || '',
        customer_avatar: resolveClientAvatar(r.customer_id, r.customer_name),
        package_name: r.package_name || '',
        trip_type: classifyTripType(r.package_name),
        status,
        deposit_due: depositDue,
        awaiting_deposit,
        total,
        paid,
        remaining: Math.max(0, total - paid),
        credit_available: credits.get(clientKey(r.customer_id, r.customer_name)) || 0,
        date: String(r.created_at || '').slice(0, 10),
      };
    })
    .sort((a, b) => {
      if (a.awaiting_deposit !== b.awaiting_deposit) return a.awaiting_deposit ? -1 : 1;
      return b.remaining - a.remaining;
    });
}

/* ------------------------------------------------------------------ *
 * Treasury: the cash boxes and bank accounts the money actually sits in.
 * ------------------------------------------------------------------ */

const TREASURY_OUTFLOW = new Set(['EXPENSE', 'PURCHASE', 'SERVICE_SPEND', 'CASH_OUT']);
let treasuryOverviewBackfillDone = false;

/** Real cash movement — exclude supplier-invoice accruals (no treasury impact). */
function isPaidTreasuryLedgerRow(r: { entry_kind?: string | null }) {
  return String(r.entry_kind || 'treasury') !== 'accrual';
}

/** Default cash box for auto-posting supplier/service/payroll payments (512/53). */
export function defaultTreasuryAccountId(): string | null {
  const accounts = readTreasuryAccounts().filter((a) => a.status === 'ACTIVE');
  const cash = accounts.find((a) => a.kind === 'CASH');
  return (cash || accounts[0])?.id || null;
}

function resolveTreasuryAccountId(explicit?: string | null): string | null {
  const id = String(explicit || '').trim();
  if (id && readTreasuryAccounts().some((a) => a.id === id)) return id;
  return defaultTreasuryAccountId();
}

/** Pick an active treasury account from payment method (for legacy rows without account_id). */
function treasuryAccountIdForMethod(method?: string | null): string | null {
  const live = readTreasuryAccounts().filter((a) => a.status === 'ACTIVE');
  if (!live.length) return null;
  const pick = (kind: string) => live.find((a) => a.kind === kind)?.id;
  const m = String(method || '').trim().toUpperCase();
  if (m === 'CCP') return pick('CCP') || pick('BANK') || pick('CASH') || live[0].id;
  if (m === 'BANK_TRANSFER' || m === 'CHECK') return pick('BANK') || pick('CCP') || pick('CASH') || live[0].id;
  return pick('CASH') || pick('BANK') || live[0].id;
}

/** Assign account_id on posted treasury lines that were saved without a cash box / bank account. */
export function backfillLedgerTreasuryAccountIds() {
  const db = getSqliteDb();
  const rows = db
    .prepare(
      `SELECT id, method, entry_kind FROM finance_ledger
       WHERE status = 'POSTED' AND (account_id IS NULL OR TRIM(account_id) = '')`
    )
    .all() as { id: string; method?: string; entry_kind?: string }[];
  if (!rows.length) return { updated: 0 };
  const upd = db.prepare('UPDATE finance_ledger SET account_id = ? WHERE id = ?');
  let updated = 0;
  for (const r of rows) {
    if (!isPaidTreasuryLedgerRow(r)) continue;
    const aid = treasuryAccountIdForMethod(r.method);
    if (!aid) continue;
    upd.run(aid, r.id);
    updated += 1;
  }
  if (updated) recomputeRunningBalances();
  return { updated };
}

export type TreasuryCashFlowLine = {
  id: string;
  label: string;
  amount: number;
  kind: 'in' | 'out';
  scf_hint?: string;
  /** Portal section for drill-down from الملخص */
  section?: string;
  /** Query focus / treasury_flow id */
  focus?: string;
};

/** SCF — tableau des flux de trésorerie (méthode directe, opérations). */
export function treasuryCashFlowForPeriod(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const db = getSqliteDb();
  const rows = db.prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'").all() as any[];
  const inPeriod = rows.filter(
    (r) => isPaidTreasuryLedgerRow(r) && inRange(String(r.entry_date || '').slice(0, 10), from, to)
  );

  let client_in = 0;
  let supplier_out = 0;
  let service_out = 0;
  let payroll_out = 0;
  let other_out = 0;

  for (const r of inPeriod) {
    const type = String(r.type || '');
    const amt = Number(r.amount) || 0;
    if (!amt) continue;
    const cat = String(r.category || '');
    if (type === 'CASH_IN') {
      client_in += amt;
    } else if (type === 'PURCHASE') {
      supplier_out += amt;
    } else if (type === 'SERVICE_SPEND') {
      service_out += amt;
    } else if (type === 'CASH_OUT' && (cat === 'payroll_related' || cat === 'payroll')) {
      payroll_out += amt;
    } else if (TREASURY_OUTFLOW.has(type)) {
      other_out += amt;
    }
  }

  const total_out = supplier_out + service_out + payroll_out + other_out;
  const allLines: TreasuryCashFlowLine[] = [
    {
      id: 'client_in',
      label: 'تحصيلات من العملاء',
      amount: client_in,
      kind: 'in',
      scf_hint: '512/53 ← 411/419',
      section: 'receipts',
    },
    {
      id: 'supplier_out',
      label: 'مدفوعات الموردين',
      amount: supplier_out,
      kind: 'out',
      scf_hint: '401 → 512/53',
      section: 'treasury',
      focus: 'supplier_out',
    },
    {
      id: 'payroll_out',
      label: 'أجور ورواتب',
      amount: payroll_out,
      kind: 'out',
      scf_hint: '421 → 512/53',
      section: 'treasury',
      focus: 'payroll_out',
    },
    {
      id: 'service_out',
      label: 'خدمات دورية',
      amount: service_out,
      kind: 'out',
      scf_hint: '613/626 → 512/53',
      section: 'treasury',
      focus: 'service_out',
    },
    {
      id: 'other_out',
      label: 'مصاريف أخرى (خزينة)',
      amount: other_out,
      kind: 'out',
      scf_hint: '62x → 512/53',
      section: 'treasury',
      focus: 'other_out',
    },
  ];
  const lines = allLines.filter((l) => l.amount > 0);

  return {
    from,
    to,
    lines,
    total_in: client_in,
    total_out,
    net: client_in - total_out,
  };
}

/** Classify a posted ledger row into a treasury cash-flow bucket (direct method). */
export function treasuryLedgerRowMatchesFlow(type: string, category: string, flowId: string) {
  const cat = String(category || '');
  switch (flowId) {
    case 'client_in':
      return type === 'CASH_IN';
    case 'supplier_out':
      return type === 'PURCHASE';
    case 'service_out':
      return type === 'SERVICE_SPEND';
    case 'payroll_out':
      return type === 'CASH_OUT' && (cat === 'payroll_related' || cat === 'payroll');
    case 'other_out':
      return (
        type === 'EXPENSE' ||
        (type === 'CASH_OUT' && cat !== 'payroll_related' && cat !== 'payroll')
      );
    default:
      return false;
  }
}

export type TreasuryFlowMove = {
  id: string;
  entry_date: string;
  description: string;
  counterparty: string;
  amount: number;
  direction: 'in' | 'out';
  type: string;
  category: string;
  account_id: string;
  account_name: string;
  method: string;
  ref_id?: string;
  payment_id?: string;
  supplier_id?: string;
  supplier_code?: string;
  invoice_no?: string;
  detail_note?: string;
  customer_code?: string;
  package_name?: string;
  service_name?: string;
  staff_name?: string;
  period_label?: string;
};

function mapRowsByLedgerId<T extends { ledger_id?: string | null }>(rows: T[]) {
  const m = new Map<string, T>();
  for (const row of rows) {
    const lid = String(row.ledger_id || '').trim();
    if (lid) m.set(lid, row);
  }
  return m;
}

/** Paid treasury movements in period for one cash-flow line (drill-down from الملخص / الخزينة). */
export function treasuryFlowDetailMoves(fromInput?: string, toInput?: string, flowId?: string) {
  const id = String(flowId || '').trim();
  if (!id) return [] as TreasuryFlowMove[];
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const db = getSqliteDb();
  const accounts = readTreasuryAccounts();
  const accountById = new Map(accounts.map((a) => [a.id, a.name_ar]));
  const defaultAccountId = defaultTreasuryAccountId() || '';

  const supplierById = new Map(
    (db.prepare('SELECT id, code, name_ar FROM finance_suppliers').all() as any[]).map((s) => [s.id, s])
  );
  const invoiceNoById = new Map(
    (db.prepare('SELECT id, invoice_no FROM finance_supplier_invoices').all() as any[]).map((i) => [
      i.id,
      String(i.invoice_no || '').trim(),
    ])
  );

  let supplierPayByLedger = new Map<string, any>();
  let clientPayByLedger = new Map<string, any>();
  let servicePayByLedger = new Map<string, any>();
  let salaryByLedger = new Map<string, any>();
  const serviceNameById = new Map<string, string>();

  if (id === 'supplier_out') {
    supplierPayByLedger = mapRowsByLedgerId(
      db.prepare('SELECT * FROM finance_supplier_payments').all() as any[]
    );
  } else if (id === 'client_in') {
    clientPayByLedger = mapRowsByLedgerId(
      db.prepare('SELECT * FROM finance_client_payments').all() as any[]
    );
  } else if (id === 'service_out') {
    servicePayByLedger = mapRowsByLedgerId(
      db.prepare('SELECT * FROM finance_service_payments').all() as any[]
    );
    for (const s of db.prepare('SELECT id, name_ar FROM finance_service_costs').all() as any[]) {
      serviceNameById.set(s.id, s.name_ar);
    }
  } else if (id === 'payroll_out') {
    salaryByLedger = mapRowsByLedgerId(db.prepare('SELECT * FROM finance_staff_salaries').all() as any[]);
  }

  const rows = (db.prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'").all() as any[]).filter(
    (r) =>
      isPaidTreasuryLedgerRow(r) &&
      inRange(String(r.entry_date || '').slice(0, 10), from, to) &&
      treasuryLedgerRowMatchesFlow(String(r.type || ''), String(r.category || ''), id)
  );

  const moves = rows.map((r) => {
    const ledgerId = r.id;
    const accountId = String(r.account_id || defaultAccountId || '').trim();
    const account_name = accountId
      ? accountById.get(accountId) || '—'
      : 'غير مخصص لحساب خزينة';
    const base: TreasuryFlowMove = {
      id: ledgerId,
      entry_date: String(r.entry_date || '').slice(0, 10),
      description: String(r.description || '').trim(),
      counterparty: String(r.counterparty || '').trim(),
      amount: Number(r.amount) || 0,
      direction: r.direction === 'in' ? 'in' : 'out',
      type: String(r.type || ''),
      category: String(r.category || ''),
      account_id: accountId,
      account_name,
      method: String(r.method || '').trim(),
      ref_id: r.ref_id ? String(r.ref_id) : undefined,
    };

    if (id === 'supplier_out') {
      const pay = supplierPayByLedger.get(ledgerId);
      if (pay) {
        const sup = supplierById.get(pay.supplier_id);
        base.payment_id = pay.id;
        base.supplier_id = pay.supplier_id;
        base.supplier_code = sup?.code ? String(sup.code) : undefined;
        if (sup?.name_ar) base.counterparty = String(sup.name_ar);
        const invNo = pay.invoice_id ? invoiceNoById.get(pay.invoice_id) : '';
        if (invNo) base.invoice_no = invNo;
        base.detail_note = String(pay.note || '').trim() || undefined;
        if (!base.method) base.method = String(pay.method || '').trim();
      }
    } else if (id === 'client_in') {
      const pay = clientPayByLedger.get(ledgerId);
      if (pay) {
        base.payment_id = pay.id;
        if (pay.customer_name) base.counterparty = String(pay.customer_name);
        base.customer_code = pay.customer_code ? String(pay.customer_code) : undefined;
        base.package_name = pay.package_name ? String(pay.package_name) : undefined;
        base.detail_note = String(pay.note || '').trim() || undefined;
        if (!base.method) base.method = String(pay.method || '').trim();
      }
    } else if (id === 'service_out') {
      const pay = servicePayByLedger.get(ledgerId);
      if (pay) {
        base.payment_id = pay.id;
        base.service_name = serviceNameById.get(pay.service_id) || undefined;
        base.detail_note = String(pay.note || '').trim() || undefined;
        if (!base.method) base.method = String(pay.method || '').trim();
      }
    } else if (id === 'payroll_out') {
      const sal = salaryByLedger.get(ledgerId);
      if (sal) {
        base.payment_id = sal.id;
        base.staff_name = String(sal.staff_name || '').trim() || undefined;
        if (base.staff_name) base.counterparty = base.staff_name;
        const y = Number(sal.period_year);
        const mo = Number(sal.period_month);
        if (y && mo) base.period_label = `${y}-${String(mo).padStart(2, '0')}`;
        base.detail_note = String(sal.note || '').trim() || undefined;
      }
    }

    return base;
  });

  return moves.sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
}

export type TreasuryAccountMove = {
  id: string;
  entry_date: string;
  description: string;
  counterparty: string;
  amount: number;
  direction: 'in' | 'out';
  type: string;
  method: string;
  category: string;
};

/** Paid treasury movements for one cash/bank account in a period (account drill-down). */
export function treasuryAccountDetailMoves(
  accountIdInput?: string,
  fromInput?: string,
  toInput?: string
) {
  const accountId = String(accountIdInput || '').trim();
  if (!accountId) return [] as TreasuryAccountMove[];
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const db = getSqliteDb();
  const unassigned = accountId === 'unassigned';
  return (db.prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'").all() as any[])
    .filter(
      (r) =>
        isPaidTreasuryLedgerRow(r) &&
        (unassigned ? !String(r.account_id || '').trim() : String(r.account_id || '') === accountId) &&
        inRange(String(r.entry_date || '').slice(0, 10), from, to)
    )
    .map((r) => ({
      id: r.id,
      entry_date: String(r.entry_date || '').slice(0, 10),
      description: String(r.description || '').trim(),
      counterparty: String(r.counterparty || '').trim(),
      amount: Number(r.amount) || 0,
      direction: r.direction === 'in' ? ('in' as const) : ('out' as const),
      type: String(r.type || ''),
      method: String(r.method || '').trim(),
      category: String(r.category || ''),
    }))
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
}

export type TreasuryAccount = {
  id: string;
  name_ar: string;
  kind: string;
  bank_name: string;
  account_no: string;
  opening_balance: number;
  currency: string;
  status: string;
  note: string;
};

function readTreasuryAccounts(): TreasuryAccount[] {
  const rows = getSqliteDb().prepare('SELECT * FROM finance_treasury_accounts').all() as any[];
  return rows
    .map((r) => ({
      id: r.id,
      name_ar: r.name_ar,
      kind: normalizeTreasuryKind(r.kind),
      bank_name: r.bank_name || '',
      account_no: r.account_no || '',
      opening_balance: Number(r.opening_balance) || 0,
      currency: r.currency || 'DZD',
      status: String(r.status || 'ACTIVE').toUpperCase(),
      note: r.note || '',
    }))
    .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
}

export function createTreasuryAccount(input: {
  name_ar: string;
  kind?: string;
  bank_name?: string;
  account_no?: string;
  opening_balance?: number;
  note?: string;
  status?: string;
}) {
  const name = String(input.name_ar || '').trim();
  if (!name) throw new Error('اسم الحساب مطلوب');
  const id = newId('trz');
  getSqliteDb().prepare(`
    INSERT INTO finance_treasury_accounts (
      id, name_ar, kind, bank_name, account_no, opening_balance, currency, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'DZD', ?, ?, ?)
  `).run(
    id, name, normalizeTreasuryKind(input.kind), input.bank_name || '', input.account_no || '',
    Number(input.opening_balance) || 0, (input.status || 'ACTIVE').toUpperCase(),
    input.note || '', new Date().toISOString()
  );
  return readTreasuryAccounts().find((a) => a.id === id) || null;
}

export function updateTreasuryAccount(id: string, patch: {
  name_ar?: string;
  kind?: string;
  bank_name?: string;
  account_no?: string;
  opening_balance?: number;
  note?: string;
  status?: string;
}) {
  const db = getSqliteDb();
  if (!db.prepare('SELECT id FROM finance_treasury_accounts WHERE id = ?').get(id)) {
    throw new Error('الحساب غير موجود');
  }
  const sets: string[] = [];
  const params: any[] = [];
  const set = (col: string, value: any) => { sets.push(`${col} = ?`); params.push(value); };

  if (patch.name_ar !== undefined) {
    const name = String(patch.name_ar).trim();
    if (!name) throw new Error('اسم الحساب مطلوب');
    set('name_ar', name);
  }
  if (patch.kind !== undefined) set('kind', normalizeTreasuryKind(patch.kind));
  if (patch.bank_name !== undefined) set('bank_name', String(patch.bank_name).trim());
  if (patch.account_no !== undefined) set('account_no', String(patch.account_no).trim());
  if (patch.note !== undefined) set('note', String(patch.note).trim());
  if (patch.opening_balance !== undefined) set('opening_balance', Number(patch.opening_balance) || 0);
  if (patch.status !== undefined) {
    const status = String(patch.status).toUpperCase();
    if (!['ACTIVE', 'CLOSED'].includes(status)) throw new Error('حالة الحساب غير مدعومة');
    set('status', status);
  }
  if (!sets.length) throw new Error('لا توجد حقول للتحديث');
  db.prepare(`UPDATE finance_treasury_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  return readTreasuryAccounts().find((a) => a.id === id) || null;
}

export function deleteTreasuryAccount(id: string) {
  const db = getSqliteDb();
  const used = db
    .prepare('SELECT COUNT(*) as n FROM finance_ledger WHERE account_id = ?')
    .get(id) as any;
  if (Number(used?.n) > 0) {
    throw new Error('لا يمكن حذف حساب له حركات — أغلقه بدلاً من ذلك');
  }
  if (!db.prepare('SELECT id FROM finance_treasury_accounts WHERE id = ?').get(id)) {
    throw new Error('الحساب غير موجود');
  }
  db.prepare('DELETE FROM finance_treasury_accounts WHERE id = ?').run(id);
  return { id };
}

/**
 * Balance per cash box / bank account, plus the movements that produced it.
 * Movements booked before accounts existed carry no account_id and are reported
 * separately as "غير مخصص" instead of being silently folded into a real account.
 */
export function treasuryOverview(opts?: {
  from?: string;
  to?: string;
  flow?: string;
  account?: string;
}) {
  if (!treasuryOverviewBackfillDone) {
    backfillLedgerTreasuryAccountIds();
    treasuryOverviewBackfillDone = true;
  }
  const db = getSqliteDb();
  const accounts = readTreasuryAccounts();
  const ledger = (db.prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'").all() as any[])
    .filter((r) => isPaidTreasuryLedgerRow(r))
    .map((r) => ({
      id: r.id,
      account_id: r.account_id || '',
      type: String(r.type),
      amount: Number(r.amount) || 0,
      entry_date: String(r.entry_date || '').slice(0, 10),
      description: r.description || '',
      counterparty: r.counterparty || '',
      method: r.method || '',
      category: r.category || 'other',
      direction: r.direction === 'in' ? 'in' : 'out',
    }))
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));

  const within = (d: string) => {
    if (opts?.from && d < opts.from) return false;
    if (opts?.to && d > opts.to) return false;
    return true;
  };

  const rowsFor = (accountId: string) => ledger.filter((r) => r.account_id === accountId);

  const beforePeriod = (d: string) => Boolean(opts?.from && d < opts.from);

  const decorated = accounts.map((acc) => {
    const rows = rowsFor(acc.id);
    const inflow = rows.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0);
    const outflow = rows.filter((r) => TREASURY_OUTFLOW.has(r.type)).reduce((s, r) => s + r.amount, 0);
    const periodRows = rows.filter((r) => within(r.entry_date));
    const rowsBefore = rows.filter((r) => beforePeriod(r.entry_date));
    const inBefore = rowsBefore.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0);
    const outBefore = rowsBefore.filter((r) => TREASURY_OUTFLOW.has(r.type)).reduce((s, r) => s + r.amount, 0);
    const period_inflow = periodRows.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0);
    const period_outflow = periodRows.filter((r) => TREASURY_OUTFLOW.has(r.type)).reduce((s, r) => s + r.amount, 0);
    const period_opening = acc.opening_balance + inBefore - outBefore;
    const period_closing = period_opening + period_inflow - period_outflow;
    return {
      ...acc,
      balance: acc.opening_balance + inflow - outflow,
      inflow,
      outflow,
      movements_count: rows.length,
      period_opening,
      period_inflow,
      period_outflow,
      period_closing,
      last_movement: rows[0]?.entry_date || '',
      recent: periodRows.slice(0, 40),
    };
  });

  const unassigned = ledger.filter((r) => !r.account_id);
  const unassignedInflow = unassigned.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0);
  const unassignedOutflow = unassigned.filter((r) => TREASURY_OUTFLOW.has(r.type)).reduce((s, r) => s + r.amount, 0);
  const unassignedPeriod = unassigned.filter((r) => within(r.entry_date));
  const unassigned_period_inflow = unassignedPeriod
    .filter((r) => r.type === 'CASH_IN')
    .reduce((s, r) => s + r.amount, 0);
  const unassigned_period_outflow = unassignedPeriod
    .filter((r) => TREASURY_OUTFLOW.has(r.type))
    .reduce((s, r) => s + r.amount, 0);
  const unassignedBefore = unassigned.filter((r) => beforePeriod(r.entry_date));
  const unassigned_opening =
    unassignedBefore.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0) -
    unassignedBefore.filter((r) => TREASURY_OUTFLOW.has(r.type)).reduce((s, r) => s + r.amount, 0);

  const live = decorated.filter((a) => a.status === 'ACTIVE');
  const sumKind = (kinds: string[]) =>
    live.filter((a) => kinds.includes(a.kind)).reduce((s, a) => s + a.balance, 0);
  const sumField = (field: 'period_opening' | 'period_inflow' | 'period_outflow' | 'period_closing') =>
    live.reduce((s, a) => s + (Number((a as any)[field]) || 0), 0);

  const period_opening = sumField('period_opening') + (opts?.from ? unassigned_opening : 0);
  const period_inflow = sumField('period_inflow') + unassigned_period_inflow;
  const period_outflow = sumField('period_outflow') + unassigned_period_outflow;
  const period_closing = period_opening + period_inflow - period_outflow;

  const unassigned_period_closing =
    opts?.from != null
      ? unassigned_opening + unassigned_period_inflow - unassigned_period_outflow
      : undefined;

  const sumAccountsClosing = sumField('period_closing') + (unassigned_period_closing ?? 0);
  const sumAccountsOpening = sumField('period_opening') + (opts?.from ? unassigned_opening : 0);

  const cash_flow =
    opts?.from && opts?.to ? treasuryCashFlowForPeriod(opts.from, opts.to) : undefined;
  const flowParam = String(opts?.flow || '').trim();
  const TREASURY_FLOW_IDS = ['client_in', 'supplier_out', 'service_out', 'payroll_out', 'other_out'] as const;
  const flow_moves =
    opts?.from && opts?.to && flowParam && flowParam !== 'all'
      ? treasuryFlowDetailMoves(opts.from, opts.to, flowParam)
      : undefined;
  const all_flow_moves =
    opts?.from && opts?.to && flowParam === 'all'
      ? Object.fromEntries(
          TREASURY_FLOW_IDS.map((fid) => [fid, treasuryFlowDetailMoves(opts.from!, opts.to!, fid)])
        )
      : undefined;

  const accountId = String(opts?.account || '').trim();
  let selected_account = accountId ? decorated.find((a) => a.id === accountId) || null : null;
  if (accountId === 'unassigned' && unassigned.length > 0) {
    selected_account = {
      id: 'unassigned',
      name_ar: 'حركات غير مخصّصة لحساب',
      kind: 'OTHER',
      bank_name: '',
      account_no: '',
      opening_balance: 0,
      currency: 'DZD',
      status: 'ACTIVE',
      note: '',
      balance: unassignedInflow - unassignedOutflow,
      inflow: unassignedInflow,
      outflow: unassignedOutflow,
      movements_count: unassigned.length,
      period_opening: unassigned_opening,
      period_inflow: unassigned_period_inflow,
      period_outflow: unassigned_period_outflow,
      period_closing: unassigned_period_closing ?? 0,
      last_movement: unassigned[0]?.entry_date || '',
      recent: unassignedPeriod.slice(0, 40),
    } as (typeof decorated)[0];
  }
  const account_moves =
    accountId && opts?.from && opts?.to
      ? treasuryAccountDetailMoves(accountId, opts.from, opts.to)
      : undefined;

  return {
    accounts: decorated,
    cash_total: sumKind(['CASH']),
    bank_total: sumKind(['BANK', 'CCP']),
    ccp_total: sumKind(['CCP']),
    bank_only_total: sumKind(['BANK']),
    other_total: sumKind(['OTHER']),
    kind_totals: {
      CASH: sumKind(['CASH']),
      BANK: sumKind(['BANK']),
      CCP: sumKind(['CCP']),
      OTHER: sumKind(['OTHER']),
    },
    total: live.reduce((s, a) => s + a.balance, 0) + (unassignedInflow - unassignedOutflow),
    period_opening,
    period_inflow,
    period_outflow,
    period_closing,
    accounts_period_totals: {
      opening: sumAccountsOpening,
      inflow: period_inflow,
      outflow: period_outflow,
      closing: sumAccountsClosing,
    },
    accounts_count: live.length,
    cash_flow,
    flow_moves,
    all_flow_moves,
    selected_account,
    account_moves,
    unassigned: {
      balance: unassignedInflow - unassignedOutflow,
      inflow: unassignedInflow,
      outflow: unassignedOutflow,
      period_opening: opts?.from != null ? unassigned_opening : undefined,
      period_inflow: unassigned_period_inflow,
      period_outflow: unassigned_period_outflow,
      period_closing: unassigned_period_closing,
      count: unassigned.length,
      recent: unassigned.filter((r) => within(r.entry_date)).slice(0, 40),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Daily journal: the cash book an accountant reads, debit vs credit.
 * ------------------------------------------------------------------ */

/**
 * Cash-book convention: money received is a debit (مدين) to the treasury,
 * money paid out is a credit (دائن). Days are returned newest-first while the
 * running balance is accumulated oldest-first so it reads like a real journal.
 */
export function dailyJournal(opts?: { from?: string; to?: string; category?: string; q?: string }) {
  dedupeSupplierInvoiceLedger();
  ensureClientRevenueRecognitions();
  const db = getSqliteDb();
  const accounts = readTreasuryAccounts();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const defaultTreasuryId = defaultTreasuryAccountId();

  const supplierInvoiceForJournal = (invoiceId: string) => {
    const inv = db
      .prepare(
        `SELECT supplier_id, amount, amount_ht, discount, tax_amount, detail_json
         FROM finance_supplier_invoices WHERE id = ?`
      )
      .get(invoiceId) as
      | {
          supplier_id?: string;
          amount?: number;
          amount_ht?: number | null;
          discount?: number | null;
          tax_amount?: number | null;
          detail_json?: string | null;
        }
      | undefined;
    if (!inv?.supplier_id) return null;
    const sup = db.prepare('SELECT category FROM finance_suppliers WHERE id = ?').get(inv.supplier_id) as
      | { category?: string }
      | undefined;
    return {
      expense: scfCodeForSupplierCategory(sup?.category || 'other'),
      parts: supplierInvoiceJournalParts(inv),
    };
  };

  const clientPaymentForJournal = (paymentId: string) => {
    const pay = db
      .prepare(
        `SELECT reservation_id, customer_name, package_name, amount, source_type, entry_date
         FROM finance_client_payments WHERE id = ?`
      )
      .get(paymentId) as
      | {
          reservation_id?: string | null;
          customer_name?: string | null;
          package_name?: string | null;
          amount?: number;
          source_type?: string | null;
          entry_date?: string | null;
        }
      | undefined;
    if (!pay) return null;
    const reservation = pay.reservation_id
      ? (db
          .prepare(
            `SELECT reservation_id, customer_name, package_name, total_price, paid_amount,
                    reservation_status, program
             FROM reservations WHERE reservation_id = ?`
          )
          .get(pay.reservation_id) as any)
      : null;
    const credit_scf = scfClientCollectionCredit(reservation);
    const invoice_total = Math.max(
      0,
      Number(reservation?.total_price) || Number(pay.amount) || 0
    );
    const payment_amount = Math.max(0, Number(pay.amount) || 0);
    // Approximate paid-before for display: current paid minus this payment (floor 0).
    const paidNow = Math.max(0, Number(reservation?.paid_amount) || 0);
    const paid_before = Math.max(0, paidNow - payment_amount);
    const description = formatClientCollectionJournalDescription({
      customer_name: String(pay.customer_name || reservation?.customer_name || '').trim(),
      package_name:
        String(pay.source_type || '').toUpperCase() === 'DEPOSIT'
          ? 'إيداع في حساب العميل'
          : String(pay.package_name || reservation?.package_name || '').trim() || null,
      invoice_total: String(pay.source_type || '').toUpperCase() === 'DEPOSIT' ? payment_amount : invoice_total,
      payment_amount,
      paid_before,
      credit_scf,
      source: pay.source_type || 'INCOME',
    });
    return { credit_scf, description };
  };

  const all = (db.prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'").all() as any[]).map((r) => {
    const accountId = r.account_id || defaultTreasuryId || '';
    const acct = accountById.get(accountId);
    const treasury_scf = treasuryScfFromKind(acct?.kind);
    const entry_kind = String(r.entry_kind || 'treasury');
    const direction = r.direction === 'in' ? ('in' as const) : ('out' as const);
    const amount = Number(r.amount) || 0;
    const ref_table = r.ref_table || null;
    const invoiceJournal =
      ref_table === 'finance_supplier_invoices' && r.ref_id
        ? supplierInvoiceForJournal(String(r.ref_id))
        : null;
    const clientJournal =
      ref_table === 'finance_client_payments' && r.ref_id
        ? clientPaymentForJournal(String(r.ref_id))
        : null;
    const revenueJournal =
      ref_table === 'finance_client_revenue' && r.ref_id
        ? (() => {
            const reservation = db
              .prepare(
                `SELECT customer_name, package_name, total_price, paid_amount, program
                 FROM reservations WHERE reservation_id = ?`
              )
              .get(String(r.ref_id)) as any;
            if (!reservation) {
              return {
                parts: { invoice: amount, advances: 0 },
                description: r.description || '',
              };
            }
            const invoice = Math.max(0, Number(reservation.total_price) || amount);
            const entryDate = String(r.entry_date || '').slice(0, 10);
            const paidByRecognition = (
              db
                .prepare(
                  `SELECT COALESCE(SUM(amount), 0) AS v FROM finance_client_payments
                   WHERE reservation_id = ? AND status = 'POSTED'
                     AND source_type IN ('INCOME', 'CLIENT_ACCOUNT')
                     AND substr(entry_date, 1, 10) <= ?`
                )
                .get(String(r.ref_id), entryDate) as { v?: number }
            )?.v;
            const advances = Math.min(
              invoice,
              Math.max(0, Number(paidByRecognition) || Number(reservation.paid_amount) || 0)
            );
            return {
              parts: { invoice, advances },
              description: formatClientRevenueJournalDescription({
                customer_name: String(reservation.customer_name || r.counterparty || '').trim(),
                package_name: reservation.package_name,
                invoice_total: invoice,
                advances,
              }),
            };
          })()
        : null;
    const postings = buildLedgerPostings({
      type: String(r.type),
      direction,
      amount,
      category: r.category || 'other',
      ref_table,
      entry_kind,
      treasury_scf,
      treasury_name: acct?.name_ar || '',
      supplier_scf_expense: invoiceJournal?.expense || null,
      invoice_parts: invoiceJournal?.parts || null,
      client_scf_credit: clientJournal?.credit_scf || null,
      client_revenue_parts: revenueJournal?.parts || null,
    });
    return {
      id: r.id,
      type: String(r.type),
      direction,
      amount,
      description: clientJournal?.description || revenueJournal?.description || r.description || '',
      counterparty: r.counterparty || '',
      method: r.method || '',
      category: r.category || 'other',
      entry_date: String(r.entry_date || '').slice(0, 10),
      created_at: String(r.created_at || ''),
      entry_kind,
      account_id: accountId,
      account_name: acct?.name_ar || '',
      postings,
      accounts_summary: formatPostingsSummary(postings),
    };
  });

  const needle = String(opts?.q || '').trim().toLowerCase();
  const rows = all
    .filter((r) => {
      if (opts?.from && r.entry_date < opts.from) return false;
      if (opts?.to && r.entry_date > opts.to) return false;
      if (opts?.category && opts.category !== 'all' && r.category !== opts.category) return false;
      if (!needle) return true;
      return (
        r.description.toLowerCase().includes(needle) ||
        r.counterparty.toLowerCase().includes(needle) ||
        r.account_name.toLowerCase().includes(needle) ||
        r.type.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });

  // Opening balance = everything posted strictly before the window.
  const cashDelta = (r: (typeof all)[0]) =>
    r.entry_kind === 'accrual' ? 0 : r.direction === 'in' ? r.amount : -r.amount;

  const opening = all
    .filter((r) => (opts?.from ? r.entry_date < opts.from : false))
    .reduce((s, r) => s + cashDelta(r), 0);

  let balance = opening;
  const byDay = new Map<string, any[]>();
  for (const r of rows) {
    let debit = r.direction === 'in' ? r.amount : 0;
    let credit = r.direction === 'in' ? 0 : r.amount;
    if (r.entry_kind === 'accrual' && r.postings?.length) {
      debit = r.postings.reduce((s: number, p: { debit: number }) => s + p.debit, 0);
      credit = r.postings.reduce((s: number, p: { credit: number }) => s + p.credit, 0);
    }
    balance += cashDelta(r);
    const day = byDay.get(r.entry_date) || [];
    day.push({ ...r, debit, credit, balance });
    byDay.set(r.entry_date, day);
  }

  const days = [...byDay.entries()]
    .map(([date, lines]) => ({
      date,
      lines,
      debit: lines.reduce((s, l) => s + l.debit, 0),
      credit: lines.reduce((s, l) => s + l.credit, 0),
      net: lines.reduce((s, l) => s + l.debit - l.credit, 0),
      closing: lines[lines.length - 1].balance,
      count: lines.length,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalDebit = rows.reduce(
    (s, r) => s + (r.entry_kind === 'accrual' ? 0 : r.direction === 'in' ? r.amount : 0),
    0
  );
  const totalCredit = rows.reduce(
    (s, r) => s + (r.entry_kind === 'accrual' ? 0 : r.direction === 'in' ? 0 : r.amount),
    0
  );

  return {
    days,
    opening,
    total_debit: totalDebit,
    total_credit: totalCredit,
    net: totalDebit - totalCredit,
    closing: opening + totalDebit - totalCredit,
    count: rows.length,
    accounts: accounts.map((a) => ({ id: a.id, name_ar: a.name_ar, kind: a.kind })),
  };
}

/* ------------------------------------------------------------------ *
 * Capital assets (investments): vehicles, equipment, property.
 * ------------------------------------------------------------------ */

export type AssetStatus = 'ACTIVE' | 'SOLD' | 'RETIRED';

export type DecoratedAsset = {
  id: string;
  name_ar: string;
  category: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchase_date: string;
  supplier: string;
  useful_life_years: number;
  status: string;
  note: string;
  age_years: number;
  accumulated_depreciation: number;
  net_book_value: number;
};

/** Straight-line depreciation; retired/sold items carry no remaining book value. */
function decorateAsset(row: any): DecoratedAsset {
  const total = Number(row.total_cost) || 0;
  const life = Number(row.useful_life_years) || assetCategoryLife(row.category);
  const purchase = String(row.purchase_date || '').slice(0, 10);
  const ageYears = purchase ? Math.max(0, daysBetween(purchase, todayISO()) / 365.25) : 0;
  const worn = life > 0 ? Math.min(1, ageYears / life) : 1;
  const active = String(row.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  const accumulated = active ? total * worn : total;
  return {
    id: row.id,
    name_ar: row.name_ar,
    category: normalizeAssetCategory(row.category),
    quantity: Number(row.quantity) || 1,
    unit_cost: Number(row.unit_cost) || 0,
    total_cost: total,
    purchase_date: purchase,
    supplier: row.supplier || '',
    useful_life_years: life,
    status: String(row.status || 'ACTIVE').toUpperCase(),
    note: row.note || '',
    age_years: Math.round(ageYears * 10) / 10,
    accumulated_depreciation: Math.round(accumulated),
    net_book_value: active ? Math.round(total - accumulated) : 0,
  };
}

export function listAssets(opts?: { category?: string; status?: string }): DecoratedAsset[] {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts?.category) { where.push("COALESCE(category,'other') = ?"); params.push(opts.category); }
  if (opts?.status) { where.push('UPPER(status) = ?'); params.push(opts.status.toUpperCase()); }
  const rows = db.prepare(`
    SELECT * FROM finance_assets
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `).all(...params) as any[];
  // Dates are encrypted at rest, so newest-first has to be resolved after decryption.
  return rows.map(decorateAsset).sort((a, b) => (a.purchase_date < b.purchase_date ? 1 : -1));
}

export function getAsset(id: string): DecoratedAsset | null {
  const row = getSqliteDb().prepare('SELECT * FROM finance_assets WHERE id = ?').get(id) as any;
  return row ? decorateAsset(row) : null;
}

export function createAsset(input: {
  name_ar: string;
  category?: string;
  quantity?: number;
  unit_cost: number;
  purchase_date?: string;
  supplier?: string;
  useful_life_years?: number;
  status?: string;
  note?: string;
  /** Post the purchase as a cash outflow so the ledger reflects the spend. */
  post_to_ledger?: boolean;
  method?: PaymentMethod;
  created_by?: string;
}) {
  const db = getSqliteDb();
  const name = String(input.name_ar || '').trim();
  if (!name) throw new Error('اسم الأصل مطلوب');
  const unit = Math.abs(Number(input.unit_cost) || 0);
  if (!unit) throw new Error('قيمة الوحدة مطلوبة');
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
  const category = normalizeAssetCategory(input.category);
  const total = unit * quantity;
  const purchase_date = input.purchase_date || todayISO();
  const life = Number(input.useful_life_years) || assetCategoryLife(category);
  const id = newId('ast');

  db.prepare(`
    INSERT INTO finance_assets (
      id, name_ar, category, quantity, unit_cost, total_cost, purchase_date,
      supplier, useful_life_years, status, note, ledger_id, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    id, name, category, quantity, unit, total, purchase_date,
    input.supplier || '', life, (input.status || 'ACTIVE').toUpperCase(),
    input.note || '', input.created_by || null, new Date().toISOString()
  );

  if (input.post_to_ledger) {
    const led = createLedgerEntry({
      type: 'CASH_OUT',
      amount: total,
      description: `شراء أصل: ${name}${quantity > 1 ? ` ×${quantity}` : ''}`,
      entry_date: purchase_date,
      counterparty: input.supplier || null,
      method: input.method || 'CASH',
      category: 'capex',
      ref_table: 'finance_assets',
      ref_id: id,
      created_by: input.created_by || null,
      status: 'POSTED',
    }) as any;
    db.prepare('UPDATE finance_assets SET ledger_id = ? WHERE id = ?').run(led.id, id);
  }

  return getAsset(id);
}

export function updateAsset(id: string, patch: {
  name_ar?: string;
  category?: string;
  quantity?: number;
  unit_cost?: number;
  purchase_date?: string;
  supplier?: string;
  useful_life_years?: number;
  status?: string;
  note?: string;
}) {
  const db = getSqliteDb();
  const current = db.prepare('SELECT * FROM finance_assets WHERE id = ?').get(id) as any;
  if (!current) throw new Error('الأصل غير موجود');

  const sets: string[] = [];
  const params: any[] = [];
  const set = (col: string, value: any) => { sets.push(`${col} = ?`); params.push(value); };

  if (patch.name_ar !== undefined) {
    const name = String(patch.name_ar).trim();
    if (!name) throw new Error('اسم الأصل مطلوب');
    set('name_ar', name);
  }
  if (patch.category !== undefined) set('category', normalizeAssetCategory(patch.category));
  if (patch.supplier !== undefined) set('supplier', String(patch.supplier).trim());
  if (patch.note !== undefined) set('note', String(patch.note).trim());
  if (patch.purchase_date !== undefined) set('purchase_date', String(patch.purchase_date).slice(0, 10));
  if (patch.useful_life_years !== undefined) {
    const life = Number(patch.useful_life_years);
    if (!Number.isFinite(life) || life <= 0 || life > 60) throw new Error('العمر الإنتاجي غير صالح');
    set('useful_life_years', Math.round(life));
  }
  if (patch.status !== undefined) {
    const status = String(patch.status).toUpperCase();
    if (!['ACTIVE', 'SOLD', 'RETIRED'].includes(status)) throw new Error('حالة الأصل غير مدعومة');
    set('status', status);
  }
  if (patch.quantity !== undefined || patch.unit_cost !== undefined) {
    const quantity = Math.max(1, Math.round(Number(patch.quantity ?? current.quantity) || 1));
    const unit = Math.abs(Number(patch.unit_cost ?? current.unit_cost) || 0);
    if (!unit) throw new Error('قيمة الوحدة مطلوبة');
    set('quantity', quantity);
    set('unit_cost', unit);
    set('total_cost', quantity * unit);
  }

  if (!sets.length) throw new Error('لا توجد حقول للتحديث');
  db.prepare(`UPDATE finance_assets SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  return getAsset(id);
}

export function deleteAsset(id: string) {
  const db = getSqliteDb();
  const row = db.prepare('SELECT id FROM finance_assets WHERE id = ?').get(id);
  if (!row) throw new Error('الأصل غير موجود');
  db.prepare('DELETE FROM finance_assets WHERE id = ?').run(id);
  return { id };
}

export function assetsSummary(opts?: { from?: string; to?: string }) {
  const assets = listAssets();
  const byCategory = ASSET_CATEGORIES.map((c) => {
    const rows = assets.filter((a) => a.category === c.id);
    return {
      id: c.id,
      label: c.label,
      count: rows.length,
      quantity: rows.reduce((s, a) => s + a.quantity, 0),
      total_cost: rows.reduce((s, a) => s + a.total_cost, 0),
      net_book_value: rows.reduce((s, a) => s + a.net_book_value, 0),
    };
  }).filter((c) => c.count > 0);

  const active = assets.filter((a) => a.status === 'ACTIVE');
  const inPeriod = opts?.from || opts?.to
    ? assets.filter((a) => {
      if (opts.from && a.purchase_date < opts.from) return false;
      if (opts.to && a.purchase_date > opts.to) return false;
      return true;
    })
    : [];

  const range = opts?.from && opts?.to ? normalizeIsoRange(opts.from, opts.to) : null;
  const period_depreciation = range ? assetDepreciationInPeriod(range.from, range.to) : 0;

  return {
    by_category: byCategory,
    total_cost: assets.reduce((s, a) => s + a.total_cost, 0),
    active_cost: active.reduce((s, a) => s + a.total_cost, 0),
    net_book_value: assets.reduce((s, a) => s + a.net_book_value, 0),
    accumulated_depreciation: assets.reduce((s, a) => s + a.accumulated_depreciation, 0),
    period_depreciation,
    count: assets.length,
    active_count: active.length,
    added_in_period: inPeriod.reduce((s, a) => s + a.total_cost, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Executive recap: income, spending, both debt sides, investments.
 * ------------------------------------------------------------------ */

const OUTFLOW_TYPES = new Set(['EXPENSE', 'PURCHASE', 'SERVICE_SPEND', 'CASH_OUT']);

/** P&L products: no bare treasury moves, transfers, or capex mis-posted as income. */
function isStatementProductRow(r: {
  type?: string;
  category?: string;
  description?: string;
  counterparty?: string;
  ref_table?: string | null;
  entry_kind?: string | null;
}) {
  // SCF 706 product revenue (accrual at service performance) — not cash collection.
  if (String(r.ref_table || '') === 'finance_client_revenue') {
    return String(r.type) === 'CASH_IN' && String(r.entry_kind || '') === 'accrual';
  }
  if (String(r.type) !== 'CASH_IN') return false;
  const cat = String(r.category || '').toLowerCase();
  if (cat === 'capex' || cat === 'transfer' || cat === 'cash_out' || cat === 'cash_in') return false;
  const desc = String(r.description || '').trim();
  const party = String(r.counterparty || '').trim();
  if (!desc && !party) return false;
  return true;
}

/** P&L charges: operating outflows only (no «نقد خارج», transfers, or capex). */
function isStatementChargeRow(r: { type?: string; category?: string }) {
  if (!OUTFLOW_TYPES.has(String(r.type))) return false;
  const cat = String(r.category || '').toLowerCase();
  if (cat === 'capex' || cat === 'cash_out' || cat === 'transfer') return false;
  return true;
}

function inRange(date: string, from: string, to: string) {
  const d = String(date || '').slice(0, 10);
  return Boolean(d) && d >= from && d <= to;
}

const MODULE_LEDGER_REFS = new Set([
  'finance_supplier_payments',
  'finance_service_payments',
  'finance_staff_salaries',
]);

function ymFromIso(iso: string) {
  const s = String(iso || '').slice(0, 10);
  const [y, m] = s.split('-');
  return { year: Number(y) || 0, month: Number(m) || 1 };
}

/** Same figure as الموردون → KPI «غير المدفوع» / 401 (الميزانية، not P&L). */
export function supplierModuleStatementTotal() {
  return Number(supplierDebtSummary().total_debt || 0);
}

function scfAccountLabelAr(code: string) {
  const row = listScfChartAccounts({ activeOnly: true }).find((a) => a.code === code);
  return row?.label_ar || code;
}

export type SupplierPnlLine = {
  supplier_id: string;
  name_ar: string;
  code: string;
  category: string;
  scf_code: string;
  amount: number;
  invoice_count: number;
};

/** P&L supplier detail — by SCF (604/616/626/625) and by fournisseur. */
export function supplierInvoicedStatementForPeriod(from: string, to: string) {
  const db = getSqliteDb();
  const rows = db
    .prepare(`
      SELECT i.amount, i.invoice_date, i.supplier_id, s.name_ar, s.code, s.category, s.scf_code
      FROM finance_supplier_invoices i
      INNER JOIN finance_suppliers s ON s.id = i.supplier_id
      WHERE i.status != 'VOID'
    `)
    .all() as any[];

  const inPeriod = rows.filter((i) => inRange(String(i.invoice_date || '').slice(0, 10), from, to));
  const bySupplier = new Map<string, SupplierPnlLine>();

  for (const inv of inPeriod) {
    const supplier_id = String(inv.supplier_id);
    const category = normalizeSupplierCategory(inv.category);
    const scf_code = scfCodeForSupplierRecord({ category, scf_code: inv.scf_code });
    const amount = Number(inv.amount) || 0;
    const prev = bySupplier.get(supplier_id);
    if (!prev) {
      bySupplier.set(supplier_id, {
        supplier_id,
        name_ar: String(inv.name_ar || '').trim() || supplier_id,
        code: String(inv.code || '').trim(),
        category,
        scf_code,
        amount,
        invoice_count: 1,
      });
    } else {
      prev.amount += amount;
      prev.invoice_count += 1;
    }
  }

  const supplier_lines = [...bySupplier.values()].sort((a, b) => b.amount - a.amount);
  const scfTotals = new Map<string, { amount: number; supplier_count: number }>();
  for (const line of supplier_lines) {
    const bucket = scfTotals.get(line.scf_code) || { amount: 0, supplier_count: 0 };
    bucket.amount += line.amount;
    bucket.supplier_count += 1;
    scfTotals.set(line.scf_code, bucket);
  }

  const scf_groups = [...scfTotals.entries()]
    .map(([scf_code, v]) => {
      const sampleCat = SUPPLIER_CATEGORY_SCF[
        (supplier_lines.find((l) => l.scf_code === scf_code)?.category || 'other') as keyof typeof SUPPLIER_CATEGORY_SCF
      ];
      return {
        scf_code,
        label: scfAccountLabelAr(scf_code),
        note_ar: sampleCat?.note_ar || `مصاريف SCF ${scf_code}`,
        amount: v.amount,
        supplier_count: v.supplier_count,
      };
    })
    .sort((a, b) => a.scf_code.localeCompare(b.scf_code));

  const total = supplier_lines.reduce((s, l) => s + l.amount, 0);
  return { total, supplier_lines, scf_groups };
}

/** P&L / حساب النتيجة — مفوتر بالفترة (تاريخ الفاتورة)، مثل تفصيل المورد. */
export function supplierInvoicedInPeriod(from: string, to: string) {
  return supplierInvoicedStatementForPeriod(from, to).total;
}

/** الدفعات مسجّلة في الخزينة — لا تُجمع كمصروف في النتيجة (604 عند الفاتورة). */
export function supplierPaymentsInPeriod(from: string, to: string) {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT amount, payment_date, status FROM finance_supplier_payments').all() as any[];
  return rows
    .filter((p) => String(p.status || 'POSTED').toUpperCase() !== 'VOID')
    .filter((p) => inRange(String(p.payment_date || '').slice(0, 10), from, to))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

/** Same totals as صفحة «المداخيل» — filter by receipt `date` (decrypted row read). */
export function receiptsIncomeForPeriod(from: string, to: string, tripType?: TripTypeId | null) {
  const db = getSqliteDb();
  const all = db.prepare('SELECT * FROM receipts').all() as any[];
  let rows = all.filter((r) => inRange(String(r.date || '').slice(0, 10), from, to));
  if (tripType) {
    rows = rows.filter((r) => classifyTripType(String(r.packageName || '')) === tripType);
  }

  const contractCtx = buildReceiptContractContext(listClientPayments(), collectibleReservations());
  const contracts = aggregateReceiptContracts(rows, contractCtx);
  const totals = receiptContractTotals(contracts);
  const collected = totals.collected;
  const outstanding = totals.outstanding;
  const billed = totals.billed;

  const byProgram = billedByProgramFromContracts(contracts);
  const products = byProgram
    .map(([label, amount]) => ({ id: label, label, amount, section: 'receipts' as const }))
    .sort((a, b) => b.amount - a.amount);

  return { rows, collected, outstanding, billed, products, count: rows.length, contracts };
}

export function servicePaymentsInPeriod(db: ReturnType<typeof getSqliteDb>, from: string, to: string) {
  const rows = db.prepare('SELECT * FROM finance_service_payments').all() as any[];
  return rows
    .filter((p) => inRange(String(p.payment_date || '').slice(0, 10), from, to))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function shiftIsoDate(iso: string, deltaMonths: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setMonth(d.getMonth() + deltaMonths);
  return d.toISOString().slice(0, 10);
}

/** Due dates for a recurring service that fall inside [from, to]. */
export function serviceDueDatesInPeriod(
  anchorDue: string,
  frequency: ServiceFrequency,
  from: string,
  to: string
): string[] {
  const anchor = String(anchorDue || '').slice(0, 10);
  if (!anchor) return [];
  if (frequency === 'ONE_OFF') {
    return inRange(anchor, from, to) ? [anchor] : [];
  }
  const stepMonths = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : frequency === 'YEARLY' ? 12 : 0;
  if (!stepMonths) return [];

  let cur = anchor;
  for (let i = 0; i < 240 && cur > from; i++) {
    cur = shiftIsoDate(cur, -stepMonths);
  }
  const out: string[] = [];
  for (let i = 0; i < 240; i++) {
    if (cur > to) break;
    if (cur >= from) out.push(cur);
    cur = shiftIsoDate(cur, stepMonths);
  }
  return out;
}

export type ServiceStatementRow = {
  id: string;
  name_ar: string;
  provider: string;
  frequency: ServiceFrequency;
  unit_amount: number;
  occurrences: number;
  amount: number;
  paid: number;
  unpaid: number;
};

/** One accrual slice per due date in period (= «فاتورة» مستحقة في النتيجة whether paid or not). */
export type ServiceAccrualLine = {
  id: string;
  service_id: string;
  name_ar: string;
  due_date: string;
  amount: number;
  frequency: ServiceFrequency;
};

/** P&L — مستحق بالفترة (تواريخ الاستحقاق) · الدفع منفصل. */
export function servicesStatementForPeriod(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const db = getSqliteDb();
  const payments = db.prepare('SELECT service_id, amount, payment_date FROM finance_service_payments').all() as any[];

  const paidForService = (serviceId: string) =>
    payments
      .filter(
        (p) =>
          String(p.service_id) === serviceId &&
          inRange(String(p.payment_date || '').slice(0, 10), from, to)
      )
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const items: ServiceStatementRow[] = [];
  const accrual_lines: ServiceAccrualLine[] = [];
  for (const svc of listServices() as any[]) {
    if (String(svc.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') continue;
    const unit = Number(svc.amount) || 0;
    if (unit <= 0) continue;
    const freq = String(svc.frequency || 'MONTHLY').toUpperCase() as ServiceFrequency;
    const dueDates = serviceDueDatesInPeriod(String(svc.next_due_date || ''), freq, from, to);
    if (dueDates.length <= 0) continue;
    const amount = unit * dueDates.length;
    const paid = paidForService(String(svc.id));
    const serviceId = String(svc.id);
    for (const due_date of dueDates) {
      accrual_lines.push({
        id: `${serviceId}:${due_date}`,
        service_id: serviceId,
        name_ar: String(svc.name_ar || ''),
        due_date,
        amount: unit,
        frequency: freq,
      });
    }
    items.push({
      id: serviceId,
      name_ar: String(svc.name_ar || ''),
      provider: String(svc.provider || ''),
      frequency: freq,
      unit_amount: unit,
      occurrences: dueDates.length,
      amount,
      paid,
      unpaid: Math.max(0, amount - paid),
    });
  }

  items.sort((a, b) => b.amount - a.amount);
  accrual_lines.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.amount - a.amount);
  const totalFromLines = accrual_lines.reduce((s, r) => s + r.amount, 0);
  const total = items.reduce((s, r) => s + r.amount, 0);
  const paid = items.reduce((s, r) => s + r.paid, 0);
  return {
    from,
    to,
    items,
    accrual_lines,
    total: totalFromLines || total,
    paid,
    unpaid: Math.max(0, (totalFromLines || total) - paid),
  };
}

export function serviceAccruedInPeriod(from: string, to: string) {
  return servicesStatementForPeriod(from, to).total;
}

let serviceSupplierLinksEnsured = false;

function guessSupplierCategoryFromProvider(provider: string) {
  const p = String(provider || '').toLowerCase();
  if (/اتصالات|إنترنت|algérie telecom|djeddi|informatique/i.test(p)) return 'telecom_it';
  if (/تأمين|sonatrach/i.test(p)) return 'insurance';
  return 'other';
}

/** One fournisseur per service `provider` — idempotent. */
export function backfillServiceSupplierLinks() {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const services = db
    .prepare('SELECT id, provider, name_ar, supplier_id FROM finance_service_costs')
    .all() as { id: string; provider?: string; name_ar?: string; supplier_id?: string | null }[];
  const findByName = db.prepare(
    'SELECT id FROM finance_suppliers WHERE TRIM(name_ar) = ? COLLATE NOCASE LIMIT 1'
  );
  const insert = db.prepare(`
    INSERT INTO finance_suppliers (id, code, name_ar, contact, payment_terms_days, status, category, created_at)
    VALUES (?, ?, ?, '', 30, 'ACTIVE', ?, ?)
  `);
  const upd = db.prepare('UPDATE finance_service_costs SET supplier_id = ? WHERE id = ?');
  let seq = 0;
  for (const svc of services) {
    if (svc.supplier_id) continue;
    const name = String(svc.provider || svc.name_ar || '').trim();
    if (!name) continue;
    let supId = (findByName.get(name) as { id?: string } | undefined)?.id;
    if (!supId) {
      seq += 1;
      supId = `sup_svc_${String(svc.id).replace(/[^a-z0-9_]/gi, '')}`;
      const code = `SUP-SVC-${String(seq).padStart(3, '0')}`;
      try {
        insert.run(supId, code, name, guessSupplierCategoryFromProvider(name), now);
      } catch {
        supId = (findByName.get(name) as { id?: string } | undefined)?.id;
      }
    }
    if (supId) upd.run(supId, svc.id);
  }
}

export function ensureServiceSupplierLinks() {
  if (serviceSupplierLinksEnsured) return;
  backfillServiceSupplierLinks();
  serviceSupplierLinksEnsured = true;
}

export type SupplierRecapRollup = {
  supplier_id: string;
  period_invoices: number;
  period_services: number;
  period_services_paid: number;
  period_payments: number;
  period_result_amount: number;
};

/** Per-fournisseur P&L in period — matches الملخص (فواتير + 613). */
export function supplierRecapRollupsForPeriod(fromInput?: string, toInput?: string) {
  ensureServiceSupplierLinks();
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const inv = supplierInvoicedStatementForPeriod(from, to);
  const svc = servicesStatementForPeriod(from, to);
  const map = new Map<string, SupplierRecapRollup>();

  for (const line of inv.supplier_lines) {
    const id = line.supplier_id;
    const prev =
      map.get(id) ||
      ({
        supplier_id: id,
        period_invoices: 0,
        period_services: 0,
        period_services_paid: 0,
        period_payments: 0,
        period_result_amount: 0,
      } satisfies SupplierRecapRollup);
    prev.period_invoices += line.amount;
    map.set(id, prev);
  }

  const payments = getSqliteDb()
    .prepare(`SELECT supplier_id, amount, payment_date, status FROM finance_supplier_payments`)
    .all() as { supplier_id?: string; amount?: number; payment_date?: string; status?: string }[];
  for (const pay of payments) {
    const id = String(pay.supplier_id || '');
    if (!id || String(pay.status || 'POSTED').toUpperCase() === 'VOID') continue;
    if (!inRange(String(pay.payment_date || '').slice(0, 10), from, to)) continue;
    const prev =
      map.get(id) ||
      ({
        supplier_id: id,
        period_invoices: 0,
        period_services: 0,
        period_services_paid: 0,
        period_payments: 0,
        period_result_amount: 0,
      } satisfies SupplierRecapRollup);
    prev.period_payments += Number(pay.amount) || 0;
    map.set(id, prev);
  }

  for (const item of svc.items) {
    const svcRow = getService(item.id) as { supplier_id?: string } | null;
    const id = svcRow?.supplier_id ? String(svcRow.supplier_id) : '';
    if (!id) continue;
    const prev =
      map.get(id) ||
      ({
        supplier_id: id,
        period_invoices: 0,
        period_services: 0,
        period_services_paid: 0,
        period_payments: 0,
        period_result_amount: 0,
      } satisfies SupplierRecapRollup);
    prev.period_services += item.amount;
    prev.period_services_paid += item.paid;
    map.set(id, prev);
  }

  for (const row of map.values()) {
    row.period_result_amount = row.period_invoices + row.period_services;
  }

  return [...map.values()]
    .filter((r) => r.period_invoices !== 0 || r.period_services !== 0 || r.period_payments !== 0)
    .sort((a, b) => b.period_result_amount - a.period_result_amount || b.period_payments - a.period_payments);
}

/** IAS 16 — straight-line depreciation allocated to the selected period. */
export function assetDepreciationInPeriod(from: string, to: string) {
  const assets = listAssets().filter((a) => a.status === 'ACTIVE');
  if (!assets.length) return 0;
  const spanYears = Math.max(0, daysBetween(from, to) + 1) / 365.25;
  const expense = assets.reduce((s, a) => {
    const life = Math.max(1, a.useful_life_years || 1);
    return s + (a.total_cost / life) * spanYears;
  }, 0);
  return Math.round(expense);
}

/**
 * Module totals for حساب النتيجة — each amount matches its detail screen (not اليومية).
 * Exported so module APIs / UI can reuse the same logic.
 */
export function statementModuleAmounts(fromInput?: string, toInput?: string) {
  const { from, to } = normalizeIsoRange(fromInput, toInput);
  const db = getSqliteDb();
  const payroll_opts = payrollOptsFromIso(from, to);
  const payroll_roll = payrollByStaff(payroll_opts);

  const supplier_invoiced = supplierInvoicedInPeriod(from, to);
  const supplier_paid = supplierPaymentsInPeriod(from, to);
  const services_stmt = servicesStatementForPeriod(from, to);
  const services_paid = services_stmt.paid;

  const amounts = {
    suppliers: supplier_invoiced,
    payroll: payroll_roll.total,
    services: services_stmt.total,
    assets: assetDepreciationInPeriod(from, to),
  };

  return {
    from,
    to,
    payroll_opts,
    payroll_roll,
    amounts,
    supplier_invoiced,
    supplier_paid,
    services_paid,
    services_stmt,
  };
}

export type StatementChargeLine = {
  id: string;
  label: string;
  amount: number;
  section: string;
  scf_code?: string;
  accountingNote?: string;
};

/** SCF class-6 lines + detail rows for fournisseurs / payroll (not journal). */
export function statementChargeBundleFromModules(from: string, to: string) {
  const mod = statementModuleAmounts(from, to);
  const supplierStmt = supplierInvoicedStatementForPeriod(from, to);

  const charges: StatementChargeLine[] = [];

  for (const g of supplierStmt.scf_groups) {
    if (g.amount <= 0) continue;
    charges.push({
      id: `suppliers_${g.scf_code}`,
      scf_code: g.scf_code,
      label: `${g.scf_code} — ${g.label}`,
      amount: g.amount,
      section: 'suppliers',
      accountingNote: `${g.note_ar} · ${g.supplier_count} مورد · مدفوع ${Math.round(mod.supplier_paid)} (خزينة)`,
    });
  }

  if (mod.amounts.payroll > 0) {
    charges.push({
      id: 'payroll',
      scf_code: '631',
      label: `631 — ${scfAccountLabelAr('631')}`,
      amount: mod.amounts.payroll,
      section: 'payroll',
      accountingNote: `أجور بالفترة · مدفوع ${Math.round(mod.payroll_roll.paid_total)} · متبقٍ ${Math.round(mod.payroll_roll.pending_total)}`,
    });
  }

  const serviceScfTotals = new Map<string, number>();
  for (const item of mod.services_stmt.items) {
    const code = serviceScfCode(String(item.id));
    serviceScfTotals.set(code, (serviceScfTotals.get(code) || 0) + item.amount);
  }
  for (const [scf_code, amount] of [...serviceScfTotals.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0])
  )) {
    if (amount <= 0) continue;
    charges.push({
      id: `services_${scf_code}`,
      scf_code,
      label: `${scf_code} — ${scfAccountLabelAr(scf_code)} (خدمات دورية)`,
      amount,
      section: 'suppliers',
      accountingNote: `مستحق بالفترة · مدفوع ${Math.round(mod.services_stmt.paid)} · متبقٍ ${Math.round(mod.services_stmt.unpaid)}`,
    });
  }

  if (mod.amounts.assets > 0) {
    charges.push({
      id: 'assets',
      scf_code: '681',
      label: `681 — ${scfAccountLabelAr('681')}`,
      amount: mod.amounts.assets,
      section: 'assets',
      accountingNote: PNL_EXPENSE_LINES.find((l) => l.id === 'assets')?.accountingNote,
    });
  }

  const supplier_lines = supplierStmt.supplier_lines.map((s) => ({
    id: s.supplier_id,
    label: s.name_ar,
    amount: s.amount,
    section: 'suppliers' as const,
    scf_code: s.scf_code,
    detail: `${supplierCategoryLabel(s.category)} · ${s.invoice_count} فاتورة${s.code ? ` · ${s.code}` : ''}`,
  }));

  const servicesBySupplier = new Map<
    string,
    {
      supplier_id: string;
      scf_code: string;
      name_ar: string;
      amount: number;
      service_names: string[];
    }
  >();
  for (const item of mod.services_stmt.items) {
    const svc = getService(item.id) as { supplier_id?: string } | null;
    const supplier_id = svc?.supplier_id ? String(svc.supplier_id) : '';
    if (!supplier_id) {
      const scf_code = serviceScfCode(String(item.id));
      supplier_lines.push({
        id: `svc-unlinked-${item.id}`,
        label: item.name_ar,
        amount: item.amount,
        section: 'suppliers' as const,
        scf_code,
        detail: `خدمة دورية · ${item.provider || 'مورد غير مربوط'}`,
      });
      continue;
    }
    const scf_code = serviceScfCode(String(item.id));
    const sup = getSupplier(supplier_id) as { name_ar?: string } | null;
    const key = `${supplier_id}:${scf_code}`;
    const prev = servicesBySupplier.get(key);
    if (!prev) {
      servicesBySupplier.set(key, {
        name_ar: String(sup?.name_ar || item.provider || supplier_id),
        amount: item.amount,
        service_names: [item.name_ar],
        scf_code,
        supplier_id,
      });
    } else {
      prev.amount += item.amount;
      if (item.name_ar && !prev.service_names.includes(item.name_ar)) {
        prev.service_names.push(item.name_ar);
      }
    }
  }
  for (const [, row] of servicesBySupplier) {
    supplier_lines.push({
      id: row.supplier_id,
      label: row.name_ar,
      amount: row.amount,
      section: 'suppliers' as const,
      scf_code: row.scf_code,
      detail:
        row.service_names.length > 1
          ? `${row.scf_code} · ${row.service_names.length} خدمات: ${row.service_names.slice(0, 3).join('، ')}${row.service_names.length > 3 ? '…' : ''}`
          : `${row.scf_code} · ${row.service_names[0] || 'خدمة دورية'}`,
    });
  }
  supplier_lines.sort((a, b) => b.amount - a.amount);

  const payroll_lines = mod.payroll_roll.staff
    .filter((s) => s.total > 0)
    .map((s) => ({
      id: String(s.key),
      label: String(s.staff_name),
      amount: Number(s.total) || 0,
      section: 'payroll' as const,
      scf_code: '631',
      detail: `${s.months} شهر · مدفوع ${Math.round(s.paid_total)} · متبقٍ ${Math.round(s.pending_total)}`,
    }));

  const scfChargeOrder = (code?: string) => {
    const m = String(code || '').match(/^(\d+)/);
    return m ? Number(m[1]) : 9999;
  };
  charges.sort(
    (a, b) =>
      scfChargeOrder(a.scf_code) - scfChargeOrder(b.scf_code) ||
      String(a.id || '').localeCompare(String(b.id || ''))
  );

  return { charges, supplier_lines, payroll_lines };
}

function statementChargeLinesFromModules(from: string, to: string) {
  return statementChargeBundleFromModules(from, to).charges;
}

/**
 * One aggregate for the accountant's first screen. Income and spending come from the
 * posted ledger; the trip-type slice comes from receipts and reservations, which are the
 * only records tied to a package. Spending and supplier debt are agency-wide overheads
 * with no package link, so `type_scoped` tells the UI to label them as such.
 */
export function financeRecap(opts?: { from?: string; to?: string; tripType?: string }) {
  const db = getSqliteDb();
  const { from, to } = normalizeIsoRange(opts?.from, opts?.to);
  const moduleTotals = statementModuleAmounts(from, to);
  const tripType = TRIP_TYPES.some((t) => t.id === opts?.tripType)
    ? (opts!.tripType as TripTypeId)
    : null;

  const ledger = db
    .prepare("SELECT * FROM finance_ledger WHERE status = 'POSTED'")
    .all() as any[];
  const period = ledger.filter((r) => inRange(r.entry_date, from, to));
  const statementPeriod = period.filter(isStatementProductRow);
  const chargePeriod = period.filter(isStatementChargeRow);

  const income = statementPeriod.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const spending = chargePeriod.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const incomeByCategory = Object.entries(
    statementPeriod.reduce<Record<string, number>>((acc, r) => {
      const key = String(r.category || 'cash_in');
      acc[key] = (acc[key] || 0) + (Number(r.amount) || 0);
      return acc;
    }, {})
  )
    .map(([id, amount]) => ({ id, label: ledgerCategoryLabel(id), amount }))
    .sort((a, b) => b.amount - a.amount);

  const spendingByCategory = Object.entries(
    chargePeriod.reduce<Record<string, number>>((acc, r) => {
      const key = String(r.category || 'other');
      acc[key] = (acc[key] || 0) + (Number(r.amount) || 0);
      return acc;
    }, {})
  )
    .map(([id, amount]) => ({ id, label: ledgerCategoryLabel(id), amount }))
    .sort((a, b) => b.amount - a.amount);

  // Receipts carry the package name, so they drive the per-activity split.
  const receipts = db.prepare('SELECT * FROM receipts').all() as any[];
  const receiptsInPeriod = receipts.filter((r) => inRange(String(r.date || '').slice(0, 10), from, to));

  // Month-by-month movement for the recap charts (aligned with KPI sources).
  const monthKeys = new Map<string, { income: number; spending: number }>();
  const bump = (key: string, field: 'income' | 'spending', amount: number) => {
    if (!key || key.length < 7 || !amount) return;
    const bucket = monthKeys.get(key) || { income: 0, spending: 0 };
    bucket[field] += amount;
    monthKeys.set(key, bucket);
  };
  for (const r of receiptsInPeriod) {
    bump(String(r.date || '').slice(0, 7), 'income', Number(r.totalAmount) || Number(r.paidAmount) || 0);
  }
  for (const r of period) {
    const key = String(r.entry_date || '').slice(0, 7);
    const amount = Number(r.amount) || 0;
    if (!amount) continue;
    if (String(r.entry_kind || 'treasury') === 'accrual' && String(r.ref_table || '') === 'finance_client_revenue') {
      bump(key, 'income', amount);
      continue;
    }
    if (OUTFLOW_TYPES.has(String(r.type)) || String(r.ref_table || '') === 'finance_supplier_invoices') {
      bump(key, 'spending', amount);
    }
  }
  if (![...monthKeys.values()].some((v) => v.spending > 0)) {
    for (const r of chargePeriod) {
      bump(String(r.entry_date || '').slice(0, 7), 'spending', Number(r.amount) || 0);
    }
  }
  const monthly = [...monthKeys.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([month, v]) => ({ month, ...v }));

  const collectedByType = TRIP_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    amount: receiptsInPeriod
      .filter((r) => classifyTripType(r.packageName) === t.id)
      .reduce((s, r) => s + (Number(r.paidAmount) || 0), 0),
  }));

  const reservations = db.prepare('SELECT * FROM reservations').all() as any[];
  const isLiveReservation = (r: any) => {
    const status = String(r.reservation_status || '').toUpperCase();
    return status !== 'CANCELLED' && status !== 'REJECTED';
  };
  const allAgencyReservations = reservations.filter(isLiveReservation);
  // Client debt = unpaid balance on live reservations (bookings in selected period).
  const liveReservations = allAgencyReservations.filter((r) =>
    inRange(String(r.created_at || '').slice(0, 10), from, to)
  );
  const clientDebtRow = (r: any) =>
    Math.max(0, (Number(r.total_price) || 0) - (Number(r.paid_amount) || 0));
  const clientDebtByType = TRIP_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    amount: liveReservations
      .filter((r) => classifyTripType(r.package_name) === t.id)
      .reduce((s, r) => s + clientDebtRow(r), 0),
  }));

  // Who owes what, so the receivables card can be drilled into.
  const clientRows = liveReservations
    .map((r) => ({
      id: r.reservation_id,
      reference: r.reservation_number || '',
      name: r.customer_name || '',
      package_name: r.package_name || '',
      trip_type: classifyTripType(r.package_name),
      total: Number(r.total_price) || 0,
      paid: Number(r.paid_amount) || 0,
      remaining: clientDebtRow(r),
      date: String(r.created_at || '').slice(0, 10),
    }))
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const scoped = <T extends { id: string; amount: number }>(rows: T[]) =>
    tripType ? rows.filter((r) => r.id === tripType) : rows;

  const debt = supplierDebtSummary();
  const assets = assetsSummary({ from: opts?.from, to: opts?.to });
  const treasury = treasuryOverview({ from: opts?.from, to: opts?.to });
  const aging = supplierAging() as any[];

  const clientDebt = scoped(clientDebtByType).reduce((s, r) => s + r.amount, 0);
  const collected = scoped(collectedByType).reduce((s, r) => s + r.amount, 0);
  const supplierDebt = Number(debt.total_debt || 0);
  const scopedClientRows = tripType ? clientRows.filter((r) => r.trip_type === tripType) : clientRows;

  const payroll_pending = Number(
    (db.prepare(`
      SELECT COALESCE(SUM(amount),0) as v FROM finance_staff_salaries WHERE status='PENDING'
    `).get() as any).v
  );
  const service_due = Number(
    (db.prepare(`
      SELECT COALESCE(SUM(amount),0) as v FROM finance_service_costs
      WHERE status='ACTIVE' AND next_due_date IS NOT NULL AND julianday(next_due_date) <= julianday('now') + 30
    `).get() as any).v
  );

  /** P&L income = same source as المداخيل (receipts dated in period). */
  const incomeTripKind: TripTypeId = tripType || 'umrah';
  const receiptIncome = receiptsIncomeForPeriod(from, to, tripType ? incomeTripKind : null);
  const tripIncomeTotal = receiptIncome.billed;
  const tripIncomePaid = receiptIncome.collected;
  const tripIncomeUnpaid = receiptIncome.outstanding;
  const agencyIncomeTotal = tripIncomeTotal;
  const agencyIncomePaid = tripIncomePaid;
  const agencyIncomeUnpaid = tripIncomeUnpaid;

  const supplierInvoicedPeriod = moduleTotals.supplier_invoiced ?? supplierInvoicedInPeriod(from, to);
  const supplierPaidPeriod = moduleTotals.supplier_paid ?? supplierPaymentsInPeriod(from, to);
  const servicesPaidPeriod = moduleTotals.services_paid ?? servicePaymentsInPeriod(db, from, to);
  const payrollPaidPeriod = moduleTotals.payroll_roll.paid_total;

  const totalIncome = tripIncomeTotal;
  const productLines =
    receiptIncome.products.length > 0
      ? receiptIncome.products
      : [
          {
            id: 'no_receipts',
            label: 'لا إيصالات مداخيل في الفترة المحددة',
            amount: 0,
            section: 'receipts' as const,
          },
        ];
  const chargeBundle = statementChargeBundleFromModules(from, to);
  const chargeLines = chargeBundle.charges;
  const totalCharges = chargeLines.reduce((s, l) => s + l.amount, 0);
  const netResult = tripIncomeTotal - totalCharges;
  /** Cash/settlements in period (الدفع منفصل عن إثبات المصروف في النتيجة). */
  const chargePaidInPeriod =
    supplierPaidPeriod + payrollPaidPeriod + servicesPaidPeriod;
  const chargeUnpaidOnAccrual = Math.max(0, totalCharges - chargePaidInPeriod);

  /** 411 — same «المستحق» as صفحة المداخيل (عقود الإيصالات بالفترة), not reservation snapshot alone. */
  const clientReceivables = Math.max(0, tripIncomeUnpaid);

  const scfBalance = buildScfBalanceSheet({
    cash_total: Number(treasury.cash_total) || 0,
    bank_total: Number(treasury.bank_total) || 0,
    other_treasury_total: Number(treasury.other_total) || 0,
    receivables: clientReceivables,
    fixed_assets_net: Number(assets.net_book_value) || 0,
    supplier_debt: supplierDebt,
    payroll_pending,
    services_due: service_due,
    period_net: netResult,
  });
  const actifLines = scfBalance.actif;
  const bilanPassif = scfBalance.passif;
  const totalActif = scfBalance.total_actif;
  const totalPassif = scfBalance.total_passif;

  return {
    from,
    to,
    trip_type: tripType,
    /** True when spending / supplier debt are wider than the selected activity. */
    type_scoped: Boolean(tripType),
    income: tripIncomeTotal,
    spending: totalCharges,
    net: netResult,
    income_bookings_count: receiptIncome.count,
    income_trip_kind: incomeTripKind,
    agency_income: {
      total: agencyIncomeTotal,
      paid: agencyIncomePaid,
      unpaid: agencyIncomeUnpaid,
    },
    agency_charges: {
      total: totalCharges,
      paid: chargePaidInPeriod,
      unpaid: chargeUnpaidOnAccrual,
      invoiced_total: supplierInvoicedPeriod,
      invoiced_paid: supplierPaidPeriod,
      invoiced_unpaid: Math.max(0, supplierInvoicedPeriod - supplierPaidPeriod),
    },
    collected,
    supplier_debt: supplierDebt,
    open_invoices: Number(debt.open_invoices || 0),
    client_debt: clientReceivables,
    /** Positive means clients owe the agency more than it owes its suppliers. */
    receivables_net: clientReceivables - supplierDebt,
    reservations_count: tripType
      ? liveReservations.filter((r) => classifyTripType(r.package_name) === tripType).length
      : liveReservations.length,
    collected_by_type: collectedByType,
    client_debt_by_type: clientDebtByType,
    client_rows: scopedClientRows.slice(0, 50),
    supplier_rows: aging
      .map((s) => ({
        id: s.id,
        name_ar: s.name_ar,
        code: s.code || '',
        remaining: Number(s.total_remaining) || 0,
        overdue: Number(s.overdue_amount) || 0,
        open_count: Number(s.open_count) || 0,
      }))
      .filter((s) => s.remaining > 0)
      .slice(0, 50),
    spending_by_category: spendingByCategory,
    income_by_category: incomeByCategory,
    monthly,
    assets,
    treasury,
    payroll_pending,
    service_due,
    statement: {
      products: productLines,
      charges: chargeLines,
      supplier_lines: chargeBundle.supplier_lines,
      payroll_lines: chargeBundle.payroll_lines,
      service_lines: moduleTotals.services_stmt.accrual_lines.map((r) => ({
        id: r.id,
        label: r.name_ar,
        amount: r.amount,
        section: 'suppliers' as const,
        scf_code: '613',
        detail: `استحقاق ${r.due_date} · ${r.frequency}`,
      })),
      services_summary: {
        total: moduleTotals.services_stmt.total,
        paid: moduleTotals.services_stmt.paid,
        unpaid: moduleTotals.services_stmt.unpaid,
      },
      total_products: totalIncome,
      total_charges: totalCharges,
      result: netResult,
      module_amounts: moduleTotals.amounts,
      payroll_range: moduleTotals.payroll_opts,
      income_summary: {
        total: agencyIncomeTotal,
        paid: agencyIncomePaid,
        unpaid: agencyIncomeUnpaid,
      },
      charge_summary: {
        total: totalCharges,
        paid: chargePaidInPeriod,
        unpaid: chargeUnpaidOnAccrual,
      },
      period_operating_income: income,
      period_operating_charges: spending,
    },
    balance_sheet: {
      actif: actifLines,
      passif: bilanPassif,
      total_actif: totalActif,
      total_passif: totalPassif,
      subtotals: scfBalance.subtotals,
    },
  };
}
