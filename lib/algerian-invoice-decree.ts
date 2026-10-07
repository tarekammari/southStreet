/**
 * Champs et libellés alignés sur le décret exécutif n° 05-468 (10 déc. 2005)
 * — conditions de la facture (JORADP n° 80, p. 18–20).
 */

export const ALGERIAN_INVOICE_DECREE_REF =
  'المرسوم التنفيذي 05-468 · 10 ديسمبر 2005 (الجريدة الرسمية)';

export type InvoiceDiscountKind = 'none' | 'remise' | 'rabais' | 'ristourne';

export const INVOICE_DISCOUNT_KINDS: { id: InvoiceDiscountKind; label: string; hint: string }[] = [
  { id: 'none', label: '—', hint: 'بدون' },
  {
    id: 'remise',
    label: 'تخفيض (remise)',
    hint: 'حسب الكمية أو صفة المشتري',
  },
  {
    id: 'rabais',
    label: 'اقتطاع (rabais)',
    hint: 'تأخير تسليم أو عيب جودة',
  },
  {
    id: 'ristourne',
    label: 'انتقاص (ristourne)',
    hint: 'حسب حجم الأعمال',
  },
];

const FR_UNITS = [
  '',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  if (n < 70) {
    const tens = Math.floor(n / 10) * 10;
    const u = n % 10;
    const tensWord =
      tens === 20
        ? 'vingt'
        : tens === 30
          ? 'trente'
          : tens === 40
            ? 'quarante'
            : tens === 50
              ? 'cinquante'
              : tens === 60
                ? 'soixante'
                : '';
    return u ? `${tensWord}-${FR_UNITS[u]}` : tensWord;
  }
  if (n < 80) return n === 71 ? 'soixante-onze' : `soixante-${FR_UNITS[n - 60]}`;
  if (n < 100) return n === 80 ? 'quatre-vingts' : `quatre-vingt-${FR_UNITS[n - 80]}`;
  return String(n);
}

function frInt(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 100) return frBelow100(n);
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const head = h === 1 ? 'cent' : `${frBelow100(h)} cent${h > 1 && !r ? 's' : ''}`;
    return r ? `${head} ${frInt(r)}` : head;
  }
  if (n < 1_000_000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const head = th === 1 ? 'mille' : `${frInt(th)} mille`;
    return r ? `${head} ${frInt(r)}` : head;
  }
  const m = Math.floor(n / 1_000_000);
  const r = n % 1_000_000;
  const head = m === 1 ? 'un million' : `${frInt(m)} millions`;
  return r ? `${head} ${frInt(r)}` : head;
}

/** Montant TTC en toutes lettres (usage courant sur factures DZ). */
export function amountInWordsFrDzd(amount: number): string {
  const v = Math.max(0, Math.round(Number(amount) * 100) / 100);
  const dinars = Math.floor(v);
  const centimes = Math.round((v - dinars) * 100);
  let s = frInt(dinars);
  s += dinars === 1 ? ' dinar algérien' : ' dinars algériens';
  if (centimes > 0) {
    s += ` et ${frInt(centimes)} centime${centimes > 1 ? 's' : ''}`;
  }
  return s;
}

export function composeSupplierInvoiceNote(input: {
  designation: string;
  quantity: number;
  unitPriceHt: number;
  discountKind: InvoiceDiscountKind;
  paymentMethodLabel: string;
  dueDate: string;
  vatExempt: boolean;
  ttc: number;
}): string {
  const lines: string[] = [];
  const d = input.designation.trim();
  if (d) lines.push(d);
  const meta: string[] = [];
  meta.push(ALGERIAN_INVOICE_DECREE_REF);
  meta.push(`كمية: ${input.quantity} · PU HT: ${input.unitPriceHt.toFixed(2)} دج`);
  if (input.discountKind !== 'none') {
    const k = INVOICE_DISCOUNT_KINDS.find((x) => x.id === input.discountKind);
    if (k) meta.push(`نوع الحسم: ${k.label}`);
  }
  if (input.vatExempt) meta.push('معفى من TVA');
  meta.push(`أجل الدفع: ${input.dueDate} · ${input.paymentMethodLabel}`);
  meta.push(`Montant TTC en lettres: ${amountInWordsFrDzd(input.ttc)}`);
  lines.push(meta.join(' · '));
  return lines.join('\n\n');
}
