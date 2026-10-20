import { getSqliteDb } from '@/lib/sqlite';
import {
  BookingExtra,
  BookingInvoice,
  BookingProgram,
  Package,
  ProgramAppointment,
  Reservation,
  TravelerInfo,
} from '@/types';
import {
  DEPOSIT_PERCENT,
  ROOM_LABELS,
  buildInvoice,
  canSelfManageReservation,
  isActiveReservation,
  isAgencyConfirmed,
  isPackageExpired,
} from '@/lib/booking-catalog';
import { documentVerifyCode } from '@/lib/booking-documents';
import { dbSaveMessage } from '@/lib/db';
import { tripKindOf, type TripKind } from '@/lib/tour';
import { buildDmChatId } from '@/lib/chat-utils';

export {
  BOOKING_EXTRAS,
  DEPOSIT_PERCENT,
  ROOM_LABELS,
  extrasByIds,
  buildInvoice,
  isActiveReservation,
  canSelfManageReservation,
  daysUntilDeparture,
  FREE_CANCEL_DAYS,
  reservationStatusLabel,
  isAgencyConfirmed,
  isDemandAccepted,
  isAwaitingDepositConfirmation,
  isPackageExpired,
} from '@/lib/booking-catalog';

function formatArDate(value?: string, withWeekday = false): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', {
    weekday: withWeekday ? 'long' : undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildAppointments(pkg: Package): ProgramAppointment[] {
  const start = pkg.start_date;
  const end = pkg.end_date || start;
  const mid = shiftIsoDate(start, Math.max(1, Math.floor((pkg.duration_days || 7) / 2)));
  return [
    {
      id: 'gather',
      title: 'تجمّع المطار',
      when: `${formatArDate(start, true)} — قبل الإقلاع بـ 4 ساعات`,
      place: pkg.departure_airport || pkg.departure_city || 'مطار الجزائر',
      note: 'إحضار الجواز الأصلي ونسخة الحجز',
    },
    {
      id: 'depart',
      title: 'إقلاع الرحلة',
      when: formatArDate(start, true),
      place: `${pkg.airline || 'الخطوط الجوية'} — ${pkg.departure_airport || pkg.departure_city || ''}`,
    },
    {
      id: 'arrive',
      title: 'وصول ولقاء المرشد',
      when: formatArDate(start, true),
      place: pkg.arrival_airport || 'المطار',
      note: pkg.morshid_name ? `يستقبلكم ${pkg.morshid_name}` : 'يستقبلكم مرشد الفوج',
    },
    {
      id: 'umrah',
      title: 'أداء العمرة',
      when: formatArDate(shiftIsoDate(start, 1), true),
      place: 'المسجد الحرام — مكة المكرمة',
      note: 'الطواف والسعي مع توجيه المرشد',
    },
    {
      id: 'madinah',
      title: 'الانتقال إلى المدينة',
      when: formatArDate(mid, true),
      place: pkg.madinah_hotel_name || 'المدينة المنورة',
    },
    {
      id: 'return',
      title: 'رحلة العودة',
      when: formatArDate(end, true),
      place: pkg.arrival_airport || 'المطار',
    },
  ];
}

export function buildProgram(pkg: Package, roomType: string, morshidPhone?: string): BookingProgram {
  return {
    package_id: pkg.package_id,
    package_name: pkg.name,
    start_date: pkg.start_date,
    end_date: pkg.end_date,
    duration_days: pkg.duration_days,
    airline: pkg.airline,
    departure_city: pkg.departure_city,
    departure_airport: pkg.departure_airport,
    arrival_airport: pkg.arrival_airport,
    makkah_hotel_name: pkg.makkah_hotel_name,
    makkah_hotel_dist: pkg.makkah_hotel_dist,
    madinah_hotel_name: pkg.madinah_hotel_name,
    madinah_hotel_dist: pkg.madinah_hotel_dist,
    hotel_category: pkg.hotel_category,
    morshid_id: pkg.morshid_id,
    morshid_name: pkg.morshid_name,
    morshid_phone: morshidPhone,
    included_services: pkg.included_services || [],
    room_type: roomType,
    room_label: ROOM_LABELS[roomType] || roomType,
  };
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** UMRAH / HAJJ / TOURISM of a program (cached a few seconds; one query per program). */
const kindCache = new Map<string, { at: number; kind: TripKind | undefined }>();
function packageKind(packageId?: string | null): TripKind | undefined {
  const id = String(packageId || '');
  if (!id || id.startsWith('hotel:')) return undefined;
  const hit = kindCache.get(id);
  if (hit && Date.now() - hit.at < 15_000) return hit.kind;
  let kind: TripKind | undefined;
  try {
    const row = getSqliteDb().prepare('SELECT * FROM packages WHERE package_id = ?').get(id) as any;
    kind = row ? tripKindOf(row) : undefined;
  } catch {
    kind = undefined;
  }
  kindCache.set(id, { at: Date.now(), kind });
  return kind;
}

export function mapReservationRow(row: any): Reservation {
  return {
    reservation_id: row.reservation_id,
    reservation_number: row.reservation_number,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    package_id: row.package_id,
    package_name: row.package_name,
    room_type: row.room_type,
    travelers_count: Number(row.travelers_count) || 1,
    travelers: parseJson<TravelerInfo[]>(row.travelers, []),
    total_amount: Number(row.total_price ?? row.total_amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    currency: 'DZD',
    status: (row.reservation_status || row.status || 'CONFIRMED') as Reservation['status'],
    payment_status: (row.payment_status || 'UNPAID') as Reservation['payment_status'],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    extras: parseJson<BookingExtra[]>(row.extras, []),
    invoice: parseJson<BookingInvoice | null>(row.invoice, null) || undefined,
    appointments: parseJson<ProgramAppointment[]>(row.appointments, []),
    program: parseJson<BookingProgram | null>(row.program, null) || undefined,
    agency_confirmed_at: row.agency_confirmed_at || undefined,
    agency_confirmed_by: row.agency_confirmed_by || undefined,
    document_verify_code: row.document_verify_code || undefined,
    agency_note: row.agency_note || undefined,
    booking_kind: row.booking_type === 'HOTEL' || row.booking_kind === 'HOTEL' ? 'HOTEL' : 'TRIP',
    hotel_stay: parseJson<import('@/lib/hotels/types').HotelStay | null>(row.hotel_stay, null) || undefined,
    visa_status: row.visa_status || undefined,
    visa_note: row.visa_note || undefined,
    trip_kind: row.booking_type === 'HOTEL' || row.booking_kind === 'HOTEL' ? undefined : packageKind(row.package_id),
  };
}

export function nextReservationNumber(): string {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `RES-${year}-${suffix}`;
}

export function loadPublishedPackage(packageId: string): Package | null {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM packages WHERE package_id = ?').get(packageId) as any;
  if (!row) return null;
  const prices = db.prepare('SELECT * FROM package_prices WHERE package_id = ?').all(packageId) as any[];
  return {
    ...row,
    published: Boolean(row.published),
    included_services: parseJson(row.included_services, []),
    excluded_services: parseJson(row.excluded_services, []),
    booking_conditions: parseJson(row.booking_conditions, []),
    prices,
  } as Package;
}

export function roomPriceFor(pkg: Package, roomType: string): number | null {
  const match = (pkg.prices || []).find((p) => p.room_type === roomType);
  if (!match || !Number.isFinite(Number(match.amount))) return null;
  return Number(match.amount);
}

export function lookupMorshidPhone(morshidId?: string): string {
  if (!morshidId) return '';
  const db = getSqliteDb();
  const row = db.prepare('SELECT phone FROM morshids WHERE morshid_id = ?').get(morshidId) as any;
  return row?.phone || '';
}

/** A client's trips (Umrah / Hajj / tourist programs), newest first. Hotel-only bookings: listCustomerHotelBookings. */
export function listCustomerReservations(customerId: string): Reservation[] {
  return listAllCustomerReservations(customerId).filter((r) => r.booking_kind !== 'HOTEL');
}

export function listCustomerHotelBookings(customerId: string): Reservation[] {
  return listAllCustomerReservations(customerId).filter((r) => r.booking_kind === 'HOTEL');
}

function listAllCustomerReservations(customerId: string): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM reservations WHERE customer_id = ?').all(customerId) as any[];
  return rows
    .map(mapReservationRow)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/** The client's active trip (hotel-only bookings never block a trip, and vice versa). */
export function findActiveReservation(customerId: string): Reservation | null {
  return listCustomerReservations(customerId).find((row) => isActiveReservation(row.status)) || null;
}

export function pilgrimAppointment(userId: string): {
  startDate: string;
  packageName: string;
  reservationNumber: string;
} | null {
  const active = findActiveReservation(userId);
  if (!active || !isAgencyConfirmed(active.status)) return null;
  const startDate = active.program?.start_date || '';
  if (!startDate) return null;
  return {
    startDate,
    packageName: active.package_name,
    reservationNumber: active.reservation_number,
  };
}

export function pilgrimWaitingRedirect(userId: string): { waitingBooking: true; redirect: '/book' } | null {
  const active = findActiveReservation(userId);
  if (!active || isAgencyConfirmed(active.status)) return null;
  return { waitingBooking: true, redirect: '/book' };
}

export function getOwnedReservation(reservationId: string, customerId: string): Reservation | null {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM reservations WHERE reservation_id = ? AND customer_id = ?').get(reservationId, customerId) as any;
  return row ? mapReservationRow(row) : null;
}

function adjustPackageSeat(packageId: string, take: boolean) {
  const db = getSqliteDb();
  if (take) {
    const pkg = db.prepare('SELECT available FROM packages WHERE package_id = ?').get(packageId) as any;
    if (!pkg || Number(pkg.available) < 1) {
      throw new Error('NO_SEATS');
    }
    db.prepare(`
      UPDATE packages SET reserved = reserved + 1, available = CASE WHEN available > 0 THEN available - 1 ELSE 0 END
      WHERE package_id = ?
    `).run(packageId);
    return;
  }
  db.prepare(`
    UPDATE packages SET
      reserved = CASE WHEN reserved > 0 THEN reserved - 1 ELSE 0 END,
      available = available + 1
    WHERE package_id = ?
  `).run(packageId);
}

export function selfManageGuard(reservation: Reservation): { ok: boolean; reason?: string } {
  return canSelfManageReservation(reservation.status, reservation.program?.start_date);
}

export function applyReservationChanges(input: {
  existing: Reservation;
  pkg: Package;
  roomType: string;
  extras: BookingExtra[];
  invoice: BookingInvoice;
  name: string;
  phone: string;
  email: string;
  travelers: TravelerInfo[];
}): Reservation {
  const guard = selfManageGuard(input.existing);
  if (!guard.ok) throw new Error(guard.reason || 'LOCKED');
  if (isPackageExpired(input.pkg)) {
    throw new Error('هذا البرنامج انتهى ولا يمكن حجزه');
  }

  const now = new Date().toISOString();
  const appointments = buildAppointments(input.pkg);
  const program = buildProgram(input.pkg, input.roomType, lookupMorshidPhone(input.pkg.morshid_id));
  const paid = Number(input.existing.paid_amount) || 0;
  const remaining = Math.max(0, input.invoice.total - paid);
  const wasConfirmed = isAgencyConfirmed(input.existing.status);
  const paymentStatus = wasConfirmed
    ? 'PENDING'
    : remaining <= 0
      ? 'PAID'
      : paid > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';
  const reservationStatus = wasConfirmed ? 'REQUESTED' : input.existing.status;
  const invoice: BookingInvoice = {
    ...input.invoice,
    remainingAmount: wasConfirmed ? input.invoice.total : remaining,
  };

  const db = getSqliteDb();
  db.transaction(() => {
    if (input.existing.package_id !== input.pkg.package_id) {
      adjustPackageSeat(input.existing.package_id, false);
      adjustPackageSeat(input.pkg.package_id, true);
    }
    db.prepare(`
      UPDATE reservations SET
        customer_name = ?, customer_email = ?, customer_phone = ?,
        package_id = ?, package_name = ?, room_type = ?, travelers = ?,
        total_price = ?, paid_amount = ?, payment_status = ?,
        reservation_status = ?, updated_at = ?,
        extras = ?, invoice = ?, appointments = ?, program = ?,
        agency_confirmed_at = NULL, agency_confirmed_by = NULL, agency_note = NULL
      WHERE reservation_id = ? AND customer_id = ?
    `).run(
      input.name,
      input.email,
      input.phone,
      input.pkg.package_id,
      input.pkg.name,
      input.roomType,
      JSON.stringify(input.travelers),
      invoice.total,
      wasConfirmed ? 0 : paid,
      paymentStatus,
      reservationStatus,
      now,
      JSON.stringify(input.extras),
      JSON.stringify(invoice),
      JSON.stringify(appointments),
      JSON.stringify(program),
      input.existing.reservation_id,
      input.existing.customer_id
    );
  })();

  return getOwnedReservation(input.existing.reservation_id, input.existing.customer_id) as Reservation;
}

export function cancelCustomerReservation(reservation: Reservation): Reservation {
  const guard = selfManageGuard(reservation);
  if (!guard.ok) throw new Error(guard.reason || 'LOCKED');
  // Money already paid: a refund is prepared by the accountant and approved by the Super Admin.
  if ((Number(reservation.paid_amount) || 0) > 0) {
    throw new Error('سُجّلت دفعة على هذا الطلب. للإلغاء واسترجاع المبلغ تواصل مع الوكالة من المحادثة.');
  }

  const db = getSqliteDb();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE reservations SET reservation_status = 'CANCELLED', payment_status = 'REFUNDED', updated_at = ?
      WHERE reservation_id = ?
    `).run(now, reservation.reservation_id);
    adjustPackageSeat(reservation.package_id, false);
  })();

  return getOwnedReservation(reservation.reservation_id, reservation.customer_id) as Reservation;
}

export function takePackageSeat(packageId: string) {
  adjustPackageSeat(packageId, true);
}

export function getReservationById(reservationId: string): Reservation | null {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  return row ? mapReservationRow(row) : null;
}

export function listPendingAgencyReservations(): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare(`
    SELECT * FROM reservations
    WHERE reservation_status IN ('REQUESTED', 'PENDING')
    ORDER BY created_at DESC
  `).all() as any[];
  return rows.map(mapReservationRow);
}

/** Stage 2: director accepted, the accountant still has to record the deposit. */
const AWAITING_DEPOSIT_SQL = `(
  reservation_status = 'PAYMENT_PENDING'
  OR (reservation_status = 'CONFIRMED' AND IFNULL(paid_amount, 0) <= 0)
)`;

export function listAwaitingDepositReservations(): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare(`
    SELECT * FROM reservations
    WHERE ${AWAITING_DEPOSIT_SQL}
    ORDER BY COALESCE(agency_confirmed_at, updated_at, created_at) ASC
  `).all() as any[];
  return rows.map(mapReservationRow);
}

/** Stage 3 and closed outcomes (confirmed, paid, rejected, cancelled). */
export function listRecentAgencyReservations(limit = 40): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare(`
    SELECT * FROM reservations
    WHERE reservation_status NOT IN ('REQUESTED', 'PENDING')
      AND NOT ${AWAITING_DEPOSIT_SQL}
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map(mapReservationRow);
}

export type { AgencyDemand } from '@/types';

export function listAgencyDemandQueue(): import('@/types').AgencyDemand[] {
  const db = getSqliteDb();
  return listPendingAgencyReservations().map((res) => {
    const user = db.prepare('SELECT status, loginEnabled, code FROM users WHERE id = ?').get(res.customer_id) as any;
    const approved = user?.status === 'APPROVED' && user?.loginEnabled !== 0;
    return {
      ...res,
      customer_status: user?.status || 'UNKNOWN',
      customer_login_enabled: approved,
      customer_code: user?.code,
      passport: res.travelers?.[0]?.passport_number || '',
    };
  });
}

function approveCustomerLogin(customerId: string) {
  const db = getSqliteDb();
  db.prepare(`UPDATE users SET status = 'APPROVED', loginEnabled = 1 WHERE id = ?`).run(customerId);
}

/**
 * Who signs agency messages to pilgrims: the agency desk account if it exists,
 * otherwise any employee, then the Admin, then the Super Admin.
 */
function agencySender(db: ReturnType<typeof getSqliteDb>): any | null {
  const desk = db.prepare("SELECT * FROM users WHERE id = 'usr_agent'").get();
  if (desk) return desk;
  const rows = db.prepare('SELECT * FROM users').all() as any[];
  const byRole = (roles: string[]) =>
    rows.find((u) => roles.includes(String(u.role || '').toUpperCase()) && u.loginEnabled !== 0 && u.loginEnabled !== false);
  return byRole(['AGENCY_AGENT', 'AGENT', 'STAFF']) || byRole(['AGENCY_MANAGER', 'MANAGER']) || byRole(['SUPER_ADMIN', 'ADMIN']) || null;
}

export function notifyPilgrimAndAgency(input: {
  customerId: string;
  customerName: string;
  reservationNumber: string;
  pilgrimText: string;
  agentText?: string;
  groupText?: string;
  packageName?: string;
}) {
  try {
    const db = getSqliteDb();
    const agent = agencySender(db);
    if (agent) {
      dbSaveMessage({
        id: '',
        chatId: buildDmChatId(input.customerId, agent.id),
        senderId: agent.id,
        senderName: agent.name,
        senderAvatar: agent.avatar || 'س',
        senderRole: 'agent',
        text: input.pilgrimText,
        time: '',
      });
      if (input.agentText) {
        dbSaveMessage({
          id: '',
          chatId: buildDmChatId(input.customerId, agent.id),
          senderId: input.customerId,
          senderName: input.customerName,
          senderAvatar: input.customerName.charAt(0) || 'م',
          senderRole: 'pilgrim',
          text: input.agentText,
          time: '',
        });
      }
    }
    if (input.groupText && agent) {
      dbSaveMessage({
        id: '',
        chatId: 'group-campaign-makkah',
        senderId: agent.id,
        senderName: agent.name,
        senderAvatar: agent.avatar || 'م',
        senderRole: 'agent',
        text: input.groupText,
        time: '',
      });
    }
  } catch {
    /* chat optional */
  }
}

/**
 * Agency accepts the demand only.
 * Does NOT mark the deposit as paid — accountant finishes confirmation after the first payment.
 */
export function confirmReservationByAgency(
  reservationId: string,
  staff: { id: string; name: string },
  note?: string
): Reservation {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  if (!row) throw new Error('NOT_FOUND');
  const status = String(row.reservation_status || '').toUpperCase();
  if (status !== 'REQUESTED' && status !== 'PENDING') {
    throw new Error('INVALID_STATUS');
  }

  const invoice = parseJson<BookingInvoice | null>(row.invoice, null);
  const total = Number(row.total_price) || invoice?.total || 0;
  const deposit = invoice?.depositAmount ?? Math.round(total * DEPOSIT_PERCENT);
  const paid = Number(row.paid_amount) || 0;
  const now = new Date().toISOString();
  const acceptNote = [
    note || '',
    `ملاحظة: الطلب مقبول — العربون ${deposit.toLocaleString('ar-DZ')} دج (${Math.round(DEPOSIT_PERCENT * 100)}٪) غير مدفوع بعد. يُكمِل المحاسب التأكيد بعد تحصيل الدفعة الأولى.`,
  ].filter(Boolean).join('\n');
  const updatedInvoice = invoice
    ? { ...invoice, depositAmount: deposit, remainingAmount: Math.max(0, total - paid) }
    : null;

  db.transaction(() => {
    db.prepare(`
      UPDATE reservations SET
        reservation_status = 'PAYMENT_PENDING',
        payment_status = CASE WHEN IFNULL(paid_amount, 0) > 0 THEN payment_status ELSE 'UNPAID' END,
        paid_amount = IFNULL(paid_amount, 0),
        agency_confirmed_at = ?,
        agency_confirmed_by = ?,
        agency_note = ?,
        invoice = COALESCE(?, invoice),
        updated_at = ?
      WHERE reservation_id = ?
    `).run(
      now,
      staff.name,
      acceptNote,
      updatedInvoice ? JSON.stringify(updatedInvoice) : null,
      now,
      reservationId
    );
    approveCustomerLogin(row.customer_id);
  })();

  // If a deposit was already collected (rare), accountant confirmation can finish immediately.
  const finished = completeConfirmationAfterDeposit(reservationId, staff);
  if (finished) return finished;

  notifyPilgrimAndAgency({
    customerId: row.customer_id,
    customerName: row.customer_name,
    reservationNumber: row.reservation_number,
    pilgrimText: `مرحباً ${row.customer_name}، قبلت الوكالة ${row.booking_type === 'HOTEL' || row.booking_kind === 'HOTEL' ? 'طلب حجز الفندق' : 'طلب عمرتك'} رقم ${row.reservation_number} وتم تفعيل دخول حسابك. ملاحظة مهمة: لم تُسجَّل بعد دفعة العربون (${deposit.toLocaleString('ar-DZ')} دج — ${Math.round(DEPOSIT_PERCENT * 100)}٪). يكتمل التأكيد النهائي عند المحاسب بعد تحصيل هذه الدفعة.`,
    groupText: `قُبل طلب ${row.customer_name} — ${row.package_name} (${row.reservation_number}) — بانتظار العربون عند المحاسب.`,
    packageName: row.package_name,
  });

  return getReservationById(reservationId) as Reservation;
}

/**
 * Accountant finishes confirmation once the first payment (deposit) is on the books.
 * Safe to call repeatedly; no-op if deposit is still unpaid.
 */
export function completeConfirmationAfterDeposit(
  reservationId: string,
  staff?: { id?: string; name?: string }
): Reservation | null {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  if (!row) return null;

  const status = String(row.reservation_status || '').toUpperCase();
  if (!['PAYMENT_PENDING', 'CONFIRMED'].includes(status)) return null;

  const invoice = parseJson<BookingInvoice | null>(row.invoice, null);
  const total = Number(row.total_price) || invoice?.total || 0;
  const deposit = invoice?.depositAmount ?? Math.round(total * DEPOSIT_PERCENT);
  const paid = Number(row.paid_amount) || 0;
  if (paid < deposit) return null;

  // Already fully confirmed with money on record — only stamp if still PAYMENT_PENDING.
  if (status === 'CONFIRMED' && paid > 0) return mapReservationRow(row);

  const now = new Date().toISOString();
  const verifyCode = documentVerifyCode(row.reservation_number, 'confirmation', total);
  const paymentStatus = paid >= total ? 'PAID' : 'PARTIALLY_PAID';
  const nextStatus = paid >= total ? 'PAID' : 'CONFIRMED';
  const accountantName = staff?.name || 'المحاسب';
  const noteExtra = `تم التأكيد النهائي من المحاسب (${accountantName}) بعد تحصيل العربون.`;
  const prevNote = String(row.agency_note || '').trim();
  const agencyNote = prevNote.includes('التأكيد النهائي من المحاسب')
    ? prevNote
    : [prevNote, noteExtra].filter(Boolean).join('\n');
  const updatedInvoice = invoice
    ? { ...invoice, remainingAmount: Math.max(0, total - paid) }
    : null;

  db.prepare(`
    UPDATE reservations SET
      reservation_status = ?,
      payment_status = ?,
      agency_note = ?,
      document_verify_code = ?,
      invoice = COALESCE(?, invoice),
      updated_at = ?
    WHERE reservation_id = ?
  `).run(
    nextStatus,
    paymentStatus,
    agencyNote,
    verifyCode,
    updatedInvoice ? JSON.stringify(updatedInvoice) : null,
    now,
    reservationId
  );

  if (status === 'PAYMENT_PENDING') {
    notifyPilgrimAndAgency({
      customerId: row.customer_id,
      customerName: row.customer_name,
      reservationNumber: row.reservation_number,
      pilgrimText: `مرحباً ${row.customer_name}، أكمل المحاسب تأكيد حجزك رقم ${row.reservation_number} بعد تسجيل العربون. المدفوع ${paid.toLocaleString('ar-DZ')} دج، والمتبقي ${Math.max(0, total - paid).toLocaleString('ar-DZ')} دج. برنامجك جاهز في بوابة المعتمر.`,
      groupText: `تأكيد نهائي (محاسب) لـ ${row.customer_name} — ${row.package_name} (${row.reservation_number}).`,
      packageName: row.package_name,
    });
  }

  return getReservationById(reservationId) as Reservation;
}

export function rejectReservationByAgency(
  reservationId: string,
  staff: { id: string; name: string },
  note?: string
): Reservation {
  const db = getSqliteDb();
  const row = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservationId) as any;
  if (!row) throw new Error('NOT_FOUND');
  const status = String(row.reservation_status || '').toUpperCase();
  const accepted = status === 'PAYMENT_PENDING';
  if (status !== 'REQUESTED' && status !== 'PENDING' && !accepted) {
    throw new Error('INVALID_STATUS');
  }
  // Money already received must be refunded through accounting, not dropped here.
  if (accepted && (Number(row.paid_amount) || 0) > 0) {
    throw new Error('DEPOSIT_PAID');
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE reservations SET
        reservation_status = 'REJECTED',
        payment_status = 'REFUNDED',
        agency_confirmed_at = ?,
        agency_confirmed_by = ?,
        agency_note = ?,
        updated_at = ?
      WHERE reservation_id = ?
    `).run(now, staff.name, note || 'مرفوض من الوكالة', now, reservationId);
    adjustPackageSeat(row.package_id, false);
  })();

  notifyPilgrimAndAgency({
    customerId: row.customer_id,
    customerName: row.customer_name,
    reservationNumber: row.reservation_number,
    pilgrimText: accepted
      ? `نعتذر ${row.customer_name}، أُلغي ${row.booking_type === 'HOTEL' || row.booking_kind === 'HOTEL' ? 'طلب حجز الفندق' : 'طلب العمرة'} ${row.reservation_number}. ${note ? `السبب: ${note}` : ''} يمكنك اختيار برنامج آخر في أي وقت أو مراسلتنا هنا.`
      : `نعتذر ${row.customer_name}، لم تتم الموافقة على ${row.booking_type === 'HOTEL' || row.booking_kind === 'HOTEL' ? 'طلب حجز الفندق' : 'طلب العمرة'} ${row.reservation_number}. ${note ? `السبب: ${note}` : ''} يمكنك اختيار برنامج آخر في أي وقت أو مراسلتنا هنا.`,
  });

  return getReservationById(reservationId) as Reservation;
}

/* ------------------------------------------------------------------ *
 * Super Admin: give a client a trip, or move their trip to another program.
 * ------------------------------------------------------------------ */

export type BookableProgram = {
  package_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  available?: number;
  prices: { room_type: string; amount: number }[];
};

/** Published programs that have not left yet, with their room prices. */
export function listBookablePrograms(): BookableProgram[] {
  const db = getSqliteDb();
  const ids = (db.prepare('SELECT package_id FROM packages').all() as { package_id: string }[]).map((r) => r.package_id);
  return ids
    .map((id) => loadPublishedPackage(id))
    .filter((pkg): pkg is Package => Boolean(pkg && pkg.published !== false && !isPackageExpired(pkg)))
    .map((pkg) => ({
      package_id: pkg.package_id,
      name: pkg.name,
      start_date: pkg.start_date,
      end_date: pkg.end_date,
      duration_days: pkg.duration_days,
      available: (pkg as any).available != null ? Number((pkg as any).available) : undefined,
      prices: (pkg.prices || [])
        .map((p) => ({ room_type: String(p.room_type), amount: Number(p.amount) }))
        .filter((p) => Number.isFinite(p.amount)),
    }))
    .filter((p) => p.prices.length > 0)
    .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
}

function quoteProgram(packageId: string, roomType: string, extras: BookingExtra[]) {
  const pkg = loadPublishedPackage(packageId);
  if (!pkg || pkg.published === false) throw new Error('هذا البرنامج غير متاح');
  if (isPackageExpired(pkg)) throw new Error('هذا البرنامج انتهى ولا يمكن حجزه');
  const room = String(roomType || '').toUpperCase();
  const amount = roomPriceFor(pkg, room);
  if (amount == null) throw new Error('سعر هذا النوع من الغرف غير متوفر في هذا البرنامج');
  const invoice = buildInvoice(
    {
      id: `room_${room}`,
      title: `${pkg.name} — ${ROOM_LABELS[room] || room}`,
      detail: `${pkg.duration_days} يوماً · ${pkg.airline || ''}`,
      amount,
    },
    extras
  );
  return { pkg, room, invoice };
}

/**
 * A client with no active booking gets one, already accepted by the agency
 * (the Super Admin is the director): it waits for the deposit at the accountant.
 */
export function addClientTrip(customerId: string, packageId: string, roomType: string, staff: { id: string; name: string }): Reservation {
  const db = getSqliteDb();
  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(customerId) as any;
  if (!customer) throw new Error('العميل غير موجود');
  if (findActiveReservation(customerId)) throw new Error('لهذا العميل رحلة نشطة — غيّر برنامجها بدل إضافة رحلة جديدة');
  const { pkg, room, invoice } = quoteProgram(packageId, roomType, []);

  const now = new Date().toISOString();
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservationNumber = nextReservationNumber();
  const name = String(customer.name || '').trim() || 'معتمر';
  const [first_name, ...rest] = name.split(/\s+/);
  const travelers = [{
    first_name,
    last_name: rest.join(' '),
    passport_number: '',
    passport_expiry: '',
    birth_date: '',
    gender: 'MALE' as const,
    traveler_type: 'ADULT' as const,
  }];
  db.transaction(() => {
    db.prepare(`
      INSERT INTO reservations (
        reservation_id, reservation_number, customer_id, customer_name, customer_email, customer_phone,
        package_id, package_name, room_type, travelers_count, travelers, total_price, paid_amount,
        payment_status, reservation_status, created_at, updated_at, extras, invoice, appointments, program,
        document_verify_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 'PENDING', 'REQUESTED', ?, ?, '[]', ?, ?, ?, ?)
    `).run(
      reservationId, reservationNumber, customerId, name, customer.email || '', customer.phone || '',
      pkg.package_id, pkg.name, room, JSON.stringify(travelers), invoice.total, now, now,
      JSON.stringify(invoice), JSON.stringify(buildAppointments(pkg)),
      JSON.stringify(buildProgram(pkg, room, lookupMorshidPhone(pkg.morshid_id))),
      documentVerifyCode(reservationNumber, 'request', invoice.total)
    );
    adjustPackageSeat(pkg.package_id, true);
  })();
  return confirmReservationByAgency(reservationId, staff, `أضافها ${staff.name} من «الفريق والحسابات».`);
}

/**
 * Move the client's active trip to another program / room before departure.
 * What was paid stays; the total, deposit and appointments follow the new program.
 */
export function changeClientTrip(customerId: string, packageId: string, roomType: string, staff: { id: string; name: string }): { before: Reservation; after: Reservation } {
  const db = getSqliteDb();
  const existing = findActiveReservation(customerId);
  if (!existing) throw new Error('لا توجد رحلة نشطة لهذا العميل');
  const guard = selfManageGuard(existing);
  if (!guard.ok) throw new Error(guard.reason || 'لا يمكن تعديل هذه الرحلة');
  const room = String(roomType || '').toUpperCase();
  if (existing.package_id === packageId && String(existing.room_type).toUpperCase() === room) {
    throw new Error('هذا هو البرنامج الحالي نفسه');
  }
  const extras = Array.isArray(existing.extras) ? (existing.extras as BookingExtra[]) : [];
  const { pkg, invoice } = quoteProgram(packageId, room, extras);
  const paid = Number(existing.paid_amount) || 0;
  if (paid > invoice.total) {
    throw new Error(`المدفوع (${paid.toLocaleString('ar-DZ')} دج) يتجاوز سعر البرنامج الجديد — الفرق يُسترجع عبر المحاسب أولاً`);
  }
  const status = String(existing.status || '').toUpperCase();
  const paymentStatus = paid >= invoice.total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  const reservationStatus = status === 'PAID' || status === 'PARTIALLY_PAID'
    ? (paid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID')
    : status;
  const now = new Date().toISOString();
  const note = [
    existing.agency_note || '',
    `غيّر ${staff.name} البرنامج من «${existing.package_name}» إلى «${pkg.name}» (${ROOM_LABELS[room] || room}) — ${new Date().toLocaleDateString('ar-DZ')}.`,
  ].filter(Boolean).join('\n');
  const newInvoice: BookingInvoice = { ...invoice, remainingAmount: Math.max(0, invoice.total - paid) };

  db.transaction(() => {
    if (existing.package_id !== pkg.package_id) {
      adjustPackageSeat(existing.package_id, false);
      adjustPackageSeat(pkg.package_id, true);
    }
    db.prepare(`
      UPDATE reservations SET
        package_id = ?, package_name = ?, room_type = ?,
        total_price = ?, payment_status = ?, reservation_status = ?,
        invoice = ?, appointments = ?, program = ?, agency_note = ?, updated_at = ?
      WHERE reservation_id = ? AND customer_id = ?
    `).run(
      pkg.package_id, pkg.name, room,
      invoice.total, paymentStatus, reservationStatus,
      JSON.stringify(newInvoice), JSON.stringify(buildAppointments(pkg)),
      JSON.stringify(buildProgram(pkg, room, lookupMorshidPhone(pkg.morshid_id))), note, now,
      existing.reservation_id, customerId
    );
  })();

  notifyPilgrimAndAgency({
    customerId,
    customerName: existing.customer_name,
    reservationNumber: existing.reservation_number,
    pilgrimText: `مرحباً ${existing.customer_name}، تم تغيير برنامج رحلتك رقم ${existing.reservation_number} إلى «${pkg.name}» (${ROOM_LABELS[room] || room}). المجموع الجديد ${invoice.total.toLocaleString('ar-DZ')} دج، والمدفوع ${paid.toLocaleString('ar-DZ')} دج.`,
    groupText: `تغيير برنامج ${existing.customer_name} (${existing.reservation_number}): «${existing.package_name}» ← «${pkg.name}».`,
    packageName: pkg.name,
  });
  return { before: existing, after: getReservationById(existing.reservation_id) as Reservation };
}
