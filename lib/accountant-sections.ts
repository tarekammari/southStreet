import {
  SCF_BALANCE,
  SCF_BALANCE_ACTIF_NOTES,
  SCF_BALANCE_PASSIF_NOTES,
  SCF_EXPENSE_LINE_NOTES,
  SCF_PNL,
  SCF_TREASURY,
} from '@/lib/accountant-scf';

/** Sidebar section ids — keep in sync with `AccountantDashboard` SECTIONS. */
export type AccountantSectionId =
  | 'overview'
  | 'treasury'
  | 'ledger'
  | 'receipts'
  | 'suppliers'
  | 'payroll'
  | 'services'
  | 'assets'
  | 'bookings'
  | 'reports'
  | 'chart'
  | 'principles'
  | 'audit'
  | 'periods'
  | 'taxes'
  | 'sakhr';

/** Right-rail labels (single source of truth for UI + القوائم المالية). */
export const ACCOUNTANT_NAV: Record<AccountantSectionId, { label: string; description: string }> = {
  overview: { label: 'الملخص', description: 'النتيجة، الخزينة، والقوائم' },
  treasury: { label: 'الخزينة', description: 'النقد والبنوك — للعرض' },
  ledger: { label: 'اليومية العامة', description: 'دفتر القيود' },
  receipts: { label: 'المداخيل', description: 'التحصيل والعملاء' },
  suppliers: { label: 'الموردون', description: 'استهلاك، خدمات، استثمارات' },
  payroll: { label: 'الرواتب', description: 'الموظفون والأجور' },
  services: { label: 'الخدمات الدورية', description: 'اشتراكات ومصاريف دورية (613/626)' },
  assets: { label: 'الاستثمارات', description: 'التثبيتات والإهلاك' },
  taxes: { label: 'الضرائب والرسوم', description: '64 · 447 · 695 — للعرض' },
  bookings: { label: 'الطلبات', description: 'حجوزات قيد المراجعة' },
  reports: { label: 'التقارير', description: 'تحليلات وفق SCF' },
  chart: { label: 'دليل الحسابات', description: 'SCF — مدونة الحسابات والربط' },
  principles: { label: 'المبادئ المحاسبية', description: 'SCF — قواعد ومراجع' },
  audit: { label: 'سجل التدقيق', description: 'تتبع عمليات المالية' },
  periods: { label: 'الفترات المحاسبية', description: 'إقفال شهري (تحذير)' },
  sakhr: { label: 'صخر', description: 'مساعد مالي ذكي' },
};

/**
 * P&L expense lines (IAS 1 — by nature). اليومية is the general ledger, not a P&L line.
 */
export type PnlExpenseLineId = 'suppliers' | 'payroll' | 'services' | 'assets';

export const PNL_EXPENSE_LINES: {
  id: PnlExpenseLineId;
  section: AccountantSectionId;
  label: string;
  accountingNote: string;
}[] = [
  {
    id: 'suppliers',
    section: 'suppliers',
    label: ACCOUNTANT_NAV.suppliers.label,
    accountingNote: SCF_EXPENSE_LINE_NOTES.suppliers,
  },
  {
    id: 'payroll',
    section: 'payroll',
    label: ACCOUNTANT_NAV.payroll.label,
    accountingNote: SCF_EXPENSE_LINE_NOTES.payroll,
  },
  {
    id: 'services',
    section: 'suppliers',
    label: 'خدمات دورية (613/626)',
    accountingNote: SCF_EXPENSE_LINE_NOTES.services,
  },
  {
    id: 'assets',
    section: 'assets',
    label: ACCOUNTANT_NAV.assets.label,
    accountingNote: SCF_EXPENSE_LINE_NOTES.assets,
  },
];

/** حساب النتيجة — SCF (alias historique PNL_IFRS pour imports existants). */
export const PNL_IFRS = SCF_PNL;

/** الميزانية — SCF */
export const BALANCE_IFRS = SCF_BALANCE;

export const BALANCE_ACTIF_NOTES = SCF_BALANCE_ACTIF_NOTES;
export const BALANCE_PASSIF_NOTES = SCF_BALANCE_PASSIF_NOTES;

export const BALANCE_LINE_SECTION: Record<string, AccountantSectionId> = {
  treasury: 'treasury',
  treasury_cash: 'treasury',
  treasury_bank: 'treasury',
  receivables: 'receipts',
  fixed_assets: 'assets',
  suppliers: 'suppliers',
  payroll: 'payroll',
  services: 'suppliers',
};

/** الخزينة — SCF */
export const TREASURY_IFRS = SCF_TREASURY;
