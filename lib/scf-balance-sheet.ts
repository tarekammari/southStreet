/**
 * Official SCF balance sheet lines (JORADP n°19 — 25 mars 2009).
 * Account references match the statutory «ميزانية» form. Amounts the agency
 * actually tracks are posted on the matching line; other lines stay at zero.
 */

export type BilanGroupId =
  | 'actif_immobilise'
  | 'actif_circulant'
  | 'capitaux_propres'
  | 'passif_non_courant'
  | 'passif_circulant';

export type ScfBilanLine = {
  id: string;
  /** Gross / principal accounts, as printed on the official form. */
  scf_code: string;
  /** Depreciation, provisions or credit-balance accounts for the same row. */
  amort_accounts?: string;
  label: string;
  amount: number;
  section?: string;
  group: BilanGroupId;
  /** Subsection title inside a group (no amount). */
  header?: boolean;
};

export const BILAN_GROUP_LABELS: Record<BilanGroupId, string> = {
  actif_immobilise: 'الأصول المثبتة (غير الجارية)',
  actif_circulant: 'الأصول الجارية',
  capitaux_propres: 'رؤوس الأموال الخاصة',
  passif_non_courant: 'الخصوم غير الجارية',
  passif_circulant: 'الخصوم الجارية',
};

export const BILAN_SUBTOTAL_LABELS: Record<BilanGroupId, string> = {
  actif_immobilise: 'مجموع الأصول غير الجارية',
  actif_circulant: 'مجموع الأصول الجارية',
  capitaux_propres: 'المجموع 1',
  passif_non_courant: 'مجموع الخصوم غير الجارية',
  passif_circulant: 'مجموع الخصوم الجارية',
};

export type ScfBalanceSheet = {
  actif: ScfBilanLine[];
  passif: ScfBilanLine[];
  total_actif: number;
  total_passif: number;
  subtotals: Partial<Record<BilanGroupId, number>>;
};

type FillId =
  | 'fixed'
  | 'receivables'
  | 'treasury_debit'
  | 'treasury_credit'
  | 'suppliers'
  | 'payroll'
  | 'equity_capital'
  | 'equity_result';

type Template = {
  id: string;
  label: string;
  scf_code: string;
  amort_accounts?: string;
  group: BilanGroupId;
  header?: boolean;
  section?: string;
  fill?: FillId;
};

/** Statutory actif rows, in the order of the official form. */
const ACTIF_TEMPLATE: Template[] = [
  { id: 'goodwill', label: 'فارق الشراء (أو goodwill)', scf_code: '207', amort_accounts: '2807 و 2907', group: 'actif_immobilise' },
  { id: 'intangible', label: 'التثبيتات المعنوية', scf_code: '20 (خارج 207)', amort_accounts: '280 (خارج 2807) و 290 (خارج 2907)', group: 'actif_immobilise' },
  { id: 'fixed_assets', label: 'التثبيتات العينية', scf_code: '21', amort_accounts: '281 و 291', group: 'actif_immobilise', section: 'assets', fill: 'fixed' },
  { id: 'assets_wip', label: 'التثبيتات الجاري إنجازها', scf_code: '23', amort_accounts: '293', group: 'actif_immobilise' },
  { id: 'fin_head', label: 'التثبيتات المالية', scf_code: '', group: 'actif_immobilise', header: true },
  { id: 'equity_method', label: 'السندات الموضوعة موضع المعادلة — مؤسسات مشاركة', scf_code: '265', group: 'actif_immobilise' },
  { id: 'other_holdings', label: 'المساهمات الأخرى والحسابات الدائنة الملحقة', scf_code: '26 (خارج 265 و 269)', amort_accounts: '269 و 296', group: 'actif_immobilise' },
  { id: 'other_securities', label: 'السندات الأخرى المثبتة', scf_code: '271 و 272 و 273', group: 'actif_immobilise' },
  { id: 'loans_nc', label: 'القروض والأصول المالية الأخرى غير الجارية', scf_code: '274 و 275 و 276', group: 'actif_immobilise' },
  { id: 'inventory', label: 'المخزونات والمنتجات قيد الصنع', scf_code: '30 إلى 38', amort_accounts: '39', group: 'actif_circulant' },
  { id: 'receivables_uses', label: 'الحسابات الدائنة — الاستخدامات المماثلة', scf_code: '41', amort_accounts: '491', group: 'actif_circulant' },
  {
    id: 'receivables',
    label: 'الزبائن',
    scf_code: '419 مدين، 42 و 43، 44 و 45 مدين، 46 و 48',
    amort_accounts: '495 و 496',
    group: 'actif_circulant',
    section: 'receipts',
    fill: 'receivables',
  },
  { id: 'tax_assets', label: 'الضرائب', scf_code: '444 و 445 و 447', group: 'actif_circulant' },
  { id: 'other_current', label: 'الأصول الأخرى الجارية', scf_code: '48 و 49', amort_accounts: '46 مدين', group: 'actif_circulant' },
  { id: 'cash_head', label: 'الموجودات وما يماثلها', scf_code: '', group: 'actif_circulant', header: true },
  { id: 'placements', label: 'التوظيفات والأصول المالية الجارية', scf_code: '50 (خارج 509)', amort_accounts: '59', group: 'actif_circulant' },
  {
    id: 'treasury',
    label: 'أموال الخزينة',
    scf_code: '519 وغيرها من المدينين، 51 و 52 و 53 و 54',
    group: 'actif_circulant',
    section: 'treasury',
    fill: 'treasury_debit',
  },
];

/** Statutory passif rows, in the order of the official form. */
const PASSIF_TEMPLATE: Template[] = [
  { id: 'equity_capital', label: 'رأس المال الصادر (أو حساب المستغل)', scf_code: '101 و 108', group: 'capitaux_propres', fill: 'equity_capital' },
  { id: 'uncalled', label: 'رأس المال غير المطلوب', scf_code: '109', group: 'capitaux_propres' },
  { id: 'premiums', label: 'العلاوات والاحتياطات', scf_code: '104 و 106', group: 'capitaux_propres' },
  { id: 'reval', label: 'فارق إعادة التقييم', scf_code: '105', group: 'capitaux_propres' },
  { id: 'equity_diff', label: 'فارق المعادلة', scf_code: '107', group: 'capitaux_propres' },
  { id: 'equity', label: 'النتيجة الصافية', scf_code: '12', group: 'capitaux_propres', section: 'overview', fill: 'equity_result' },
  { id: 'other_equity', label: 'رؤوس الأموال الخاصة الأخرى — ترحيل من جديد', scf_code: '11', group: 'capitaux_propres' },
  { id: 'consol_share', label: 'حصة الشركة المندمجة', scf_code: '—', group: 'capitaux_propres' },
  { id: 'minority', label: 'حصة ذوي الأقلية', scf_code: '—', group: 'capitaux_propres' },
  { id: 'borrowings', label: 'القروض والديون المالية', scf_code: '16 و 17', group: 'passif_non_courant' },
  { id: 'tax_deferred', label: 'الضرائب (المؤجلة والمرصود لها)', scf_code: '134 و 155', group: 'passif_non_courant' },
  { id: 'other_nc_debt', label: 'الديون الأخرى غير الجارية', scf_code: '229', group: 'passif_non_courant' },
  { id: 'provisions', label: 'المؤونات والمنتوجات المدرجة في الحسابات سلفا', scf_code: '131 و 132 (خارج 155)', group: 'passif_non_courant' },
  { id: 'suppliers', label: 'الموردون والحسابات الملحقة', scf_code: '40', group: 'passif_circulant', section: 'suppliers', fill: 'suppliers' },
  { id: 'tax_current', label: 'الضرائب', scf_code: '444 و 445 و 447', group: 'passif_circulant' },
  { id: 'payroll', label: 'الديون الأخرى', scf_code: '419 و 509 و 42 إلى 48', group: 'passif_circulant', section: 'payroll', fill: 'payroll' },
  { id: 'treasury_credit', label: 'خزينة الخصوم', scf_code: '519 دائن وغيرها، 52 و 53 و 54', group: 'passif_circulant', section: 'treasury', fill: 'treasury_credit' },
];

function lineFrom(tpl: Template, amount: number): ScfBilanLine {
  return {
    id: tpl.id,
    label: tpl.label,
    scf_code: tpl.scf_code,
    amort_accounts: tpl.amort_accounts,
    amount: tpl.header ? 0 : amount,
    section: tpl.section,
    group: tpl.group,
    header: tpl.header,
  };
}

export function buildScfBalanceSheet(input: {
  cash_total: number;
  bank_total: number;
  other_treasury_total?: number;
  receivables: number;
  fixed_assets_net: number;
  supplier_debt: number;
  payroll_pending: number;
  services_due: number;
  period_net?: number;
}): ScfBalanceSheet {
  const treasuryNet =
    (Number(input.cash_total) || 0) + (Number(input.bank_total) || 0) + (Number(input.other_treasury_total) || 0);
  const treasuryDebit = Math.max(0, treasuryNet);
  const treasuryCredit = Math.max(0, -treasuryNet);
  const fixed = Math.max(0, Number(input.fixed_assets_net) || 0);
  const receivables = Math.max(0, Number(input.receivables) || 0);
  const suppliers = Math.max(0, (Number(input.supplier_debt) || 0) + (Number(input.services_due) || 0));
  const payroll = Math.max(0, Number(input.payroll_pending) || 0);

  const assetAmounts: Partial<Record<FillId, number>> = {
    fixed,
    receivables,
    treasury_debit: treasuryDebit,
  };
  const actif = ACTIF_TEMPLATE.map((tpl) => lineFrom(tpl, tpl.fill ? assetAmounts[tpl.fill] || 0 : 0));
  const totalActif = actif.reduce((s, r) => s + (r.header ? 0 : r.amount), 0);
  const debtBeforeEquity = suppliers + payroll + treasuryCredit;
  const equityPlug = totalActif - debtBeforeEquity;
  const periodNet = input.period_net != null ? Number(input.period_net) || 0 : equityPlug;
  const capitalPlug = input.period_net != null ? equityPlug - periodNet : 0;

  const liabilityAmounts: Partial<Record<FillId, number>> = {
    suppliers,
    payroll,
    treasury_credit: treasuryCredit,
    equity_result: periodNet,
    equity_capital: capitalPlug,
  };
  const passif = PASSIF_TEMPLATE.map((tpl) => lineFrom(tpl, tpl.fill ? liabilityAmounts[tpl.fill] || 0 : 0));
  const totalPassif = passif.reduce((s, r) => s + (r.header ? 0 : r.amount), 0);

  const subtotals: Partial<Record<BilanGroupId, number>> = {};
  for (const g of Object.keys(BILAN_GROUP_LABELS) as BilanGroupId[]) {
    subtotals[g] = [...actif, ...passif]
      .filter((l) => l.group === g && !l.header)
      .reduce((s, l) => s + l.amount, 0);
  }

  return { actif, passif, total_actif: totalActif, total_passif: totalPassif, subtotals };
}
