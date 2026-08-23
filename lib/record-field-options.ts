/** Select / multi-select options for record detail card edit fields. */

export interface FieldOption {
  value: string;
  label: string;
}

export const MORSHID_CATEGORY_OPTIONS: FieldOption[] = [
  { value: 'staff', label: 'إدارة وطاقم' },
  { value: 'religious_guide', label: 'مرشد ديني (رجال)' },
  { value: 'women_guide', label: 'مرشدة نسائية (أخوات)' },
  { value: 'field_guide', label: 'مرشد ميداني' },
  { value: 'accountant', label: 'محاسب الوكالة' },
];

export const STAFF_VIEW_GROUPS = [
  { id: 'admin', label: 'الإدارة والطاقم', hint: 'ملفات المديرين وموظفي الوكالة' },
  { id: 'guides', label: 'المرشدون والمرشدات', hint: 'ملفات الإرشاد الديني والميداني' },
  { id: 'accountant', label: 'المحاسبة', hint: 'ملفات المحاسبين في الطاقم' },
  { id: 'blocked', label: 'موقوف أو مرفوض', hint: 'أعضاء أوقفتهم أو رفضتهم الإدارة' },
] as const;

export const ACCOUNT_VIEW_GROUPS = [
  { id: 'pilgrims', label: 'حسابات المعتمرين', hint: 'دخول ضيوف الرحمن وطلبات انضمامهم' },
  { id: 'blocked', label: 'موقوف أو مرفوض', hint: 'حسابات أوقفتها أو رفضتها الإدارة' },
] as const;

export type StaffViewGroupId = (typeof STAFF_VIEW_GROUPS)[number]['id'];
export type AccountViewGroupId = (typeof ACCOUNT_VIEW_GROUPS)[number]['id'];

const GUIDE_CATEGORIES = new Set(['religious_guide', 'women_guide', 'field_guide']);

export function isPendingStatus(status: unknown): boolean {
  const s = String(status || '').toUpperCase().replace(/\s+/g, '_');
  return s === 'PENDING_APPROVAL' || s === 'PENDING' || String(status || '').includes('انتظار');
}

export function isBlockedStatus(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  const raw = String(status || '');
  return (
    s === 'REJECTED' ||
    s === 'SUSPENDED' ||
    s === 'BLOCKED' ||
    s === 'INACTIVE' ||
    raw.includes('موقوف') ||
    raw.includes('مرفوض') ||
    raw.includes('معطل')
  );
}

/** Staff profile albums — job in the agency, not a login account. */
export function staffViewGroup(row: Record<string, unknown>): StaffViewGroupId {
  if (isBlockedStatus(row.status)) return 'blocked';

  const category = String(row.category || '');
  const roleName = String(row.roleName || '');

  if (category === 'accountant' || roleName.includes('محاسب')) return 'accountant';
  if (GUIDE_CATEGORIES.has(category)) return 'guides';
  if (category === 'staff') return 'admin';
  if (roleName.includes('مرشد') || roleName.includes('مرشدة') || roleName.includes('شيخ')) return 'guides';
  return 'admin';
}

/** Login-account albums — pilgrims only. Staff logins belong in the team table. */
export function accountViewGroup(row: Record<string, unknown>): AccountViewGroupId | null {
  if (isBlockedStatus(row.status)) return 'blocked';

  const role = String(row.role || '').toUpperCase();
  const roleName = String(row.roleName || '');
  const isPilgrim =
    isPendingStatus(row.status) ||
    role === 'PILGRIM_USER' ||
    role === 'PILGRIM' ||
    role === 'USER' ||
    role === '' ||
    roleName.includes('معتمر') ||
    roleName.includes('حاج');

  return isPilgrim ? 'pilgrims' : null;
}

export const USER_ROLE_OPTIONS: FieldOption[] = [
  { value: 'SUPER_ADMIN', label: 'مدير النظام العام' },
  { value: 'AGENCY_MANAGER', label: 'مدير الوكالة' },
  { value: 'ACCOUNTANT', label: 'محاسب الوكالة' },
  { value: 'GUIDE_MURSHID', label: 'مرشد ديني' },
  { value: 'AGENCY_AGENT', label: 'موظف الوكالة' },
  { value: 'PILGRIM_USER', label: 'معتمر / حاج' },
];

export const HOTEL_CATEGORY_OPTIONS: FieldOption[] = [
  { value: 'VIP', label: 'VIP' },
  { value: '5_STAR', label: '5 نجوم' },
  { value: '4_STAR', label: '4 نجوم' },
  { value: '3_STAR', label: '3 نجوم' },
  { value: 'ECONOMY', label: 'اقتصادي' },
];

export const LANGUAGE_OPTIONS: FieldOption[] = [
  { value: 'العربية', label: 'العربية' },
  { value: 'الفرنسية', label: 'الفرنسية' },
  { value: 'الإنجليزية', label: 'الإنجليزية' },
  { value: 'الأمازيغية', label: 'الأمازيغية' },
  { value: 'التركية', label: 'التركية' },
  { value: 'الأردية', label: 'الأردية' },
  { value: 'الماليزية', label: 'الماليزية' },
];

const MULTI_SELECT_FIELDS = new Set(['languages', 'supported_languages']);

export function isMultiSelectField(fieldName: string): boolean {
  return MULTI_SELECT_FIELDS.has(fieldName);
}

export function getFieldSelectOptions(fieldName: string, tableName?: string): FieldOption[] | null {
  if (fieldName === 'category') {
    if (tableName === 'hotels') return HOTEL_CATEGORY_OPTIONS;
    return MORSHID_CATEGORY_OPTIONS;
  }
  if (fieldName === 'role') return USER_ROLE_OPTIONS;
  if (fieldName === 'hotel_category') return HOTEL_CATEGORY_OPTIONS;
  if (isMultiSelectField(fieldName)) return LANGUAGE_OPTIONS;
  return null;
}

export function formatSelectDisplay(fieldName: string, value: string, tableName?: string): string {
  const options = getFieldSelectOptions(fieldName, tableName);
  if (!options) return value;
  return options.find((o) => o.value === value)?.label ?? value;
}
