/** Receipt row shape used for income / contract aggregation (one sale per client + programme). */
export type ReceiptContractRow = {
  id: string;
  pilgrimName?: string | null;
  pilgrimCode?: string | null;
  packageName?: string | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  remainingAmount?: number | null;
  date?: string | null;
  status?: string | null;
};

export type AggregatedReceiptContract = {
  key: string;
  program: string;
  pilgrimName: string;
  pilgrimCode: string;
  /** Contract price (invoiced once per client + programme). */
  contractTotal: number;
  collected: number;
  outstanding: number;
  payments: ReceiptContractRow[];
  lastPaymentDate: string;
  settled: boolean;
};

const programLabel = (name?: string | null) => String(name || '—').trim() || '—';

export function normalizeClientName(name?: string | null): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFKC')
    .toLowerCase();
}

export type ReceiptContractContext = {
  /** Normalized client name → agency customer code (from payments / bookings). */
  codeByName: Map<string, string>;
  /** Receipt id → linked finance payment (reservation + code). */
  paymentByReceiptId: Map<
    string,
    { reservation_id: string; customer_code: string; customer_name: string }
  >;
  /** programme + client identity → reservation (when any payment on that booking exists). */
  reservationByClientProgram: Map<string, string>;
  /** Receipt suffix `2026-509236` → reservation_id (from RES-2026-509236). */
  reservationIdBySuffix: Map<string, string>;
};

function addNameCode(map: Map<string, string>, name: string, code: string) {
  const n = normalizeClientName(name);
  const c = String(code || '').trim();
  if (n && c && !map.has(n)) map.set(n, c);
}

export function buildReceiptContractContext(
  payments: Array<{
    receipt_id?: string | null;
    reservation_id?: string | null;
    customer_name?: string | null;
    customer_code?: string | null;
    package_name?: string | null;
  }>,
  reservations?: Array<{
    reservation_id?: string | null;
    reference?: string | null;
    reservation_number?: string | null;
    customer_name?: string | null;
    customer_code?: string | null;
    package_name?: string | null;
  }>,
): ReceiptContractContext {
  const codeByName = new Map<string, string>();
  const paymentByReceiptId = new Map<
    string,
    { reservation_id: string; customer_code: string; customer_name: string }
  >();
  const reservationByClientProgram = new Map<string, string>();
  const reservationIdBySuffix = new Map<string, string>();

  const registerReservationNumber = (reservationId: string, number: string) => {
    const id = String(reservationId || '').trim();
    const raw = String(number || '').trim();
    if (!id || !raw) return;
    const m = raw.match(/(\d{4}-\d+)\s*$/);
    if (m) reservationIdBySuffix.set(m[1], id);
  };

  const paymentClientIdentity = (p: {
    customer_name?: string | null;
    customer_code?: string | null;
  }) => {
    const code = String(p.customer_code || '').trim();
    if (code) return `code:${code}`;
    const nameNorm = normalizeClientName(p.customer_name);
    return nameNorm ? `name:${nameNorm}` : 'name:unknown';
  };

  for (const p of payments) {
    addNameCode(codeByName, p.customer_name || '', p.customer_code || '');
    const receiptId = String(p.receipt_id || '').trim();
    const reservationId = String(p.reservation_id || '').trim();
    if (receiptId) {
      paymentByReceiptId.set(receiptId, {
        reservation_id: reservationId,
        customer_code: String(p.customer_code || '').trim(),
        customer_name: String(p.customer_name || '').trim(),
      });
    }
    if (reservationId) {
      const program = programLabel(p.package_name);
      const client = paymentClientIdentity(p);
      const slot = `${program}\u001f${client}`;
      if (!reservationByClientProgram.has(slot)) reservationByClientProgram.set(slot, reservationId);
    }
  }
  for (const r of reservations || []) {
    addNameCode(codeByName, r.customer_name || '', r.customer_code || '');
    registerReservationNumber(String(r.reservation_id || ''), r.reference || r.reservation_number || '');
  }
  return { codeByName, paymentByReceiptId, reservationByClientProgram, reservationIdBySuffix };
}

export function receiptReservationSuffix(receiptId: string): string {
  const m = String(receiptId || '').match(/^RCP-(\d{4}-\d+)/i);
  return m ? m[1] : '';
}

export function clientDisplayName(r: ReceiptContractRow, ctx?: ReceiptContractContext): string {
  const linked = ctx?.paymentByReceiptId.get(r.id);
  return String(r.pilgrimName || linked?.customer_name || '').trim();
}

export function resolveReservationId(r: ReceiptContractRow, ctx?: ReceiptContractContext): string {
  const linked = ctx?.paymentByReceiptId.get(r.id);
  const fromPayment = String(linked?.reservation_id || '').trim();
  if (fromPayment) return fromPayment;
  const suffix = receiptReservationSuffix(r.id);
  if (suffix && ctx?.reservationIdBySuffix.has(suffix)) {
    return ctx.reservationIdBySuffix.get(suffix) || '';
  }
  return '';
}

/** Client identity: code when known (including from linked payment), else normalized name. */
export function receiptClientIdentity(r: ReceiptContractRow, ctx?: ReceiptContractContext): string {
  const linked = ctx?.paymentByReceiptId.get(r.id);
  let code = String(r.pilgrimCode || '').trim();
  if (!code && linked?.customer_code) code = linked.customer_code;
  const nameNorm = normalizeClientName(r.pilgrimName || linked?.customer_name);
  if (!code && nameNorm && ctx?.codeByName.has(nameNorm)) {
    code = ctx.codeByName.get(nameNorm) || '';
  }
  if (code) return `code:${code}`;
  if (nameNorm) return `name:${nameNorm}`;
  return 'name:unknown';
}

/**
 * One booking per programme when reservation is known; otherwise one row per
 * normalized client name (avoids splitting SS-3210 vs usr_… on duplicate receipts).
 */
export function receiptContractKey(r: ReceiptContractRow, ctx?: ReceiptContractContext): string {
  const program = programLabel(r.packageName);
  const reservationId = resolveReservationId(r, ctx);
  if (reservationId) return `${program}\u001fres:${reservationId}`;

  const client = receiptClientIdentity(r, ctx);
  if (ctx) {
    const inferred = ctx.reservationByClientProgram.get(`${program}\u001f${client}`);
    if (inferred) return `${program}\u001fres:${inferred}`;
  }

  const nameNorm = normalizeClientName(clientDisplayName(r, ctx));
  return `${program}\u001fname:${nameNorm || 'unknown'}`;
}

/**
 * Each payment creates a receipt line with the full contract in `totalAmount` and this
 * payment in `paidAmount`. Totals must dedupe by client + programme.
 */
export function aggregateReceiptContracts(
  receipts: ReceiptContractRow[],
  ctx?: ReceiptContractContext,
): AggregatedReceiptContract[] {
  const map = new Map<string, AggregatedReceiptContract>();

  for (const r of receipts) {
    const key = receiptContractKey(r, ctx);
    const linked = ctx?.paymentByReceiptId.get(r.id);
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        program: programLabel(r.packageName),
        pilgrimName: String(r.pilgrimName || linked?.customer_name || '').trim(),
        pilgrimCode: String(r.pilgrimCode || linked?.customer_code || '').trim(),
        contractTotal: 0,
        collected: 0,
        outstanding: 0,
        payments: [],
        lastPaymentDate: '',
        settled: false,
      };
      map.set(key, c);
    }
    c.contractTotal = Math.max(c.contractTotal, Number(r.totalAmount) || 0);
    c.collected += Number(r.paidAmount) || 0;
    c.payments.push(r);
    const d = String(r.date || '');
    if (d > c.lastPaymentDate) c.lastPaymentDate = d;
  }

  let list = [...map.values()];
  for (const c of list) {
    c.outstanding = Math.max(0, c.contractTotal - c.collected);
    c.settled = c.outstanding <= 0;
    c.payments.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  list = mergeContractsByClientName(list);
  return list;
}

/** Safety merge when reservation/code metadata still split the same person + programme. */
function mergeContractsByClientName(contracts: AggregatedReceiptContract[]): AggregatedReceiptContract[] {
  const byName = new Map<string, AggregatedReceiptContract>();
  for (const c of contracts) {
    const slot = `${c.program}\u001f${normalizeClientName(c.pilgrimName)}`;
    const prev = byName.get(slot);
    if (!prev) {
      byName.set(slot, { ...c, payments: [...c.payments] });
      continue;
    }
    prev.contractTotal = Math.max(prev.contractTotal, c.contractTotal);
    prev.collected += c.collected;
    prev.pilgrimCode = prev.pilgrimCode || c.pilgrimCode;
    if (String(c.lastPaymentDate) > String(prev.lastPaymentDate)) {
      prev.lastPaymentDate = c.lastPaymentDate;
      prev.pilgrimName = c.pilgrimName || prev.pilgrimName;
    }
    const seen = new Set(prev.payments.map((p) => p.id));
    for (const p of c.payments) {
      if (!seen.has(p.id)) {
        prev.payments.push(p);
        seen.add(p.id);
      }
    }
    prev.key = prev.key || c.key;
  }
  for (const [slot, c] of byName.entries()) {
    c.key = slot;
    c.outstanding = Math.max(0, c.contractTotal - c.collected);
    c.settled = c.outstanding <= 0;
    c.payments.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  return [...byName.values()];
}

export function receiptContractTotals(contracts: AggregatedReceiptContract[]) {
  const billed = contracts.reduce((s, c) => s + c.contractTotal, 0);
  const collected = contracts.reduce((s, c) => s + c.collected, 0);
  const outstanding = contracts.reduce((s, c) => s + c.outstanding, 0);
  const settled = contracts.filter((c) => c.settled).length;
  return { billed, collected, outstanding, settled, contractCount: contracts.length };
}

export function billedByProgramFromContracts(contracts: AggregatedReceiptContract[]) {
  const m = new Map<string, number>();
  for (const c of contracts) {
    m.set(c.program, (m.get(c.program) || 0) + c.contractTotal);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function collectedByProgramFromContracts(contracts: AggregatedReceiptContract[]) {
  const m = new Map<string, number>();
  for (const c of contracts) {
    m.set(c.program, (m.get(c.program) || 0) + c.collected);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
