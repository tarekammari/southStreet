import fs from 'fs';
import path from 'path';
import { hashPassword, encryptData, decryptData } from './security';
import { User, Message, Receipt, AuditLog, UserRole } from '@/types';

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

