import fs from 'fs';
import path from 'path';
import { hashPassword, encryptData, decryptData } from './security';
import {
  User, Message, Receipt, AuditLog, UserRole,
  AgencySettings, Season, Hotel, Flight, Morshid, Package, Reservation,
  CustomerDocument, MediaAsset, AiConversationLog, TravelerInfo
} from '@/types';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'AGENCY_MANAGER' | 'AGENCY_AGENT' | 'PILGRIM_USER';
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  lastLoginIp?: string;
  pcFingerprint?: string;
  requiresFileKey?: boolean;
}

export interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ip: string;
  pcPrint: string;
  userAgent: string;
  loginTime: string;
  lastActive: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ip: string;
  pcPrint: string;
  userAgent: string;
  requestTime: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export interface AiKnowledgeRule {
  id: string;
  category: 'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq';
  title_ar: string;
  keywords: string[];
  response_ar: string;
  is_active: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  securityKey: string;
  users: UserAccount[];
  sessions: ActiveSession[];
  accessRequests: AccessRequest[];
  aiKnowledge: AiKnowledgeRule[];
  appUsers?: User[];
  messages?: Message[];
  receipts?: Receipt[];
  auditLogs?: AuditLog[];
  agencySettings?: AgencySettings;
  seasons?: Season[];
  hotels?: Hotel[];
  flights?: Flight[];
  morshids?: Morshid[];
  packages?: Package[];
  reservations?: Reservation[];
  documents?: CustomerDocument[];
  mediaAssets?: MediaAsset[];
  aiConversations?: AiConversationLog[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'secure_db.json.enc');

const DEFAULT_SECURITY_KEY = 'SOUTHSTREET-KEY-v1-9F8E7D6C5B4A3928';

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_super_admin',
    name: 'طارق العماري (المدير العام)',
    email: 'admin@southstreet.dz',
    passwordHash: hashPassword('Admin@2026!'),
    role: 'SUPER_ADMIN',
    status: 'APPROVED',
    createdAt: '2026-08-01T10:00:00Z',
    requiresFileKey: true
  },
  {
    id: 'usr_manager',
    name: 'أحمد محمود (مدير البرامج)',
    email: 'manager@southstreet.dz',
    passwordHash: hashPassword('Manager@2026!'),
    role: 'AGENCY_MANAGER',
    status: 'APPROVED',
    createdAt: '2026-08-05T12:00:00Z',
    requiresFileKey: true
  },
  {
    id: 'usr_agent',
    name: 'سارة خالد (خدمة العملاء)',
    email: 'agent@southstreet.dz',
    passwordHash: hashPassword('Agent@2026!'),
    role: 'AGENCY_AGENT',
    status: 'APPROVED',
    createdAt: '2026-08-08T09:30:00Z',
    requiresFileKey: false
  },
  {
    id: 'usr_pilgrim_user',
    name: 'عمر بن علي (معتمر معتمد)',
    email: 'user@southstreet.dz',
    passwordHash: hashPassword('User@2026!'),
    role: 'PILGRIM_USER',
    status: 'APPROVED',
    createdAt: '2026-08-10T14:15:00Z',
    requiresFileKey: false
  },
  {
    id: 'usr_pending_user',
    name: 'يوسف الجزائري (ينتظر الموافقة)',
    email: 'pending@southstreet.dz',
    passwordHash: hashPassword('Pending@2026!'),
    role: 'PILGRIM_USER',
    status: 'PENDING_APPROVAL',
    createdAt: '2026-08-13T08:00:00Z',
    requiresFileKey: false
  }
];

const DEFAULT_AI_KNOWLEDGE: AiKnowledgeRule[] = [
  {
    id: 'rule_august_package',
    category: 'packages',
    title_ar: 'باقة أوت الاقتصادية المميزة',
    keywords: ['أوت', 'اقتصادية', '215000', '215,000'],
    response_ar: '🕋 **باقة أوت المميزة (215,000 دج):**\n• طيران مباشر بدون توقف من العاصمة، وهران، وعنابة.\n• إقامة فاخرة بفندق منارات غزة (350م فقط عن صحن الحرم المكي).',
    is_active: true,
    updatedBy: 'admin@southstreet.dz',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_mawlid_package',
    category: 'packages',
    title_ar: 'باقة المولد النبوي VIP',
    keywords: ['المولد', 'vip', '295000', '295,000', 'سويس أوتيل'],
    response_ar: '🌟 **باقة المولد النبوي VIP (295,000 دج):**\n• إقامة VIP بفندق سويس أوتيل برج الساعة (50م فقط عن صحن الحرم).\n• إعاشة بوفيه مفتوح وتأطير ديني خاص.',
    is_active: true,
    updatedBy: 'admin@southstreet.dz',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_passport_docs',
    category: 'requirements',
    title_ar: 'شروط والوثائق المطلوبة للتسجيل',
    keywords: ['شروط', 'وثائق', 'جواز', 'ملف', 'أوراق', 'تلقيح'],
    response_ar: '📋 **شروط وأوراق التقديم للعمرة:**\n1. جواز سفر بيومتري صالح 6 أشهر.\n2. عدد 2 صور شمسية خلفية بيضاء.\n3. دفتر العائلة أو شهادة الميلاد.\n4. دفتر التلقيح المعتمد.\n5. دفع عربون الحجز 30%.',
    is_active: true,
    updatedBy: 'manager@southstreet.dz',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_umrah_steps',
    category: 'rituals',
    title_ar: 'مناسك العمرة الأربعة',
    keywords: ['مناسك', 'خطوات', 'طواف', 'سعي', 'إحرام'],
    response_ar: '🕋 **مناسك العمرة بالتفصيل:**\n1. **الإحرام** من الميقات.\n2. **الطواف** حول الكعبة 7 أشواط.\n3. **السعي** بين الصفا والمروة 7 أشواط.\n4. **الحلق أو التقصير** للتحلل.\n💡 توفر الوكالة مرشدين ومرشدات مرافقتك خطوة بخطوة.',
    is_active: true,
    updatedBy: 'admin@southstreet.dz',
    updatedAt: new Date().toISOString()
  }
];

export function getDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialDb: DatabaseSchema = {
        securityKey: DEFAULT_SECURITY_KEY,
        users: DEFAULT_USERS,
        sessions: [],
        accessRequests: [
          {
            id: 'req_pending_1',
            userId: 'usr_pending_user',
            userName: 'يوسف الجزائري (ينتظر الموافقة)',
            userEmail: 'pending@southstreet.dz',
            userRole: 'PILGRIM_USER',
            ip: '105.101.42.18',
            pcPrint: 'FP-4B9C-1E8F',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127.0',
            requestTime: new Date().toISOString(),
            status: 'PENDING_APPROVAL'
          }
        ],
        aiKnowledge: DEFAULT_AI_KNOWLEDGE
      };
      saveDatabase(initialDb);
      return initialDb;
    }

    const encryptedData = fs.readFileSync(DB_FILE, 'utf8');
    const decryptedJson = decryptData(encryptedData);
    const db = JSON.parse(decryptedJson) as DatabaseSchema;
    if (!db.securityKey || db.securityKey.includes('2026-X7Y9Z')) {
      db.securityKey = DEFAULT_SECURITY_KEY;
      saveDatabase(db);
    }
    return db;
  } catch (e) {
    const fallbackDb: DatabaseSchema = {
      securityKey: DEFAULT_SECURITY_KEY,
      users: DEFAULT_USERS,
      sessions: [],
      accessRequests: [],
      aiKnowledge: DEFAULT_AI_KNOWLEDGE
    };
    return fallbackDb;
  }
}

export function saveDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(db, null, 2);
    const encryptedStr = encryptData(jsonStr);
    fs.writeFileSync(DB_FILE, encryptedStr, 'utf8');
  } catch (e) {
    console.error('Failed to save encrypted DB:', e);
  }
}

// ─────────────────────────────────────────────
// PORTAL & APP DB HELPERS
// ─────────────────────────────────────────────

const DEFAULT_APP_USERS: User[] = [
  { id: 'USR-001', code: 'ADMIN-2026', name: 'د. عبد الرحمن العتيبي', role: 'admin', roleName: 'مدير النظام', phone: '+966501234567', avatar: 'ع', status: 'نشط' },
  { id: 'USR-002', code: 'MANAGER-99', name: 'الأستاذ طارق السعيد', role: 'manager', roleName: 'مسير الحملات', phone: '+966559876543', avatar: 'ط', status: 'نشط' },
  { id: 'USR-003', code: 'GUIDE-777', name: 'الشيخ أحمد بن علي', role: 'murshid', roleName: 'مرشد ديني', phone: '+966544443322', avatar: 'أ', status: 'نشط' },
  { id: 'USR-004', code: 'ACC-404', name: 'الأستاذ ياسين الفاسي', role: 'accountant', roleName: 'محاسب الوكالة', phone: '+966561118899', avatar: 'ي', status: 'نشط' },
  { id: 'USR-005', code: 'PILGRIM-101', name: 'محمد عبد الله الشمري', role: 'pilgrim', roleName: 'معتمر', phone: '+966597770011', avatar: 'م', room: '1402 - سويس أوتيل مكة', status: 'نشط' },
  { id: 'USR-006', code: 'PILGRIM-102', name: 'فاطمة الزهراء البقمي', role: 'pilgrim', roleName: 'معتمرة', phone: '+966598882233', avatar: 'ف', room: '1405 - سويس أوتيل مكة', status: 'نشط' }
];

export function dbGetUsers(): User[] {
  const db = getDatabase();
  if (!db.appUsers || db.appUsers.length === 0) {
    db.appUsers = DEFAULT_APP_USERS;
    saveDatabase(db);
  }
  return db.appUsers;
}

export function dbFindUserByCode(code: string): User | null {
  const users = dbGetUsers();
  const cleanCode = (code || '').trim().toUpperCase();
  return users.find(u => u.code.toUpperCase() === cleanCode) || null;
}

export function dbCreateUser(userData: {
  name: string;
  role: UserRole;
  roleName: string;
  phone?: string;
  code: string;
}): User {
  const db = getDatabase();
  const users = dbGetUsers();
  const newUser: User = {
    id: `USR-${Date.now()}`,
    code: userData.code,
    name: userData.name,
    role: userData.role,
    roleName: userData.roleName || userData.role,
    phone: userData.phone || '',
    avatar: userData.name ? userData.name.charAt(0) : 'م',
    status: 'نشط'
  };
  users.push(newUser);
  db.appUsers = users;
  saveDatabase(db);
  return newUser;
}

export function dbGetAuditLogs(): AuditLog[] {
  const db = getDatabase();
  return db.auditLogs || [];
}

export function dbLogAudit(
  actorName: string,
  actorRole: string,
  action: string,
  details: string,
  ip: string = ''
): AuditLog {
  const db = getDatabase();
  if (!db.auditLogs) {
    db.auditLogs = [];
  }
  const log: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorName: actorName || 'غير معروف',
    actorRole: actorRole || 'مستخدم',
    action: action || '',
    details: details || '',
    ip: ip || '127.0.0.1'
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 200) {
    db.auditLogs = db.auditLogs.slice(0, 200);
  }
  saveDatabase(db);
  return log;
}

export function dbGetMessages(chatId: string): Message[] {
  const db = getDatabase();
  if (!db.messages) {
    db.messages = [];
  }
  return db.messages.filter(m => m.chatId === chatId);
}

export function dbSaveMessage(msg: Message): Message {
  const db = getDatabase();
  if (!db.messages) {
    db.messages = [];
  }
  const savedMsg: Message = {
    ...msg,
    id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    time: msg.time || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  };
  db.messages.push(savedMsg);
  saveDatabase(db);
  return savedMsg;
}

export function dbGetReceipts(): Receipt[] {
  const db = getDatabase();
  if (!db.receipts) {
    db.receipts = [
      {
        id: 'RCP-8801',
        pilgrimName: 'محمد عبد الله الشمري',
        pilgrimCode: 'PILGRIM-101',
        packageName: 'باقة أوت الاقتصادية المميزة',
        totalAmount: 215000,
        paidAmount: 215000,
        remainingAmount: 0,
        paymentMethod: 'تحويل بنكي (CCP)',
        date: '2026-08-11',
        accountantName: 'الأستاذ ياسين الفاسي',
        status: 'مكتمل'
      }
    ];
    saveDatabase(db);
  }
  return db.receipts;
}

export function dbSaveReceipt(receipt: Receipt): Receipt {
  const db = getDatabase();
  const receipts = dbGetReceipts();
  const savedReceipt: Receipt = {
    ...receipt,
    id: receipt.id || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
    date: receipt.date || new Date().toISOString().split('T')[0],
    status: receipt.status || 'مكتمل'
  };
  receipts.push(savedReceipt);
  db.receipts = receipts;
  saveDatabase(db);
  return savedReceipt;
}

// ─────────────────────────────────────────────
// AGENCY SETTINGS & DOMAIN HELPERS
// ─────────────────────────────────────────────

const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  agency_name: 'ساوث ستريت للأسفار والعمرة',
  legal_name: 'شركة ساوث ستريت للسياحة والأسفار ذ.م.م',
  logo: '/images/logo.png',
  description: 'الوكالة المعتمدة الأولى لرحلات العمرة والحج المباشرة وتأطير المعتمرين بالجزائر',
  address: 'شارع 01 نوفمبر 1954، الجزائر العاصمة',
  city: 'الجزائر العاصمة',
  country: 'الجزائر',
  phone: '+213 21 55 44 33',
  whatsapp: '+213 550 12 34 56',
  email: 'contact@southstreet.dz',
  website: 'https://southstreet.dz',
  opening_hours: 'الأحد - الخميس: 08:30 صباحاً - 17:30 مساءً',
  emergency_phone: '+213 661 99 88 77',
  supported_languages: ['العربية', 'الدارجة الجزائرية', 'Français', 'English'],
  default_currency: 'DZD',
  timezone: 'Africa/Algiers'
};

const DEFAULT_SEASONS: Season[] = [
  {
    season_id: 'season_ramadan_2026',
    type: 'UMRAH',
    islamic_year: '1447',
    gregorian_year: '2026',
    name: 'موسم عمرة رمضان المبارك 2026',
    start_date: '2026-03-01',
    end_date: '2026-04-05',
    status: 'CURRENT',
    description: 'رحلات مباشرة متتابعة طيلة شهر رمضان المبارك مع ليالي القدر في مكة المكرمة.',
    official_information: 'اشتراط التواجد المسبق قبل 48 ساعة بالمطار وتحليل الصحي المعترف به.',
    agency_information: 'فنادق 5 نجوم على بعد خطوات من صحن الحرم المكي الشريف.'
  },
  {
    season_id: 'season_august_2026',
    type: 'UMRAH',
    islamic_year: '1448',
    gregorian_year: '2026',
    name: 'موسم عمرة أوت المميز 2026',
    start_date: '2026-08-15',
    end_date: '2026-09-10',
    status: 'OPEN',
    description: 'باقة اقتصادية عائلية ومباشرة من الجزائر العاصمة، وهران، وعنابة.',
    official_information: 'جواز سفر بيومتري صالح 6 أشهر وزوج صور خلفية بيضاء.',
    agency_information: 'إقامة بفندق منارات غزة 350م فقط عن صحن الحرم المكي.'
  },
  {
    season_id: 'season_hajj_1447',
    type: 'HAJJ',
    islamic_year: '1447',
    gregorian_year: '2026',
    name: 'موسم الحج الإداري والمباشر 1447هـ',
    start_date: '2026-05-15',
    end_date: '2026-06-25',
    status: 'UPCOMING',
    description: 'حملة الحج المعتمدة رسمياً للتكفل التام بالحجاج بالمشاعر المقدسة (منى وعرفات).',
    official_information: 'التسجيل يتبع القرعة الرسمية للديوان الوطني للحج والعمرة.',
    agency_information: 'مخيمات VIP مجددة ومكيفة بمنى مع إعاشة كاملة وتأطير علماء شريعة.'
  }
];

const DEFAULT_HOTELS: Hotel[] = [
  {
    hotel_id: 'htl_swissotel_makkah',
    name: 'فندق سويس أوتيل مكة (Swissôtel Makkah)',
    city: 'MAKKAH',
    category: 'VIP',
    address: 'مجمع أبراج البيت، صحن الحرم المكي الشريف',
    latitude: 21.4187,
    longitude: 39.8256,
    distance_from_haram: '50م فقط (دخول مباشر لصحن الحرم عبر مجمع الأبراج)',
    description: 'فندق فاخر خماسي النجوم يطل مباشرة على الكعبة المشرفة وصحن الحرم المكي.',
    services: ['بوفيه مفتوح', 'واي فاي سريع', 'خدمة الغرف 24/7', 'دخول مباشر للمصلى', 'مصاعد سريعة'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop'
    ],
    videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
    status: 'ACTIVE'
  },
  {
    hotel_id: 'htl_manarat_gaza',
    name: 'فندق منارات غزة مكة المكرمة',
    city: 'MAKKAH',
    category: '4_STAR',
    address: 'منطقة غزة، مكة المكرمة',
    latitude: 21.4245,
    longitude: 39.8312,
    distance_from_haram: '350م فقط عن صحن الحرم المكي',
    description: 'فندق حديث مميز بالقرب السريع من صحن الحرم وغرف واسعة للعائلات والأفراد.',
    services: ['تكييف مركزي', 'شاشات مسطحة', 'خدمة حافلات عند الحاجة', 'مطعم إعاشة'],
    images: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop'
    ],
    videos: [],
    status: 'ACTIVE'
  },
  {
    hotel_id: 'htl_pullman_madinah',
    name: 'فندق بولمان زمزم المدينة المنورة',
    city: 'MADINAH',
    category: '5_STAR',
    address: 'المنطقة المركزية الشمالية، المدينة المنورة',
    latitude: 24.4672,
    longitude: 39.6111,
    distance_from_haram: ' خطوات معدودة عن المسجد النبوي الشريف وباب النساء',
    description: 'إقامة راقية ومباشرة بالمنطقة المركزية بالقرب من الروضة الشريفة.',
    services: ['بوفيه مفتوح', 'إرشاد خاص', 'خدمات كبار السن', 'مركز رجال الأعمال'],
    images: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop'
    ],
    videos: [],
    status: 'ACTIVE'
  }
];

const DEFAULT_FLIGHTS: Flight[] = [
  {
    flight_id: 'flt_ah_1002',
    airline: 'الخطوط الجوية الجزائرية (Air Algérie)',
    flight_number: 'AH-1002',
    departure_airport: 'مطار هواري بومدين (ALG) - الجزائر العاصمة',
    arrival_airport: 'مطار الأمير محمد بن عبد العزيز (MED) - المدينة المنورة',
    departure_datetime: '2026-08-15T08:00:00Z',
    arrival_datetime: '2026-08-15T14:30:00Z',
    baggage: 'حقيبتان (23كغ كل حقيبة) + حقيبة يد (8كغ) + قارورة ماء زمزم 5 لتر',
    status: 'CONFIRMED'
  },
  {
    flight_id: 'flt_sv_405',
    airline: 'الخطوط السعودية (Saudia Airlines)',
    flight_number: 'SV-405',
    departure_airport: 'مطار أحمد بن بلة (ORN) - وهران',
    arrival_airport: 'مطار الملك عبد العزيز الدولي (JED) - جدة',
    departure_datetime: '2026-08-18T10:30:00Z',
    arrival_datetime: '2026-08-18T17:00:00Z',
    baggage: 'حقيبتان (23كغ) + حقيبة يد (7كغ) + قارورة ماء زمزم',
    status: 'CONFIRMED'
  }
];

const DEFAULT_MORSHIDS: Morshid[] = [
  {
    morshid_id: 'msh_001',
    name: 'الشيخ أحمد بن علي',
    languages: ['العربية', 'الدارجة', 'Français'],
    experience_years: 12,
    specialization: 'مرشد ديني متخصص في مناسك العمرة ومزارات المدينة المنورة',
    phone: '+213 555 11 22 33',
    status: 'ASSIGNED'
  },
  {
    morshid_id: 'msh_002',
    name: 'د. عبد الرحمن العتيبي',
    languages: ['العربية', 'English'],
    experience_years: 18,
    specialization: 'خبير إدارة الحملات الفاخرة وتأطير الحجاج والمعتمرين VIP',
    phone: '+213 661 44 55 66',
    status: 'AVAILABLE'
  }
];

const DEFAULT_PACKAGES: Package[] = [
  {
    package_id: 'pkg_august_economy_2026',
    name: 'باقة أوت الاقتصادية المميزة (طيران مباشر)',
    type: 'ECONOMY',
    season_id: 'season_august_2026',
    season_name: 'موسم عمرة أوت 2026',
    description: 'رحلة عمرة مباشرة اقتصادية مريحة تشمل طيران مباشر، فندق منارات غزة 350م من صحن الحرم المكي، وتنقلات VIP.',
    start_date: '2026-08-15',
    end_date: '2026-08-29',
    duration_days: 15,
    departure_city: 'الجزائر العاصمة / وهران / عنابة',
    departure_airport: 'مطار هواري بومدين (ALG)',
    arrival_airport: 'مطار الأمير محمد بن عبد العزيز (MED)',
    airline: 'الخطوط الجوية الجزائرية والخطوط السعودية',
    makkah_hotel_id: 'htl_manarat_gaza',
    makkah_hotel_name: 'فندق منارات غزة مكة',
    makkah_hotel_dist: '350م فقط عن صحن الحرم المكي',
    madinah_hotel_id: 'htl_pullman_madinah',
    madinah_hotel_name: 'فندق بولمان زمزم المدينة',
    madinah_hotel_dist: 'خطوات عن المسجد النبوي',
    hotel_category: '4 نجوم / 5 نجوم',
    morshid_id: 'msh_001',
    morshid_name: 'الشيخ أحمد بن علي',
    prices: [
      { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 215000 },
      { room_type: 'TRIPLE', traveler_type: 'ADULT', currency: 'DZD', amount: 235000 },
      { room_type: 'DOUBLE', traveler_type: 'ADULT', currency: 'DZD', amount: 265000 },
      { room_type: 'SINGLE', traveler_type: 'ADULT', currency: 'DZD', amount: 320000 }
    ],
    included_services: [
      'تأشيرة العمرة الإلكترونية النسك',
      'تذكرة الطيران المباشر ذهاباً وإياداً',
      'الإقامة بالفنادق المذكورة مع الإفطار',
      'التنقلات الداخلية بحافلات سياحية VIP مكيفة',
      'زيارات المزارات بالمدينة المنورة ومكة المكرمة',
      'مرشد ديني ومرافقة صحية طوال الرحلة'
    ],
    excluded_services: ['مصاريف الجواز والتطعيمات الشخصية', 'المشتريات والهدايا الشخصية'],
    booking_conditions: ['دفع 30% دفعة أولى عند الحجز', 'تسديد المتبقي 15 يوماً قبل موعد السفر'],
    cancellation_policy: 'إلغاء مجاني حتى 20 يوماً قبل السفر، يخصم قيمة التبتيل بعد صدور التأشيرة.',
    capacity: 45,
    reserved: 28,
    available: 17,
    status: 'PUBLISHED',
    published: true,
    image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'
  },
  {
    package_id: 'pkg_mawlid_vip_2026',
    name: 'باقة المولد النبوي VIP (سويس أوتيل برج الساعة)',
    type: 'VIP',
    season_id: 'season_ramadan_2026',
    season_name: 'موسم عمرة المولد VIP',
    description: 'إقامة VIP مطلة ومباشرة على صحن الحرم المكي بفندق سويس أوتيل برج الساعة (50م فقط)، مع إعاشة بوفيه فاخر وتأطير شرعي خاص.',
    start_date: '2026-09-12',
    end_date: '2026-09-27',
    duration_days: 15,
    departure_city: 'الجزائر العاصمة',
    departure_airport: 'مطار هواري بومدين (ALG)',
    arrival_airport: 'مطار الملك عبد العزيز (JED)',
    airline: 'الخطوط السعودية (Saudia VIP)',
    makkah_hotel_id: 'htl_swissotel_makkah',
    makkah_hotel_name: 'فندق سويس أوتيل مكة برج الساعة',
    makkah_hotel_dist: '50م فقط عن صحن الحرم (دخول مباشر)',
    madinah_hotel_id: 'htl_pullman_madinah',
    madinah_hotel_name: 'فندق بولمان زمزم المدينة',
    madinah_hotel_dist: 'خطوات عن المسجد النبوي',
    hotel_category: '5 نجوم VIP',
    morshid_id: 'msh_002',
    morshid_name: 'د. عبد الرحمن العتيبي',
    prices: [
      { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 295000 },
      { room_type: 'TRIPLE', traveler_type: 'ADULT', currency: 'DZD', amount: 325000 },
      { room_type: 'DOUBLE', traveler_type: 'ADULT', currency: 'DZD', amount: 375000 },
      { room_type: 'SINGLE', traveler_type: 'ADULT', currency: 'DZD', amount: 480000 }
    ],
    included_services: [
      'تأشيرة العمرة الإلكترونية السريعة',
      'تذكرة طيران VIP على الخطوط السعودية',
      'إعاشة بوفيه مفتوح فاخر بفندق سويس أوتيل',
      'استخراج تصريح الروضة الشريفة بنسك',
      'استقبال خاص بسيارات VIP في مطار جدة والمدينة'
    ],
    excluded_services: ['مصاريف التطعيم الشخصية'],
    booking_conditions: ['دفع 40% عند التأكيد وارفاق نسخة الجواز'],
    cancellation_policy: 'استرجاع كامل المبلغ في حال إلغاء الرحلة من الطرف الرسمي.',
    capacity: 30,
    reserved: 21,
    available: 9,
    status: 'PUBLISHED',
    published: true,
    image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop'
  },
  {
    package_id: 'pkg_hajj_direct_1447',
    name: 'برنامج الحج المباشر والتكفل التام 1447هـ',
    type: 'GROUP',
    season_id: 'season_hajj_1447',
    season_name: 'موسم الحج 1447هـ',
    description: 'حملة الحج المعتمدة رسمياً بالتكفل الشامل بجميع المشاعر المقدسة (منى، عرفات، ومزدلفة) مع مرافقين وإرشاد شرعي وديني كلي.',
    start_date: '2026-05-18',
    end_date: '2026-06-22',
    duration_days: 35,
    departure_city: 'جميع المطارات الوطنية (الجزائر/وهران/عنابة/قسنطينة)',
    departure_airport: 'مطار هواري بومدين (ALG)',
    arrival_airport: 'مطار الملك عبد العزيز (JED)',
    airline: 'الخطوط الجوية الجزائرية والخطوط السعودية',
    makkah_hotel_id: 'htl_swissotel_makkah',
    makkah_hotel_name: 'فنادق أبراج مكة المركزية',
    makkah_hotel_dist: 'المنطقة المركزية مكة',
    madinah_hotel_id: 'htl_pullman_madinah',
    madinah_hotel_name: 'فنادق المنطقة المركزية الشمالية',
    madinah_hotel_dist: 'خطوات عن الحرم النبوي',
    hotel_category: '5 نجوم VIP',
    morshid_id: 'msh_002',
    morshid_name: 'د. عبد الرحمن العتيبي',
    prices: [
      { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 890000 },
      { room_type: 'TRIPLE', traveler_type: 'ADULT', currency: 'DZD', amount: 960000 },
      { room_type: 'DOUBLE', traveler_type: 'ADULT', currency: 'DZD', amount: 1100000 }
    ],
    included_services: [
      'تأشيرة الحج الرسمية المعتمدة',
      'تذكرة طيران للحجاج',
      'مخيمات مكيفة ومجهزة بالكامل بمنى وعرفات',
      'ثلاث وجبات يومية بوفيه مفتوح ومشروبات طوال اليوم',
      'تأطير طبي وديني وإداري 24 ساعة'
    ],
    excluded_services: ['الهدي الشخصي'],
    booking_conditions: ['التسجيل بشرط جواز السفر ودفتر القرعة الرسمية'],
    cancellation_policy: 'تخضع لقوانين وزارة الحج والعمرة والديوان الوطني للحج والعمرة.',
    capacity: 100,
    reserved: 65,
    available: 35,
    status: 'PUBLISHED',
    published: true,
    image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop'
  }
];

const DEFAULT_RESERVATIONS: Reservation[] = [
  {
    reservation_id: 'res_1001',
    reservation_number: 'RES-2026-8801',
    customer_id: 'usr_pilgrim_user',
    customer_name: 'عمر بن علي',
    customer_email: 'user@southstreet.dz',
    customer_phone: '+213 559 88 77 66',
    package_id: 'pkg_august_economy_2026',
    package_name: 'باقة أوت الاقتصادية المميزة (طيران مباشر)',
    room_type: 'QUAD',
    travelers_count: 1,
    travelers: [
      {
        first_name: 'عمر',
        last_name: 'بن علي',
        passport_number: 'A99887766',
        passport_expiry: '2030-05-10',
        birth_date: '1985-04-12',
        gender: 'MALE',
        traveler_type: 'ADULT'
      }
    ],
    total_amount: 215000,
    paid_amount: 215000,
    currency: 'DZD',
    status: 'CONFIRMED',
    payment_status: 'PAID',
    created_at: '2026-08-11T14:30:00Z',
    updated_at: '2026-08-11T16:00:00Z'
  }
];

const DEFAULT_MEDIA_ASSETS: MediaAsset[] = [
  {
    media_id: 'med_001',
    type: 'IMAGE',
    title: 'فندق سويس أوتيل مكة والإطلالة المباشرة على الحرم',
    description: 'صورة رسمية معتمدة لمدخل وفندق سويس أوتيل برج الساعة بمكة المكرمة.',
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=300&auto=format&fit=crop',
    source: 'HOTEL_PARTNER',
    license: 'Approved Partner License',
    approved: true,
    related_entity_type: 'HOTEL',
    related_entity_id: 'htl_swissotel_makkah'
  },
  {
    media_id: 'med_002',
    type: 'IMAGE',
    title: 'فندق منارات غزة والقرب من الكعبة',
    description: 'إقامة مريحة على بعد 350م فقط من صحن الحرم المكي.',
    url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
    thumbnail_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300&auto=format&fit=crop',
    source: 'AGENCY',
    license: 'Agency Direct Ownership',
    approved: true,
    related_entity_type: 'HOTEL',
    related_entity_id: 'htl_manarat_gaza'
  },
  {
    media_id: 'med_003',
    type: 'MAP',
    title: 'خريطة صحن الحرم المكي والفنادق المعتمدة',
    description: 'مواقع الفنادق بالنسبة لبوابات الحرم المكي الشريف.',
    url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
    source: 'OFFICIAL',
    license: 'Public Educational Use',
    approved: true,
    related_entity_type: 'DESTINATION',
    related_entity_id: 'MAKKAH'
  }
];

export function dbGetAgencySettings(): AgencySettings {
  const db = getDatabase();
  if (!db.agencySettings) {
    db.agencySettings = DEFAULT_AGENCY_SETTINGS;
    saveDatabase(db);
  }
  return db.agencySettings;
}

export function dbGetSeasons(): Season[] {
  const db = getDatabase();
  if (!db.seasons || db.seasons.length === 0) {
    db.seasons = DEFAULT_SEASONS;
    saveDatabase(db);
  }
  return db.seasons;
}

export function dbGetHotels(): Hotel[] {
  const db = getDatabase();
  if (!db.hotels || db.hotels.length === 0) {
    db.hotels = DEFAULT_HOTELS;
    saveDatabase(db);
  }
  return db.hotels;
}

export function dbGetFlights(): Flight[] {
  const db = getDatabase();
  if (!db.flights || db.flights.length === 0) {
    db.flights = DEFAULT_FLIGHTS;
    saveDatabase(db);
  }
  return db.flights;
}

export function dbGetMorshids(): Morshid[] {
  const db = getDatabase();
  if (!db.morshids || db.morshids.length === 0) {
    db.morshids = DEFAULT_MORSHIDS;
    saveDatabase(db);
  }
  return db.morshids;
}

export function dbGetPackages(): Package[] {
  const db = getDatabase();
  if (!db.packages || db.packages.length === 0) {
    db.packages = DEFAULT_PACKAGES;
    saveDatabase(db);
  }
  return db.packages;
}

export function dbGetPackageById(id: string): Package | null {
  const pkgs = dbGetPackages();
  return pkgs.find(p => p.package_id === id || p.package_id.includes(id)) || null;
}

export function dbGetReservations(): Reservation[] {
  const db = getDatabase();
  if (!db.reservations) {
    db.reservations = DEFAULT_RESERVATIONS;
    saveDatabase(db);
  }
  return db.reservations;
}

export function dbCreateReservation(data: {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  package_id: string;
  room_type: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD';
  travelers_count: number;
  travelers?: TravelerInfo[];
}): Reservation {
  const db = getDatabase();
  const pkgs = dbGetPackages();
  const targetPkg = pkgs.find(p => p.package_id === data.package_id) || pkgs[0];

  const priceObj = targetPkg.prices.find(p => p.room_type === data.room_type) || targetPkg.prices[0];
  const unitPrice = priceObj ? priceObj.amount : 215000;
  const totalAmount = unitPrice * Math.max(1, data.travelers_count);

  const resNumber = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newRes: Reservation = {
    reservation_id: `res_${Date.now()}`,
    reservation_number: resNumber,
    customer_id: `usr_${Date.now()}`,
    customer_name: data.customer_name || 'معتمر جديد',
    customer_email: data.customer_email || 'pilgrim@southstreet.dz',
    customer_phone: data.customer_phone || '+213 550 00 00 00',
    package_id: targetPkg.package_id,
    package_name: targetPkg.name,
    room_type: data.room_type,
    travelers_count: data.travelers_count,
    travelers: data.travelers || [
      {
        first_name: data.customer_name ? data.customer_name.split(' ')[0] : 'معتمر',
        last_name: data.customer_name ? data.customer_name.split(' ').slice(1).join(' ') : 'جديد',
        passport_number: 'PENDING_UPLOAD',
        passport_expiry: '2030-01-01',
        birth_date: '1990-01-01',
        gender: 'MALE',
        traveler_type: 'ADULT'
      }
    ],
    total_amount: totalAmount,
    paid_amount: 0,
    currency: 'DZD',
    status: 'REQUESTED',
    payment_status: 'UNPAID',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Decrement seat availability securely
  targetPkg.reserved += Math.max(1, data.travelers_count);
  targetPkg.available = Math.max(0, targetPkg.capacity - targetPkg.reserved);

  if (!db.reservations) db.reservations = [];
  db.reservations.unshift(newRes);
  db.packages = pkgs;
  saveDatabase(db);

  return newRes;
}

export function dbGetCustomerDocuments(customerId?: string): CustomerDocument[] {
  const db = getDatabase();
  if (!db.documents) {
    db.documents = [
      {
        document_id: 'doc_101',
        customer_id: 'usr_pilgrim_user',
        document_type: 'PASSPORT',
        file_name: 'Passport_Omar_Bin_Ali.pdf',
        file_url: '/documents/passport_omar.pdf',
        status: 'VERIFIED',
        uploaded_at: '2026-08-10T10:00:00Z'
      }
    ];
    saveDatabase(db);
  }
  if (customerId) {
    return db.documents.filter(d => d.customer_id === customerId);
  }
  return db.documents;
}

export function dbSaveCustomerDocument(doc: Partial<CustomerDocument>): CustomerDocument {
  const db = getDatabase();
  const docs = dbGetCustomerDocuments();
  const newDoc: CustomerDocument = {
    document_id: doc.document_id || `doc_${Date.now()}`,
    customer_id: doc.customer_id || 'usr_pilgrim_user',
    document_type: doc.document_type || 'PASSPORT',
    file_name: doc.file_name || 'document.pdf',
    file_url: doc.file_url || '/documents/sample.pdf',
    status: doc.status || 'UPLOADED',
    uploaded_at: new Date().toISOString()
  };
  docs.unshift(newDoc);
  db.documents = docs;
  saveDatabase(db);
  return newDoc;
}

export function dbGetMediaAssets(): MediaAsset[] {
  const db = getDatabase();
  if (!db.mediaAssets || db.mediaAssets.length === 0) {
    db.mediaAssets = DEFAULT_MEDIA_ASSETS;
    saveDatabase(db);
  }
  return db.mediaAssets;
}

export function dbLogAiConversation(log: Partial<AiConversationLog>): AiConversationLog {
  const db = getDatabase();
  if (!db.aiConversations) {
    db.aiConversations = [];
  }
  const entry: AiConversationLog = {
    conversation_id: log.conversation_id || `conv_${Date.now()}`,
    customer_id: log.customer_id,
    prompt: log.prompt || '',
    response: log.response || '',
    tools_called: log.tools_called || [],
    language: log.language || 'ar',
    feedback: log.feedback,
    escalated: log.escalated || false,
    timestamp: new Date().toISOString()
  };
  db.aiConversations.unshift(entry);
  if (db.aiConversations.length > 300) {
    db.aiConversations = db.aiConversations.slice(0, 300);
  }
  saveDatabase(db);
  return entry;
}


