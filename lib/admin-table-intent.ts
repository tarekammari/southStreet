/**
 * Detects admin intents like "أريد إضافة مرشد جديد" or "افتح جدول الفنادق"
 * so the chat can open the right table tool without a round-trip to the AI.
 */

export type AdminTableAction = 'insert' | 'edit' | 'view';

export interface TableRef {
  table: string;
  label: string;
}

export interface AdminTableIntent {
  action: AdminTableAction;
  table: string;
  label: string;
  alternatives: TableRef[];
}

export const TABLE_LABELS_AR: Record<string, string> = {
  packages: 'باقات العمرة والحج',
  hotels: 'الفنادق المعتمدة',
  morshids: 'المرشدين وطاقم العمل',
  users: 'المستخدمين والحسابات',
  ai_knowledge: 'قاعدة معرفة صخر AI',
  seasons: 'المواسم والرحلات',
  messages: 'رسائل الدردشة',
  receipts: 'سندات القبض',
  audit_logs: 'سجل تدقيق الأمان',
  agency_settings: 'إعدادات الوكالة',
  page_content: 'محتوى الصفحات',
};

const INSERT_TERMS = [
  'اضافة', 'إضافة', 'أضف', 'اضف', 'انشاء', 'إنشاء', 'أنشئ', 'انشئ', 'اضيف', 'أضيف',
  'تسجيل', 'سجل جديد', 'جديد', 'جديدة', 'add', 'new', 'create', 'insert',
];

const EDIT_TERMS = [
  'تعديل', 'عدل', 'عدّل', 'تحديث', 'حدث', 'حدّث', 'تغيير', 'غير', 'غيّر',
  'حذف', 'ازالة', 'إزالة', 'edit', 'update', 'modify', 'change', 'delete',
];

const VIEW_TERMS = [
  'عرض', 'اعرض', 'أعرض', 'اظهر', 'أظهر', 'شاهد', 'افتح', 'فتح', 'استعرض',
  'قائمة', 'جدول', 'بيانات', 'كل', 'جميع', 'show', 'open', 'list', 'view', 'display',
];

/** Staff role words: primarily the staff table, but may mean an account */
const ROLE_TERMS = [
  'مدير', 'مديرة', 'المدير', 'محاسب', 'محاسبة', 'المحاسب', 'مسؤول', 'مسير',
  'director', 'manager', 'accountant',
];

export const TABLE_TERMS: Record<string, string[]> = {
  morshids: [
    'مرشد', 'مرشدين', 'المرشدين', 'مرشدة', 'مرشدات', 'طاقم', 'الطاقم', 'موظف', 'موظفين',
    'عامل', 'عاملين', 'دليل', 'مشرف', 'مضيف', 'سائق', 'منسق', 'منسقة', 'شيخ', 'امام', 'إمام',
    'morshed', 'morshid', 'murshid', 'guide', 'staff', 'employee',
  ],
  users: [
    'مستخدم', 'مستخدمين', 'المستخدمين', 'حساب', 'حسابات', 'الحسابات', 'كلمة المرور',
    'كلمة السر', 'صلاحية', 'صلاحيات', 'دخول', 'user', 'users', 'account', 'login',
  ],
  packages: [
    'باقة', 'باقات', 'الباقات', 'عروض', 'العروض', 'برنامج', 'برامج', 'رحلة', 'رحلات',
    'package', 'packages', 'offer', 'trip',
  ],
  hotels: ['فندق', 'فنادق', 'الفنادق', 'اقامة', 'إقامة', 'سكن', 'hotel', 'hotels'],
  seasons: ['موسم', 'مواسم', 'المواسم', 'season', 'seasons'],
  ai_knowledge: [
    'معرفة', 'المعرفة', 'صيغة', 'صيغ', 'تدريب', 'قاعدة معرفة', 'اسئلة', 'أسئلة',
    'knowledge', 'faq',
  ],
  receipts: ['سند', 'سندات', 'وصل', 'وصولات', 'قبض', 'دفع', 'مدفوعات', 'receipt', 'receipts', 'payment'],
  messages: ['رسالة', 'رسائل', 'الرسائل', 'محادثة', 'محادثات', 'message', 'messages', 'chat'],
  audit_logs: ['تدقيق', 'سجل الامان', 'سجل الأمان', 'سجلات', 'audit', 'logs', 'log'],
  agency_settings: ['اعدادات', 'إعدادات', 'الوكالة', 'settings', 'agency'],
  page_content: ['محتوى', 'المحتوى', 'صفحة', 'صفحات', 'content', 'page', 'contenu'],
};

export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const normalize = normalizeArabic;

function containsAny(haystack: string, terms: string[]): boolean {
  return terms.some((t) => haystack.includes(normalize(t)));
}

function toRef(table: string): TableRef {
  return { table, label: TABLE_LABELS_AR[table] || table };
}

export function detectAdminTableIntent(text: string): AdminTableIntent | null {
  const q = normalize(text);
  if (!q) return null;

  let action: AdminTableAction | null = null;
  if (containsAny(q, INSERT_TERMS)) action = 'insert';
  else if (containsAny(q, EDIT_TERMS)) action = 'edit';
  else if (containsAny(q, VIEW_TERMS)) action = 'view';

  if (!action) return null;

  const matches = Object.entries(TABLE_TERMS)
    .map(([table, terms]) => ({
      table,
      score: terms.reduce((acc, t) => (q.includes(normalize(t)) ? acc + normalize(t).length : acc), 0),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  const hasRoleWord = containsAny(q, ROLE_TERMS);

  if (matches.length === 0) {
    if (!hasRoleWord) return null;
    // "أضف محاسب جديد" — staff table first, accounts as the alternative
    return { action, table: 'morshids', label: TABLE_LABELS_AR.morshids, alternatives: [toRef('users')] };
  }

  const best = matches[0].table;
  const alternatives: TableRef[] = matches.slice(1, 3).map((m) => toRef(m.table));

  if (hasRoleWord && best !== 'users' && !alternatives.some((a) => a.table === 'users')) {
    alternatives.push(toRef('users'));
  }
  if (hasRoleWord && best === 'users' && !alternatives.some((a) => a.table === 'morshids')) {
    alternatives.push(toRef('morshids'));
  }

  return { action, table: best, label: TABLE_LABELS_AR[best] || best, alternatives };
}

export function describeIntent(intent: AdminTableIntent): string {
  if (intent.action === 'insert') {
    return `تم فتح نموذج **إضافة جديد** إلى جدول **${intent.label}**. املأ الحقول ثم اضغط "إضافة جديد".`;
  }
  if (intent.action === 'edit') {
    return `تم فتح جدول **${intent.label}** كبطاقات. انقر على البطاقة التي تريد مراجعتها أو تعديل بياناتها، ويمكنك إضافة جديد من الزر بالأعلى.`;
  }
  return `تم فتح جدول **${intent.label}**. البيانات معروضة كبطاقات — انقر أي بطاقة لعرض كل التفاصيل والصور.`;
}
