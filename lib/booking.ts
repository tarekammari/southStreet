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
import { ROOM_LABELS, canSelfManageReservation, isActiveReservation, isAgencyConfirmed, isPackageExpired } from '@/lib/booking-catalog';
import { documentVerifyCode } from '@/lib/booking-documents';
import { dbSaveMessage, dbSaveReceipt } from '@/lib/db';
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

export function listCustomerReservations(customerId: string): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM reservations WHERE customer_id = ?').all(customerId) as any[];
  return rows
    .map(mapReservationRow)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

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

export function listRecentAgencyReservations(limit = 40): Reservation[] {
  const db = getSqliteDb();
  const rows = db.prepare(`
    SELECT * FROM reservations
    WHERE reservation_status NOT IN ('REQUESTED', 'PENDING')
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

function notifyPilgrimAndAgency(input: {
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
    const agent = db.prepare("SELECT * FROM users WHERE id = 'usr_agent'").get() as any;
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
  const deposit = invoice?.depositAmount ?? Math.round(total * 0.3);
  const now = new Date().toISOString();
  const verifyCode = documentVerifyCode(row.reservation_number, 'confirmation', total);
  const updatedInvoice = invoice
    ? { ...invoice, remainingAmount: Math.max(0, total - deposit) }
    : null;

  db.transaction(() => {
    db.prepare(`
      UPDATE reservations SET
        reservation_status = 'CONFIRMED',
        payment_status = 'PARTIALLY_PAID',
        paid_amount = ?,
        agency_confirmed_at = ?,
        agency_confirmed_by = ?,
        agency_note = ?,
        document_verify_code = ?,
        invoice = COALESCE(?, invoice),
        updated_at = ?
      WHERE reservation_id = ?
    `).run(
      deposit,
      now,
      staff.name,
      note || '',
      verifyCode,
      updatedInvoice ? JSON.stringify(updatedInvoice) : null,
      now,
      reservationId
    );
    approveCustomerLogin(row.customer_id);
  })();

  const reservation = getReservationById(reservationId) as Reservation;

  const userRow = db.prepare('SELECT code, username FROM users WHERE id = ?').get(row.customer_id) as any;
  dbSaveReceipt({
    id: `RCP-${String(row.reservation_number).replace('RES-', '')}`,
    pilgrimName: row.customer_name,
    pilgrimCode: userRow?.code || userRow?.username || row.customer_id,
    packageName: row.package_name,
    totalAmount: total,
    paidAmount: deposit,
    remainingAmount: Math.max(0, total - deposit),
    paymentMethod: 'دفعة تأكيد أولى (30%) — تحويل بريدي موب / CCP',
    date: now.slice(0, 10),
    accountantName: staff.name,
    status: 'دفعة أولى — بعد تأكيد الوكالة',
  });

  notifyPilgrimAndAgency({
    customerId: row.customer_id,
    customerName: row.customer_name,
    reservationNumber: row.reservation_number,
    pilgrimText: `مرحباً ${row.customer_name}، أكّدت الوكالة طلب عمرتك رقم ${row.reservation_number} وتم تفعيل دخول حسابك. الدفعة الأولى ${deposit.toLocaleString('ar-DZ')} دج، والمتبقي ${Math.max(0, total - deposit).toLocaleString('ar-DZ')} دج قبل السفر. برنامجك جاهز في بوابة المعتمر.`,
    groupText: `تم تأكيد طلب ${row.customer_name} — ${row.package_name} (${row.reservation_number}).`,
    packageName: row.package_name,
  });

  return reservation;
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
  if (status !== 'REQUESTED' && status !== 'PENDING') {
    throw new Error('INVALID_STATUS');
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
    pilgrimText: `نعتذر ${row.customer_name}، لم تتم الموافقة على طلب ${row.reservation_number}. ${note ? `السبب: ${note}` : 'تواصل معنا من المحادثة لمعرفة البدائل.'}`,
  });

  return getReservationById(reservationId) as Reservation;
}
