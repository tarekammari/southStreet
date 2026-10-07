const fs = require('fs');
const path = require('path');
const root = 'D:/data/south_street';
function w(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('W', rel, fs.statSync(full).size);
}

w('lib/finance.ts', `/**
 * Finance domain helpers — ledger, suppliers, salaries, services (cash-based, no double-entry).
 */
import { getSqliteDb } from '@/lib/sqlite';
import { randomUUID } from 'crypto';

export type LedgerType = 'EXPENSE' | 'PURCHASE' | 'SERVICE_SPEND' | 'CASH_IN' | 'CASH_OUT';
export type LedgerStatus = 'DRAFT' | 'POSTED' | 'VOID';
export type LedgerDirection = 'in' | 'out';
export type PaymentMethod = 'CASH' | 'CCP' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
export type ServiceFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_OFF';

export function newId(prefix: string) {
  return \`\${prefix}_\${Date.now().toString(36)}_\${randomUUID().slice(0, 8)}\`;
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
  const rows = db
    .prepare(
      \`SELECT id, direction, amount, status FROM finance_ledger
       WHERE status = 'POSTED'
       ORDER BY entry_date ASC, created_at ASC, id ASC\`
    )
    .all() as { id: string; direction: LedgerDirection; amount: number }[];
  let bal = 0;
  const upd = db.prepare('UPDATE finance_ledger SET running_balance = ? WHERE id = ?');
  db.transaction(() => {
    for (const r of rows) {
      bal += signedAmount(r.direction, r.amount);
      upd.run(bal, r.id);
    }
  })();
  return bal;
}

export function listLedger(opts?: { from?: string; to?: string; status?: string }) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts?.from) { where.push('entry_date >= ?'); params.push(opts.from); }
  if (opts?.to) { where.push('entry_date <= ?'); params.push(opts.to); }
  if (opts?.status) { where.push('status = ?'); params.push(opts.status); }
  const sql = \`SELECT * FROM finance_ledger \${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY entry_date DESC, created_at DESC, id DESC\`;
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
  ref_table?: string | null;
  ref_id?: string | null;
  created_by?: string | null;
  status?: LedgerStatus;
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
  db.prepare(\`
    INSERT INTO finance_ledger (
      id, type, direction, amount, description, entry_date, status, receipt_id,
      counterparty, method, ref_table, ref_id, running_balance, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  \`).run(
    id, type, direction, amount, input.description || '', entry_date, status,
    input.receipt_id || null, input.counterparty || null, input.method || null,
    input.ref_table || null, input.ref_id || null, input.created_by || null, created_at
  );
  if (status === 'POSTED') recomputeRunningBalances();
  return db.prepare('SELECT * FROM finance_ledger WHERE id = ?').get(id);
}

export function listSuppliers() {
  return getSqliteDb().prepare('SELECT * FROM finance_suppliers ORDER BY name_ar COLLATE NOCASE').all();
}

export function createSupplier(input: {
  code?: string; name_ar: string; contact?: string; payment_terms_days?: number; status?: string;
}) {
  const db = getSqliteDb();
  const id = newId('sup');
  const code = (input.code || \`SUP-\${Math.floor(100 + Math.random() * 900)}\`).trim();
  const created_at = new Date().toISOString();
  db.prepare(\`
    INSERT INTO finance_suppliers (id, code, name_ar, contact, payment_terms_days, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  \`).run(
    id, code, input.name_ar, input.contact || '', Number(input.payment_terms_days) || 30,
    input.status || 'ACTIVE', created_at
  );
  return db.prepare('SELECT * FROM finance_suppliers WHERE id = ?').get(id);
}

export function getSupplier(id: string) {
  return getSqliteDb().prepare('SELECT * FROM finance_suppliers WHERE id = ?').get(id) || null;
}

export function listSupplierInvoices(supplierId: string) {
  return getSqliteDb()
    .prepare('SELECT * FROM finance_supplier_invoices WHERE supplier_id = ? ORDER BY invoice_date DESC')
    .all(supplierId);
}

export function createSupplierInvoice(input: {
  supplier_id: string; invoice_no?: string; invoice_date?: string; due_date?: string;
  amount: number; note?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الفاتورة مطلوب');
  const id = newId('sinv');
  const invoice_date = input.invoice_date || todayISO();
  const due = input.due_date || invoice_date;
  db.prepare(\`
    INSERT INTO finance_supplier_invoices (
      id, supplier_id, invoice_no, invoice_date, due_date, amount, paid_amount, remaining, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'OPEN', ?, ?)
  \`).run(
    id, input.supplier_id, input.invoice_no || \`INV-\${Date.now().toString().slice(-6)}\`,
    invoice_date, due, amount, amount, input.note || '', new Date().toISOString()
  );
  return db.prepare('SELECT * FROM finance_supplier_invoices WHERE id = ?').get(id);
}

export function listSupplierPayments(supplierId: string) {
  return getSqliteDb()
    .prepare('SELECT * FROM finance_supplier_payments WHERE supplier_id = ? ORDER BY payment_date DESC')
    .all(supplierId);
}

export function createSupplierPayment(input: {
  supplier_id: string; invoice_id?: string | null; amount: number;
  method: PaymentMethod; payment_date?: string; note?: string; created_by?: string;
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

  db.transaction(() => {
    db.prepare(\`
      INSERT INTO finance_supplier_payments (
        id, supplier_id, invoice_id, amount, method, payment_date, note, ledger_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    \`).run(
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
      description: \`دفعة مورد: \${supplier?.name_ar || input.supplier_id}\`,
      entry_date: payment_date,
      counterparty: supplier?.name_ar || null,
      method,
      ref_table: 'finance_supplier_payments',
      ref_id: id,
      created_by: input.created_by || null,
      status: 'POSTED',
    }) as any;
    db.prepare('UPDATE finance_supplier_payments SET ledger_id = ? WHERE id = ?').run(led.id, id);
  })();
  return db.prepare('SELECT * FROM finance_supplier_payments WHERE id = ?').get(id);
}

export function supplierAging() {
  const db = getSqliteDb();
  return db.prepare(\`
    SELECT s.id as supplier_id, s.code, s.name_ar, s.payment_terms_days,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) <= 0 THEN i.remaining ELSE 0 END) as bucket_current,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) > 0 AND julianday('now') - julianday(i.due_date) <= 30 THEN i.remaining ELSE 0 END) as bucket_1_30,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) > 30 AND julianday('now') - julianday(i.due_date) <= 60 THEN i.remaining ELSE 0 END) as bucket_31_60,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) > 60 AND julianday('now') - julianday(i.due_date) <= 90 THEN i.remaining ELSE 0 END) as bucket_61_90,
      SUM(CASE WHEN julianday('now') - julianday(i.due_date) > 90 THEN i.remaining ELSE 0 END) as bucket_90_plus,
      SUM(i.remaining) as total_remaining
    FROM finance_suppliers s
    JOIN finance_supplier_invoices i ON i.supplier_id = s.id
    WHERE i.status IN ('OPEN','PARTIAL') AND i.remaining > 0
    GROUP BY s.id
    ORDER BY total_remaining DESC
  \`).all();
}

export function supplierDebtSummary() {
  const db = getSqliteDb();
  const row = db.prepare(\`
    SELECT
      COALESCE(SUM(remaining),0) as total_debt,
      COALESCE(SUM(CASE WHEN status='OPEN' THEN remaining ELSE 0 END),0) as open_debt,
      COALESCE(SUM(CASE WHEN status='PARTIAL' THEN remaining ELSE 0 END),0) as partial_debt,
      COUNT(*) as open_invoices
    FROM finance_supplier_invoices
    WHERE status IN ('OPEN','PARTIAL') AND remaining > 0
  \`).get() as any;
  return row || { total_debt: 0, open_debt: 0, partial_debt: 0, open_invoices: 0 };
}

export function listSalaries(opts?: { year?: number; month?: number }) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: any[] = [];
  if (opts?.year) { where.push('period_year = ?'); params.push(opts.year); }
  if (opts?.month) { where.push('period_month = ?'); params.push(opts.month); }
  return db.prepare(\`
    SELECT * FROM finance_staff_salaries
    \${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY period_year DESC, period_month DESC, staff_name COLLATE NOCASE
  \`).all(...params);
}

export function createSalary(input: {
  morshid_id?: string | null; staff_name: string; period_year: number; period_month: number;
  amount: number; note?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الراتب مطلوب');
  const id = newId('sal');
  db.prepare(\`
    INSERT INTO finance_staff_salaries (
      id, morshid_id, staff_name, period_year, period_month, amount, status, paid_at, note, ledger_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NULL, ?, NULL, ?)
  \`).run(
    id, input.morshid_id || null, input.staff_name, input.period_year, input.period_month,
    amount, input.note || '', new Date().toISOString()
  );
  return db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id);
}

export function markSalaryPaid(id: string, created_by?: string) {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id) as any;
  if (!row) throw new Error('الراتب غير موجود');
  if (row.status === 'PAID') return row;
  const paid_at = new Date().toISOString();
  const led = createLedgerEntry({
    type: 'CASH_OUT',
    amount: row.amount,
    description: \`راتب: \${row.staff_name} — \${row.period_year}/\${row.period_month}\`,
    entry_date: paid_at.slice(0, 10),
    counterparty: row.staff_name,
    method: 'CASH',
    ref_table: 'finance_staff_salaries',
    ref_id: id,
    created_by: created_by || null,
    status: 'POSTED',
  }) as any;
  db.prepare(\`UPDATE finance_staff_salaries SET status = 'PAID', paid_at = ?, ledger_id = ? WHERE id = ?\`)
    .run(paid_at, led.id, id);
  return db.prepare('SELECT * FROM finance_staff_salaries WHERE id = ?').get(id);
}

export function listServices() {
  return getSqliteDb().prepare('SELECT * FROM finance_service_costs ORDER BY name_ar COLLATE NOCASE').all();
}

export function createService(input: {
  name_ar: string; frequency: ServiceFrequency; amount: number;
  next_due_date?: string; provider?: string; status?: string; note?: string;
}) {
  const db = getSqliteDb();
  const amount = Math.abs(Number(input.amount) || 0);
  if (!amount) throw new Error('مبلغ الخدمة مطلوب');
  const id = newId('svc');
  db.prepare(\`
    INSERT INTO finance_service_costs (
      id, name_ar, frequency, amount, next_due_date, provider, status, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`).run(
    id, input.name_ar, input.frequency, amount, input.next_due_date || todayISO(),
    input.provider || '', input.status || 'ACTIVE', input.note || '', new Date().toISOString()
  );
  return db.prepare('SELECT * FROM finance_service_costs WHERE id = ?').get(id);
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
  payment_date?: string; note?: string; created_by?: string;
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

  db.transaction(() => {
    db.prepare(\`
      INSERT INTO finance_service_payments (
        id, service_id, amount, method, payment_date, note, ledger_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    \`).run(id, input.service_id, amount, method, payment_date, input.note || '', input.created_by || null, created_at);

    const led = createLedgerEntry({
      type: 'SERVICE_SPEND',
      amount,
      description: \`خدمة: \${svc.name_ar}\`,
      entry_date: payment_date,
      counterparty: svc.provider || svc.name_ar,
      method,
      ref_table: 'finance_service_payments',
      ref_id: id,
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
  return db.prepare(\`
    SELECT * FROM finance_service_costs
    WHERE status = 'ACTIVE'
      AND next_due_date IS NOT NULL
      AND julianday(next_due_date) <= julianday('now') + ?
    ORDER BY next_due_date ASC
  \`).all(withinDays);
}

export function reportsSummary(from?: string, to?: string) {
  const db = getSqliteDb();
  const fromDate = from || '1970-01-01';
  const toDate = to || '2999-12-31';

  const cash_in = (db.prepare(\`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_ledger
    WHERE status='POSTED' AND type='CASH_IN' AND entry_date BETWEEN ? AND ?
  \`).get(fromDate, toDate) as any).v;

  const cash_out = (db.prepare(\`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_ledger
    WHERE status='POSTED' AND type IN ('EXPENSE','PURCHASE','SERVICE_SPEND','CASH_OUT')
      AND entry_date BETWEEN ? AND ?
  \`).get(fromDate, toDate) as any).v;

  const debt = supplierDebtSummary();
  const payroll_pending = (db.prepare(\`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_staff_salaries WHERE status='PENDING'
  \`).get() as any).v;
  const service_due = (db.prepare(\`
    SELECT COALESCE(SUM(amount),0) as v FROM finance_service_costs
    WHERE status='ACTIVE' AND next_due_date IS NOT NULL AND julianday(next_due_date) <= julianday('now') + 30
  \`).get() as any).v;

  const net = Number(cash_in) - Number(cash_out);
  const balRow = db.prepare(\`
    SELECT running_balance FROM finance_ledger WHERE status='POSTED'
    ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT 1
  \`).get() as any;

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
`);

console.log('finance.ts done');