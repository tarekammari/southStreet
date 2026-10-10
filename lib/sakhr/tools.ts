import { normalizeLoginRole, LOGIN_ROLE_LABELS, type LoginRole } from '@/lib/roles';
import { ADMIN_TABLES, canReadTable, canWriteTable, REDIRECT_TABLES } from '@/lib/admin-tables';
import { formatProgramDate, programAvailability, programMinPrice, AVAILABILITY_LABEL } from '@/lib/program-display';
import { callRoute, type CallerContext } from '@/lib/sakhr/route-call';
import { toolGetTeamMembers, toolSearchKnowledge } from '@/lib/ai-tools';
import { GET as packagesGET, POST as packagesPOST } from '@/app/api/admin/packages/route';
import { getColumnLabelAr } from '@/lib/table-column-labels';
import { GET as hotelsGET } from '@/app/api/admin/hotels/route';
import { GET as myBookingsGET } from '@/app/api/bookings/route';
import { GET as bookingQueueGET, POST as bookingDecisionPOST } from '@/app/api/bookings/confirm/route';
import { GET as tablesGET, POST as tablesPOST } from '@/app/api/admin/db-tables/route';
import { GET as usersGET, POST as usersPOST, PATCH as usersPATCH } from '@/app/api/admin/users/route';
import { GET as treasuryGET } from '@/app/api/finance/treasury/route';
import { getSqliteDb } from '@/lib/sqlite';
import { reservationStatusLabel } from '@/lib/booking-catalog';
import { sanitizeVisual, type VisualSpec } from '@/lib/sakhr/visual';

/**
 * Sakhr's tools. Each one runs through the app's own API handler with the
 * user's credentials (lib/sakhr/route-call.ts), so a tool can never do more
 * than that user could do by hand. `roles` only decides which tools the model
 * is offered; the handlers still enforce every rule.
 *
 * `kind`:
 *  - read   — runs immediately, result goes back to the model;
 *  - write  — never runs from the model: it becomes a confirmation card the
 *             user approves (app/api/ai/sakhr/action);
 *  - client — a UI action (open a page or a table) done by the browser.
 */

export type Who = LoginRole | 'ANON';

export type ToolContext = CallerContext & { role: Who; userId?: string };

export type ToolResult = { ok: boolean; data?: unknown; error?: string; status?: number; visual?: VisualSpec };

export type ClientAction =
  | { type: 'navigate'; href: string }
  | { type: 'open_table'; table: string }
  | { type: 'visual'; visual: VisualSpec };

export type SakhrTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  roles: Who[];
  kind: 'read' | 'write' | 'client';
  /** read / write tools */
  run?: (ctx: ToolContext, args: any) => Promise<ToolResult>;
  /** write tools: one Arabic line for the confirmation card */
  summarize?: (args: any) => string;
  /** client tools */
  clientAction?: (args: any, role: Who) => ClientAction | { error: string };
};

const EVERYONE: Who[] = ['ANON', 'PILGRIM_USER', 'AGENCY_AGENT', 'GUIDE_MURSHID', 'ACCOUNTANT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];
const SIGNED_IN: Who[] = EVERYONE.filter((r) => r !== 'ANON');
const STAFF: Who[] = ['AGENCY_AGENT', 'ACCOUNTANT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];
const FINANCE: Who[] = ['ACCOUNTANT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];
const ADMINS: Who[] = ['AGENCY_MANAGER', 'SUPER_ADMIN'];

const MANAGEABLE_TABLES = Object.keys(ADMIN_TABLES);

/* ------------------------------------------------------------------ *
 * Output shaping: keep tool results small, useful and free of secrets.
 * ------------------------------------------------------------------ */

function clip(value: unknown, max = 160): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}…` : value;
  if (Array.isArray(value)) return value.length > 6 ? [...value.slice(0, 6).map((v) => clip(v, 60)), `(+${value.length - 6})`] : value.map((v) => clip(v, 60));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 14)) out[k] = clip(v, 80);
    return out;
  }
  return value;
}

function compactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (/hash|password|secret|token|fingerprint/i.test(k)) continue;
    if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = clip(v);
  }
  return out;
}

function fail(res: { status: number; data: any }): ToolResult {
  return { ok: false, status: res.status, error: String(res.data?.error || 'تعذّر تنفيذ الطلب') };
}

function money(n: unknown): string {
  return `${(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
}

function tableLabel(table: string): string {
  return ADMIN_TABLES[table]?.label || table;
}

function fieldsPreview(fields: Record<string, unknown> = {}): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
    .slice(0, 6)
    .map(([k, v]) => `${getColumnLabelAr(k)}: ${String(v).slice(0, 40)}`)
    .join('، ');
}

const MONTHS: Record<string, number> = {
  'جانفي': 1, 'يناير': 1, 'فيفري': 2, 'فبراير': 2, 'مارس': 3, 'أفريل': 4, 'ابريل': 4, 'أبريل': 4, 'ماي': 5, 'مايو': 5,
  'جوان': 6, 'يونيو': 6, 'جويلية': 7, 'يوليو': 7, 'أوت': 8, 'اوت': 8, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10,
  'نوفمبر': 11, 'ديسمبر': 12,
};

/** Date columns are stored as YYYY-MM-DD; the model sometimes writes "20 أكتوبر 2026". */
function isoDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const m = text.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  const month = m ? MONTHS[m[2]] : undefined;
  if (!m || !month) return value;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function normalizeFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, /date$/i.test(k) ? isoDate(v) : v]));
}

/** Columns the server derives or that must not travel to a copy. */
const COPY_SKIP = new Set(['reserved', 'available', 'published', 'featured', 'createdAt', 'updatedAt', 'updated_at']);

const ROOM_LABEL: Record<string, string> = { QUAD: 'رباعية', TRIPLE: 'ثلاثية', DOUBLE: 'ثنائية', SINGLE: 'فردية' };

/** Full (decrypted, unclipped) admin view of one programme, prices included. */
async function programById(ctx: ToolContext, id: string): Promise<any | null> {
  const res = await callRoute(packagesGET as any, ctx, { path: '/api/admin/packages' });
  if (!res.ok || !Array.isArray(res.data)) return null;
  return (res.data as any[]).find((p) => p.package_id === id) || null;
}

/** Saves room prices (and keeps the programme's options) through the packages API. */
async function saveProgramPrices(ctx: ToolContext, id: string, annex: unknown, prices: { room_type: string; amount: number }[]) {
  return callRoute(packagesPOST as any, ctx, {
    path: '/api/admin/packages',
    method: 'POST',
    body: { options_only: true, package_id: id, annex_options: annex, prices },
  });
}

/** Primary key column for a table, read from the editor route's schema. */
async function tableSchema(ctx: ToolContext, table: string) {
  const res = await callRoute(tablesGET as any, ctx, { path: '/api/admin/db-tables', query: { table, limit: 1 } });
  if (!res.ok) return null;
  const columns = (res.data.columns || []) as { name: string; type: string; pk: boolean; notnull: boolean; hasDefault: boolean; labelAr?: string }[];
  return { columns, pk: columns.find((c) => c.pk) };
}

/** Agency figures for reports and charts. Money only for finance roles. */
function agencyStats(role: Who, months: number) {
  const db = getSqliteDb();
  const money = FINANCE.includes(role);
  const rows = db.prepare('SELECT reservation_status, total_price, paid_amount, created_at, invoice FROM reservations').all() as any[];
  const totalOf = (r: any) => {
    try {
      const inv = typeof r.invoice === 'string' ? JSON.parse(r.invoice) : r.invoice;
      if (inv && Number(inv.total)) return Number(inv.total);
    } catch {
      /* fall back to the stored price */
    }
    return Number(r.total_price) || 0;
  };

  const byStatus: Record<string, number> = {};
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth = Object.fromEntries(monthKeys.map((k) => [k, { requests: 0, value: 0, paid: 0 }]));
  let value = 0;
  let paid = 0;
  for (const r of rows) {
    const label = reservationStatusLabel(r.reservation_status);
    byStatus[label] = (byStatus[label] || 0) + 1;
    const key = String(r.created_at || '').slice(0, 7);
    const refused = ['REJECTED', 'CANCELLED'].includes(String(r.reservation_status || '').toUpperCase());
    if (byMonth[key]) {
      byMonth[key].requests += 1;
      if (!refused) byMonth[key].value += totalOf(r);
      byMonth[key].paid += Number(r.paid_amount) || 0;
    }
    if (!refused) value += totalOf(r);
    paid += Number(r.paid_amount) || 0;
  }

  const programs = (db.prepare('SELECT name, capacity, reserved, available, start_date FROM packages').all() as any[]).map((p) => ({
    program: p.name,
    start: p.start_date,
    capacity: Number(p.capacity) || 0,
    reserved: Number(p.reserved) || 0,
    available: Number(p.available) || 0,
  }));

  let paymentsByMonth: Record<string, number> | undefined;
  if (money) {
    paymentsByMonth = Object.fromEntries(monthKeys.map((k) => [k, 0]));
    try {
      for (const p of db.prepare('SELECT amount, entry_date, created_at, status FROM finance_client_payments').all() as any[]) {
        if (String(p.status || 'POSTED').toUpperCase() !== 'POSTED') continue;
        const key = String(p.entry_date || p.created_at || '').slice(0, 7);
        if (key in paymentsByMonth) paymentsByMonth[key] += Number(p.amount) || 0;
      }
    } catch {
      /* no payments table yet */
    }
  }

  const months_ = monthKeys.map((k) => ({
    month: k,
    requests: byMonth[k].requests,
    ...(money ? { booked_value_dzd: byMonth[k].value, paid_on_bookings_dzd: byMonth[k].paid, payments_received_dzd: paymentsByMonth?.[k] || 0 } : {}),
  }));
  return {
    totals: {
      requests: rows.length,
      ...(money ? { booked_value_dzd: value, paid_dzd: paid, outstanding_dzd: Math.max(0, value - paid) } : {}),
      seats_capacity: programs.reduce((s, p) => s + p.capacity, 0),
      seats_reserved: programs.reduce((s, p) => s + p.reserved, 0),
    },
    by_status: byStatus,
    by_month: months_,
    programs,
    currency: 'DZD',
  };
}

const MONTHS_AR = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_AR[(m || 1) - 1]} ${String(y).slice(2)}`;
};

/** Standard reports built on the server from exact figures (one tool call, no numbers typed by the model). */
function buildReport(kind: string, role: Who, months: number): { visual: VisualSpec; summary: Record<string, unknown> } {
  const st = agencyStats(role, months);
  const money = FINANCE.includes(role);
  const t = st.totals as Record<string, number>;
  const labels = st.by_month.map((m) => monthLabel(m.month));
  const statusLabels = Object.keys(st.by_status);

  if (kind === 'programs') {
    const progs = st.programs.slice(0, 12);
    return {
      visual: {
        title: 'امتلاء البرامج',
        subtitle: `${progs.length} برنامج · ${t.seats_reserved} مقعد محجوز من ${t.seats_capacity}`,
        kpis: [
          { label: 'المقاعد الكلية', value: t.seats_capacity, unit: 'مقعد' },
          { label: 'المحجوزة', value: t.seats_reserved, unit: 'مقعد' },
          { label: 'نسبة الامتلاء', value: t.seats_capacity ? Math.round((t.seats_reserved / t.seats_capacity) * 100) : 0, unit: '%' },
        ],
        charts: progs.length
          ? [{ type: 'hbar', title: 'المقاعد المحجوزة والمتاحة لكل برنامج', unit: 'مقعد', labels: progs.map((p) => p.program), series: [{ name: 'محجوز', values: progs.map((p) => p.reserved) }, { name: 'متاح', values: progs.map((p) => p.available) }] }]
          : undefined,
        table: progs.length
          ? { columns: ['البرنامج', 'الانطلاق', 'السعة', 'محجوز', 'متاح'], rows: progs.map((p) => [p.program, String(p.start || '—'), p.capacity, p.reserved, p.available]) }
          : undefined,
      },
      summary: { programs: progs.length, seats_capacity: t.seats_capacity, seats_reserved: t.seats_reserved },
    };
  }

  if (kind === 'finance' && money) {
    return {
      visual: {
        title: 'الحالة المالية للحجوزات',
        subtitle: `آخر ${months} أشهر · بالدينار الجزائري`,
        kpis: [
          { label: 'قيمة الحجوزات', value: t.booked_value_dzd, unit: 'دج' },
          { label: 'المحصّل', value: t.paid_dzd, unit: 'دج' },
          { label: 'المتبقي', value: t.outstanding_dzd, unit: 'دج' },
        ],
        charts: [
          { type: 'area', title: 'المبالغ المحصّلة شهرياً', unit: 'دج', labels, series: [{ name: 'المحصّل', values: st.by_month.map((m: any) => m.payments_received_dzd || m.paid_on_bookings_dzd || 0) }] },
          { type: 'bar', title: 'قيمة الحجوزات الجديدة شهرياً', unit: 'دج', labels, series: [{ name: 'قيمة الحجوزات', values: st.by_month.map((m: any) => m.booked_value_dzd || 0) }] },
        ],
      },
      summary: { booked_value_dzd: t.booked_value_dzd, paid_dzd: t.paid_dzd, outstanding_dzd: t.outstanding_dzd },
    };
  }

  // overview
  return {
    visual: {
      title: 'نشاط الوكالة',
      subtitle: `آخر ${months} أشهر`,
      kpis: [
        { label: 'طلبات العمرة', value: t.requests, unit: 'طلب' },
        ...(money ? [{ label: 'المحصّل', value: t.paid_dzd, unit: 'دج' }, { label: 'المتبقي', value: t.outstanding_dzd, unit: 'دج' }] : []),
        { label: 'المقاعد المحجوزة', value: t.seats_reserved, unit: `من ${t.seats_capacity}` },
      ],
      charts: [
        { type: 'bar', title: 'الطلبات الجديدة شهرياً', unit: 'طلب', labels, series: [{ name: 'الطلبات', values: st.by_month.map((m) => m.requests) }] },
        ...(statusLabels.length
          ? [{ type: 'donut' as const, title: 'الطلبات حسب الحالة', unit: 'طلب', labels: statusLabels, series: [{ name: 'الطلبات', values: statusLabels.map((k) => st.by_status[k]) }] }]
          : []),
      ],
    },
    summary: { totals: st.totals, by_status: st.by_status },
  };
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

export const SAKHR_TOOLS: SakhrTool[] = [
  {
    name: 'search_programs',
    description:
      'Search the agency Umrah/Hajj programs (trips): dates, duration, hotels, airline, price from, seats left and whether booking is open. Use for any question about trips, prices or availability.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional words to match in the program name, hotel, airline or season.' },
        include_past: { type: 'boolean', description: 'Include programs whose departure has passed.' },
      },
    },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, args) => {
      const res = await callRoute(packagesGET as any, ctx, { path: '/api/admin/packages' });
      if (!res.ok || !Array.isArray(res.data)) return fail(res);
      const q = String(args?.query || '').trim().toLowerCase();
      const rows = (res.data as any[])
        .filter((p) => args?.include_past || programAvailability(p) !== 'expired')
        .filter((p) => !q || [p.name, p.makkah_hotel_name, p.madinah_hotel_name, p.airline, p.season_name].join(' ').toLowerCase().includes(q))
        .slice(0, 15)
        .map((p) => ({
          id: p.package_id,
          name: p.name,
          type: p.type,
          start: formatProgramDate(p.start_date),
          end: formatProgramDate(p.end_date),
          days: p.duration_days,
          from_price: programMinPrice(p) ? money(programMinPrice(p)) : 'عند الطلب',
          // Exact per-room prices (DZD) so prices can be compared or charted.
          room_prices_dzd: Object.fromEntries(
            (Array.isArray(p.prices) ? p.prices : [])
              .filter((pr: any) => Number(pr.amount) > 0)
              .map((pr: any) => [String(pr.room_type || '').toUpperCase(), Number(pr.amount)])
          ),
          seats_left: p.available,
          capacity: p.capacity,
          status: AVAILABILITY_LABEL[programAvailability(p)],
          makkah_hotel: p.makkah_hotel_name,
          madinah_hotel: p.madinah_hotel_name,
          airline: p.airline,
          departure: p.departure_city,
          book_link: `/book?package=${encodeURIComponent(p.package_id)}`,
        }));
      return { ok: true, data: { count: rows.length, programs: rows } };
    },
  },
  {
    name: 'list_hotels',
    description: 'List the agency partner hotels in Makkah and Madinah with category, distance from the Haram and services.',
    parameters: { type: 'object', properties: { city: { type: 'string', enum: ['MAKKAH', 'MADINAH'] } } },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, args) => {
      // Visitors and clients only hear about hotels shown on the site; staff see all.
      const res = await callRoute(hotelsGET as any, ctx, { path: '/api/admin/hotels', query: { site: STAFF.includes(ctx.role) ? undefined : 1 } });
      if (!res.ok || !Array.isArray(res.data)) return fail(res);
      const hotels = (res.data as any[])
        .filter((h) => !args?.city || String(h.city).toUpperCase() === args.city)
        .map((h) => ({
          id: h.hotel_id,
          name: h.name,
          city: h.city,
          category: h.category,
          distance: h.distance_from_haram,
          services: clip(h.services),
        }));
      return { ok: true, data: { hotels } };
    },
  },
  {
    name: 'agency_knowledge',
    description:
      "Look up the agency's own trained answers: policies, required documents, visa, payment and cancellation rules, Umrah guidance. Use before answering such questions.",
    parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
    roles: EVERYONE,
    kind: 'read',
    run: async (_ctx, a) => {
      const hit = toolSearchKnowledge(String(a.question || ''));
      if (!hit) return { ok: true, data: { found: false } };
      return { ok: true, data: { found: true, title: hit.rule.title_ar, answer: clip(hit.rule.response_ar, 1500) } };
    },
  },
  {
    name: 'agency_team',
    description: 'The agency team: religious guides, field guides and staff with their role, specialization, languages and experience.',
    parameters: { type: 'object', properties: { search: { type: 'string' } } },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, a) => {
      const staffView = STAFF.includes(ctx.role);
      const team = toolGetTeamMembers(undefined, a?.search || undefined)
        .slice(0, 20)
        .map((m) => ({
          name: m.name,
          role: m.roleName,
          specialization: m.specialization,
          experience_years: m.experience_years,
          languages: m.languages,
          ...(staffView ? { phone: m.phone, status: m.status } : {}),
        }));
      return { ok: true, data: { team } };
    },
  },
  {
    name: 'my_bookings',
    description: "The signed-in user's own Umrah requests and bookings: status, amounts paid and remaining, receipts.",
    parameters: { type: 'object', properties: {} },
    roles: SIGNED_IN,
    kind: 'read',
    run: async (ctx) => {
      const res = await callRoute(myBookingsGET as any, ctx, { path: '/api/bookings' });
      if (!res.ok) return fail(res);
      const reservations = (res.data.reservations || []).map((r: any) => ({
        id: r.reservation_id,
        number: r.reservation_number,
        program: r.package_name,
        status: r.status,
        total: money(r.total_amount),
        paid: money(r.paid_amount),
        remaining: money((Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0)),
        created: r.created_at,
      }));
      return { ok: true, data: { reservations, receipts: (res.data.receipts || []).length } };
    },
  },
  {
    name: 'booking_queue',
    description:
      'Agency staff: the Umrah request pipeline — new requests waiting for the Admin, accepted ones waiting for the deposit, and recently processed.',
    parameters: { type: 'object', properties: {} },
    roles: STAFF,
    kind: 'read',
    run: async (ctx) => {
      const res = await callRoute(bookingQueueGET as any, ctx, { path: '/api/bookings/confirm' });
      if (!res.ok) return fail(res);
      const brief = (r: any) => ({
        id: r.reservation_id,
        number: r.reservation_number,
        client: r.customer_name,
        program: r.package_name,
        total: money(r.total_amount),
        paid: money(r.paid_amount),
        status: r.status,
        date: r.created_at,
      });
      return {
        ok: true,
        data: {
          new_requests: (res.data.demands || []).slice(0, 20).map(brief),
          awaiting_deposit: (res.data.awaitingDeposit || []).slice(0, 20).map(brief),
          recent: (res.data.recent || []).slice(0, 10).map(brief),
          can_approve: Boolean(res.data.permissions?.canApprove),
        },
      };
    },
  },
  {
    name: 'decide_booking',
    description: 'Accept or reject a new Umrah request, or cancel (decision=reject) an accepted one that has no deposit yet (Admin only). Accepting sends it to the accountant for the deposit. A rejection needs a clear, polite reason for the pilgrim: ask the user for it if they did not give one.',
    parameters: {
      type: 'object',
      properties: {
        reservation_id: { type: 'string', description: 'The id from booking_queue.' },
        decision: { type: 'string', enum: ['accept', 'reject'] },
        note: { type: 'string', description: 'Shown to the pilgrim. Required when rejecting (the reason); optional when accepting.' },
      },
      required: ['reservation_id', 'decision'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) => `${a.decision === 'reject' ? 'رفض' : 'قبول'} طلب العمرة ${a.reservation_id}${a.note ? ` — ملاحظة: ${a.note}` : ''}`,
    run: async (ctx, a) => {
      const res = await callRoute(bookingDecisionPOST as any, ctx, {
        path: '/api/bookings/confirm',
        method: 'POST',
        body: { reservationId: a.reservation_id, action: a.decision === 'reject' ? 'reject' : 'confirm', note: a.note || '' },
      });
      return res.ok ? { ok: true, data: { message: res.data.message, status: res.data.status } } : fail(res);
    },
  },
  {
    name: 'finance_overview',
    description: 'Treasury overview: balance of each cash box and bank account and the totals.',
    parameters: { type: 'object', properties: {} },
    roles: FINANCE,
    kind: 'read',
    run: async (ctx) => {
      const res = await callRoute(treasuryGET as any, ctx, { path: '/api/finance/treasury' });
      if (!res.ok) return fail(res);
      return {
        ok: true,
        data: {
          accounts: (res.data.accounts || []).map((a: any) => ({ name: a.name_ar, kind: a.kind, balance: money(a.balance), last_movement: a.last_movement })),
          cash_total: money(res.data.cash_total),
          bank_total: money(res.data.bank_total),
        },
      };
    },
  },
  {
    name: 'list_tables',
    description:
      'Admin: the editable data tables of the app (programs/packages, hotels, staff/guides, seasons, reviews, Sakhr knowledge, page content) with row counts.',
    parameters: { type: 'object', properties: {} },
    roles: ADMINS,
    kind: 'read',
    run: async (ctx) => {
      const res = await callRoute(tablesGET as any, ctx, { path: '/api/admin/db-tables' });
      if (!res.ok) return fail(res);
      return {
        ok: true,
        data: {
          tables: (res.data.tables || []).map((t: any) => ({ table: t.name, label: t.label, rows: t.count, writable: canWriteTable(t.name, ctx.role) })),
          not_in_tables: Object.entries(REDIRECT_TABLES).map(([name, r]) => ({ name, reason: r.message })),
        },
      };
    },
  },
  {
    name: 'describe_table',
    description: 'Admin: the columns of a table (name, type, Arabic label, primary key, required). Call before creating or updating records.',
    parameters: { type: 'object', properties: { table: { type: 'string', enum: MANAGEABLE_TABLES } }, required: ['table'] },
    roles: ADMINS,
    kind: 'read',
    run: async (ctx, a) => {
      const schema = await tableSchema(ctx, a.table);
      if (!schema) return { ok: false, error: 'لا يمكن فتح هذا الجدول بصلاحياتك' };
      return {
        ok: true,
        data: {
          table: a.table,
          label: tableLabel(a.table),
          writable: canWriteTable(a.table, ctx.role),
          columns: schema.columns.map((c) => ({ name: c.name, type: c.type, label: c.labelAr, primary_key: c.pk || undefined, required: (c.notnull && !c.hasDefault) || undefined })),
        },
      };
    },
  },
  {
    name: 'find_records',
    description: 'Admin: find rows in a table, optionally filtered by words that appear in any field. Returns up to 20 rows.',
    parameters: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: MANAGEABLE_TABLES },
        search: { type: 'string', description: 'Words to look for (name, city, phone, …).' },
      },
      required: ['table'],
    },
    roles: ADMINS,
    kind: 'read',
    run: async (ctx, a) => {
      if (!canReadTable(a.table, ctx.role)) return { ok: false, error: 'لا يمكن فتح هذا الجدول بصلاحياتك' };
      const res = await callRoute(tablesGET as any, ctx, { path: '/api/admin/db-tables', query: { table: a.table, limit: 500 } });
      if (!res.ok) return fail(res);
      const q = String(a.search || '').trim().toLowerCase();
      const rows = (res.data.rows || []) as Record<string, unknown>[];
      const hits = q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : rows;
      return { ok: true, data: { table: a.table, total_rows: res.data.totalCount, matched: hits.length, rows: hits.slice(0, 20).map(compactRow) } };
    },
  },
  {
    name: 'create_record',
    description:
      'Admin: add a row (hotel, program, staff member, season…). To duplicate an existing row (e.g. same program on another date) pass copy_from = its id and only the changed fields; the server copies everything else (for programs: prices and options too). Otherwise use describe_table first for column names. The user confirms before saving.',
    parameters: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: MANAGEABLE_TABLES },
        copy_from: { type: 'string', description: 'Optional: primary-key id of a row to duplicate.' },
        fields: { type: 'object', description: 'Column name → value (only the changes when copying). Dates as YYYY-MM-DD.', additionalProperties: true },
      },
      required: ['table', 'fields'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) =>
      a.copy_from
        ? `نسخ سجل من «${tableLabel(a.table)}» (${a.copy_from}) مع التغييرات — ${fieldsPreview(a.fields) || 'بدون تغييرات'}`
        : `إضافة سجل جديد إلى «${tableLabel(a.table)}» — ${fieldsPreview(a.fields)}`,
    run: async (ctx, a) => {
      if (!canWriteTable(a.table, ctx.role)) return { ok: false, error: 'هذا الجدول للقراءة فقط بصلاحياتك' };
      const schema = await tableSchema(ctx, a.table);
      const pk = schema?.pk;
      let base: Record<string, unknown> = {};
      if (a.copy_from) {
        if (!pk) return { ok: false, error: 'لا يمكن نسخ سجل من هذا الجدول' };
        const all = await callRoute(tablesGET as any, ctx, { path: '/api/admin/db-tables', query: { table: a.table, limit: 500 } });
        if (!all.ok) return fail(all);
        const source = ((all.data.rows || []) as Record<string, unknown>[]).find((row) => String(row[pk.name]) === String(a.copy_from));
        if (!source) return { ok: false, error: 'لم أجد السجل المطلوب نسخه' };
        base = Object.fromEntries(Object.entries(source).filter(([k]) => k !== pk.name && !COPY_SKIP.has(k)));
      }
      const rowData: Record<string, unknown> = { ...base, ...normalizeFields(a.fields) };
      if (pk && rowData[pk.name] == null && !/INT/i.test(pk.type)) {
        rowData[pk.name] = `${a.table.slice(0, 3)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      }
      const res = await callRoute(tablesPOST as any, ctx, {
        path: '/api/admin/db-tables',
        method: 'POST',
        body: { action: 'insert_data', tableName: a.table, rowData },
      });
      if (!res.ok) return fail(res);
      const newId = pk ? String(rowData[pk.name]) : undefined;
      // A copied programme keeps the source's room prices.
      if (a.table === 'packages' && a.copy_from && newId) {
        const source = await programById(ctx, String(a.copy_from));
        const prices = (source?.prices || []).map((p: any) => ({ room_type: p.room_type, amount: Number(p.amount) }));
        if (prices.length) await saveProgramPrices(ctx, newId, source.annex_options, prices);
      }
      return { ok: true, data: { message: res.data.message, id: newId } };
    },
  },
  {
    name: 'set_program_price',
    description:
      "Admin: change a program's prices per room type: QUAD (4 per room, the advertised 'from' price), TRIPLE, DOUBLE, SINGLE. Send only the rooms the user named; a single price with no room type means QUAD only. The user confirms first.",
    parameters: {
      type: 'object',
      properties: {
        program_id: { type: 'string', description: 'Program id (from search_programs).' },
        prices: {
          type: 'object',
          description: 'Room type → price in DZD, e.g. {"QUAD": 185000}.',
          properties: { QUAD: { type: 'number' }, TRIPLE: { type: 'number' }, DOUBLE: { type: 'number' }, SINGLE: { type: 'number' } },
        },
      },
      required: ['program_id', 'prices'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) =>
      `تعديل أسعار البرنامج ${a.program_id} — ${Object.entries(a.prices || {})
        .map(([room, amount]) => `${ROOM_LABEL[room] || room}: ${money(amount)}`)
        .join('، ')}`,
    run: async (ctx, a) => {
      const program = await programById(ctx, String(a.program_id));
      if (!program) return { ok: false, error: 'لم أجد هذا البرنامج' };
      const next = new Map<string, number>((program.prices || []).map((p: any) => [String(p.room_type), Number(p.amount)]));
      for (const [room, amount] of Object.entries(a.prices || {})) {
        const value = Number(amount);
        if (ROOM_LABEL[room] && value > 0) next.set(room, value);
      }
      const prices = [...next].map(([room_type, amount]) => ({ room_type, amount }));
      const res = await saveProgramPrices(ctx, program.package_id, program.annex_options, prices);
      return res.ok ? { ok: true, data: { message: 'تم تحديث الأسعار', prices } } : fail(res);
    },
  },
  {
    name: 'update_record',
    description: 'Admin: change fields of an existing row identified by its primary-key id. The user confirms first.',
    parameters: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: MANAGEABLE_TABLES },
        id: { type: 'string', description: 'Primary-key value of the row (from find_records).' },
        fields: { type: 'object', description: 'Column name → new value.', additionalProperties: true },
      },
      required: ['table', 'id', 'fields'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) => `تعديل السجل ${a.id} في «${tableLabel(a.table)}» — ${fieldsPreview(a.fields)}`,
    run: async (ctx, a) => {
      if (!canWriteTable(a.table, ctx.role)) return { ok: false, error: 'هذا الجدول للقراءة فقط بصلاحياتك' };
      const res = await callRoute(tablesPOST as any, ctx, {
        path: '/api/admin/db-tables',
        method: 'POST',
        body: { action: 'update_data', tableName: a.table, keyValue: a.id, rowData: normalizeFields(a.fields) },
      });
      return res.ok ? { ok: true, data: { message: res.data.message } } : fail(res);
    },
  },
  {
    name: 'delete_record',
    description: 'Admin: delete a row by its primary-key id. The user confirms; some tables also need a security-key tap.',
    parameters: {
      type: 'object',
      properties: { table: { type: 'string', enum: MANAGEABLE_TABLES }, id: { type: 'string' } },
      required: ['table', 'id'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) => `حذف السجل ${a.id} من «${tableLabel(a.table)}» نهائياً`,
    run: async (ctx, a) => {
      if (!canWriteTable(a.table, ctx.role)) return { ok: false, error: 'هذا الجدول للقراءة فقط بصلاحياتك' };
      const check = await callRoute(tablesPOST as any, ctx, {
        path: '/api/admin/db-tables',
        method: 'POST',
        body: { action: 'delete_check', tableName: a.table, keyValue: a.id },
      });
      if (!check.ok) return fail(check);
      if (check.data.canDelete === false) return { ok: false, error: String(check.data.blocker || 'لا يمكن حذف هذا السجل') };
      const res = await callRoute(tablesPOST as any, ctx, {
        path: '/api/admin/db-tables',
        method: 'POST',
        body: { action: 'delete_data', tableName: a.table, keyValue: a.id, confirm: true },
      });
      return res.ok ? { ok: true, data: { message: res.data.message } } : fail(res);
    },
  },
  {
    name: 'list_users',
    description: 'Admin: list app accounts (name, username, role, status, online) optionally filtered by words or role.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        role: { type: 'string', enum: ['SUPER_ADMIN', 'AGENCY_MANAGER', 'ACCOUNTANT', 'GUIDE_MURSHID', 'AGENCY_AGENT', 'PILGRIM_USER'] },
      },
    },
    roles: ADMINS,
    kind: 'read',
    run: async (ctx, a) => {
      const res = await callRoute(usersGET as any, ctx, { path: '/api/admin/users' });
      if (!res.ok) return fail(res);
      const q = String(a?.search || '').toLowerCase();
      const users = (res.data.users || [])
        .filter((u: any) => !a?.role || u.role === a.role)
        .filter((u: any) => !q || [u.name, u.username, u.email, u.phone].join(' ').toLowerCase().includes(q))
        .slice(0, 25)
        .map((u: any) => ({ id: u.id, name: u.name, username: u.username, role: LOGIN_ROLE_LABELS[normalizeLoginRole(u.role)], status: u.status, login_enabled: u.loginEnabled, online: u.isOnline }));
      return { ok: true, data: { total: res.data.stats?.total, users } };
    },
  },
  {
    name: 'create_user',
    description:
      'Admin: create an account. Accountant, guide, staff and pilgrim get a generated password shown once. An Admin account (Super Admin only) gets an activation link instead. The user confirms first.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        username: { type: 'string', description: 'Latin letters, digits, . _ -' },
        email: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string', enum: ['AGENCY_MANAGER', 'ACCOUNTANT', 'GUIDE_MURSHID', 'AGENCY_AGENT', 'PILGRIM_USER'] },
      },
      required: ['name', 'role'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) => `إنشاء حساب «${a.name}» بدور ${LOGIN_ROLE_LABELS[normalizeLoginRole(a.role)]}${a.username ? ` (${a.username})` : ''}`,
    run: async (ctx, a) => {
      const res = await callRoute(usersPOST as any, ctx, {
        path: '/api/admin/users',
        method: 'POST',
        body: { name: a.name, username: a.username, email: a.email, phone: a.phone, role: a.role },
      });
      if (!res.ok) return fail(res);
      return {
        ok: true,
        data: {
          message: res.data.message,
          username: res.data.credentials?.username,
          password_shown_once: res.data.credentials?.password,
          activation_link: res.data.invite?.url,
        },
      };
    },
  },
  {
    name: 'set_user_access',
    description: 'Admin: suspend or re-activate an account, or change its role. The user confirms first.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        action: { type: 'string', enum: ['suspend', 'activate', 'change_role'] },
        role: { type: 'string', enum: ['AGENCY_MANAGER', 'ACCOUNTANT', 'GUIDE_MURSHID', 'AGENCY_AGENT', 'PILGRIM_USER'] },
      },
      required: ['user_id', 'action'],
    },
    roles: ADMINS,
    kind: 'write',
    summarize: (a) =>
      a.action === 'suspend'
        ? `إيقاف الحساب ${a.user_id}`
        : a.action === 'activate'
          ? `تفعيل الحساب ${a.user_id}`
          : `تغيير دور الحساب ${a.user_id} إلى ${LOGIN_ROLE_LABELS[normalizeLoginRole(a.role)]}`,
    run: async (ctx, a) => {
      const body =
        a.action === 'suspend'
          ? { userId: a.user_id, status: 'SUSPENDED', loginEnabled: false }
          : a.action === 'activate'
            ? { userId: a.user_id, status: 'APPROVED', loginEnabled: true }
            : { userId: a.user_id, role: a.role };
      const res = await callRoute(usersPATCH as any, ctx, { path: '/api/admin/users', method: 'PATCH', body });
      return res.ok ? { ok: true, data: { message: res.data.message, activation_link: res.data.invite?.url } } : fail(res);
    },
  },
  {
    name: 'open_page',
    description:
      'Open a page of the app for the user: home, programs, hotels, booking, about the agency, the Umrah guide (rituals step by step), the user portal, or the admin dashboard.',
    parameters: {
      type: 'object',
      properties: { page: { type: 'string', enum: ['home', 'programs', 'hotels', 'book', 'about', 'guide', 'portal', 'admin_dashboard'] } },
      required: ['page'],
    },
    roles: EVERYONE,
    kind: 'client',
    clientAction: (a, role) => {
      const map: Record<string, string> = { home: '/', programs: '/packages', hotels: '/hotels', book: '/book', about: '/about', guide: '/guide', portal: '/portal', admin_dashboard: '/admin' };
      if (a.page === 'admin_dashboard' && !ADMINS.includes(role)) return { error: 'لوحة الإدارة للمشرفين فقط' };
      if (a.page === 'portal' && role === 'ANON') return { error: 'سجّل الدخول أولاً' };
      const href = map[a.page];
      return href ? { type: 'navigate', href } : { error: 'صفحة غير معروفة' };
    },
  },
  {
    name: 'agency_stats',
    description:
      'Agency figures for reports and charts: requests by status and by month, seats per program, and (finance roles) booked value, paid, outstanding and payments per month in DZD. Use it before drawing a chart of agency activity.',
    parameters: {
      type: 'object',
      properties: { months: { type: 'number', description: 'How many recent months (1-24, default 6).' } },
    },
    roles: STAFF,
    kind: 'read',
    run: async (ctx, a) => {
      const months = Math.min(24, Math.max(1, Math.round(Number(a?.months) || 6)));
      return { ok: true, data: agencyStats(ctx.role, months) };
    },
  },
  {
    name: 'agency_report',
    description:
      'Show a ready, designed report with charts in the chat (exact figures from the database). kind: "overview" (requests per month, status, seats), "finance" (booked value, collected, outstanding — finance roles), "programs" (seats per program). Prefer this for any agency report / dashboard / chart request.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['overview', 'finance', 'programs'] },
        months: { type: 'number', description: '1-24, default 6' },
      },
      required: ['kind'],
    },
    roles: STAFF,
    kind: 'read',
    run: async (ctx, a) => {
      const months = Math.min(24, Math.max(1, Math.round(Number(a?.months) || 6)));
      const kind = ['overview', 'finance', 'programs'].includes(a?.kind) ? a.kind : 'overview';
      if (kind === 'finance' && !FINANCE.includes(ctx.role)) return { ok: false, error: 'التقرير المالي للمحاسب والإدارة فقط' };
      const { visual, summary } = buildReport(kind, ctx.role, months);
      const clean = sanitizeVisual(visual);
      if ('error' in clean) return { ok: false, error: clean.error };
      return { ok: true, data: { shown_in_chat: true, summary }, visual: clean };
    },
  },
  {
    name: 'show_visual',
    description:
      'Custom visual in the chat (KPIs, up to 3 charts, a table) for data not covered by agency_report, e.g. comparing program prices, or any table of 4+ rows. Real numbers from tools only; one measure per chart; pie/donut = one series of parts of a whole; short labels, Arabic titles.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        kpis: {
          type: 'array',
          items: {
            type: 'object',
            properties: { label: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, hint: { type: 'string' } },
            required: ['label', 'value'],
          },
        },
        charts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['bar', 'hbar', 'line', 'area', 'pie', 'donut'] },
              title: { type: 'string' },
              unit: { type: 'string', description: 'e.g. "دج" or "طلب"' },
              labels: { type: 'array', items: { type: 'string' } },
              series: {
                type: 'array',
                items: { type: 'object', properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'number' } } }, required: ['name', 'values'] },
              },
            },
            required: ['type', 'title', 'labels', 'series'],
          },
        },
        table: {
          type: 'object',
          properties: {
            columns: { type: 'array', items: { type: 'string' } },
            rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          },
        },
        note: { type: 'string' },
      },
      required: ['title'],
    },
    roles: EVERYONE,
    kind: 'client',
    clientAction: (a) => {
      const visual = sanitizeVisual(a);
      return 'error' in visual ? { error: visual.error } : { type: 'visual', visual };
    },
  },
  {
    name: 'open_table',
    description: 'Super Admin: open a data table in the visual table editor on screen.',
    parameters: { type: 'object', properties: { table: { type: 'string', enum: MANAGEABLE_TABLES } }, required: ['table'] },
    roles: ['SUPER_ADMIN'],
    kind: 'client',
    clientAction: (a, role) => (canReadTable(a.table, role) ? { type: 'open_table', table: a.table } : { error: 'لا يمكن فتح هذا الجدول' }),
  },
];

export function toolsFor(role: Who): SakhrTool[] {
  return SAKHR_TOOLS.filter((t) => t.roles.includes(role));
}

export function findTool(name: string): SakhrTool | undefined {
  return SAKHR_TOOLS.find((t) => t.name === name);
}
