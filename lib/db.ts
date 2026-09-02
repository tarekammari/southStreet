import { getSqliteDb } from './sqlite';
import {
  User, Message, Receipt, AuditLog, UserRole,
  AgencySettings, Season, Hotel, Flight, Morshid, Package, Reservation,
  CustomerDocument, MediaAsset, AiConversationLog
} from '@/types';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
  role: string;
  roleName?: string;
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED' | string;
  createdAt: string;
    lastLoginIp?: string;
  pcFingerprint?: string;
  requiresFileKey?: boolean;
  staffId?: string;
  loginEnabled?: boolean;
  phone?: string;
  code?: string;
  usernameHash?: string;
  emailHash?: string;
  codeHash?: string;
  qrSecretHash?: string;
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
  endedAt?: string | null;
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
  qualityRating?: 'good' | 'less' | 'bad';
  modelAnswer?: string;
  answerMode?: 'official_exact' | 'ai_generated' | 'hybrid';
  matchStrategy?: 'keywords_or_title' | 'keywords_only' | 'exact_title';
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

const DEFAULT_SECURITY_KEY = 'SOUTHSTREET-KEY-v1-9F8E7D6C5B4A3928';

export function getDatabase(): DatabaseSchema {
  const db = getSqliteDb();

  // Load Users
  const userRows = db.prepare('SELECT * FROM users').all() as any[];
  const users: UserAccount[] = userRows.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    passwordHash: u.passwordHash,
    role: u.role,
    roleName: u.roleName,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginIp: u.lastLoginIp,
    pcFingerprint: u.pcFingerprint,
    requiresFileKey: Boolean(u.requiresFileKey),
    staffId: u.staffId,
    loginEnabled: u.loginEnabled !== 0,
    phone: u.phone,
    code: u.code,
    usernameHash: u.usernameHash,
    emailHash: u.emailHash,
    codeHash: u.codeHash,
    qrSecretHash: u.qrSecretHash,
  }));

  const appUsers: User[] = userRows.map(u => ({
    id: u.id,
    code: u.code || u.username || u.id,
    name: u.name,
    role: u.role,
    roleName: u.roleName || u.role,
    email: u.email,
    phone: u.phone || '',
    avatar: u.avatar || (u.name ? u.name.charAt(0) : 'م'),
    room: u.room,
    status: u.status === 'APPROVED' ? 'نشط' : u.status || 'معطل',
    username: u.username,
  }));

  // Load Sessions
  const sessions = db.prepare('SELECT * FROM sessions').all() as ActiveSession[];

  // Load Access Requests
  const accessRequests = db.prepare('SELECT * FROM access_requests').all() as AccessRequest[];

  // Load AI Knowledge Rules
  const knowledgeRows = db.prepare('SELECT * FROM ai_knowledge').all() as any[];
  const aiKnowledge: AiKnowledgeRule[] = knowledgeRows.map(k => ({
    id: k.id,
    category: k.category,
    title_ar: k.title_ar,
    keywords: JSON.parse(k.keywords || '[]'),
    response_ar: k.response_ar,
    is_active: Boolean(k.is_active),
    updatedBy: k.updatedBy,
    updatedAt: k.updatedAt,
    qualityRating: k.qualityRating,
    modelAnswer: k.modelAnswer,
    answerMode: k.answerMode || 'official_exact',
    matchStrategy: k.matchStrategy || 'keywords_or_title'
  }));

  // Load Agency Settings
  const agencyRow = db.prepare("SELECT * FROM agency_settings WHERE id = 'main'").get() as any;
  const agencySettings: AgencySettings = agencyRow ? {
    agency_name: agencyRow.agency_name,
    legal_name: agencyRow.legal_name,
    logo: agencyRow.logo,
    description: agencyRow.description,
    address: agencyRow.address,
    city: agencyRow.city,
    country: agencyRow.country,
    phone: agencyRow.phone,
    whatsapp: agencyRow.whatsapp,
    email: agencyRow.email,
    website: agencyRow.website,
    opening_hours: agencyRow.opening_hours,
    emergency_phone: agencyRow.emergency_phone,
    supported_languages: JSON.parse(agencyRow.supported_languages || '[]'),
    default_currency: agencyRow.default_currency,
    timezone: agencyRow.timezone
  } : {} as AgencySettings;

  // Load Seasons
  const seasons = db.prepare('SELECT * FROM seasons').all() as Season[];

  // Load Hotels
  const hotelRows = db.prepare('SELECT * FROM hotels').all() as any[];
  const hotels: Hotel[] = hotelRows.map(h => ({
    hotel_id: h.hotel_id,
    name: h.name,
    city: h.city,
    category: h.category,
    address: h.address,
    latitude: h.latitude,
    longitude: h.longitude,
    distance_from_haram: h.distance_from_haram,
    description: h.description,
    services: JSON.parse(h.services || '[]'),
    images: JSON.parse(h.images || '[]'),
    videos: JSON.parse(h.videos || '[]'),
    status: h.status
  }));

  // Load Flights
  const flights = db.prepare('SELECT * FROM flights').all() as Flight[];

  // Load Morshids
  const morshidRows = db.prepare('SELECT * FROM morshids').all() as any[];
  const morshids: Morshid[] = morshidRows.map(m => ({
    morshid_id: m.morshid_id,
    name: m.name,
    languages: JSON.parse(m.languages || '[]'),
    experience_years: m.experience_years,
    specialization: m.specialization,
    phone: m.phone,
    status: m.status
  }));

  // Load Packages with Prices
  const pkgRows = db.prepare('SELECT * FROM packages').all() as any[];
  const priceRows = db.prepare('SELECT * FROM package_prices').all() as any[];
  
  const packages: Package[] = pkgRows.map(p => ({
    package_id: p.package_id,
    name: p.name,
    type: p.type,
    season_id: p.season_id,
    season_name: p.season_name,
    description: p.description,
    start_date: p.start_date,
    end_date: p.end_date,
    duration_days: p.duration_days,
    departure_city: p.departure_city,
    departure_airport: p.departure_airport,
    arrival_airport: p.arrival_airport,
    airline: p.airline,
    makkah_hotel_id: p.makkah_hotel_id,
    makkah_hotel_name: p.makkah_hotel_name,
    makkah_hotel_dist: p.makkah_hotel_dist,
    madinah_hotel_id: p.madinah_hotel_id,
    madinah_hotel_name: p.madinah_hotel_name,
    madinah_hotel_dist: p.madinah_hotel_dist,
    hotel_category: p.hotel_category,
    morshid_id: p.morshid_id,
    morshid_name: p.morshid_name,
    prices: priceRows.filter(pr => pr.package_id === p.package_id).map(pr => ({
      room_type: pr.room_type,
      traveler_type: pr.traveler_type,
      currency: pr.currency,
      amount: pr.amount
    })),
    included_services: JSON.parse(p.included_services || '[]'),
    excluded_services: JSON.parse(p.excluded_services || '[]'),
    booking_conditions: JSON.parse(p.booking_conditions || '[]'),
    cancellation_policy: p.cancellation_policy,
    capacity: p.capacity,
    reserved: p.reserved,
    available: p.available,
    status: p.status,
    published: Boolean(p.published),
    image_url: p.image_url
  }));

  // Load Receipts
  const receipts = db.prepare('SELECT * FROM receipts').all() as Receipt[];

  // Load Messages
  const msgRows = db.prepare('SELECT * FROM messages').all() as any[];
  const messages: Message[] = msgRows.map(m => ({
    ...m,
    isUrgent: Boolean(m.isUrgent)
  }));

  // Load Audit Logs
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all() as AuditLog[];

  return {
    securityKey: agencyRow?.security_key || DEFAULT_SECURITY_KEY,
    users,
    sessions,
    accessRequests,
    aiKnowledge,
    appUsers,
    messages,
    receipts,
    auditLogs,
    agencySettings,
    seasons,
    hotels,
    flights,
    morshids,
    packages,
    reservations: [],
    documents: [],
    mediaAssets: [],
    aiConversations: []
  };
}

export function saveDatabase(dbSchema: DatabaseSchema): void {
  const db = getSqliteDb();

  // Persist Users
  if (dbSchema.users) {
    const upsertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, code, name, email, username, passwordHash, role, roleName, status, phone, avatar, room,
        createdAt, lastLoginIp, pcFingerprint, requiresFileKey, staffId, loginEnabled,
        usernameHash, emailHash, codeHash, qrSecretHash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const u of dbSchema.users) {
        upsertUser.run(
          u.id,
          u.code || u.id,
          u.name,
          u.email,
          u.username || '',
          u.passwordHash,
          u.role,
          u.roleName || u.role || 'ROLE',
          u.status || 'APPROVED',
          u.phone || '',
          (u as any).avatar || (u.name ? u.name.charAt(0) : 'ع'),
          (u as any).room || '',
          u.createdAt || new Date().toISOString(),
          u.lastLoginIp || '',
          u.pcFingerprint || '',
          u.requiresFileKey ? 1 : 0,
          u.staffId || '',
          u.loginEnabled === false ? 0 : 1,
          u.usernameHash || '',
          u.emailHash || '',
          u.codeHash || '',
          u.qrSecretHash || ''
        );
      }
    })();
  }

  // Persist AI Knowledge
  if (dbSchema.aiKnowledge) {
    db.transaction(() => {
      db.prepare('DELETE FROM ai_knowledge').run();
      const insertRule = db.prepare(`
        INSERT INTO ai_knowledge (id, category, title_ar, keywords, response_ar, is_active, updatedBy, updatedAt, qualityRating, modelAnswer, answerMode, matchStrategy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of dbSchema.aiKnowledge) {
        insertRule.run(
          r.id,
          r.category,
          r.title_ar,
          JSON.stringify(r.keywords || []),
          r.response_ar,
          r.is_active ? 1 : 0,
          r.updatedBy || '',
          r.updatedAt || new Date().toISOString(),
          r.qualityRating || null,
          r.modelAnswer || null,
          r.answerMode || 'official_exact',
          r.matchStrategy || 'keywords_or_title'
        );
      }
    })();
  }

  // Persist Sessions
  if (dbSchema.sessions) {
    db.transaction(() => {
      db.prepare('DELETE FROM sessions').run();
      const insertSess = db.prepare(`
        INSERT INTO sessions (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, loginTime, lastActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of dbSchema.sessions) {
        insertSess.run(s.id, s.userId, s.userName, s.userEmail, s.userRole, s.ip, s.pcPrint, s.userAgent, s.loginTime, s.lastActive);
      }
    })();
  }

  // Persist Access Requests
  if (dbSchema.accessRequests) {
    db.transaction(() => {
      db.prepare('DELETE FROM access_requests').run();
      const insertReq = db.prepare(`
        INSERT INTO access_requests (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, requestTime, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of dbSchema.accessRequests) {
        insertReq.run(r.id, r.userId, r.userName, r.userEmail, r.userRole, r.ip, r.pcPrint, r.userAgent, r.requestTime, r.status);
      }
    })();
  }

  if (dbSchema.securityKey) {
    try {
      db.prepare("UPDATE agency_settings SET security_key = ? WHERE id = 'main'").run(dbSchema.securityKey);
    } catch {
      /* column may not exist yet */
    }
  }
}

export function dbGetAgencySettings(): AgencySettings {
  const db = getDatabase();
  return db.agencySettings || {} as AgencySettings;
}

export function dbLogAiConversation(sessionId: string, prompt: string, responseText: string, rating?: string) {
  const db = getSqliteDb();
  dbLogAudit('Sakhr AI', 'SYSTEM', 'AI_CONVERSATION', `Prompt: ${prompt.substring(0, 100)} | Response: ${responseText.substring(0, 100)}`);
}

export function dbGetUsers(): User[] {
  const db = getDatabase();
  return db.appUsers || [];
}

export function dbFindUserByCode(code: string): User | null {
  const { lookupHash } = require('./db-crypto') as typeof import('./db-crypto');
  const db = getSqliteDb();
  const clean = (code || '').trim();
  if (!clean) return null;
  const row = db.prepare('SELECT * FROM users WHERE codeHash = ? OR code = ?').get(lookupHash(clean), clean.toUpperCase()) as any;
  if (row) {
    return {
      id: row.id,
      code: row.code || row.username || row.id,
      name: row.name,
      role: row.role,
      roleName: row.roleName || row.role,
      email: row.email,
      phone: row.phone || '',
      avatar: row.avatar || (row.name ? row.name.charAt(0) : 'م'),
      username: row.username,
    };
  }
  const users = dbGetUsers();
  const cleanCode = clean.toUpperCase();
  return users.find(u => (u.code || '').toUpperCase() === cleanCode) || null;
}

export function dbCreateUser(userData: {
  name: string;
  role: UserRole;
  roleName: string;
  phone?: string;
  code: string;
  email?: string;
  username?: string;
  password?: string;
}): User {
  const { ensureUserAccount } = require('./accounts') as typeof import('./accounts');
  const issued = ensureUserAccount({
    name: userData.name,
    role: userData.role,
    roleName: userData.roleName,
    phone: userData.phone,
    email: userData.email,
    username: userData.username || userData.code,
    password: userData.password,
  });

  return {
    id: issued.userId,
    code: userData.code || issued.username,
    name: issued.name,
    role: issued.role as UserRole,
    roleName: issued.roleName,
    phone: userData.phone || '',
    avatar: issued.name ? issued.name.charAt(0) : 'م',
    email: issued.email,
    username: issued.username,
    status: 'نشط'
  };
}

export function dbGetAuditLogs(): AuditLog[] {
  const db = getSqliteDb();
  return db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all() as AuditLog[];
}

export function dbLogAudit(
  actorName: string,
  actorRole: string,
  action: string,
  details: string,
  ip: string = ''
): AuditLog {
  const log: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorName: actorName || 'غير معروف',
    actorRole: actorRole || 'مستخدم',
    action: action || '',
    details: details || '',
    ip: ip || '127.0.0.1'
  };

  try {
    const db = getSqliteDb();
    const cols = new Set(
      (db.prepare('PRAGMA table_info(audit_logs)').all() as { name: string }[]).map((c) => c.name)
    );
    const payload: Record<string, unknown> = { id: log.id };
    const put = (camel: string, snake: string, value: unknown) => {
      if (cols.has(camel)) payload[camel] = value;
      else if (cols.has(snake)) payload[snake] = value;
    };
    put('timestamp', 'timestamp', log.timestamp);
    put('actorName', 'actor_name', log.actorName);
    put('actorRole', 'actor_role', log.actorRole);
    put('action', 'action', log.action);
    put('details', 'details', log.details);
    put('ip', 'ip', log.ip);
    if (cols.has('actor_id') && payload.actor_id === undefined) payload.actor_id = 'SYSTEM';

    const keys = Object.keys(payload);
    if (keys.length > 1) {
      db.prepare(`INSERT INTO audit_logs (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
        .run(...keys.map((k) => payload[k]));
    }
  } catch (err) {
    console.warn('[Audit log skipped]:', err);
  }

  return log;
}

export function dbGetMessages(chatId: string): Message[] {
  const db = getSqliteDb();
  const rows = db.prepare('SELECT * FROM messages WHERE chatId = ?').all(chatId) as any[];
  return rows.map(m => ({
    ...m,
    isUrgent: Boolean(m.isUrgent)
  }));
}

export function dbSaveMessage(msg: Message): Message {
  const db = getSqliteDb();
  const savedMsg: Message = {
    ...msg,
    id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    time: msg.time || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
  };

  db.prepare(`
    INSERT INTO messages (id, chatId, senderId, senderName, senderAvatar, senderRole, text, time, isUrgent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    savedMsg.id,
    savedMsg.chatId,
    savedMsg.senderId,
    savedMsg.senderName,
    savedMsg.senderAvatar || null,
    savedMsg.senderRole,
    savedMsg.text,
    savedMsg.time,
    savedMsg.isUrgent ? 1 : 0
  );

  return savedMsg;
}

export function dbGetAppUsers(): User[] {
  return getDatabase().appUsers || [];
}

export function dbGetLastMessageForChat(chatId: string): { text: string; time: string; senderId: string } | null {
  const db = getSqliteDb();
  const row = db.prepare(
    'SELECT text, time, senderId FROM messages WHERE chatId = ? ORDER BY rowid DESC LIMIT 1'
  ).get(chatId) as any;
  return row || null;
}

export function dbGetReceipts(): Receipt[] {
  const db = getSqliteDb();
  return db.prepare('SELECT * FROM receipts').all() as Receipt[];
}

export function dbSaveReceipt(receipt: Receipt): Receipt {
  const db = getSqliteDb();
  const savedReceipt: Receipt = {
    ...receipt,
    id: receipt.id || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
    date: receipt.date || new Date().toISOString().split('T')[0],
    status: receipt.status || 'مكتمل'
  };

  db.prepare(`
    INSERT INTO receipts (id, pilgrimName, pilgrimCode, packageName, totalAmount, paidAmount, remainingAmount, paymentMethod, date, accountantName, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    savedReceipt.id,
    savedReceipt.pilgrimName,
    savedReceipt.pilgrimCode,
    savedReceipt.packageName,
    savedReceipt.totalAmount,
    savedReceipt.paidAmount,
    savedReceipt.remainingAmount,
    savedReceipt.paymentMethod,
    savedReceipt.date,
    savedReceipt.accountantName,
    savedReceipt.status
  );

  return savedReceipt;
}

export function dbGetPackages(): Package[] {
  const db = getDatabase();
  return db.packages || [];
}

export function dbGetPackageById(packageId: string): Package | null {
  const packages = dbGetPackages();
  return packages.find(p => p.package_id === packageId) || null;
}

