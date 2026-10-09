import { isAgencyConfirmed } from '@/lib/booking-catalog';

/**
 * Which booking documents make sense at each stage of a request.
 * Shared by the print menus (UI) and the document API (server), so an
 * official-looking paper can never be issued for the wrong stage — e.g. no
 * "confirmation" for a request that was refused.
 */

export type ReservationDoc = 'request' | 'invoice' | 'confirmation';

export function printableDocs(status?: string | null): ReservationDoc[] {
  const s = String(status || '').toUpperCase();
  if (s === 'REJECTED' || s === 'CANCELLED' || s === 'EXPIRED') return [];
  if (isAgencyConfirmed(s)) return ['confirmation', 'invoice'];
  // Accepted, waiting for the deposit: the proforma tells the pilgrim what to pay.
  if (s === 'PAYMENT_PENDING') return ['invoice', 'request'];
  // New demand: only the filled-in request form, nothing binding yet.
  return ['request'];
}

export function canPrintDoc(type: string, status?: string | null): boolean {
  return (printableDocs(status) as string[]).includes(type);
}

/** Menu label + one-line hint for a document at this stage. */
export function docLabel(type: ReservationDoc, status?: string | null): { label: string; hint: string } {
  const confirmed = isAgencyConfirmed(status);
  switch (type) {
    case 'confirmation':
      return { label: 'تأكيد الحجز', hint: 'الوثيقة الرسمية للمعتمر' };
    case 'invoice':
      return confirmed
        ? { label: 'الفاتورة', hint: 'المبالغ المدفوعة والمتبقية' }
        : { label: 'فاتورة أولية', hint: 'المبلغ والعربون المطلوب للتأكيد' };
    case 'request':
    default:
      return { label: 'استمارة الطلب', hint: 'بيانات الطلب كما أرسلها المعتمر' };
  }
}
