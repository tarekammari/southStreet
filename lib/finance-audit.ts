import { getSqliteDb } from '@/lib/sqlite';
import type { FinanceAuthOk } from '@/lib/finance-auth';
import type { LoginRole } from '@/lib/roles';

export type FinanceAuditActor = {
  userId: string;
  userName: string;
  role: LoginRole | string;
};

export type FinanceAuditAction = 'create' | 'update' | 'delete' | 'void' | 'close_period' | 'reopen_period';

export function auditFinanceMutation(
  gate: FinanceAuthOk,
  action: FinanceAuditAction,
  entity: string,
  entity_id: string,
  before?: unknown,
  after?: unknown
) {
  writeFinanceAuditLog({
    actor: actorFromFinanceGate(gate),
    action,
    entity,
    entity_id,
    before,
    after,
  });
}

export function actorFromFinanceGate(gate: FinanceAuthOk): FinanceAuditActor {
  return {
    userId: String(gate.payload.sub || ''),
    userName: String(gate.payload.name || gate.payload.email || gate.payload.sub || 'unknown'),
    role: gate.role,
  };
}

function newAuditId() {
  return `faud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** Never throws — audit failure must not block finance writes. */
export function writeFinanceAuditLog(input: {
  actor?: FinanceAuditActor | null;
  action: FinanceAuditAction;
  entity: string;
  entity_id: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    const db = getSqliteDb();
    const created_at = new Date().toISOString();
    db.prepare(`
      INSERT INTO finance_audit_log (
        id, user_id, user_name, role, action, entity, entity_id, before_json, after_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newAuditId(),
      input.actor?.userId || null,
      input.actor?.userName || null,
      input.actor?.role ? String(input.actor.role) : null,
      input.action,
      input.entity,
      input.entity_id,
      safeJson(input.before),
      safeJson(input.after),
      created_at
    );
  } catch (err) {
    console.warn('[finance_audit]', err);
  }
}

export function listFinanceAuditLog(opts?: {
  from?: string;
  to?: string;
  entity?: string;
  action?: string;
  user?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getSqliteDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.from) {
    where.push('created_at >= ?');
    params.push(opts.from.length === 10 ? `${opts.from}T00:00:00.000Z` : opts.from);
  }
  if (opts?.to) {
    where.push('created_at <= ?');
    params.push(opts.to.length === 10 ? `${opts.to}T23:59:59.999Z` : opts.to);
  }
  if (opts?.entity) {
    where.push('entity = ?');
    params.push(opts.entity);
  }
  if (opts?.action) {
    where.push('action = ?');
    params.push(opts.action);
  }
  if (opts?.user) {
    where.push('(user_name LIKE ? OR user_id LIKE ?)');
    const like = `%${opts.user}%`;
    params.push(like, like);
  }
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  const offset = Math.max(0, opts?.offset ?? 0);
  const items = db
    .prepare(
      `SELECT id, user_id, user_name, role, action, entity, entity_id, before_json, after_json, created_at
       FROM finance_audit_log
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  const total = db
    .prepare(
      `SELECT COUNT(*) as n FROM finance_audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`
    )
    .get(...params) as { n: number };
  return { items, count: items.length, total: Number(total?.n) || 0 };
}
