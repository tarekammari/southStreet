import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, Message, Receipt, AuditLog, Campaign } from '@/types';

const DB_FILE = path.join(process.cwd(), 'south_street_db.json');
const SALT_ROUNDS = 12;

interface DbSchema {
  users: Array<{
    id: string;
    code_hash: string;
    code_plain: string;
    name: string;
    role: string;
    role_name: string;
    phone: string;
    avatar: string;
    room: string;
    status: string;
  }>;
  messages: Message[];
  receipts: Receipt[];
  auditLogs: AuditLog[];
}

function getInitialData(): DbSchema {
  return {
    users: [
      {
        id: 'USR-001',
        code_hash: bcrypt.hashSync('ADMIN-2026', SALT_ROUNDS),
        code_plain: 'ADMIN-2026',
        name: 'د. عبد الرحمن العتيبي',
        role: 'admin',
        role_name: 'مدير النظام',
        phone: '+966501234567',
        avatar: 'ع',
        room: '',
        status: 'نشط',
      },
      {
        id: 'USR-002',
        code_hash: bcrypt.hashSync('MANAGER-99', SALT_ROUNDS),
        code_plain: 'MANAGER-99',
        name: 'الأستاذ طارق السعيد',
        role: 'manager',
        role_name: 'مسير الحملات',
        phone: '+966559876543',
        avatar: 'ط',
        room: '',
        status: 'نشط',
      },
      {
        id: 'USR-003',
        code_hash: bcrypt.hashSync('GUIDE-777', SALT_ROUNDS),
        code_plain: 'GUIDE-777',
        name: 'الشيخ أحمد بن علي',
        role: 'murshid',
        role_name: 'مرشد ديني',
        phone: '+966544443322',
        avatar: 'أ',
        room: '',
        status: 'نشط',
      },
      {
        id: 'USR-004',
        code_hash: bcrypt.hashSync('ACC-404', SALT_ROUNDS),
        code_plain: 'ACC-404',
        name: 'الأستاذ ياسين الفاسي',
        role: 'accountant',
        role_name: 'محاسب الوكالة',
        phone: '+966561118899',
        avatar: 'ي',
        room: '',
        status: 'نشط',
      },
      {
        id: 'USR-005',
        code_hash: bcrypt.hashSync('PILGRIM-101', SALT_ROUNDS),
        code_plain: 'PILGRIM-101',
        name: 'محمد عبد الله الشمري',
        role: 'pilgrim',
        role_name: 'معتمر',
        phone: '+966597770011',
        avatar: 'م',
        room: '1402 - سويس أوتيل مكة',
        status: 'نشط',
      },
      {
        id: 'USR-006',
        code_hash: bcrypt.hashSync('PILGRIM-102', SALT_ROUNDS),
        code_plain: 'PILGRIM-102',
        name: 'فاطمة الزهراء البقمي',
        role: 'pilgrim',
        role_name: 'معتمرة',
        phone: '+966598882233',
        avatar: 'ف',
        room: '1405 - سويس أوتيل مكة',
        status: 'نشط',
      },
    ],
    messages: [
      {
        id: 'MSG-001',
        chatId: 'group-makkah',
        senderId: 'USR-003',
        senderName: 'الشيخ أحمد بن علي (مرشد)',
        senderRole: 'murshid',
        text: 'السلام عليكم ورحمة الله وبركاته حجاج ومعتمري وكالة سوث ستريت. تذكير: الانطلاق لأداء طواف القدوس اليوم الساعة 4:30 عصراً من لوبي الفندق.',
        time: '10:15 ص',
        type: 'text',
        status: 'read',
      },
    ],
    receipts: [
      {
        id: 'REC-9081',
        pilgrimName: 'محمد عبد الله الشمري',
        pilgrimCode: 'PILGRIM-101',
        packageName: 'باقة العمرة الفاخرة - 10 أيام',
        totalAmount: 12500,
        paidAmount: 12500,
        remainingAmount: 0,
        paymentMethod: 'تحويل بنكي سديد',
        date: '2026-08-01',
        accountantName: 'الأستاذ ياسين الفاسي',
        status: 'خالص الدفع',
      },
      {
        id: 'REC-9082',
        pilgrimName: 'فاطمة الزهراء البقمي',
        pilgrimCode: 'PILGRIM-102',
        packageName: 'باقة العمرة الفاخرة - 10 أيام',
        totalAmount: 12500,
        paidAmount: 8000,
        remainingAmount: 4500,
        paymentMethod: 'بطاقة مدى',
        date: '2026-08-05',
        accountantName: 'الأستاذ ياسين الفاسي',
        status: 'عربون متبقي',
      },
    ],
    auditLogs: [
      {
        id: 'LOG-1001',
        timestamp: '2026-08-10 09:15:00',
        actorName: 'د. عبد الرحمن العتيبي',
        actorRole: 'admin',
        action: 'إنشاء كود وصول جديد',
        details: 'تم إصدار رمز الوصول PILGRIM-101 للمعتمر محمد عبد الله',
        ip: '197.220.14.88',
      },
    ],
  };
}

function loadDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const initial = getInitialData();
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch {}
    return initial;
  }
}

function saveDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export function dbFindUserByCode(code: string): User | null {
  const data = loadDb();
  const cleanCode = code.trim().toUpperCase();
  for (const u of data.users) {
    if (u.code_plain && u.code_plain.toUpperCase() === cleanCode) {
      return {
        id: u.id,
        code: u.code_plain,
        name: u.name,
        role: u.role as any,
        roleName: u.role_name,
        phone: u.phone,
        avatar: u.avatar,
        room: u.room,
        status: u.status,
      };
    }
    if (bcrypt.compareSync(cleanCode, u.code_hash)) {
      return {
        id: u.id,
        code: cleanCode,
        name: u.name,
        role: u.role as any,
        roleName: u.role_name,
        phone: u.phone,
        avatar: u.avatar,
        room: u.room,
        status: u.status,
      };
    }
  }
  return null;
}

export function dbGetUsers(): User[] {
  const data = loadDb();
  return data.users.map((u) => ({
    id: u.id,
    code: u.code_plain,
    name: u.name,
    role: u.role as any,
    roleName: u.role_name,
    phone: u.phone,
    avatar: u.avatar,
    room: u.room,
    status: u.status,
  }));
}

export function dbCreateUser(user: { name: string; role: string; roleName: string; phone?: string; code: string; avatar?: string }): User {
  const data = loadDb();
  const id = `USR-${Math.floor(100 + Math.random() * 900)}`;
  const cleanCode = user.code.trim().toUpperCase();
  const newUserRaw = {
    id,
    code_hash: bcrypt.hashSync(cleanCode, SALT_ROUNDS),
    code_plain: cleanCode,
    name: user.name,
    role: user.role,
    role_name: user.roleName,
    phone: user.phone || '',
    avatar: user.avatar || user.name[0] || 'س',
    room: '',
    status: 'نشط',
  };
  data.users.push(newUserRaw);
  saveDb(data);
  return {
    id,
    code: cleanCode,
    name: user.name,
    role: user.role as any,
    roleName: user.roleName,
    phone: user.phone,
    avatar: user.avatar,
    status: 'نشط',
  };
}

export function dbGetMessages(chatId: string = 'group-makkah'): Message[] {
  const data = loadDb();
  return data.messages.filter((m) => m.chatId === chatId);
}

export function dbSaveMessage(msg: Message): Message {
  const data = loadDb();
  data.messages.push(msg);
  saveDb(data);
  return msg;
}

export function dbGetReceipts(): Receipt[] {
  const data = loadDb();
  return data.receipts;
}

export function dbSaveReceipt(r: Receipt): Receipt {
  const data = loadDb();
  data.receipts.unshift(r);
  saveDb(data);
  return r;
}

export function dbGetAuditLogs(): AuditLog[] {
  const data = loadDb();
  return data.auditLogs;
}

export function dbLogAudit(actorName: string, actorRole: string, action: string, details: string = '', ip: string = '197.220.14.88') {
  const data = loadDb();
  const newLog: AuditLog = {
    id: `LOG-${1000 + data.auditLogs.length + 1}`,
    timestamp: new Date().toLocaleString('ar-SA'),
    actorName,
    actorRole: actorRole as any,
    action,
    details,
    ip,
  };
  data.auditLogs.unshift(newLog);
  saveDb(data);
}

export function dbGetCampaigns(): Campaign[] {
  return [
    {
      id: 'CMP-2026-01',
      title: 'حملة سوث ستريت الكبرى - أوت 2026 / شعبان 1447هـ',
      startDate: '2026-08-10',
      endDate: '2026-08-25',
      makkahHotel: 'سويس أوتيل المقام - برج الساعة (5 نجوم)',
      madinahHotel: 'فندق أوبروي المدينة المنورة (أمام الروضة)',
      flightNumber: 'الخطوط السعودية SV-382 (مباشرة)',
      busNumber: 'حافلة VIP فاخرة رقم 12',
      pilgrimsCount: 45,
      guideName: 'الشيخ أحمد بن علي',
      managerName: 'الأستاذ طارق السعيد',
      status: 'قيد التنفيذ',
    },
  ];
}
