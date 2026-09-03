import { BookingExtra, BookingInvoice, InvoiceLine } from '@/types';

export const DEPOSIT_PERCENT = 0.3;

export const ROOM_LABELS: Record<string, string> = {
  QUAD: 'غرفة رباعية',
  TRIPLE: 'غرفة ثلاثية',
  DOUBLE: 'غرفة ثنائية',
  SINGLE: 'غرفة فردية',
};

export const BOOKING_EXTRAS: BookingExtra[] = [
  {
    id: 'visa_fast',
    title: 'تأشيرة نسك عاجلة',
    detail: 'إصدار التأشيرة خلال 48 ساعة بدل المسار العادي',
    price: 8500,
  },
  {
    id: 'private_transfer',
    title: 'نقل مطار خاص',
    detail: 'سيارة خاصة عند الوصول بدل الحافلة الجماعية',
    price: 12000,
  },
  {
    id: 'zamzam',
    title: 'زمزم إضافي (5 لتر)',
    detail: 'شحن مع الأمتعة عند العودة',
    price: 3500,
  },
  {
    id: 'insurance',
    title: 'تأمين سفر شامل',
    detail: 'تغطية طبية طوال أيام البرنامج',
    price: 6500,
  },
  {
    id: 'extra_night',
    title: 'ليلة إضافية في مكة',
    detail: 'بعد نهاية البرنامج الرسمي',
    price: 18000,
  },
  {
    id: 'wheelchair',
    title: 'كرسي متحرك',
    detail: 'مرافقة في الحرم والمزارات',
    price: 4000,
  },
];

export const ACTIVE_RESERVATION_STATUSES = [
  'REQUESTED',
  'PENDING',
  'CONFIRMED',
  'PAYMENT_PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'DOCUMENTS_PENDING',
  'READY_FOR_TRAVEL',
] as const;

export const FREE_CANCEL_DAYS = 20;

export function isActiveReservation(status?: string | null): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(String(status || '').toUpperCase() as (typeof ACTIVE_RESERVATION_STATUSES)[number]);
}

export function daysUntilDeparture(startDate?: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

export function reservationStatusLabel(status?: string | null): string {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'REQUESTED':
    case 'PENDING':
      return 'بانتظار تأكيد الوكالة';
    case 'CONFIRMED':
      return 'مؤكد من الوكالة';
    case 'PAYMENT_PENDING':
      return 'بانتظار الدفع';
    case 'PARTIALLY_PAID':
      return 'مدفوع جزئياً';
    case 'PAID':
      return 'مدفوع بالكامل';
    case 'DOCUMENTS_PENDING':
      return 'بانتظار الوثائق';
    case 'READY_FOR_TRAVEL':
      return 'جاهز للسفر';
    case 'COMPLETED':
      return 'مكتمل';
    case 'CANCELLED':
      return 'ملغى';
    case 'REJECTED':
      return 'مرفوض من الوكالة';
    default:
      return status || '—';
  }
}

export function isAgencyConfirmed(status?: string | null): boolean {
  const s = String(status || '').toUpperCase();
  return ['CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(s);
}

export function paymentStatusLabel(status?: string | null): string {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'UNPAID':
      return 'غير مدفوع';
    case 'PENDING':
      return 'بانتظار الدفع';
    case 'PARTIALLY_PAID':
      return 'مدفوع جزئياً';
    case 'PAID':
      return 'مدفوع بالكامل';
    case 'REFUNDED':
      return 'مسترد';
    default:
      return status || '—';
  }
}

export function canSelfManageReservation(status?: string | null, startDate?: string | null): { ok: boolean; reason?: string } {
  if (!isActiveReservation(status)) {
    return { ok: false, reason: 'هذا الطلب ملغى أو مكتمل. يمكنك بدء حجز جديد.' };
  }
  const days = daysUntilDeparture(startDate);
  if (days !== null && days < 0) {
    return { ok: false, reason: 'الرحلة بدأت. للتعديل أو الإلغاء تواصل مع الوكالة من المحادثة.' };
  }
  return { ok: true };
}

export function extrasByIds(ids: string[]): BookingExtra[] {
  const wanted = new Set(ids);
  return BOOKING_EXTRAS.filter((item) => wanted.has(item.id));
}

export function buildInvoice(roomLine: InvoiceLine, extras: BookingExtra[]): BookingInvoice {
  const extraLines: InvoiceLine[] = extras.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.detail,
    amount: item.price,
  }));
  const extrasTotal = extraLines.reduce((sum, line) => sum + line.amount, 0);
  const total = roomLine.amount + extrasTotal;
  const depositAmount = Math.round(total * DEPOSIT_PERCENT);
  return {
    lines: [roomLine, ...extraLines],
    extrasTotal,
    total,
    depositPercent: Math.round(DEPOSIT_PERCENT * 100),
    depositAmount,
    remainingAmount: total - depositAmount,
    currency: 'DZD',
  };
}
