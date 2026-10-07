import { getSqliteDb } from '@/lib/sqlite';
import { writeFinanceAuditLog, type FinanceAuditActor } from '@/lib/finance-audit';
import type { LoginRole } from '@/lib/roles';

export type FiscalPeriodStatus = 'open' | 'closed';

export type FiscalPeriodRow = {
  year: number;
  month: number;
  status: FiscalPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
};

function assertYm(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('السنة غير صالحة');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('الشهر غير صالح');
}

export function ensureFiscalPeriodRow(year: number, month: number): FiscalPeriodRow {
  assertYm(year, month);
  const db = getSqliteDb();
  const existing = db
    .prepare('SELECT * FROM finance_fiscal_periods WHERE year = ? AND month = ?')
    .get(year, month) as FiscalPeriodRow | undefined;
  if (existing) return existing;
  db.prepare(`
    INSERT INTO finance_fiscal_periods (year, month, status, closed_by, closed_at, reopened_by, reopened_at)
    VALUES (?, ?, 'open', NULL, NULL, NULL, NULL)
  `).run(year, month);
  return db.prepare('SELECT * FROM finance_fiscal_periods WHERE year = ? AND month = ?').get(year, month) as FiscalPeriodRow;
}

export function listFiscalPeriods(opts?: { year?: number }) {
  const db = getSqliteDb();
  if (opts?.year) {
    return db
      .prepare('SELECT * FROM finance_fiscal_periods WHERE year = ? ORDER BY month')
      .all(opts.year) as FiscalPeriodRow[];
  }
  return db.prepare('SELECT * FROM finance_fiscal_periods ORDER BY year DESC, month DESC LIMIT 60').all() as FiscalPeriodRow[];
}

export function periodStatusForDate(isoDate: string): FiscalPeriodStatus {
  const s = String(isoDate || '').slice(0, 10);
  if (!s || s.length < 7) return 'open';
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  if (!year || !month) return 'open';
  const row = getSqliteDb()
    .prepare('SELECT status FROM finance_fiscal_periods WHERE year = ? AND month = ?')
    .get(year, month) as { status: string } | undefined;
  return row?.status === 'closed' ? 'closed' : 'open';
}

export function isClosedPeriodDate(isoDate: string) {
  return periodStatusForDate(isoDate) === 'closed';
}

export function closeFiscalPeriod(
  year: number,
  month: number,
  actor: FinanceAuditActor,
  allowedRoles: Set<LoginRole> = new Set(['ACCOUNTANT', 'SUPER_ADMIN'])
) {
  if (!allowedRoles.has(actor.role as LoginRole)) {
    throw new Error('غير مصرح بإقفال الفترة');
  }
  assertYm(year, month);
  const before = ensureFiscalPeriodRow(year, month);
  if (before.status === 'closed') return before;
  const closed_at = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `UPDATE finance_fiscal_periods SET status = 'closed', closed_by = ?, closed_at = ?, reopened_by = NULL, reopened_at = NULL
       WHERE year = ? AND month = ?`
    )
    .run(actor.userName, closed_at, year, month);
  const after = ensureFiscalPeriodRow(year, month);
  writeFinanceAuditLog({
    actor,
    action: 'close_period',
    entity: 'fiscal_period',
    entity_id: `${year}-${String(month).padStart(2, '0')}`,
    before,
    after,
  });
  return after;
}

export function reopenFiscalPeriod(year: number, month: number, actor: FinanceAuditActor) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('إعادة الفتح للمسؤول العام فقط');
  }
  assertYm(year, month);
  const before = ensureFiscalPeriodRow(year, month);
  if (before.status === 'open') return before;
  const reopened_at = new Date().toISOString();
  getSqliteDb()
    .prepare(
      `UPDATE finance_fiscal_periods SET status = 'open', reopened_by = ?, reopened_at = ?
       WHERE year = ? AND month = ?`
    )
    .run(actor.userName, reopened_at, year, month);
  const after = ensureFiscalPeriodRow(year, month);
  writeFinanceAuditLog({
    actor,
    action: 'reopen_period',
    entity: 'fiscal_period',
    entity_id: `${year}-${String(month).padStart(2, '0')}`,
    before,
    after,
  });
  return after;
}

/** Bootstrap current year months as open (idempotent). */
export function bootstrapFiscalPeriodsForYear(year: number) {
  for (let m = 1; m <= 12; m++) ensureFiscalPeriodRow(year, m);
}
