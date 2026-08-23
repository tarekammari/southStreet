import crypto from 'crypto';
import { getSqliteDb } from './sqlite';
import { lookupHash, generatePassword, generateSecret } from './db-crypto';
import { hashPassword, verifyPassword } from './security';
import {
  LoginRole,
  LOGIN_ROLE_LABELS,
  loginRoleFromStaff,
  normalizeLoginRole,
  requiresSecurityKey,
  toPortalRole,
} from './roles';

export interface IssuedCredentials {
  userId: string;
  staffId?: string;
  name: string;
  username: string;
  email: string;
  role: LoginRole;
  roleName: string;
  password?: string;
  qrPayload: string;
  created: boolean;
}

export interface PublicAccountView {
  userId: string;
  staffId?: string;
  name: string;
  username: string;
  email: string;
  role: LoginRole;
  roleName: string;
  loginEnabled: boolean;
  hasPassword: boolean;
  hasQr: boolean;
  googleLinked?: boolean;
  status?: string;
}

const QR_ISSUER = 'southstreet';

export function buildQrPayload(username: string, secret: string): string {
  const body = Buffer.from(
    JSON.stringify({ v: 1, iss: QR_ISSUER, u: username, k: secret }),
    'utf8'
  ).toString('base64url');
  return `SSQR1.${body}`;
}

export function parseQrPayload(raw: string): { username: string; secret: string } | null {
  const text = (raw || '').trim();
  if (!text) return null;

  let encoded = text;
  if (text.startsWith('SSQR1.')) encoded = text.slice(6);
  else if (text.includes('SSQR1.')) encoded = text.slice(text.indexOf('SSQR1.') + 6);

  try {
    const json = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (json?.iss && json.iss !== QR_ISSUER) return null;
    if (!json?.u || !json?.k) return null;
    return { username: String(json.u), secret: String(json.k) };
  } catch {
    return null;
  }
}

export function hashQrSecret(secret: string): string {
  return crypto.createHmac('sha256', process.env.DB_LOOKUP_SECRET || process.env.DB_ENCRYPTION_SECRET || 'SouthStreet-AES-256-SuperSecretKey-2026!')
    .update(secret)
    .digest('hex');
}

function suggestUsername(name: string, id: string, email?: string): string {
  const emailLocal = (email || '').split('@')[0].replace(/[^a-z0-9._-]/gi, '');
  if (emailLocal.length >= 3) return emailLocal.toLowerCase();

  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
  if (ascii.length >= 3) return ascii.slice(0, 24);

  const compact = id.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user';
  return `ss.${compact}`.slice(0, 24);
}

function uniqueUsername(db: ReturnType<typeof getSqliteDb>, desired: string, excludeUserId?: string): string {
  const base = (desired || 'user').toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
  let candidate = base;
  let n = 2;
  while (true) {
    const row = db.prepare('SELECT id FROM users WHERE usernameHash = ?').get(lookupHash(candidate)) as { id?: string } | undefined;
    if (!row || row.id === excludeUserId) return candidate;
    candidate = `${base}${n}`.slice(0, 28);
    n += 1;
  }
}

function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function usersTableInfo(db: ReturnType<typeof getSqliteDb>) {
  return db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number; dflt_value: unknown; pk: number }[];
}

function usersTableSql(db: ReturnType<typeof getSqliteDb>): string {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get() as { sql?: string } | undefined;
  return row?.sql || '';
}

function roleForLegacyCheck(role: string, tableSql: string): string {
  if (!/CHECK\s*\(\s*role\s+IN/i.test(tableSql)) return normalizeLoginRole(role);
  const portal = toPortalRole(role);
  return portal === 'agent' ? 'manager' : portal;
}

/** Writes camelCase fields and their snake_case twins (code_hash, role_name, …). */
function assignUserColumns(
  names: Set<string>,
  payload: Record<string, unknown>,
  logical: string,
  value: unknown
) {
  if (names.has(logical) && payload[logical] === undefined) payload[logical] = value;
  const snake = camelToSnake(logical);
  if (snake !== logical && names.has(snake) && payload[snake] === undefined) payload[snake] = value;
}

function insertUserRow(db: ReturnType<typeof getSqliteDb>, row: Record<string, unknown>) {
  const info = usersTableInfo(db);
  const names = new Set(info.map((c) => c.name));
  const tableSql = usersTableSql(db);
  const payload: Record<string, unknown> = {};

  if (typeof row.role === 'string') {
    row = { ...row, role: roleForLegacyCheck(row.role, tableSql) };
  }

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    assignUserColumns(names, payload, key, value);
  }

  for (const col of info) {
    if (!col.notnull || col.pk) continue;
    if (payload[col.name] != null && String(payload[col.name]) !== '') continue;
    if (col.dflt_value != null) continue;
    if (col.name === 'code_hash' || col.name === 'codeHash') {
      payload[col.name] = row.codeHash || lookupHash(String(row.code || row.id || 'ss'));
    }
  }

  const keys = Object.keys(payload);
  db.prepare(`INSERT INTO users (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .run(...keys.map((k) => payload[k]));
}

function rowToView(row: any): PublicAccountView {
  return {
    userId: row.id,
    staffId: row.staffId || undefined,
    name: row.name,
    username: row.username || '',
    email: row.email || '',
    role: normalizeLoginRole(row.role, { email: row.email, roleName: row.roleName }),
    roleName: row.roleName || LOGIN_ROLE_LABELS[normalizeLoginRole(row.role)],
    loginEnabled: row.loginEnabled !== 0 && row.status !== 'SUSPENDED' && row.status !== 'REJECTED',
    hasPassword: Boolean(row.passwordHash || row.password_hash),
    hasQr: Boolean(row.qrSecretHash || row.qr_secret_hash),
    googleLinked: Boolean(row.googleId || row.google_id),
    status: row.status || 'APPROVED',
  };
}

export function findUserForLogin(identifier: string): any | null {
  const db = getSqliteDb();
  const clean = (identifier || '').trim();
  if (!clean) return null;
  const hash = lookupHash(clean);
  if (hash) {
    const byHash =
      (db.prepare('SELECT * FROM users WHERE usernameHash = ?').get(hash) as any) ||
      (db.prepare('SELECT * FROM users WHERE emailHash = ?').get(hash) as any) ||
      (db.prepare('SELECT * FROM users WHERE codeHash = ?').get(hash) as any);
    if (byHash) return byHash;
  }

  const needle = clean.toLowerCase();
  const users = db.prepare('SELECT * FROM users').all() as any[];
  return (
    users.find((u) =>
      String(u.username || '').toLowerCase() === needle ||
      String(u.email || '').toLowerCase() === needle ||
      String(u.code || '').toLowerCase() === needle ||
      String(u.id || '').toLowerCase() === needle
    ) || null
  );
}

export function findUserByQr(payload: string): { user: any; secret: string } | null {
  const parsed = parseQrPayload(payload);
  if (!parsed) return null;
  const user = findUserForLogin(parsed.username);
  if (!user?.qrSecretHash) return null;
  const expected = hashQrSecret(parsed.secret);
  if (expected !== user.qrSecretHash) return null;
  return { user, secret: parsed.secret };
}

function persistHashes(db: ReturnType<typeof getSqliteDb>, userId: string, fields: {
  username?: string;
  email?: string;
  code?: string;
  qrSecret?: string;
  password?: string;
}) {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!current) return;

  const username = fields.username ?? current.username;
  const email = fields.email ?? current.email;
  const code = fields.code ?? current.code;
  const qrSecretHash = fields.qrSecret ? hashQrSecret(fields.qrSecret) : current.qrSecretHash;
  const passwordHash = fields.password ? hashPassword(fields.password) : current.passwordHash;

  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name)
  );
  const ensure = (name: string, def: string) => {
    if (existingCols.has(name)) return;
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
      existingCols.add(name);
    } catch {
      /* already added or unavailable */
    }
  };
  ensure('email', 'TEXT');
  ensure('emailHash', 'TEXT');
  ensure('username', 'TEXT');
  ensure('usernameHash', 'TEXT');
  ensure('codeHash', 'TEXT');
  ensure('qrSecretHash', 'TEXT');
  ensure('passwordHash', 'TEXT');

  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, val: unknown) => {
    if (!existingCols.has(col)) return;
    sets.push(`${col} = ?`);
    vals.push(val);
  };
  add('username', username || '');
  add('usernameHash', username ? lookupHash(username) : current.usernameHash || '');
  add('email', email || '');
  add('emailHash', email ? lookupHash(email) : current.emailHash || '');
  add('code', code || '');
  add('codeHash', code ? lookupHash(code) : current.codeHash || current.code_hash || '');
  add('code_hash', code ? lookupHash(code) : current.code_hash || current.codeHash || '');
  add('qrSecretHash', qrSecretHash || '');
  add('qr_secret_hash', qrSecretHash || '');
  add('passwordHash', passwordHash);
  add('password_hash', passwordHash);

  if (sets.length === 0) return;
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, userId);
}

export function issueQrSecret(userId: string): { qrPayload: string; username: string } {
  const db = getSqliteDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) throw new Error('المستخدم غير موجود');
  const secret = generateSecret(24);
  const username = user.username || uniqueUsername(db, suggestUsername(user.name, user.id, user.email), user.id);
  persistHashes(db, userId, { username, qrSecret: secret });
  return { qrPayload: buildQrPayload(username, secret), username };
}

export function rotatePassword(userId: string, password?: string): string {
  const next = password?.trim() || generatePassword();
  persistHashes(getSqliteDb(), userId, { password: next });
  return next;
}

export function changeOwnPassword(userId: string, currentPassword: string, nextPassword: string): void {
  const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) throw new Error('المستخدم غير موجود');
  if (!verifyPassword(currentPassword, user.passwordHash || user.password_hash)) {
    throw new Error('كلمة المرور الحالية غير صحيحة');
  }
  const next = nextPassword.trim();
  if (next.length < 8) throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
  if (currentPassword === next) throw new Error('اختر كلمة مرور مختلفة عن الحالية');
  rotatePassword(userId, next);
}

export function rotateOwnQr(userId: string, currentPassword: string): { qrPayload: string; username: string } {
  const user = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) throw new Error('المستخدم غير موجود');
  if (!verifyPassword(currentPassword, user.passwordHash || user.password_hash)) {
    throw new Error('كلمة المرور الحالية غير صحيحة');
  }
  return issueQrSecret(userId);
}

export function getAccountByUserId(userId: string): PublicAccountView | null {
  const row = getSqliteDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  return row ? rowToView(row) : null;
}

export function getAccountByStaffId(staffId: string): PublicAccountView | null {
  const row = getSqliteDb().prepare('SELECT * FROM users WHERE staffId = ?').get(staffId) as any;
  return row ? rowToView(row) : null;
}

export function ensureUserAccount(input: {
  id?: string;
  staffId?: string;
  name: string;
  email?: string;
  username?: string;
  password?: string;
  role: string;
  roleName?: string;
  phone?: string;
  status?: string;
  issueSecrets?: boolean;
}): IssuedCredentials {
  const db = getSqliteDb();
  const role = normalizeLoginRole(input.role, {
    email: input.email,
    roleName: input.roleName,
  });
  const roleName = input.roleName || LOGIN_ROLE_LABELS[role];

  let existing: any = null;
  if (input.id) existing = db.prepare('SELECT * FROM users WHERE id = ?').get(input.id);
  if (!existing && input.staffId) existing = db.prepare('SELECT * FROM users WHERE staffId = ?').get(input.staffId);
  if (!existing && input.email) existing = db.prepare('SELECT * FROM users WHERE emailHash = ?').get(lookupHash(input.email));

  const id = existing?.id || input.id || `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const username = uniqueUsername(
    db,
    input.username || existing?.username || suggestUsername(input.name, input.staffId || id, input.email),
    id
  );
  const email = (input.email || existing?.email || `${username}@southstreet.dz`).trim().toLowerCase();
  const code = existing?.code || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
  const password = input.password?.trim() || (existing ? undefined : generatePassword());
  const issueQr = input.issueSecrets !== false && (!existing || !existing.qrSecretHash);
  const qrSecret = issueQr ? generateSecret(24) : undefined;
  const created = !existing;

  if (!existing) {
    insertUserRow(db, {
      id,
      code,
      codeHash: lookupHash(code),
      name: input.name,
      email,
      emailHash: lookupHash(email),
      username,
      usernameHash: lookupHash(username),
      passwordHash: hashPassword(password || generatePassword()),
      role,
      roleName,
      status: input.status || 'APPROVED',
      phone: input.phone || '',
      avatar: input.name ? input.name.charAt(0) : 'م',
      room: '',
      createdAt: new Date().toISOString(),
      requiresFileKey: requiresSecurityKey(role) ? 1 : 0,
      staffId: input.staffId || '',
      qrSecretHash: qrSecret ? hashQrSecret(qrSecret) : '',
      loginEnabled: input.status === 'PENDING_APPROVAL' || input.status === 'PENDING' ? 0 : 1,
    });
  } else {
    const tableSql = usersTableSql(db);
    db.prepare(`
      UPDATE users SET
        name = ?, role = ?, roleName = ?, phone = COALESCE(NULLIF(?, ''), phone),
        staffId = COALESCE(NULLIF(?, ''), staffId),
        requiresFileKey = ?,
        loginEnabled = 1
      WHERE id = ?
    `).run(
      input.name || existing.name,
      roleForLegacyCheck(role, tableSql),
      roleName,
      input.phone || '',
      input.staffId || '',
      requiresSecurityKey(role) ? 1 : 0,
      id
    );
    persistHashes(db, id, {
      username,
      email,
      code,
      password,
      qrSecret,
    });
  }

  const qrPayload = qrSecret
    ? buildQrPayload(username, qrSecret)
    : existing?.qrSecretHash
      ? ''
      : '';

  return {
    userId: id,
    staffId: input.staffId,
    name: input.name,
    username,
    email,
    role,
    roleName,
    password,
    qrPayload,
    created,
  };
}

export function ensureStaffLogin(staff: {
  morshid_id: string;
  name: string;
  roleName?: string;
  category?: string;
  status?: string;
  phone?: string;
}): IssuedCredentials {
  const role = loginRoleFromStaff(staff.category, staff.roleName, staff.status);
  return ensureUserAccount({
    staffId: staff.morshid_id,
    name: staff.name,
    phone: staff.phone,
    role,
    roleName: staff.roleName,
    issueSecrets: true,
  });
}

export function backfillStaffAccounts(): void {
  const db = getSqliteDb();
  const staff = db.prepare('SELECT * FROM morshids').all() as any[];
  for (const member of staff) {
    if (!member?.morshid_id || !member?.name) continue;
    const existing = db.prepare('SELECT id FROM users WHERE staffId = ?').get(member.morshid_id);
    if (existing) continue;
    ensureStaffLogin(member);
  }
}

export function backfillUserLookupHashes(): void {
  const db = getSqliteDb();
  const users = db.prepare('SELECT * FROM users').all() as any[];
  for (const user of users) {
    const username = user.username || suggestUsername(user.name || 'user', user.id, user.email);
    persistHashes(db, user.id, {
      username,
      email: user.email,
      code: user.code,
    });
    if (!user.qrSecretHash) {
      try {
        issueQrSecret(user.id);
      } catch {
        /* ignore */
      }
    }
  }
}

export function queueAccessRequest(input: {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  pcPrint?: string;
  userAgent?: string;
}) {
  const db = getSqliteDb();
  const existing = db.prepare('SELECT id FROM access_requests WHERE userId = ? AND status = ?')
    .get(input.userId, 'PENDING_APPROVAL') as { id?: string } | undefined;
  if (existing) return;
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    db.prepare(`
      INSERT INTO access_requests (id, userId, userName, userEmail, userRole, ip, pcPrint, userAgent, requestTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.userId,
      input.userName,
      input.userEmail || '',
      input.userRole || 'PILGRIM_USER',
      input.ip || '',
      input.pcPrint || '',
      input.userAgent || '',
      new Date().toISOString(),
      'PENDING_APPROVAL'
    );
  } catch {
    /* table may use a different shape */
  }
}

export function registerSelfAccount(input: {
  name: string;
  username: string;
  password: string;
  email?: string;
  phone?: string;
  googleId?: string;
  ip?: string;
  pcPrint?: string;
  userAgent?: string;
}): { userId: string; username: string; status: string } {
  const name = input.name.trim();
  let username = input.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const password = input.password.trim();
  const email = (input.email || '').trim().toLowerCase();
  if (username.length < 3) {
    username = (email.split('@')[0] || 'member').toLowerCase().replace(/[^a-z0-9._-]/g, '');
  }
  if (username.length < 3) username = `member${Date.now().toString().slice(-6)}`;

  if (name.length < 2) throw new Error('الاسم مطلوب');
  if (username.length < 3) throw new Error('اسم المستخدم يجب ألا يقل عن 3 أحرف');
  if (!input.googleId && password.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
  if (findUserForLogin(username)) throw new Error('اسم المستخدم مستخدم مسبقاً');
  if (email && findUserForLogin(email)) throw new Error('البريد الإلكتروني مسجّل مسبقاً');

  const issued = ensureUserAccount({
    name,
    username,
    email: email || undefined,
    password: password || generatePassword(),
    phone: input.phone,
    role: 'PILGRIM_USER',
    roleName: LOGIN_ROLE_LABELS.PILGRIM_USER,
    status: 'PENDING_APPROVAL',
    issueSecrets: false,
  });

  const db = getSqliteDb();
  if (input.googleId) {
    const cols = new Set(usersTableInfo(db).map((c) => c.name));
    if (cols.has('googleId')) db.prepare('UPDATE users SET googleId = ? WHERE id = ?').run(input.googleId, issued.userId);
    if (cols.has('google_id')) db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(input.googleId, issued.userId);
  }

  queueAccessRequest({
    userId: issued.userId,
    userName: name,
    userEmail: email || issued.email,
    userRole: 'PILGRIM_USER',
    ip: input.ip,
    pcPrint: input.pcPrint,
    userAgent: input.userAgent,
  });

  return { userId: issued.userId, username: issued.username, status: 'PENDING_APPROVAL' };
}

export function findUserByGoogleId(googleId: string): any | null {
  if (!googleId) return null;
  const db = getSqliteDb();
  const cols = new Set(usersTableInfo(db).map((c) => c.name));
  if (cols.has('googleId')) {
    const row = db.prepare('SELECT * FROM users WHERE googleId = ?').get(googleId) as any;
    if (row) return row;
  }
  if (cols.has('google_id')) {
    const row = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as any;
    if (row) return row;
  }
  return null;
}

export function attachGoogleId(userId: string, googleId: string) {
  const db = getSqliteDb();
  const cols = new Set(usersTableInfo(db).map((c) => c.name));
  if (cols.has('googleId')) db.prepare('UPDATE users SET googleId = ? WHERE id = ?').run(googleId, userId);
  if (cols.has('google_id')) db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, userId);
}

export function updateUserAccess(userId: string, patch: {
  status?: string;
  role?: string;
  roleName?: string;
  loginEnabled?: number;
}) {
  const db = getSqliteDb();
  const info = usersTableInfo(db);
  const names = new Set(info.map((c) => c.name));
  const tableSql = usersTableSql(db);
  const payload: Record<string, unknown> = {};

  if (patch.status != null) assignUserColumns(names, payload, 'status', patch.status);
  if (patch.role != null) {
    const role = normalizeLoginRole(patch.role);
    assignUserColumns(names, payload, 'role', roleForLegacyCheck(role, tableSql));
    assignUserColumns(names, payload, 'roleName', patch.roleName || LOGIN_ROLE_LABELS[role]);
    assignUserColumns(names, payload, 'requiresFileKey', requiresSecurityKey(role) ? 1 : 0);
  }
  if (patch.loginEnabled != null) assignUserColumns(names, payload, 'loginEnabled', patch.loginEnabled);

  const keys = Object.keys(payload);
  if (keys.length === 0) return;
  db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .run(...keys.map((k) => payload[k]), userId);

  if (patch.status) {
    try {
      db.prepare('UPDATE access_requests SET status = ? WHERE userId = ?')
        .run(patch.status === 'APPROVED' ? 'APPROVED' : patch.status, userId);
    } catch {
      /* ignore */
    }
  }
}

export function repairSuperAdminLogin(): void {
  ensureUserAccount({
    id: 'usr_super_admin',
    name: 'طارق العماري (المدير العام)',
    email: 'admin@southstreet.dz',
    username: 'admin',
    password: 'Admin@2026!',
    role: 'SUPER_ADMIN',
    roleName: 'مدير النظام العام',
    status: 'APPROVED',
    issueSecrets: false,
  });
  updateUserAccess('usr_super_admin', {
    status: 'APPROVED',
    role: 'SUPER_ADMIN',
    roleName: 'مدير النظام العام',
    loginEnabled: 1,
  });
}
