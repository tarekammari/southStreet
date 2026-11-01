/**
 * Segregation of duties for client money (maker / checker).
 *
 *  - The accountant validates payments (deposits, installments, receipts).
 *    The accountant's own entry at or under the threshold posts at once and is
 *    stamped "recorded and validated by the accountant".
 *  - An entry by anyone else (the Admin) waits as PENDING until an accountant
 *    who is not its recorder validates it.
 *  - Above the threshold (agency_settings.payment_approval_threshold, default
 *    300,000 DZD) and for reversals (voiding a payment / receipt = refund), the
 *    accountant prepares and the Super Admin approves (AWAITING_APPROVAL).
 *  - The Super Admin never validates in the normal way: only a break-glass
 *    override (written reason + fresh security-key tap), stamped as such, with
 *    a Connect notice to the accountants.
 *
 * Every step writes finance_audit_log + the security audit trail; both refuse
 * DELETE at the database level (triggers), and no UI edits them.
 */
import { getSqliteDb } from '@/lib/sqlite';
import { dbLogAudit } from '@/lib/db';
import { writeFinanceAuditLog, type FinanceAuditAction, type FinanceAuditActor } from '@/lib/finance-audit';
import {
  recordClientPayment,
  voidClientPayment,
  voidIncomeReceipt,
  type ClientPaymentSource,
} from '@/lib/finance';
import type { LoginRole } from '@/lib/roles';

export const DEFAULT_APPROVAL_THRESHOLD = 300_000;

export type RequestType = 'PAYMENT' | 'VOID_PAYMENT' | 'VOID_RECEIPT';
export type RequestStatus = 'PENDING' | 'AWAITING_APPROVAL' | 'VALIDATED' | 'REJECTED';
export type ValidationType = 'ACCOUNTANT' | 'SUPER_ADMIN_APPROVAL' | 'SUPER_ADMIN_OVERRIDE';

export const VALIDATION_LABELS: Record<ValidationType, string> = {
  ACCOUNTANT: 'اعتمدها المحاسب',
  SUPER_ADMIN_APPROVAL: 'وافق عليها المشرف العام',
  SUPER_ADMIN_OVERRIDE: 'اعتمدها المشرف العام (تجاوز الإدارة)',
};

export type Staff = { id: string; name: string; role: LoginRole };

export type PaymentPayload = {
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
};

export class ApprovalError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

/* ------------------------------------------------------------------ *
 * Schema (idempotent, run on first use)
 * ------------------------------------------------------------------ */

let schemaReady = false;

function ensureSchema() {
  if (schemaReady) return;
  const db = getSqliteDb();
  // Column names ending in _id / _type / status / amount stay plaintext so
  // they can be filtered; everything else is encrypted at rest by the wrapper.
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_payment_requests (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL NOT NULL,
      reservation_id TEXT,
      target_id TEXT,
      customer_name TEXT,
      payload TEXT,
      recorded_by_id TEXT,
      recorded_by_name TEXT,
      recorded_role TEXT,
      recorded_ts INTEGER,
      prepared_by_id TEXT,
      prepared_by_name TEXT,
      prepared_ts INTEGER,
      decided_by_id TEXT,
      decided_by_name TEXT,
      decided_role TEXT,
      decided_ts INTEGER,
      decision_type TEXT,
      reason TEXT,
      result_payment_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fpr_status ON finance_payment_requests(status);

    CREATE TRIGGER IF NOT EXISTS finance_payment_requests_no_delete
      BEFORE DELETE ON finance_payment_requests
      BEGIN SELECT RAISE(ABORT, 'finance_payment_requests is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS finance_audit_log_no_delete
      BEFORE DELETE ON finance_audit_log
      BEGIN SELECT RAISE(ABORT, 'finance_audit_log is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS finance_audit_log_no_rekey
      BEFORE UPDATE OF id, entity_id, user_id ON finance_audit_log
      BEGIN SELECT RAISE(ABORT, 'finance_audit_log is append-only'); END;
  `);
  const cols = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const add = (table: string, col: string, def: string) => {
    if (!cols(table).includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  add('finance_client_payments', 'validated_by_id', 'TEXT');
  add('finance_client_payments', 'validated_by', 'TEXT');
  add('finance_client_payments', 'validation_type', 'TEXT');
  add('finance_client_payments', 'validation_reason', 'TEXT');
  add('agency_settings', 'payment_approval_threshold', `REAL DEFAULT ${DEFAULT_APPROVAL_THRESHOLD}`);
  schemaReady = true;
}

/* ------------------------------------------------------------------ *
 * Threshold (agency setting)
 * ------------------------------------------------------------------ */

export function approvalThreshold(): number {
  ensureSchema();
  const row = getSqliteDb()
    .prepare("SELECT payment_approval_threshold FROM agency_settings WHERE id = 'main'")
    .get() as { payment_approval_threshold?: number | string | null } | undefined;
  const n = Number(row?.payment_approval_threshold);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_APPROVAL_THRESHOLD;
}

export function setApprovalThreshold(value: number, actor: Staff, ip = '') {
  ensureSchema();
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1000) throw new ApprovalError('الحد يجب أن يكون 1000 دج على الأقل');
  const before = approvalThreshold();
  getSqliteDb().prepare("UPDATE agency_settings SET payment_approval_threshold = ? WHERE id = 'main'").run(n);
  audit(actor, 'update', 'approval_threshold', 'main', { threshold: before }, {
    threshold: n,
    summary_ar: `تغيير حد موافقة المشرف العام من ${fmt(before)} إلى ${fmt(n)} دج`,
  }, ip);
  return n;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function fmt(n: number) {
  return Math.round(Number(n) || 0).toLocaleString('ar-DZ');
}

function newRequestId() {
  return `fpr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function audit(
  actor: Staff,
  action: FinanceAuditAction,
  entity: string,
  entityId: string,
  before: unknown,
  after: Record<string, unknown> & { summary_ar: string },
  ip = ''
) {
  const a: FinanceAuditActor = { userId: actor.id, userName: actor.name, role: actor.role };
  writeFinanceAuditLog({ actor: a, action, entity, entity_id: entityId, before, after });
  try {
    dbLogAudit(actor.name, actor.role, after.summary_ar.split(' — ')[0], `${entityId} — ${after.summary_ar}`, ip);
  } catch {
    /* security audit mirror is best-effort */
  }
}

export type PaymentRequest = {
  id: string;
  request_type: RequestType;
  status: RequestStatus;
  amount: number;
  reservation_id: string | null;
  target_id: string | null;
  customer_name: string;
  payload: PaymentPayload | null;
  recorded_by_id: string;
  recorded_by_name: string;
  recorded_role: string;
  recorded_ts: number;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
  prepared_ts: number | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decided_ts: number | null;
  decision_type: string | null;
  reason: string | null;
  result_payment_id: string | null;
};

function mapRow(row: any): PaymentRequest {
  let payload: PaymentPayload | null = null;
  try {
    payload = row.payload ? JSON.parse(row.payload) : null;
  } catch {
    payload = null;
  }
  return {
    ...row,
    amount: Number(row.amount) || 0,
    recorded_ts: Number(row.recorded_ts) || 0,
    prepared_ts: row.prepared_ts ? Number(row.prepared_ts) : null,
    decided_ts: row.decided_ts ? Number(row.decided_ts) : null,
    customer_name: String(row.customer_name || ''),
    payload,
  };
}

function getRequest(id: string): PaymentRequest {
  ensureSchema();
  const row = getSqliteDb().prepare('SELECT * FROM finance_payment_requests WHERE id = ?').get(id);
  if (!row) throw new ApprovalError('الطلب غير موجود', 404);
  return mapRow(row);
}

export function listOpenRequests(): PaymentRequest[] {
  ensureSchema();
  return (getSqliteDb()
    .prepare("SELECT * FROM finance_payment_requests WHERE status IN ('PENDING', 'AWAITING_APPROVAL')")
    .all() as any[])
    .map(mapRow)
    .sort((a, b) => b.recorded_ts - a.recorded_ts);
}

export function listRecentDecisions(limit = 30): PaymentRequest[] {
  ensureSchema();
  return (getSqliteDb()
    .prepare("SELECT * FROM finance_payment_requests WHERE status IN ('VALIDATED', 'REJECTED')")
    .all() as any[])
    .map(mapRow)
    .sort((a, b) => (b.decided_ts || 0) - (a.decided_ts || 0))
    .slice(0, limit);
}

function insertRequest(input: {
  type: RequestType;
  status: RequestStatus;
  amount: number;
  reservation_id?: string | null;
  target_id?: string | null;
  customer_name?: string | null;
  payload?: PaymentPayload | null;
  recorder: Staff;
  prepared?: boolean;
  reason?: string | null;
}): PaymentRequest {
  ensureSchema();
  const id = newRequestId();
  const now = Date.now();
  getSqliteDb().prepare(`
    INSERT INTO finance_payment_requests (
      id, request_type, status, amount, reservation_id, target_id, customer_name, payload,
      recorded_by_id, recorded_by_name, recorded_role, recorded_ts,
      prepared_by_id, prepared_by_name, prepared_ts, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.type, input.status, input.amount, input.reservation_id || null, input.target_id || null,
    input.customer_name || '', input.payload ? JSON.stringify(input.payload) : null,
    input.recorder.id, input.recorder.name, input.recorder.role, now,
    input.prepared ? input.recorder.id : null, input.prepared ? input.recorder.name : null, input.prepared ? now : null,
    input.reason || null
  );
  return getRequest(id);
}

function stampPayment(paymentId: string, by: Staff, type: ValidationType, reason?: string | null) {
  getSqliteDb()
    .prepare(
      'UPDATE finance_client_payments SET validated_by_id = ?, validated_by = ?, validation_type = ?, validation_reason = ? WHERE id = ?'
    )
    .run(by.id, by.name, type, reason || null, paymentId);
}

function requestLabel(r: Pick<PaymentRequest, 'request_type' | 'amount' | 'customer_name'>) {
  const what =
    r.request_type === 'VOID_PAYMENT' ? 'إلغاء دفعة' : r.request_type === 'VOID_RECEIPT' ? 'إلغاء سند قبض' : 'دفعة';
  return `${what} ${fmt(r.amount)} دج${r.customer_name ? ` — ${r.customer_name}` : ''}`;
}

/* ------------------------------------------------------------------ *
 * Connect notices
 * ------------------------------------------------------------------ */

function notifyRole(from: Staff, role: LoginRole, text: string) {
  // Lazy import: Connect pulls in push / bus modules the finance code does not need otherwise.
  void (async () => {
    try {
      const [{ activeUsers, saveConnectMessage, userById }, { pushTo }, { buildDmChatId }] = await Promise.all([
        import('@/lib/connect/store'),
        import('@/lib/connect/push'),
        import('@/lib/chat-utils'),
      ]);
      const sender = userById(from.id);
      if (!sender) return;
      for (const to of activeUsers().filter((u) => u.role === role && u.id !== from.id)) {
        const chatId = buildDmChatId(sender.id, to.id);
        const msg = saveConnectMessage(sender, chatId, { kind: 'text', text });
        void pushTo(to.id, {
          kind: 'message', title: sender.name, body: text.slice(0, 140), tag: `chat-${chatId}`,
          url: `/connect?chat=${sender.id}`, msgId: msg.id, chatId,
        });
      }
    } catch (err) {
      console.warn('[finance-approvals] notice', err);
    }
  })();
}

/* ------------------------------------------------------------------ *
 * Execution (the only place money actually moves)
 * ------------------------------------------------------------------ */

function execute(req: PaymentRequest, by: Staff, type: ValidationType, reason: string | null) {
  if (req.request_type === 'PAYMENT') {
    if (!req.payload) throw new ApprovalError('بيانات الدفعة مفقودة');
    const row = recordClientPayment({ ...req.payload, created_by: req.recorded_by_name });
    stampPayment(row.id, by, type, reason);
    return { result_id: row.id, result: row };
  }
  if (req.request_type === 'VOID_PAYMENT') {
    const row = voidClientPayment(String(req.target_id));
    return { result_id: String(req.target_id), result: row };
  }
  const row = voidIncomeReceipt(String(req.target_id));
  return { result_id: String(req.target_id), result: row };
}

function decide(
  req: PaymentRequest,
  by: Staff,
  type: ValidationType,
  reason: string | null,
  ip: string
) {
  const db = getSqliteDb();
  let outcome: ReturnType<typeof execute> | null = null;
  db.transaction(() => {
    // Re-read inside the transaction: two people pressing at once cannot both win.
    const fresh = getRequest(req.id);
    if (fresh.status !== req.status) throw new ApprovalError('تمت معالجة هذا الطلب بالفعل', 409);
    outcome = execute(fresh, by, type, reason);
    db.prepare(`
      UPDATE finance_payment_requests SET status = 'VALIDATED', decided_by_id = ?, decided_by_name = ?,
        decided_role = ?, decided_ts = ?, decision_type = ?, reason = COALESCE(?, reason), result_payment_id = ?
      WHERE id = ?
    `).run(by.id, by.name, by.role, Date.now(), type, reason, outcome.result_id, req.id);
  })();
  const label = requestLabel(req);
  audit(
    by,
    type === 'SUPER_ADMIN_OVERRIDE' ? 'override' : type === 'SUPER_ADMIN_APPROVAL' ? 'approve' : 'validate',
    req.request_type === 'VOID_RECEIPT' ? 'receipt' : 'client_payment',
    outcome!.result_id,
    { request_id: req.id, status: req.status, recorded_by: req.recorded_by_name },
    {
      request_id: req.id,
      status: 'VALIDATED',
      amount: req.amount,
      validation_type: type,
      reason,
      summary_ar: `${VALIDATION_LABELS[type]} — ${label}${reason ? ` — السبب: ${reason}` : ''}`,
    },
    ip
  );
  return outcome!;
}

/* ------------------------------------------------------------------ *
 * Entry points used by the API handler
 * ------------------------------------------------------------------ */

function requireReason(reason: unknown) {
  const text = String(reason || '').trim();
  if (text.length < 5) throw new ApprovalError('اكتب سبب تجاوز الإدارة (5 أحرف على الأقل)', 400, 'REASON_REQUIRED');
  return text.slice(0, 500);
}

/** Who gets what: recording a client payment. Step-up is checked by the caller for the Super Admin. */
export function submitClientPayment(payload: PaymentPayload, by: Staff, opts: { overrideReason?: string; ip?: string } = {}) {
  ensureSchema();
  const amount = Math.abs(Number(payload.amount) || 0);
  if (!amount) throw new ApprovalError('المبلغ مطلوب');
  const clean: PaymentPayload = { ...payload, amount };
  const ip = opts.ip || '';

  if (by.role === 'SUPER_ADMIN') {
    // Break-glass: posted now, stamped as an override, accountants told.
    const reason = requireReason(opts.overrideReason);
    const req = insertRequest({ type: 'PAYMENT', status: 'PENDING', amount, reservation_id: clean.reservation_id, customer_name: clean.customer_name, payload: clean, recorder: by });
    const out = decide(req, by, 'SUPER_ADMIN_OVERRIDE', reason, ip);
    notifyRole(by, 'ACCOUNTANT', `⚠️ تجاوز الإدارة: سجّل المشرف العام واعتمد ${requestLabel(req)}. السبب: ${reason}`);
    return { status: 'VALIDATED' as const, queued: false, request_id: req.id, payment: out.result, message: 'سُجّلت الدفعة بتجاوز الإدارة وأُبلغ المحاسب' };
  }

  if (by.role === 'ACCOUNTANT') {
    if (amount > approvalThreshold()) {
      const req = insertRequest({ type: 'PAYMENT', status: 'AWAITING_APPROVAL', amount, reservation_id: clean.reservation_id, customer_name: clean.customer_name, payload: clean, recorder: by, prepared: true });
      audit(by, 'create', 'payment_request', req.id, null, { status: req.status, amount, summary_ar: `طلب موافقة المشرف العام — ${requestLabel(req)}` }, ip);
      notifyRole(by, 'SUPER_ADMIN', `طلب موافقة: ${requestLabel(req)} — يتجاوز حد ${fmt(approvalThreshold())} دج.`);
      return { status: req.status, queued: true, request_id: req.id, message: `المبلغ يتجاوز ${fmt(approvalThreshold())} دج — أُرسل للمشرف العام للموافقة` };
    }
    // The accountant's own entry under the threshold: recorded and validated in one step.
    const row = recordClientPayment({ ...clean, created_by: by.name });
    stampPayment(row.id, by, 'ACCOUNTANT', null);
    audit(by, 'validate', 'client_payment', row.id, null, {
      status: 'VALIDATED', amount, validation_type: 'ACCOUNTANT',
      summary_ar: `${VALIDATION_LABELS.ACCOUNTANT} (تسجيل واعتماد) — دفعة ${fmt(amount)} دج${clean.customer_name ? ` — ${clean.customer_name}` : ''}`,
    }, ip);
    return { status: 'VALIDATED' as const, queued: false, payment: row, message: 'سُجّلت الدفعة واعتُمدت' };
  }

  if (by.role === 'AGENCY_MANAGER') {
    const req = insertRequest({ type: 'PAYMENT', status: 'PENDING', amount, reservation_id: clean.reservation_id, customer_name: clean.customer_name, payload: clean, recorder: by });
    audit(by, 'create', 'payment_request', req.id, null, { status: req.status, amount, summary_ar: `دفعة بانتظار اعتماد المحاسب — ${requestLabel(req)}` }, ip);
    notifyRole(by, 'ACCOUNTANT', `دفعة جديدة بانتظار اعتمادك: ${requestLabel(req)} (سجّلها ${by.name}).`);
    return { status: req.status, queued: true, request_id: req.id, message: 'سُجّلت الدفعة — بانتظار اعتماد المحاسب' };
  }

  throw new ApprovalError('تسجيل الدفعات من صلاحية المحاسب', 403, 'FORBIDDEN');
}

/** Voiding a posted payment / receipt reverses money: the accountant prepares, the Super Admin approves. */
export function submitVoid(kind: 'payment' | 'receipt', targetId: string, by: Staff, opts: { overrideReason?: string; reason?: string; ip?: string } = {}) {
  ensureSchema();
  if (by.role !== 'SUPER_ADMIN' && by.role !== 'ACCOUNTANT') {
    throw new ApprovalError('إلغاء الدفعات يحضّره المحاسب ويوافق عليه المشرف العام', 403, 'FORBIDDEN');
  }
  const id = String(targetId || '').trim();
  if (!id) throw new ApprovalError('المعرّف مطلوب');
  const db = getSqliteDb();
  const target = kind === 'payment'
    ? (db.prepare('SELECT amount, customer_name, reservation_id FROM finance_client_payments WHERE id = ?').get(id) as any)
    : (db.prepare('SELECT paidAmount AS amount, pilgrimName AS customer_name FROM receipts WHERE id = ?').get(id) as any);
  if (!target) throw new ApprovalError(kind === 'payment' ? 'الدفعة غير موجودة' : 'السند غير موجود', 404);
  const type: RequestType = kind === 'payment' ? 'VOID_PAYMENT' : 'VOID_RECEIPT';
  const open = listOpenRequests().find((r) => r.request_type === type && r.target_id === id);
  if (open) throw new ApprovalError('يوجد طلب إلغاء مفتوح لهذا السجل', 409);
  const base = { type, amount: Number(target.amount) || 0, target_id: id, reservation_id: target.reservation_id || null, customer_name: target.customer_name, recorder: by };
  const ip = opts.ip || '';

  if (by.role === 'SUPER_ADMIN') {
    const reason = requireReason(opts.overrideReason);
    const req = insertRequest({ ...base, status: 'PENDING' });
    decide(req, by, 'SUPER_ADMIN_OVERRIDE', reason, ip);
    notifyRole(by, 'ACCOUNTANT', `⚠️ تجاوز الإدارة: ${requestLabel(req)} نفّذه المشرف العام. السبب: ${reason}`);
    return { status: 'VALIDATED' as const, queued: false, request_id: req.id, message: 'نُفّذ الإلغاء بتجاوز الإدارة وأُبلغ المحاسب' };
  }
  // The accountant prepares; the Super Admin approves.
  const reason = String(opts.reason || '').trim().slice(0, 500) || null;
  const req = insertRequest({ ...base, status: 'AWAITING_APPROVAL', prepared: true, reason });
  audit(by, 'create', 'payment_request', req.id, null, { status: req.status, amount: req.amount, reason, summary_ar: `طلب موافقة المشرف العام — ${requestLabel(req)}` }, ip);
  notifyRole(by, 'SUPER_ADMIN', `طلب موافقة: ${requestLabel(req)}${reason ? ` — ${reason}` : ''}.`);
  return { status: req.status, queued: true, request_id: req.id, message: 'أُرسل طلب الإلغاء للمشرف العام للموافقة' };
}

/** Accountant checks a payment someone else recorded. */
export function validateRequest(id: string, by: Staff, ip = '') {
  const req = getRequest(id);
  if (by.role !== 'ACCOUNTANT') throw new ApprovalError('اعتماد الدفعات من صلاحية المحاسب', 403, 'FORBIDDEN');
  if (req.status !== 'PENDING') throw new ApprovalError('هذا الطلب ليس بانتظار المحاسب', 409);
  if (req.recorded_by_id === by.id) {
    throw new ApprovalError('لا يمكنك اعتماد دفعة سجّلتها بنفسك — يعتمدها محاسب آخر', 403, 'SELF_VALIDATION');
  }
  if (req.amount > approvalThreshold()) {
    // Above the threshold the accountant only prepares; the Super Admin approves.
    getSqliteDb().prepare(`
      UPDATE finance_payment_requests SET status = 'AWAITING_APPROVAL', prepared_by_id = ?, prepared_by_name = ?, prepared_ts = ?
      WHERE id = ? AND status = 'PENDING'
    `).run(by.id, by.name, Date.now(), id);
    audit(by, 'update', 'payment_request', id, { status: 'PENDING' }, { status: 'AWAITING_APPROVAL', amount: req.amount, summary_ar: `حضّرها المحاسب — بانتظار موافقة المشرف العام — ${requestLabel(req)}` }, ip);
    notifyRole(by, 'SUPER_ADMIN', `طلب موافقة: ${requestLabel(req)} — يتجاوز حد ${fmt(approvalThreshold())} دج.`);
    return { status: 'AWAITING_APPROVAL' as const, message: 'المبلغ فوق الحد — أُرسل للمشرف العام للموافقة' };
  }
  decide(req, by, 'ACCOUNTANT', null, ip);
  return { status: 'VALIDATED' as const, message: 'اعتُمدت الدفعة' };
}

/** Super Admin approves what an accountant prepared (step-up checked by the caller). */
export function approveRequest(id: string, by: Staff, ip = '') {
  const req = getRequest(id);
  if (by.role !== 'SUPER_ADMIN') throw new ApprovalError('الموافقة من صلاحية المشرف العام', 403, 'FORBIDDEN');
  if (req.status !== 'AWAITING_APPROVAL') throw new ApprovalError('هذا الطلب ليس بانتظار موافقتك', 409);
  if (req.recorded_by_id === by.id || req.prepared_by_id === by.id) {
    throw new ApprovalError('لا يمكن الموافقة على طلب حضّرته بنفسك', 403, 'SELF_VALIDATION');
  }
  decide(req, by, 'SUPER_ADMIN_APPROVAL', null, ip);
  notifyRole(by, 'ACCOUNTANT', `✅ وافق المشرف العام على ${requestLabel(req)}.`);
  return { status: 'VALIDATED' as const, message: 'تمت الموافقة' };
}

/** Super Admin break-glass on a request still waiting for the accountant (step-up checked by the caller). */
export function overrideRequest(id: string, by: Staff, reasonInput: unknown, ip = '') {
  const req = getRequest(id);
  if (by.role !== 'SUPER_ADMIN') throw new ApprovalError('تجاوز الإدارة من صلاحية المشرف العام', 403, 'FORBIDDEN');
  if (req.status !== 'PENDING' && req.status !== 'AWAITING_APPROVAL') throw new ApprovalError('تمت معالجة هذا الطلب', 409);
  if (req.recorded_by_id === by.id) throw new ApprovalError('لا يمكن اعتماد طلب سجّلته بنفسك', 403, 'SELF_VALIDATION');
  const reason = requireReason(reasonInput);
  decide(req, by, 'SUPER_ADMIN_OVERRIDE', reason, ip);
  notifyRole(by, 'ACCOUNTANT', `⚠️ تجاوز الإدارة: اعتمد المشرف العام ${requestLabel(req)}. السبب: ${reason}`);
  return { status: 'VALIDATED' as const, message: 'اعتُمد الطلب بتجاوز الإدارة وأُبلغ المحاسب' };
}

export function rejectRequest(id: string, by: Staff, reasonInput: unknown, ip = '') {
  const req = getRequest(id);
  const reason = String(reasonInput || '').trim().slice(0, 500);
  if (reason.length < 3) throw new ApprovalError('اكتب سبب الرفض');
  const allowed =
    (req.status === 'PENDING' && (by.role === 'ACCOUNTANT' || by.id === req.recorded_by_id)) ||
    (req.status === 'AWAITING_APPROVAL' && (by.role === 'SUPER_ADMIN' || by.id === req.prepared_by_id));
  if (!allowed) throw new ApprovalError('لا يمكنك رفض هذا الطلب', 403, 'FORBIDDEN');
  const changed = getSqliteDb().prepare(`
    UPDATE finance_payment_requests SET status = 'REJECTED', decided_by_id = ?, decided_by_name = ?, decided_role = ?,
      decided_ts = ?, decision_type = 'REJECTED', reason = ?
    WHERE id = ? AND status = ?
  `).run(by.id, by.name, by.role, Date.now(), reason, id, req.status);
  if (!changed.changes) throw new ApprovalError('تمت معالجة هذا الطلب بالفعل', 409);
  audit(by, 'reject', 'payment_request', id, { status: req.status }, { status: 'REJECTED', amount: req.amount, reason, summary_ar: `رفض — ${requestLabel(req)} — السبب: ${reason}` }, ip);
  return { status: 'REJECTED' as const, message: 'رُفض الطلب' };
}
