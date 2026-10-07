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
  { value: 'SUPER_ADMIN', label: 'المشرف العام (Super Admin)' },
  { value: 'AGENCY_MANAGER', label: 'المشرف (Admin)' },
  { value: 'ACCOUNTANT', label: 'محاسب الوكالة' },
  { value: 'GUIDE_MURSHID', label: 'مرشد ديني' },
  { value: 'AGENCY_AGENT', label: 'موظف الوكالة' },
  { value: 'PILGRIM_USER', label: 'معتمر / حاج' },
];

export const HOTEL_CITY_OPTIONS: FieldOption[] = [
  { value: 'MAKKAH', label: 'مكة المكرمة' },
  { value: 'MADINAH', label: 'المدينة المنورة' },
];

export const HOTEL_SERVICE_OPTIONS = [
  'بوفيه مفتوح',
  'واي فاي سريع',
  'خدمة الغرف 24/7',
  'دخول مباشر للمصلى',
  'مصاعد سريعة',
  'تكييف مركزي',
  'شاشات مسطحة',
  'خدمة حافلات عند الحاجة',
  'مطعم إعاشة',
  'إرشاد خاص',
  'خدمات كبار السن',
  'مركز رجال الأعمال',
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

export const ALGERIA_69_WILAYAS: FieldOption[] = [
  { value: '01 - أدرار', label: '01 - أدرار' },
  { value: '02 - الشلف', label: '02 - الشلف' },
  { value: '03 - الأغواط', label: '03 - الأغواط' },
  { value: '04 - أم البواقي', label: '04 - أم البواقي' },
  { value: '05 - باتنة', label: '05 - باتنة' },
  { value: '06 - بجاية', label: '06 - بجاية' },
  { value: '07 - بسكرة', label: '07 - بسكرة' },
  { value: '08 - بشار', label: '08 - بشار' },
  { value: '09 - البليدة', label: '09 - البليدة' },
  { value: '10 - البويرة', label: '10 - البويرة' },
  { value: '11 - تمنراست', label: '11 - تمنراست' },
  { value: '12 - تبسة', label: '12 - تبسة' },
  { value: '13 - تلمسان', label: '13 - تلمسان' },
  { value: '14 - تيارت', label: '14 - تيارت' },
  { value: '15 - تيزي وزو', label: '15 - تيزي وزو' },
  { value: '16 - الجزائر العاصمة', label: '16 - الجزائر العاصمة' },
  { value: '17 - الجلفة', label: '17 - الجلفة' },
  { value: '18 - جيجل', label: '18 - جيجل' },
  { value: '19 - سطيف', label: '19 - سطيف' },
  { value: '20 - سعيدة', label: '20 - سعيدة' },
  { value: '21 - سكيكدة', label: '21 - سكيكدة' },
  { value: '22 - سيدي بلعباس', label: '22 - سيدي بلعباس' },
  { value: '23 - عنابة', label: '23 - عنابة' },
  { value: '24 - قالمة', label: '24 - قالمة' },
  { value: '25 - قسنطينة', label: '25 - قسنطينة' },
  { value: '26 - المدية', label: '26 - المدية' },
  { value: '27 - مستغانم', label: '27 - مستغانم' },
  { value: '28 - المسيلة', label: '28 - المسيلة' },
  { value: '29 - معسكر', label: '29 - معسكر' },
  { value: '30 - ورقلة', label: '30 - ورقلة' },
  { value: '31 - وهران', label: '31 - وهران' },
  { value: '32 - البيض', label: '32 - البيض' },
  { value: '33 - إليزي', label: '33 - إليزي' },
  { value: '34 - برج بوعريريج', label: '34 - برج بوعريريج' },
  { value: '35 - بومرداس', label: '35 - بومرداس' },
  { value: '36 - الطارف', label: '36 - الطارف' },
  { value: '37 - تندوف', label: '37 - تندوف' },
  { value: '38 - تسمسيلت', label: '38 - تسمسيلت' },
  { value: '39 - الوادي', label: '39 - الوادي' },
  { value: '40 - خنشلة', label: '40 - خنشلة' },
  { value: '41 - سوق أهراس', label: '41 - سوق أهراس' },
  { value: '42 - تيبازة', label: '42 - تيبازة' },
  { value: '43 - ميلة', label: '43 - ميلة' },
  { value: '44 - عين الدفلى', label: '44 - عين الدفلى' },
  { value: '45 - النعامة', label: '45 - النعامة' },
  { value: '46 - عين تموشنت', label: '46 - عين تموشنت' },
  { value: '47 - غرداية', label: '47 - غرداية' },
  { value: '48 - غليزان', label: '48 - غليزان' },
  { value: '49 - تيميمون', label: '49 - تيميمون' },
  { value: '50 - برج باجي مختار', label: '50 - برج باجي مختار' },
  { value: '51 - أولاد جلال', label: '51 - أولاد جلال' },
  { value: '52 - بني عباس', label: '52 - بني عباس' },
  { value: '53 - إن صالح', label: '53 - إن صالح' },
  { value: '54 - إن قزام', label: '54 - إن قزام' },
  { value: '55 - توقرت', label: '55 - توقرت' },
  { value: '56 - جانت', label: '56 - جانت' },
  { value: '57 - المغير', label: '57 - المغير' },
  { value: '58 - المنيعة', label: '58 - المنيعة' },
  { value: '59 - بوسعادة', label: '59 - بوسعادة' },
  { value: '60 - بريكة', label: '60 - بريكة' },
  { value: '61 - عين وسارة', label: '61 - عين وسارة' },
  { value: '62 - مسعد', label: '62 - مسعد' },
  { value: '63 - قصر الشلالة', label: '63 - قصر الشلالة' },
  { value: '64 - أفلو', label: '64 - أفلو' },
  { value: '65 - فرندة', label: '65 - فرندة' },
  { value: '66 - الأربعاء نايث إيراثن', label: '66 - الأربعاء نايث إيراثن' },
  { value: '67 - بئر العاتر', label: '67 - بئر العاتر' },
  { value: '68 - القنطرة', label: '68 - القنطرة' },
  { value: '69 - العريشة', label: '69 - العريشة' },
];

export const DEPARTURE_CITY_OPTIONS: FieldOption[] = ALGERIA_69_WILAYAS;

export const DEPARTURE_AIRPORT_OPTIONS: FieldOption[] = [
  { value: 'مطار هواري بومدين الدولي - الجزائر', label: 'هواري بومدين — الجزائر' },
  { value: 'مطار أحمد بن بلة - وهران', label: 'أحمد بن بلة — وهران' },
  { value: 'مطار محمد بوضياف - قسنطينة', label: 'محمد بوضياف — قسنطينة' },
  { value: 'مطار رابح بيطاط - عنابة', label: 'رابح بيطاط — عنابة' },
  { value: 'مطار 8 ماي 1945 - سطيف', label: '8 ماي 1945 — سطيف' },
  { value: 'مطار مصطفى بن بولعيد - باتنة', label: 'مصطفى بن بولعيد — باتنة' },
  { value: 'مطار سونلغاز - بجاية', label: 'بجاية' },
  { value: 'مطار زناتة - تلمسان', label: 'زناتة — تلمسان' },
  { value: 'مطار بسكرة', label: 'بسكرة' },
  { value: 'مطار عين البيضاء - ورقلة', label: 'عين البيضاء — ورقلة' },
  { value: 'مطار نومرات - غرداية', label: 'نومرات — غرداية' },
];

export const ARRIVAL_AIRPORT_OPTIONS: FieldOption[] = [
  { value: 'مطار الملك عبدالعزيز الدولي - جدة', label: 'الملك عبدالعزيز — جدة (JED)' },
  { value: 'مطار الأمير محمد بن عبدالعزيز - المدينة', label: 'الأمير محمد — المدينة (MED)' },
  { value: 'مطار الطائف الدولي', label: 'مطار الطائف الدولي' },
];

export const AIRLINE_OPTIONS: FieldOption[] = [
  { value: 'الخطوط الجوية الجزائرية', label: 'الخطوط الجوية الجزائرية (Air Algérie)' },
  { value: 'الخطوط السعودية', label: 'الخطوط السعودية (Saudia)' },
  { value: 'طيران ناس', label: 'طيران ناس (Flynas)' },
  { value: 'طيران أديل', label: 'طيران أديل (Flyadeal)' },
  { value: 'الخطوط الجوية التركية', label: 'الخطوط التركية (Turkish Airlines)' },
  { value: 'مصر للطيران', label: 'مصر للطيران (EgyptAir)' },
  { value: 'طيران الإمارات', label: 'طيران الإمارات (Emirates)' },
  { value: 'الخطوط الجوية القطرية', label: 'الخطوط القطرية (Qatar Airways)' },
  { value: 'الاتحاد للطيران', label: 'الاتحاد للطيران (Etihad Airways)' },
  { value: 'الملكية الأردنية', label: 'الملكية الأردنية (Royal Jordanian)' },
  { value: 'طيران الخليج', label: 'طيران الخليج (Gulf Air)' },
  { value: 'الخطوط التونسية', label: 'الخطوط التونسية (Tunisair)' },
  { value: 'الخطوط الملكية المغربية', label: 'الخطوط المغربية (RAM)' },
  { value: 'طيران الجزيرة', label: 'طيران الجزيرة (Jazeera Airways)' },
  { value: 'فلاي دبي', label: 'فلاي دبي (Flydubai)' },
  { value: 'تاسيلي للطيران', label: 'تاسيلي للطيران (Tassili Airlines)' },
];

export const MAKKAH_HOTEL_OPTIONS: FieldOption[] = [
  { value: 'فندق سويس أوتيل مكة (Swissôtel Makkah)', label: 'سويس أوتيل مكة برج الساعة (50م)' },
  { value: 'فندق منارات غزة مكة المكرمة', label: 'منارات غزة مكة (350م)' },
  { value: 'فندق فيرمونت برج الساعة مكة', label: 'فيرمونت برج الساعة مكة (مباشر)' },
  { value: 'فندق موفنبيك برج هاجر مكة', label: 'موفنبيك برج هاجر مكة (مباشر)' },
  { value: 'فندق قصر مكة رافلز', label: 'قصر مكة رافلز (مباشر)' },
  { value: 'فندق دار التوحيد إنتركونتيننتال مكة', label: 'دار التوحيد إنتركونتيننتال (مباشر)' },
  { value: 'فندق هيلتون مكة للمؤتمرات', label: 'هيلتون مكة للمؤتمرات (جبل عمر)' },
  { value: 'فندق أبراج الكسوة مكة', label: 'أبراج الكسوة مكة (900م)' },
  { value: 'فندق فلسطين مكة', label: 'فندق فلسطين مكة (800م)' },
];

export const MADINAH_HOTEL_OPTIONS: FieldOption[] = [
  { value: 'فندق بولمان زمزم المدينة المنورة', label: 'بولمان زمزم المدينة (خطوات)' },
  { value: 'فندق أنوار المدينة موفنبيك', label: 'أنوار المدينة موفنبيك (مباشر)' },
  { value: 'فندق دار التقوى المدينة', label: 'دار التقوى المدينة (مباشر)' },
  { value: 'فندق أوبروي المدينة المنورة', label: 'أوبروي المدينة (مباشر)' },
  { value: 'فندق شذا المدينة المنورة', label: 'شذا المدينة (150م)' },
  { value: 'فندق ميلينيوم العقيق المدينة', label: 'ميلينيوم العقيق المدينة (100م)' },
  { value: 'فندق روف المدينة المنورة', label: 'روف المدينة (خطوات)' },
  { value: 'فندق كراون بلازا المدينة', label: 'كراون بلازا المدينة (خطوات)' },
];

export const PACKAGE_TYPE_OPTIONS: FieldOption[] = [
  { value: 'ECONOMY', label: 'اقتصادي' },
  { value: 'STANDARD', label: 'عادي' },
  { value: 'PREMIUM', label: 'ممتاز' },
  { value: 'VIP', label: 'VIP' },
];

export const SEASON_NAME_OPTIONS: FieldOption[] = [
  { value: 'عمرة رمضان', label: 'عمرة رمضان' },
  { value: 'عمرة شوال', label: 'عمرة شوال' },
  { value: 'عمرة ذو القعدة', label: 'عمرة ذو القعدة' },
  { value: 'عمرة محرم', label: 'عمرة محرم' },
  { value: 'عمرة صفر', label: 'عمرة صفر' },
  { value: 'عمرة ربيع الأول', label: 'عمرة ربيع الأول' },
  { value: 'عمرة ربيع الثاني', label: 'عمرة ربيع الثاني' },
  { value: 'عمرة جمادى الأولى', label: 'عمرة جمادى الأولى' },
  { value: 'عمرة جمادى الثانية', label: 'عمرة جمادى الثانية' },
  { value: 'عمرة رجب', label: 'عمرة رجب' },
  { value: 'عمرة شعبان', label: 'عمرة شعبان' },
  { value: 'حج', label: 'حج' },
  { value: 'عمرة يناير', label: 'عمرة يناير' },
  { value: 'عمرة فبراير', label: 'عمرة فبراير' },
  { value: 'عمرة مارس', label: 'عمرة مارس' },
  { value: 'عمرة أبريل', label: 'عمرة أبريل' },
  { value: 'عمرة ماي', label: 'عمرة ماي' },
  { value: 'عمرة جوان', label: 'عمرة جوان' },
  { value: 'عمرة جويلية', label: 'عمرة جويلية' },
  { value: 'عمرة أوت', label: 'عمرة أوت' },
  { value: 'عمرة سبتمبر', label: 'عمرة سبتمبر' },
  { value: 'عمرة أكتوبر', label: 'عمرة أكتوبر' },
  { value: 'عمرة نوفمبر', label: 'عمرة نوفمبر' },
  { value: 'عمرة ديسمبر', label: 'عمرة ديسمبر' },
];

export const PACKAGE_STATUS_OPTIONS: FieldOption[] = [
  { value: 'PUBLISHED', label: 'منشور — ظاهر للمعتمرين' },
  { value: 'DRAFT', label: 'مسودة — مخفي عن الجمهور' },
  { value: 'SOLD_OUT', label: 'مكتمل — لا أماكن' },
  { value: 'CANCELLED', label: 'ملغي' },
];

export const PACKAGE_FEATURED_OPTIONS: FieldOption[] = [
  { value: '1', label: 'نعم — العرض الرئيسي في الصفحة الأولى' },
  { value: '0', label: 'لا' },
];

const MULTI_SELECT_FIELDS = new Set(['languages', 'supported_languages']);

export function isMultiSelectField(fieldName: string): boolean {
  return MULTI_SELECT_FIELDS.has(fieldName);
}

const LIST_TAG_FIELDS = new Set(['included_services', 'excluded_services', 'booking_conditions']);

export function isListTagField(fieldName: string): boolean {
  return LIST_TAG_FIELDS.has(fieldName);
}

export function isDateField(fieldName: string): boolean {
  const n = fieldName.toLowerCase();
  return (
    n.endsWith('_date') ||
    n.endsWith('date') ||
    n === 'date' ||
    n === 'start_date' ||
    n === 'end_date' ||
    n === 'departure_date' ||
    n === 'return_date' ||
    n === 'birth_date' ||
    n === 'expiry_date' ||
    n === 'issue_date'
  );
}

export function getFieldSelectOptions(fieldName: string, tableName?: string): FieldOption[] | null {
  if (fieldName === 'category') {
    if (tableName === 'hotels') return HOTEL_CATEGORY_OPTIONS;
    return MORSHID_CATEGORY_OPTIONS;
  }
  if (tableName === 'hotels' && fieldName === 'city') return HOTEL_CITY_OPTIONS;
  if (fieldName === 'role') return USER_ROLE_OPTIONS;
  if (fieldName === 'hotel_category') return HOTEL_CATEGORY_OPTIONS;
  if (isMultiSelectField(fieldName)) return LANGUAGE_OPTIONS;

  // Package-specific selects
  if (tableName === 'packages') {
    if (fieldName === 'departure_city') return DEPARTURE_CITY_OPTIONS;
    if (fieldName === 'departure_airport') return DEPARTURE_AIRPORT_OPTIONS;
    if (fieldName === 'arrival_airport') return ARRIVAL_AIRPORT_OPTIONS;
    if (fieldName === 'airline') return AIRLINE_OPTIONS;
    if (fieldName === 'makkah_hotel_name') return MAKKAH_HOTEL_OPTIONS;
    if (fieldName === 'madinah_hotel_name') return MADINAH_HOTEL_OPTIONS;
    if (fieldName === 'type') return PACKAGE_TYPE_OPTIONS;
    if (fieldName === 'season_name') return SEASON_NAME_OPTIONS;
    if (fieldName === 'status') return PACKAGE_STATUS_OPTIONS;
    if (fieldName === 'featured') return PACKAGE_FEATURED_OPTIONS;
  }

  return null;
}

export function formatSelectDisplay(fieldName: string, value: string, tableName?: string): string {
  const options = getFieldSelectOptions(fieldName, tableName);
  if (!options) return value;
  const match = options.find((o) => o.value === value || o.value.includes(value) || value.includes(o.value));
  return match?.label ?? value;
}
