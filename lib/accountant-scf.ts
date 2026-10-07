/**
 * SCF Algérie (JORADP 2009) — règles applicatives pour le tableau de bord comptable.
 * Source: docs/accountant_principales/SCF_Algerie_JORADP_2009_App_Rules.{md,json}
 */
import scfRules from '@/docs/accountant_principales/SCF_Algerie_JORADP_2009_App_Rules.json';

export const SCF_METADATA = scfRules.metadata;
export const SCF_VALIDATION = scfRules.validation_policy;
export const SCF_ACCOUNT_CLASSES = scfRules.account_classes as Record<string, string>;
export const SCF_FINANCIAL_STATEMENTS = scfRules.financial_statements as string[];

export const SCF_LEGAL_NOTICE_AR =
  'القوائم مستندة إلى النظام المحاسبي المالي (SCF) — الجريدة الرسمية رقم 19 (25 مارس 2009). راجع النصوص المعدّلة قبل أي استخدام قانوني.';

export const SCF_SOURCE_URL = SCF_METADATA.official_url;

export const SCF_CLASS_LABELS_AR: Record<string, string> = {
  '1': 'الفئة 1 — حسابات رأس المال',
  '2': 'الفئة 2 — الموجودات الثابتة',
  '3': 'الفئة 3 — المخزونات والإنتاجات الجارية',
  '4': 'الفئة 4 — حسابات الأطراف',
  '5': 'الفئة 5 — الحسابات المالية (خزينة)',
  '6': 'الفئة 6 — المصاريف',
  '7': 'الفئة 7 — الإيرادات',
};

export const SCF_MODULE_ACCOUNTS = {
  receipts: { class: '7', hint: '701/706 — إيرادات النشاط (عقود العملاء)' },
  treasury: { class: '5', hint: '53/512 — صندوق وحسابات بنكية' },
  receivables: { class: '4', hint: '411 — زبائن وذمم مدينة' },
  suppliers: { class: '4', hint: '401 — موردون وذمم دائنة' },
  payroll: { class: '4', hint: '421/425 — أجور ومستحقات الموظفين' },
  services: { class: '6', hint: '62/613 — خدمات خارجية' },
  assets: { class: '2', hint: '21/28 — موجودات ثابتة وإهلاك' },
  equity: { class: '1', hint: '10/12 — رأس المال والنتيجة' },
} as const;

export const SCF_PNL = {
  statementTitle: 'حساب النتائج',
  statementSubtitle: 'SCF — حسب الطبيعة · الجريدة الرسمية 19 (25 مارس 2009)',
  revenueHeading: 'الإيرادات (الفئة 7)',
  revenueStandard: 'إثبات الإيراد حسب الفترة والجوهر الاقتصادي للعقد — مبدأ الحذر (SCF)',
  revenueDetail: 'تفصيل حسب البرنامج — نفس منطق صفحة المداخيل (عقد واحد لكل عميل وبرنامج)',
  revenueTotal: 'إجمالي المفوتر (المداخيل)',
  expenseHeading: 'مصاريف التشغيل (الفئة 6)',
  expenseStandard:
    'تفصيل SCF (6) — موردون حسب حساب 604/616/626/625 ثم كل مورد؛ أجور 631؛ خدمات دورية 613/626؛ إهلاك 681. الدفع في الخزينة منفصل.',
  expenseTotal: 'إجمالي مصاريف التشغيل',
  profitHeading: 'صافي نتيجة السنة المالية',
  profitStandard: 'SCF — نتيجة التمرين (إيرادات − مصاريف الفترة)',
  footnote: 'بنود حساب النتائج الرسمي. المبالغ تُرحَّل إلى الحساب المقابل (70 مبيعات، 60 مشتريات، 61/62 خدمات، 63 أجور، 68 اهتلاكات). بقية البنود صفر إلى حين قيدها.',
} as const;

export const SCF_BALANCE = {
  title: 'الميزانية',
  subtitle: 'SCF — الجريدة الرسمية 19 (25 مارس 2009) · نفس بنود وحسابات النموذج الرسمي',
  assetsHeading: 'الأصول',
  assetsStandard: 'الأصول المثبتة (غير الجارية) ثم الأصول الجارية — أرقام الحسابات كما في النموذج',
  liabilitiesHeading: 'الخصوم',
  liabilitiesStandard: 'رؤوس الأموال الخاصة ثم الخصوم غير الجارية ثم الخصوم الجارية',
  totalAssets: 'المجموع العام للأصول',
  totalLiabilities: 'المجموع العام للخصوم',
  footnote: 'SCF — بنود الميزانية الرسمية. المبالغ المعروضة تُرحَّل إلى الحساب المقابل؛ بقية البنود صفر إلى حين قيدها.',
  imbalanceHint: 'عدم توازن — راجع الذمم والخزينة قبل الإقفال',
} as const;

export const SCF_BALANCE_ACTIF_NOTES: Record<string, string> = {
  treasury: SCF_MODULE_ACCOUNTS.treasury.hint,
  treasury_cash: '53 — الصندوق',
  treasury_bank: '512 — حسابات بنكية',
  receivables: '411 — المستحق على العملاء (كما في المداخيل · عقود الإيصالات بالفترة)',
  fixed_assets: SCF_MODULE_ACCOUNTS.assets.hint,
};

export const SCF_BALANCE_PASSIF_NOTES: Record<string, string> = {
  suppliers: SCF_MODULE_ACCOUNTS.suppliers.hint,
  payroll: SCF_MODULE_ACCOUNTS.payroll.hint,
  services: SCF_MODULE_ACCOUNTS.services.hint,
  equity: SCF_MODULE_ACCOUNTS.equity.hint,
};

export const SCF_ETATS_FINANCIERS = {
  bundleTitle: 'الكشوف المالية — SCF',
  bundleNote:
    'حساب النتيجة (مصاريف حسب الطبيعة · 6/7) · الميزانية (مركز مالي) · الخزينة (5 — تدفقات). المصروف يُثبت بالاستحقاق/الفوترة؛ الدفع يظهر كـ «خارج» من الخزينة فقط.',
  fluxTitle: 'تدفقات الخزينة بالفترة',
  fluxSubtitle: 'SCF — مدفوعات وتحصيلات فعلية فقط (خزينة · بدون قيود استحقاق)',
} as const;

export const SCF_TREASURY = {
  title: 'الخزينة',
  subtitle: 'SCF — الفئة 5 (53/512) · أرصدة وتدفقات نقدية',
  movementStandard:
    'افتتاح + داخل − خارج = ختام — الدفعات (موردون، أجور، خدمات) = خارج من الخزينة',
  colAccount: 'الحساب',
  colKind: 'النوع',
  colOpening: 'افتتاح',
  colIn: 'داخل',
  colOut: 'خارج',
  colClosing: 'ختام',
  total: 'الإجمالي',
  manage: 'إدارة الخزينة',
  footnote: 'قبل الإقفال: مطابقة الصندوق والبنك مع الواقع وكشوف البنك (SCF — ضوابط نهاية التمرين)',
} as const;

export const SCF_EXPENSE_LINE_NOTES: Record<string, string> = {
  suppliers: '604 — مجموع فواتير الموردين بالفترة (تاريخ الفاتورة) · الدفع منفصل (401/512)',
  payroll: '421/425 — أجور مستحقة (مزايا الموظفين)',
  services: '613/626 — مجموع المستحقات بالفترة (كل استحقاق = مبلغ في النتيجة حتى دونه) · الدفع منفصل',
  assets: '21/28 — استهلاك الموجودات الثابتة',
};

export const SCF_CLOSING_CONTROLS: { id: string; label: string; section?: string }[] = [
  { id: 'cash', label: 'الصندوق: مطابقة الرصيد المحاسبي مع الموجود الفعلي', section: 'treasury' },
  { id: 'bank', label: 'البنك: مطابقة الحسابات مع كشوف البنك', section: 'treasury' },
  { id: 'clients', label: 'العملاء: فواتير، تحصيل، ذمم قديمة، هبوط قيمة', section: 'receipts' },
  { id: 'suppliers', label: 'الموردون: فواتير، دفعات، أرصدة، فواتير غير مسجلة', section: 'suppliers' },
  { id: 'assets', label: 'الموجودات الثابتة: إهلاك، صيانة، قيمة دفترية', section: 'assets' },
  { id: 'payroll', label: 'الأجور: مستحقات الفترة وربطها بالنتيجة', section: 'payroll' },
  { id: 'period', label: 'ربط المصاريف والإيرادات بالفترة المعروضة', section: 'overview' },
];

export const SCF_REPORTS_INTRO_AR =
  'التقارير تغذّي حساب النتيجة والميزانية وفق SCF — الأرقام محسوبة من المصدر (اليومية، المداخيل، الوحدات) وليست تقديراً.';

export const SCF_PRINCIPLES_AR: string[] = [
  'صورة أمينة للوضعية المالية',
  'عدم اختراع قيد عند نقص معلومات أساسية',
  'ثبات طرق المحاسبة وإظهار أي تغيير',
  'ربط المصاريف والإيرادات بالفترة',
  'الجوهر الاقتصادي للعملية وليس شكلها فقط',
  'وثيقة داعمة وأثر تدقيق لأي تعديل',
];
