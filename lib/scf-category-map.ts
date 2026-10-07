import {
  LEDGER_CATEGORIES,
  SUPPLIER_CATEGORIES,
  normalizeSupplierCategory,
  type LedgerCategoryId,
  type SupplierCategoryId,
} from '@/lib/finance-categories';

export type ScfCategoryMapping = {
  scf_code: string;
  note_ar: string;
};

export const SUPPLIER_CATEGORY_SCF: Record<SupplierCategoryId, ScfCategoryMapping> = {
  hotels: { scf_code: '604', note_ar: 'مشتريات خدمات مؤداة — فنادق (باقات)' },
  airlines: { scf_code: '604', note_ar: 'مشتريات خدمات — طيران' },
  transport: { scf_code: '604', note_ar: 'مشتريات خدمات — نقل' },
  visa: { scf_code: '604', note_ar: 'مشتريات خدمات — تأشيرات' },
  catering: { scf_code: '604', note_ar: 'مشتريات خدمات — إعاشة' },
  ground: { scf_code: '604', note_ar: 'مشتريات خدمات — أرضي' },
  insurance: { scf_code: '616', note_ar: 'تأمين الوكالة (616)؛ تأمين الحاج غالباً 604 — راجع المحاسب' },
  telecom_it: { scf_code: '626', note_ar: 'اتصالات وتقنية — 626؛ برمجيات مقتناة → 20/404' },
  investment: { scf_code: '404', note_ar: 'موردو التثبيتات — 21 / 404' },
  other: { scf_code: '625', note_ar: 'أخرى — 625/62x حسب الطبيعة' },
};

export const LEDGER_CATEGORY_SCF: Record<LedgerCategoryId, ScfCategoryMapping> = {
  ops: { scf_code: '625', note_ar: 'تشغيل — تنقلات ومهمات' },
  supplier_purchase: { scf_code: '604', note_ar: 'مشتريات موردين — 604 / دائن 401' },
  services: { scf_code: '613', note_ar: 'خدمات — إيجار أو 626' },
  payroll_related: { scf_code: '631', note_ar: 'رواتب — 631 / 421' },
  gov_fees: { scf_code: '447', note_ar: 'رسوم حكومية — 447' },
  commissions: { scf_code: '622', note_ar: 'عمولات — 622' },
  capex: { scf_code: '404', note_ar: 'أصول — 404/21 (تثبيتات)' },
  cash_in: { scf_code: '512', note_ar: 'تحصيل — مدين 512/53؛ عربون → 419' },
  cash_out: { scf_code: '512', note_ar: 'صرف — دائن 512/53' },
  transfer: { scf_code: '581', note_ar: 'تحويل داخلي — 581' },
  other: { scf_code: '658', note_ar: 'متفرق — 65x حسب الطبيعة' },
};

export function supplierMappingsForUi() {
  return SUPPLIER_CATEGORIES.map((c) => ({
    category_id: c.id,
    category_label: c.label,
    ...SUPPLIER_CATEGORY_SCF[c.id],
  }));
}

export function ledgerMappingsForUi() {
  return LEDGER_CATEGORIES.map((c) => ({
    category_id: c.id,
    category_label: c.label,
    ...LEDGER_CATEGORY_SCF[c.id],
  }));
}

export function scfCodeForSupplierCategory(id: string) {
  return SUPPLIER_CATEGORY_SCF[id as SupplierCategoryId]?.scf_code || '604';
}

/** Supplier row: explicit chart account wins over category default. */
export function scfCodeForSupplierRecord(input: { category?: string | null; scf_code?: string | null }) {
  const explicit = String(input.scf_code || '').trim();
  if (explicit) return explicit;
  return scfCodeForSupplierCategory(normalizeSupplierCategory(input.category));
}

export function scfCodeForLedgerCategory(id: string) {
  return LEDGER_CATEGORY_SCF[id as LedgerCategoryId]?.scf_code || '625';
}
