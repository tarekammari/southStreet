/**
 * Shared finance category constants (Arabic RTL labels).
 * IDs are stable English keys stored in DB/API; UI shows Arabic labels.
 */

export const SUPPLIER_CATEGORIES = [
  { id: 'hotels', label: 'فنادق' },
  { id: 'airlines', label: 'طيران' },
  { id: 'transport', label: 'نقل' },
  { id: 'visa', label: 'تأشيرات' },
  { id: 'catering', label: 'إعاشة' },
  { id: 'ground', label: 'خدمات أرضية' },
  { id: 'insurance', label: 'تأمين' },
  { id: 'telecom_it', label: 'اتصالات وتقنية' },
  { id: 'investment', label: 'استثمارات وتثبيتات' },
  { id: 'other', label: 'أخرى' },
] as const;

export type SupplierCategoryId = (typeof SUPPLIER_CATEGORIES)[number]['id'];
export const DEFAULT_SUPPLIER_CATEGORY: SupplierCategoryId = 'other';

export const LEDGER_CATEGORIES = [
  { id: 'ops', label: 'تشغيل' },
  { id: 'supplier_purchase', label: 'مشتريات موردين' },
  { id: 'services', label: 'خدمات' },
  { id: 'payroll_related', label: 'رواتب وأجور' },
  { id: 'gov_fees', label: 'رسوم حكومية' },
  { id: 'commissions', label: 'عمولات' },
  { id: 'capex', label: 'أصول واستثمارات' },
  { id: 'cash_in', label: 'نقد داخل' },
  { id: 'cash_out', label: 'نقد خارج' },
  { id: 'transfer', label: 'تحويل' },
  { id: 'other', label: 'أخرى' },
] as const;

export type LedgerCategoryId = (typeof LEDGER_CATEGORIES)[number]['id'];
export const DEFAULT_LEDGER_CATEGORY: LedgerCategoryId = 'other';

const SUPPLIER_IDS = new Set(SUPPLIER_CATEGORIES.map((c) => c.id));
const LEDGER_IDS = new Set(LEDGER_CATEGORIES.map((c) => c.id));

export function normalizeSupplierCategory(raw?: string | null): SupplierCategoryId {
  const v = String(raw ?? '').trim().toLowerCase();
  if (SUPPLIER_IDS.has(v as SupplierCategoryId)) return v as SupplierCategoryId;
  return DEFAULT_SUPPLIER_CATEGORY;
}

export function supplierCategoryLabel(raw?: string | null): string {
  const id = normalizeSupplierCategory(raw);
  return SUPPLIER_CATEGORIES.find((c) => c.id === id)!.label;
}

/** Three supplier books used by the accountant rail. */
export const SUPPLIER_LANES = [
  {
    id: 'consumption',
    label: 'موردو الاستهلاك',
    hint: '60 · مشتريات مستهلكة',
    defaultCategory: 'hotels',
  },
  {
    id: 'services',
    label: 'موردو الخدمات',
    hint: '61 / 62 · خدمات خارجية',
    defaultCategory: 'other',
  },
  {
    id: 'investment',
    label: 'موردو الاستثمارات',
    hint: '21 · تثبيتات',
    defaultCategory: 'investment',
  },
] as const;

export type SupplierLane = (typeof SUPPLIER_LANES)[number]['id'];

const CONSUMPTION_CATEGORIES = new Set<SupplierCategoryId>([
  'hotels',
  'airlines',
  'transport',
  'visa',
  'catering',
  'ground',
]);

/** Classify a supplier into استهلاك / خدمات / استثمارات. */
export function supplierLane(input: { category?: string | null; scf_code?: string | null }): SupplierLane {
  const cat = normalizeSupplierCategory(input.category);
  if (cat === 'investment') return 'investment';
  const code = String(input.scf_code || '').replace(/\s/g, '');
  if (code.startsWith('21') || code.startsWith('20') || code.startsWith('404')) return 'investment';
  if (CONSUMPTION_CATEGORIES.has(cat) || code.startsWith('60')) return 'consumption';
  return 'services';
}

export function normalizeLedgerCategory(raw?: string | null): LedgerCategoryId {
  const v = String(raw ?? '').trim().toLowerCase();
  if (LEDGER_IDS.has(v as LedgerCategoryId)) return v as LedgerCategoryId;
  return DEFAULT_LEDGER_CATEGORY;
}

export function ledgerCategoryLabel(raw?: string | null): string {
  const id = normalizeLedgerCategory(raw);
  return LEDGER_CATEGORIES.find((c) => c.id === id)!.label;
}

/**
 * Capital assets the agency invests in. `life` is the default straight-line
 * useful life in years used to estimate depreciation and net book value.
 */
export const ASSET_CATEGORIES = [
  { id: 'apartments', label: 'شقق وعقارات', life: 25 },
  { id: 'cars', label: 'سيارات', life: 7 },
  { id: 'buses', label: 'حافلات', life: 10 },
  { id: 'air_conditioners', label: 'مكيفات', life: 8 },
  { id: 'refrigerators', label: 'ثلاجات', life: 8 },
  { id: 'televisions', label: 'تلفزيونات', life: 6 },
  { id: 'computers', label: 'حواسيب', life: 4 },
  { id: 'printers', label: 'طابعات', life: 4 },
  { id: 'mobiles', label: 'هواتف', life: 3 },
  { id: 'desks', label: 'مكاتب', life: 10 },
  { id: 'chairs', label: 'كراسي', life: 8 },
  { id: 'furniture', label: 'أثاث وتجهيزات', life: 10 },
  { id: 'other', label: 'أخرى', life: 5 },
] as const;

export type AssetCategoryId = (typeof ASSET_CATEGORIES)[number]['id'];
export const DEFAULT_ASSET_CATEGORY: AssetCategoryId = 'other';

const ASSET_IDS = new Set(ASSET_CATEGORIES.map((c) => c.id));

export function normalizeAssetCategory(raw?: string | null): AssetCategoryId {
  const v = String(raw ?? '').trim().toLowerCase();
  if (ASSET_IDS.has(v as AssetCategoryId)) return v as AssetCategoryId;
  return DEFAULT_ASSET_CATEGORY;
}

export function assetCategoryLabel(raw?: string | null): string {
  const id = normalizeAssetCategory(raw);
  return ASSET_CATEGORIES.find((c) => c.id === id)!.label;
}

export function assetCategoryLife(raw?: string | null): number {
  const id = normalizeAssetCategory(raw);
  return ASSET_CATEGORIES.find((c) => c.id === id)!.life;
}

/** Where the agency actually holds its money. */
export const TREASURY_KINDS = [
  { id: 'CASH', label: 'صندوق نقدي' },
  { id: 'BANK', label: 'حساب بنكي' },
  { id: 'CCP', label: 'حساب بريدي CCP' },
  { id: 'OTHER', label: 'أخرى' },
] as const;

export type TreasuryKindId = (typeof TREASURY_KINDS)[number]['id'];

export function normalizeTreasuryKind(raw?: string | null): TreasuryKindId {
  const v = String(raw ?? '').trim().toUpperCase();
  return TREASURY_KINDS.some((k) => k.id === v) ? (v as TreasuryKindId) : 'CASH';
}

export function treasuryKindLabel(raw?: string | null): string {
  const id = normalizeTreasuryKind(raw);
  return TREASURY_KINDS.find((k) => k.id === id)!.label;
}

/** Revenue activity lines the agency sells; used to slice the recap by trip type. */
export const TRIP_TYPES = [
  { id: 'umrah', label: 'عمرة' },
  { id: 'hajj', label: 'حج' },
  { id: 'other', label: 'أخرى' },
] as const;

export type TripTypeId = (typeof TRIP_TYPES)[number]['id'];

export function tripTypeLabel(raw?: string | null): string {
  const id = String(raw || 'other');
  return TRIP_TYPES.find((t) => t.id === id)?.label || 'أخرى';
}

/**
 * Package names are free Arabic text, so the trip line is inferred from keywords.
 * Seasonal names such as "باقة أوت الاقتصادية" carry no keyword; since the agency only
 * sells Umrah and Hajj, anything named that is not Hajj is counted as Umrah, and only
 * revenue with no package attached falls to "أخرى".
 */
export function classifyTripType(packageName?: string | null): TripTypeId {
  const name = String(packageName || '').trim();
  if (!name) return 'other';
  if (/حج|حجة|hajj/i.test(name)) return 'hajj';
  return 'umrah';
}

/** Infer a sensible ledger category from legacy type enum (additive UX helper). */
export function ledgerCategoryFromType(type?: string | null): LedgerCategoryId {
  const t = String(type || '').toUpperCase();
  if (t === 'CASH_IN') return 'cash_in';
  if (t === 'CASH_OUT') return 'cash_out';
  if (t === 'PURCHASE') return 'supplier_purchase';
  if (t === 'SERVICE_SPEND') return 'services';
  if (t === 'EXPENSE') return 'ops';
  return DEFAULT_LEDGER_CATEGORY;
}
