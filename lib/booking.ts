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
import { ROOM_LABELS } from '@/lib/booking-catalog';

export { BOOKING_EXTRAS, DEPOSIT_PERCENT, ROOM_LABELS, extrasByIds, buildInvoice } from '@/lib/booking-catalog';

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
