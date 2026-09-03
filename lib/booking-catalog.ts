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
