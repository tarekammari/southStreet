/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║         SOUTH STREET — PRODUCTION SERVER v2.0                    ║
 * ║         Express + Socket.io + SQLite + JWT + WebRTC Signaling    ║
 * ║         E2E Encryption: Server NEVER sees plaintext messages     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const { createServer } = require('http');
const { Server: IOServer } = require('socket.io');
const Database     = require('better-sqlite3');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const fs           = require('fs');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const PORT         = process.env.PORT || 3000;
const JWT_SECRET   = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN || '24h';
const DB_PATH      = process.env.DB_PATH || './south_street.db';
const SALT_ROUNDS  = 12;

const ICE_SERVERS = [];
if (process.env.STUN_SERVER) ICE_SERVERS.push({ urls: process.env.STUN_SERVER });
else ICE_SERVERS.push({ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' });

// ─────────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    code_hash   TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('admin','manager','murshid','accountant','pilgrim')),
    role_name   TEXT NOT NULL,
    phone       TEXT DEFAULT '',
    avatar      TEXT DEFAULT '',
    room        TEXT DEFAULT '',
    public_key  TEXT DEFAULT '',
    status      TEXT DEFAULT 'نشط',
    created_at  INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            TEXT PRIMARY KEY,
    chat_id       TEXT NOT NULL,
    sender_id     TEXT NOT NULL,
    sender_name   TEXT NOT NULL,
    sender_role   TEXT NOT NULL,
    iv            TEXT NOT NULL,
    ciphertext    TEXT NOT NULL,
    enc_keys      TEXT DEFAULT '[]',
    msg_type      TEXT DEFAULT 'text',
    call_type     TEXT DEFAULT '',
    call_duration TEXT DEFAULT '',
    missed        INTEGER DEFAULT 0,
    timestamp     INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id            TEXT PRIMARY KEY,
    encrypted_data TEXT NOT NULL,
    iv            TEXT NOT NULL,
    created_by    TEXT NOT NULL,
    created_at    INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    actor_id    TEXT,
    actor_name  TEXT,
    actor_role  TEXT,
    action      TEXT,
    details     TEXT,
    ip          TEXT,
    timestamp   INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS public_keys (
    user_id     TEXT PRIMARY KEY,
    public_key  TEXT NOT NULL,
    updated_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp);
`);

// ─────────────────────────────────────────────
// SEED DEFAULT USERS
// ─────────────────────────────────────────────
const seedUsers = [
  { id:'USR-001', code:'ADMIN-2026',   name:'د. عبد الرحمن العتيبي',    role:'admin',       roleName:'مدير النظام',       phone:'+966501234567', avatar:'ع' },
  { id:'USR-002', code:'MANAGER-99',   name:'الأستاذ طارق السعيد',       role:'manager',     roleName:'مسير الحملات',      phone:'+966559876543', avatar:'ط' },
  { id:'USR-003', code:'GUIDE-777',    name:'الشيخ أحمد بن علي',         role:'murshid',     roleName:'مرشد ديني',         phone:'+966544443322', avatar:'أ' },
  { id:'USR-004', code:'ACC-404',      name:'الأستاذ ياسين الفاسي',       role:'accountant',  roleName:'محاسب الوكالة',     phone:'+966561118899', avatar:'ي' },
  { id:'USR-005', code:'PILGRIM-101',  name:'محمد عبد الله الشمري',       role:'pilgrim',     roleName:'معتمر',             phone:'+966597770011', avatar:'م', room:'1402 - سويس أوتيل مكة' },
  { id:'USR-006', code:'PILGRIM-102',  name:'فاطمة الزهراء البقمي',       role:'pilgrim',     roleName:'معتمرة',            phone:'+966598882233', avatar:'ف', room:'1405 - سويس أوتيل مكة' },
];

const seedStmt = db.prepare(`
  INSERT OR IGNORE INTO users (id, code_hash, name, role, role_name, phone, avatar, room)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedTx = db.transaction(() => {
  for (const u of seedUsers) {
    const hash = bcrypt.hashSync(u.code, SALT_ROUNDS);
    seedStmt.run(u.id, hash, u.name, u.role, u.roleName, u.phone || '', u.avatar || '', u.room || '');
  }
});
seedTx();

// ─────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────
const db_findByCode = (code) => {
  const users = db.prepare('SELECT * FROM users').all();
  for (const u of users) {
    if (bcrypt.compareSync(code.trim().toUpperCase(), u.code_hash)) return u;
    const seed = seedUsers.find(s => s.id === u.id);
    if (seed && seed.code.toUpperCase() === code.trim().toUpperCase()) return u;
  }
  return null;
};

const db_createUser = (user) => {
  const hash = bcrypt.hashSync(user.code, SALT_ROUNDS);
  db.prepare(`
    INSERT INTO users (id, code_hash, name, role, role_name, phone, avatar, room, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, hash, user.name, user.role, user.roleName, user.phone||'', user.avatar||'', user.room||'', 'نشط');
  return { ...user, code_hash: undefined };
};

const db_getUsers = () => db.prepare('SELECT id,name,role,role_name,phone,avatar,room,status FROM users').all();

const db_saveMessage = (msg) => {
  db.prepare(`
    INSERT INTO messages (id,chat_id,sender_id,sender_name,sender_role,iv,ciphertext,enc_keys,msg_type,call_type,call_duration,missed,timestamp)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    msg.id, msg.chatId, msg.senderId, msg.senderName, msg.senderRole,
    msg.iv, msg.ciphertext, JSON.stringify(msg.encKeys||[]),
    msg.type||'text', msg.callType||'', msg.duration||'', msg.missed?1:0,
    Math.floor(Date.now()/1000)
  );
};

const db_getMessages = (chatId, limit=100) => {
  return db.prepare(`
    SELECT * FROM messages WHERE chat_id=? ORDER BY timestamp DESC LIMIT ?
  `).all(chatId, limit).reverse();
};

const db_savePublicKey = (userId, publicKey) => {
  db.prepare(`
    INSERT OR REPLACE INTO public_keys (user_id, public_key, updated_at)
    VALUES (?,?,unixepoch())
  `).run(userId, publicKey);
};

const db_getPublicKey = (userId) => {
  const row = db.prepare('SELECT public_key FROM public_keys WHERE user_id=?').get(userId);
  return row ? row.public_key : null;
};

const db_getPublicKeys = () => db.prepare('SELECT user_id, public_key FROM public_keys').all();

const db_logAudit = (actorId, actorName, actorRole, action, details, ip) => {
  db.prepare(`
    INSERT INTO audit_logs (id,actor_id,actor_name,actor_role,action,details,ip)
    VALUES (?,?,?,?,?,?,?)
  `).run(uuidv4(), actorId||'SYSTEM', actorName||'System', actorRole||'system', action, details||'', ip||'');
};

const db_getAudit = (limit=50) => db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
const db_saveReceipt = (receipt) => db.prepare('INSERT INTO receipts (id,encrypted_data,iv,created_by) VALUES (?,?,?,?)').run(receipt.id, receipt.encryptedData, receipt.iv, receipt.createdBy);
const db_getReceipts = () => db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all();

// ─────────────────────────────────────────────
// JWT HELPERS
// ─────────────────────────────────────────────
const signToken = (user) => jwt.sign(
  { sub: user.id, name: user.name, role: user.role, roleName: user.role_name },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES, issuer: 'south-street', audience: 'ss-app' }
);

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'south-street', audience: 'ss-app' });
  } catch { return null; }
};

// ─────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────
const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static images from local 'images' directory
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/assets/images', express.static(path.join(__dirname, 'images')));

// Serve static frontend
app.use(express.static(path.join(__dirname, '.'), { index: 'index.html' }));

// Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '15'),
  message: { error: 'عدد كبير من المحاولات. انتظر 15 دقيقة.' }
});

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  req.user = decoded;
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Access forbidden' });
  next();
};

// REST ENDPOINTS
app.post('/auth/connect', authLimiter, (req, res) => {
  const { name, code } = req.body;
  if (!code) return res.status(400).json({ error: 'كود الوصول مطلوب' });
  const user = db_findByCode(code);
  if (!user) {
    db_logAudit(null, name||'Unknown', 'unknown', 'فشل تسجيل دخول', `كود غير صحيح`, req.ip);
    return res.status(401).json({ error: 'رمز الوصول غير صحيح أو منتهي الصلاحية.' });
  }
  const token = signToken(user);
  db_logAudit(user.id, user.name, user.role, 'تسجيل دخول ناجح', `IP: ${req.ip}`, req.ip);
  return res.json({ token, user: { id: user.id, name: user.name, role: user.role, roleName: user.role_name, avatar: user.avatar, phone: user.phone, room: user.room, status: user.status }, iceServers: ICE_SERVERS });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id,name,role,role_name,phone,avatar,room,status FROM users WHERE id=?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ ...user, roleName: user.role_name });
});

app.post('/api/keys', requireAuth, (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
  db_savePublicKey(req.user.sub, publicKey);
  io.emit('key:published', { userId: req.user.sub, publicKey });
  res.json({ ok: true });
});

app.get('/api/keys', requireAuth, (req, res) => res.json(db_getPublicKeys()));
app.get('/api/users', requireAuth, requireRole('admin','manager'), (req, res) => res.json(db_getUsers()));

app.post('/api/users', requireAuth, requireRole('admin','manager'), (req, res) => {
  const { name, role, phone, code, avatar, room } = req.body;
  if (!name || !role || !code) return res.status(400).json({ error: 'name, role, code are required' });
  const ROLE_NAMES = { pilgrim:'معتمر', murshid:'مرشد ديني', accountant:'محاسب الوكالة', manager:'مسير الحملات', admin:'مدير النظام' };
  const newUser = { id: `USR-${Math.floor(100 + Math.random() * 900)}`, code: code.toUpperCase(), name, role, roleName: ROLE_NAMES[role] || role, phone: phone || '', avatar: avatar || name[0] || '؟', room: room || '' };
  try {
    db_createUser(newUser);
    db_logAudit(req.user.sub, req.user.name, req.user.role, 'إنشاء مستخدم جديد', `${name} - كود: ${code}`, req.ip);
    io.emit('user:created', { id: newUser.id, name: newUser.name, role: newUser.role });
    res.json({ ok: true, user: { ...newUser, code } });
  } catch (e) { res.status(500).json({ error: 'فشل إنشاء المستخدم. ربما الكود مكرر.' }); }
});

app.get('/api/messages/:chatId', requireAuth, (req, res) => res.json(db_getMessages(req.params.chatId, 100)));
app.get('/api/receipts', requireAuth, requireRole('admin','manager','accountant'), (req, res) => res.json(db_getReceipts()));
app.post('/api/receipts', requireAuth, requireRole('admin','manager','accountant'), (req, res) => {
  const { id, encryptedData, iv } = req.body;
  if (!id || !encryptedData || !iv) return res.status(400).json({ error: 'Missing receipt data' });
  db_saveReceipt({ id, encryptedData, iv, createdBy: req.user.sub });
  res.json({ ok: true, id });
});
app.get('/api/audit', requireAuth, requireRole('admin'), (req, res) => res.json(db_getAudit(50)));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// SOCKET.IO SERVER
const httpServer = createServer(app);
const io = new IOServer(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ','');
  const decoded = verifyToken(token);
  if (!decoded) return next(new Error('Unauthorized'));
  socket.user = decoded;
  next();
});

io.on('connection', (socket) => {
  const user = socket.user;
  onlineUsers.set(socket.id, { userId: user.sub, name: user.name, role: user.role, socketId: socket.id });
  socket.join('all-users'); socket.join(`user:${user.sub}`); socket.join('chat:grp-makkah');

  socket.to('all-users').emit('presence:online', { userId: user.sub, name: user.name, role: user.role });
  socket.emit('presence:list', Array.from(onlineUsers.values()));

  socket.on('message:send', (payload, ack) => {
    if (!payload?.chatId || !payload?.iv || !payload?.ciphertext) return ack?.({ error: 'Invalid payload' });
    const msg = {
      id: payload.id || uuidv4(), chatId: payload.chatId, senderId: user.sub, senderName: user.name, senderRole: user.role,
      iv: payload.iv, ciphertext: payload.ciphertext, encKeys: payload.encKeys || [], type: payload.type || 'text',
      callType: payload.callType || '', duration: payload.duration || '', missed: payload.missed || false, timestamp: Math.floor(Date.now() / 1000)
    };
    db_saveMessage(msg);
    socket.to(`chat:${payload.chatId}`).emit('message:receive', msg);
    ack?.({ ok: true, id: msg.id, timestamp: msg.timestamp });
  });

  socket.on('key:publish', (data) => {
    if (data?.publicKey) { db_savePublicKey(user.sub, data.publicKey); socket.to('all-users').emit('key:published', { userId: user.sub, publicKey: data.publicKey }); }
  });

  // Signaling
  socket.on('call:initiate', (payload) => {
    if (payload?.targetUserId) io.to(`user:${payload.targetUserId}`).emit('call:incoming', { fromUserId: user.sub, fromName: user.name, fromAvatar: payload.fromAvatar || user.name[0], fromRole: user.role, callType: payload.callType || 'voice', callId: payload.callId || uuidv4() });
  });
  socket.on('call:offer', (payload) => {
    if (payload?.targetUserId) io.to(`user:${payload.targetUserId}`).emit('call:offer', { fromUserId: user.sub, callId: payload.callId, encryptedSdp: payload.encryptedSdp });
  });
  socket.on('call:answer', (payload) => {
    if (payload?.targetUserId) io.to(`user:${payload.targetUserId}`).emit('call:answer', { fromUserId: user.sub, callId: payload.callId, encryptedSdp: payload.encryptedSdp });
  });
  socket.on('call:ice', (payload) => {
    if (payload?.targetUserId) io.to(`user:${payload.targetUserId}`).emit('call:ice', { fromUserId: user.sub, candidate: payload.candidate });
  });
  socket.on('call:accepted', (payload) => io.to(`user:${payload.targetUserId}`).emit('call:accepted', { fromUserId: user.sub, callId: payload.callId }));
  socket.on('call:declined', (payload) => io.to(`user:${payload.targetUserId}`).emit('call:declined', { fromUserId: user.sub, callId: payload.callId }));
  socket.on('call:end', (payload) => io.to(`user:${payload.targetUserId}`).emit('call:ended', { fromUserId: user.sub, callId: payload.callId }));

  socket.on('disconnect', () => { onlineUsers.delete(socket.id); socket.to('all-users').emit('presence:offline', { userId: user.sub }); });
});

httpServer.listen(PORT, () => {
  console.log(`🕋 SOUTH STREET SERVER RUNNING AT http://localhost:${PORT}`);
});
