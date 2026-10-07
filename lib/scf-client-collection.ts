import { daysUntilDeparture } from '@/lib/booking-catalog';

/** SCF credit side for cash collected from a pilgrim (not revenue 706 on cash). */
export type ClientCollectionCredit = '419' | '411';

function moneyAr(n: number) {
  return `${Math.round(Math.abs(Number(n) || 0)).toLocaleString('fr-DZ')} دج`;
}

export function parseReservationProgramStart(reservation: {
  program?: string | { start_date?: string | null } | null;
  start_date?: string | null;
} | null): string | null {
  if (!reservation) return null;
  if (reservation.start_date) return String(reservation.start_date).slice(0, 10);
  const raw = reservation.program;
  if (!raw) return null;
  if (typeof raw === 'object') return raw.start_date ? String(raw.start_date).slice(0, 10) : null;
  try {
    const p = JSON.parse(String(raw));
    return p?.start_date ? String(p.start_date).slice(0, 10) : null;
  } catch {
    return null;
  }
}

/**
 * SCF (JORADP / agency rules):
 * - قبل أداء الرحلة: التحصيل = تسبيق زبائن دائنون → دائن 419 (ليس إيراداً 706)
 * - بعد انطلاق/أداء الخدمة: التحصيل على ذمة الزبون → دائن 411
 * الإيراد 706 يُعترف عند أداء الخدمة (قيد منفصل)، لا عند قبض النقد.
 */
export function scfClientCollectionCredit(reservation: {
  program?: string | { start_date?: string | null } | null;
  start_date?: string | null;
  reservation_status?: string | null;
} | null): ClientCollectionCredit {
  const start = parseReservationProgramStart(reservation);
  const days = daysUntilDeparture(start);
  if (days !== null && days < 0) return '411';
  const status = String(reservation?.reservation_status || '').toUpperCase();
  if (['COMPLETED', 'READY_FOR_TRAVEL'].includes(status) && days !== null && days < 0) return '411';
  return '419';
}

/** SCF م2 — recognize package revenue (706) on/after departure date. */
export function shouldRecognizeClientRevenue(reservation: {
  program?: string | { start_date?: string | null } | null;
  start_date?: string | null;
  reservation_status?: string | null;
  total_price?: number | null;
} | null): boolean {
  if (!reservation) return false;
  const invoice = Math.max(0, Number(reservation.total_price) || 0);
  if (!invoice) return false;
  const status = String(reservation.reservation_status || '').toUpperCase();
  if (
    !['CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'DOCUMENTS_PENDING', 'READY_FOR_TRAVEL', 'COMPLETED'].includes(
      status
    )
  ) {
    return false;
  }
  const start = parseReservationProgramStart(reservation);
  const days = daysUntilDeparture(start);
  if (days === null) {
    return ['READY_FOR_TRAVEL', 'COMPLETED'].includes(status);
  }
  return days <= 0;
}

export function formatClientRevenueJournalDescription(input: {
  customer_name: string;
  package_name?: string | null;
  invoice_total: number;
  advances?: number;
}): string {
  const name = String(input.customer_name || '').trim() || 'عميل';
  const pkg = String(input.package_name || '').trim();
  const invoice = Math.max(0, Number(input.invoice_total) || 0);
  const advances = Math.min(invoice, Math.max(0, Number(input.advances) || 0));
  const invoicePart = pkg
    ? `فاتورة الباقة ${moneyAr(invoice)} — ${pkg} — ${name}`
    : `فاتورة الباقة ${moneyAr(invoice)} — ${name}`;
  const settle =
    advances > 0
      ? ` · تسوية تسبيق 419→411 ${moneyAr(advances)}`
      : '';
  return `اعتراف بإيراد المنتوج (SCF 706) · ${invoicePart} · مدين 411 · دائن 706${settle}`;
}

export function scfClientCollectionCreditLabel(code: ClientCollectionCredit) {
  return code === '419'
    ? '419 — زبائن دائنون (تسبيقات مستلمة)'
    : '411 — زبائن';
}

/** Journal wording: invoice total first, then the cash payment (SCF). */
export function formatClientCollectionJournalDescription(input: {
  customer_name: string;
  package_name?: string | null;
  invoice_total: number;
  payment_amount: number;
  paid_before?: number;
  credit_scf: ClientCollectionCredit;
  source?: string | null;
}): string {
  const name = String(input.customer_name || '').trim() || 'عميل';
  const pkg = String(input.package_name || '').trim();
  const invoice = Math.max(0, Number(input.invoice_total) || 0);
  const pay = Math.max(0, Number(input.payment_amount) || 0);
  const paidBefore = Math.max(0, Number(input.paid_before) || 0);
  const paidAfter = paidBefore + pay;
  const credit = input.credit_scf;
  const source = String(input.source || 'INCOME').toUpperCase();

  const invoicePart = pkg
    ? `فاتورة الباقة ${moneyAr(invoice)} — ${pkg} — ${name}`
    : `فاتورة الباقة ${moneyAr(invoice)} — ${name}`;

  let paymentKind: string;
  if (source === 'DEPOSIT' || credit === '419') {
    paymentKind =
      paidBefore <= 0
        ? `دفعة محصّلة ${moneyAr(pay)} (عربون / تسبيق — SCF ${credit})`
        : `دفعة محصّلة ${moneyAr(pay)} (تسبيق إضافي — SCF ${credit})`;
  } else {
    paymentKind = `دفعة محصّلة ${moneyAr(pay)} (تحصيل على 411 — SCF ${credit})`;
  }

  const progress =
    invoice > 0
      ? ` · المدفوع بعد القيد ${moneyAr(paidAfter)} من ${moneyAr(invoice)}`
      : '';

  return `${invoicePart} · ${paymentKind}${progress} · مدين 512/53 · دائن ${credit}`;
}
