/* ==========================================================================
   SOUTH STREET (سوث ستريت) - Data Store & State Engine
   ========================================================================== */

const STORAGE_KEYS = {
  SESSION: 'south_street_session',
  USERS: 'south_street_users',
  CAMPAIGNS: 'south_street_campaigns',
  MESSAGES: 'south_street_messages',
  RECEIPTS: 'south_street_receipts',
  AUDIT: 'south_street_audit_logs'
};

// Initial Seed Data
const DEFAULT_USERS = [
  {
    id: 'USR-001',
    code: 'ADMIN-2026',
    name: 'د. عبد الرحمن العتيبي',
    role: 'admin',
    roleName: 'مدير النظام',
    phone: '+966 50 123 4567',
    avatar: 'ع',
    status: 'نشط'
  },
  {
    id: 'USR-002',
    code: 'MANAGER-99',
    name: 'الأستاذ طارق السعيد',
    role: 'manager',
    roleName: 'مسير الحملات',
    phone: '+966 55 987 6543',
    avatar: 'ط',
    status: 'نشط'
  },
  {
    id: 'USR-003',
    code: 'GUIDE-777',
    name: 'الشيخ أحمد بن علي',
    role: 'murshid',
    roleName: 'مرشد ديني',
    phone: '+966 54 444 3322',
    avatar: 'أ',
    status: 'نشط'
  },
  {
    id: 'USR-004',
    code: 'ACC-404',
    name: 'الأستاذ ياسين الفاسي',
    role: 'accountant',
    roleName: 'محاسب الوكالة',
    phone: '+966 56 111 8899',
    avatar: 'ي',
    status: 'نشط'
  },
  {
    id: 'USR-005',
    code: 'PILGRIM-101',
    name: 'محمد عبد الله الشمري',
    role: 'pilgrim',
    roleName: 'معتمر',
    phone: '+966 59 777 0011',
    avatar: 'م',
    status: 'نشط',
    group: 'حملة سوث ستريت الكبرى',
    room: '1402 - سويس أوتيل مكة'
  },
  {
    id: 'USR-006',
    code: 'PILGRIM-102',
    name: 'فاطمة الزهراء البقمي',
    role: 'pilgrim',
    roleName: 'معتمرة',
    phone: '+966 59 888 2233',
    avatar: 'ف',
    status: 'نشط',
    group: 'حملة سوث ستريت الكبرى',
    room: '1405 - سويس أوتيل مكة'
  }
];

const DEFAULT_CAMPAIGNS = [
  {
    id: 'CMP-2026-01',
    title: 'حملة سوث ستريت الكبرى - شعبان 1447هـ',
    startDate: '1447-08-15',
    endDate: '1447-08-25',
    makkahHotel: 'سويس أوتيل المقام - برج الساعة (5 نجوم)',
    madinahHotel: 'فندق أوبروي المدينة المنورة',
    flightNumber: 'الخطوط السعودية SV-382',
    busNumber: 'حافلة VIP رقم 12',
    pilgrimsCount: 45,
    guideName: 'الشيخ أحمد بن علي',
    managerName: 'الأستاذ طارق السعيد',
    status: 'قيد التنفيذ'
  }
];

const DEFAULT_MESSAGES = [
  {
    id: 'MSG-001',
    chatId: 'group-makkah',
    chatName: 'حملة سوث ستريت الكبرى (مكة)',
    senderId: 'USR-003',
    senderName: 'الشيخ أحمد بن علي (مرشد)',
    senderRole: 'murshid',
    text: 'السلام عليكم ورحمة الله وبركاته حجاج ومعتمري وكالة سوث ستريت. تذكير: الانطلاق لأداء طواف القدوس اليوم الساعة 4:30 عصراً من لوبي الفندق.',
    time: '10:15 ص',
    type: 'text',
    status: 'read'
  },
  {
    id: 'MSG-002',
    chatId: 'group-makkah',
    chatName: 'حملة سوث ستريت الكبرى (مكة)',
    senderId: 'USR-005',
    senderName: 'محمد عبد الله الشمري',
    senderRole: 'pilgrim',
    text: 'تقبل الله منا ومنكم يا شيخ. هل تجمع الحافلة أمام باب الملك عبد العزيز؟',
    time: '10:18 ص',
    type: 'text',
    status: 'read'
  },
  {
    id: 'MSG-003',
    chatId: 'group-makkah',
    chatName: 'حملة سوث ستريت الكبرى (مكة)',
    senderId: 'USR-003',
    senderName: 'الشيخ أحمد بن علي (مرشد)',
    senderRole: 'murshid',
    text: 'تسجيل صوتي: توجيهات حول الالتزام بالدعاء وأدعية السعي بين الصفا والمروة',
    time: '10:22 ص',
    type: 'voice',
    duration: '0:42',
    status: 'read'
  },
  {
    id: 'MSG-004',
    chatId: 'group-makkah',
    chatName: 'حملة سوث ستريت الكبرى (مكة)',
    senderId: 'USR-003',
    senderName: 'الشيخ أحمد بن علي (مرشد)',
    senderRole: 'murshid',
    text: 'موقعي الحالي: نقطة تجمع الحافلات أمام فندق سويس أوتيل',
    time: '10:30 ص',
    type: 'location',
    locationName: 'سويس أوتيل المقام - مكة المكرمة',
    coords: '21.4187, 39.8256',
    status: 'read'
  }
];

const DEFAULT_RECEIPTS = [
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
    status: 'خالص الدفع'
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
    status: 'عربون متبقي'
  }
];

const DEFAULT_AUDIT_LOGS = [
  {
    id: 'LOG-1001',
    timestamp: '2026-08-10 09:15:00',
    actorName: 'د. عبد الرحمن العتيبي',
    actorRole: 'admin',
    action: 'إنشاء كود وصول جديد',
    details: 'تم إصدار رمز الوصول PILGRIM-101 للمعتمر محمد عبد الله',
    ip: '197.220.14.88'
  },
  {
    id: 'LOG-1002',
    timestamp: '2026-08-10 09:40:22',
    actorName: 'محمد عبد الله الشمري',
    actorRole: 'pilgrim',
    action: 'ربط جهاز آمن',
    details: 'تم اقتران الهاتف بالرمز PILGRIM-101 بنجاح عبر بروتوكول التشافير LocalKey',
    ip: '197.220.14.90'
  }
];

class Store {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)) {
      localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(DEFAULT_CAMPAIGNS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(DEFAULT_MESSAGES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.RECEIPTS)) {
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(DEFAULT_RECEIPTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(DEFAULT_AUDIT_LOGS));
    }
  }

  // Users Management
  getUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  }

  saveUser(user) {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.logAudit(user.name, user.role, 'إضافة مستخدم جديد', `تم إنشاء كود الوصول ${user.code}`);
  }

  findUserByCode(code) {
    const users = this.getUsers();
    return users.find(u => u.code.trim().toUpperCase() === code.trim().toUpperCase());
  }

  // Session Management
  getSession() {
    const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
    return sessionStr ? JSON.parse(sessionStr) : null;
  }

  setSession(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    this.logAudit(user.name, user.role, 'تسجيل دخول وتوصيل', `تم الاتصال بواسطة الكود ${user.code}`);
  }

  clearSession() {
    const session = this.getSession();
    if (session) {
      this.logAudit(session.name, session.role, 'تسجيل خروج', 'تم خروج المستخدم وإنهاء الجلسة');
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }

  // Campaigns Management
  getCampaigns() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CAMPAIGNS) || '[]');
  }

  saveCampaign(campaign) {
    const campaigns = this.getCampaigns();
    campaigns.push(campaign);
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  }

  // Messages Management
  getMessages(chatId = null) {
    const msgs = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    return chatId ? msgs.filter(m => m.chatId === chatId) : msgs;
  }

  addMessage(msg) {
    const msgs = this.getMessages();
    msgs.push(msg);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
  }

  // Receipts Management
  getReceipts() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECEIPTS) || '[]');
  }

  saveReceipt(receipt) {
    const receipts = this.getReceipts();
    receipts.push(receipt);
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    this.logAudit(receipt.accountantName, 'accountant', 'إصدار سند قبض رقمي', `سند رقم ${receipt.id} للمعتمر ${receipt.pilgrimName}`);
  }

  // Audit Logs
  getAuditLogs() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT) || '[]');
  }

  logAudit(actorName, actorRole, action, details) {
    const logs = this.getAuditLogs();
    const newLog = {
      id: `LOG-${1000 + logs.length + 1}`,
      timestamp: new Date().toLocaleString('ar-SA'),
      actorName,
      actorRole,
      action,
      details,
      ip: '197.220.14.88'
    };
    logs.unshift(newLog); // Newest first
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
  }
}

window.appStore = new Store();
