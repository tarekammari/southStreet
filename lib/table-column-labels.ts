/** Arabic labels for SQLite column names across admin tables */
export const COLUMN_LABELS_AR: Record<string, string> = {
  // Common
  id: 'المعرّف',
  name: 'الاسم',
  status: 'الحالة',
  description: 'الوصف',
  category: 'التصنيف',
  phone: 'الهاتف',
  email: 'البريد الإلكتروني',
  avatar: 'الحرف/الرمز',
  image: 'الصورة',
  image_url: 'رابط الصورة',
  images: 'الصور',
  videos: 'الفيديوهات',
  logo: 'الشعار',
  rating: 'التقييم (من النجوم)',
  review_count: 'عدد التقييمات',
  type: 'النوع',
  createdAt: 'تاريخ الإنشاء',
  updatedAt: 'آخر تحديث',

  // Morshids
  morshid_id: 'معرّف المرشد',
  roleName: 'المسمى الوظيفي',
  specialization: 'التخصص',
  experience_years: 'سنوات الخبرة',
  languages: 'اللغات',

  // Packages
  package_id: 'معرّف الباقة',
  season_id: 'معرّف الموسم',
  season_name: 'اسم الموسم',
  start_date: 'تاريخ البداية',
  end_date: 'تاريخ النهاية',
  duration_days: 'المدة (أيام)',
  departure_city: 'مدينة المغادرة',
  departure_airport: 'مطار المغادرة',
  arrival_airport: 'مطار الوصول',
  airline: 'شركة الطيران',
  makkah_hotel_id: 'فندق مكة',
  makkah_hotel_name: 'اسم فندق مكة',
  makkah_hotel_dist: 'بعد فندق مكة عن الحرم',
  madinah_hotel_id: 'فندق المدينة',
  madinah_hotel_name: 'اسم فندق المدينة',
  madinah_hotel_dist: 'بعد فندق المدينة عن الحرم',
  hotel_category: 'تصنيف الفندق',
  morshid_name: 'اسم المرشد',
  included_services: 'الخدمات المشمولة',
  excluded_services: 'الخدمات غير المشمولة',
  booking_conditions: 'شروط الحجز',
  cancellation_policy: 'سياسة الإلغاء',
  capacity: 'السعة',
  reserved: 'المحجوز',
  available: 'المتاح',
  published: 'منشور',

  // Hotels
  hotel_id: 'معرّف الفندق',
  city: 'المدينة',
  address: 'العنوان',
  latitude: 'خط العرض',
  longitude: 'خط الطول',
  distance_from_haram: 'المسافة عن الحرم',
  services: 'الخدمات',

  // Users
  code: 'رمز الدخول',
  username: 'اسم المستخدم',
  passwordHash: 'كلمة المرور (مشفّرة)',
  qrSecretHash: 'سر رمز QR (مشفّر)',
  staffId: 'ربط بالموظف',
  loginEnabled: 'الدخول مفعّل',
  role: 'الدور',
  room: 'الغرفة',
  requiresFileKey: 'يتطلب مفتاح ملف',

  // AI knowledge
  title_ar: 'العنوان',
  keywords: 'الكلمات المفتاحية',
  response_ar: 'نص الإجابة',
  is_active: 'نشط',
  answerMode: 'نمط الإجابة',
  matchStrategy: 'استراتيجية المطابقة',
  updatedBy: 'آخر تعديل بواسطة',

  // Messages
  chatId: 'معرّف المحادثة',
  senderId: 'مرسل',
  senderName: 'اسم المرسل',
  senderRole: 'دور المرسل',
  text: 'النص',
  time: 'الوقت',
  isUrgent: 'عاجل',

  // Receipts
  pilgrimName: 'اسم المعتمر',
  pilgrimCode: 'رمز المعتمر',
  packageName: 'اسم الباقة',
  totalAmount: 'المبلغ الإجمالي',
  paidAmount: 'المبلغ المدفوع',
  remainingAmount: 'المتبقي',
  paymentMethod: 'طريقة الدفع',
  date: 'التاريخ',
  accountantName: 'المحاسب',

  // Audit
  timestamp: 'الوقت',
  actorName: 'المستخدم',
  actorRole: 'الدور',
  action: 'الإجراء',
  details: 'التفاصيل',
  ip: 'عنوان IP',

  // Agency
  agency_name: 'اسم الوكالة',
  legal_name: 'الاسم القانوني',
  whatsapp: 'واتساب',
  website: 'الموقع',
  opening_hours: 'ساعات العمل',
  emergency_phone: 'هاتف الطوارئ',
  supported_languages: 'اللغات المدعومة',
  default_currency: 'العملة',
  timezone: 'المنطقة الزمنية',

  reviews: 'التقييمات',
  stars: 'النجوم',
  reviewer_name: 'اسم المقيّم',
  target_name: 'الجهة',
  body: 'نص التقييم',
  featured: 'مميّز',
  admin_reply: 'رد الإدارة',
  content_key: 'مفتاح المحتوى',
  content_ar: 'المحتوى',
  content_fr: 'المحتوى بالفرنسية',
  content_en: 'المحتوى بالإنجليزية',
  title_fr: 'العنوان بالفرنسية',
  title_en: 'العنوان بالإنجليزية',
  section: 'القسم',
};

export function getColumnLabelAr(columnName: string): string {
  return COLUMN_LABELS_AR[columnName] || columnName.replace(/_/g, ' ');
}

export const TYPE_LABELS_AR: Record<string, string> = {
  TEXT: 'نص',
  INTEGER: 'عدد صحيح',
  REAL: 'عدد عشري',
  BLOB: 'ملف',
  BOOLEAN: 'نعم/لا',
};

export function getTypeLabelAr(type: string): string {
  const upper = (type || 'TEXT').toUpperCase();
  return TYPE_LABELS_AR[upper] || type;
}
