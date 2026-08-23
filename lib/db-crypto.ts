import crypto from 'crypto';

/**
 * Application-level AES-256-GCM for every sensitive SQLite TEXT value.
 * A stolen .db file is ciphertext; only this process (with DB_ENCRYPTION_SECRET) can read it.
 *
 * Wire format: SSENC1.<iv_b64url>.<tag_b64url>.<cipher_b64url>
 */

const PREFIX = 'SSENC1.';
const LEGACY_CBC_SEP = ':';

function encryptionSecret(): string {
  return (
    process.env.DB_ENCRYPTION_SECRET ||
    process.env.SERVER_ENCRYPTION_KEY ||
    'SouthStreet-AES-256-SuperSecretKey-2026!'
  );
}

function hmacSecret(): string {
  return process.env.DB_LOOKUP_SECRET || encryptionSecret();
}

let aesKey: Buffer | null = null;
function getAesKey(): Buffer {
  if (!aesKey) {
    aesKey = crypto.scryptSync(encryptionSecret(), 'southstreet-db-gcm-v1', 32);
  }
  return aesKey;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function isEncryptedValue(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function isLegacyCbcValue(value: unknown): boolean {
  if (typeof value !== 'string' || !value.includes(LEGACY_CBC_SEP)) return false;
  const [ivHex, rest] = value.split(LEGACY_CBC_SEP);
  return Boolean(ivHex && rest && /^[0-9a-f]+$/i.test(ivHex) && ivHex.length === 32);
}

/** HMAC used as a searchable index (email / username / access code) — not reversible. */
export function lookupHash(value: string): string {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  return crypto.createHmac('sha256', hmacSecret()).update(normalized).digest('hex');
}

export function encryptValue(plainText: unknown): string {
  if (plainText === null || plainText === undefined) return '';
  const text = typeof plainText === 'string' ? plainText : String(plainText);
  if (!text) return '';
  if (isEncryptedValue(text)) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${b64url(iv)}.${b64url(tag)}.${b64url(encrypted)}`;
}

export function decryptValue(stored: unknown): string {
  if (stored === null || stored === undefined) return '';
  if (typeof stored !== 'string') return String(stored);
  if (!stored) return '';

  if (isEncryptedValue(stored)) {
    try {
      const body = stored.slice(PREFIX.length);
      const [ivB64, tagB64, dataB64] = body.split('.');
      if (!ivB64 || !tagB64 || !dataB64) return stored;
      const decipher = crypto.createDecipheriv('aes-256-gcm', getAesKey(), fromB64url(ivB64));
      decipher.setAuthTag(fromB64url(tagB64));
      return Buffer.concat([decipher.update(fromB64url(dataB64)), decipher.final()]).toString('utf8');
    } catch {
      return stored;
    }
  }

  if (isLegacyCbcValue(stored)) {
    try {
      const [ivHex, encrypted] = stored.split(':');
      const key = crypto.scryptSync(encryptionSecret(), 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
      return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    } catch {
      return stored;
    }
  }

  return stored;
}

/**
 * Columns that stay in plaintext so joins, enums, and hashes still work.
 * Everything else that is TEXT is encrypted at rest.
 */
const PLAIN_COLUMN = /(?:^id$|_id$|_key$|^key$|^code$|Hash$|^role$|^status$|^category$|^type$|^city$|^currency$|_status$|_type$|^published$|^reserved$|^available$|^is_active$|^requiresFileKey$|^loginEnabled$|^isUrgent$|^latitude$|^longitude$|^amount$|^rating$|^experience_years$|^capacity$|^travelers_count$|^duration_days$|^totalAmount$|^paidAmount$|^remainingAmount$|^paid_amount$|^total_price$|^price_id$)/i;

const PLAIN_EXACT = new Set([
  'id',
  'code',
  'role',
  'status',
  'category',
  'type',
  'city',
  'currency',
  'room_type',
  'traveler_type',
  'hotel_category',
  'payment_status',
  'reservation_status',
  'document_type',
  'answerMode',
  'matchStrategy',
  'qualityRating',
  'senderRole',
  'userRole',
  'actorRole',
  'published',
  'reserved',
  'available',
  'is_active',
  'requiresFileKey',
  'loginEnabled',
  'isUrgent',
  'staffId',
  'userId',
  'senderId',
  'chatId',
  'customer_id',
  'package_id',
  'hotel_id',
  'morshid_id',
  'season_id',
  'flight_id',
  'price_id',
  'reservation_id',
  'document_id',
  'media_id',
  'conversation_id',
  'content_key',
  'passwordHash',
  'usernameHash',
  'emailHash',
  'qrSecretHash',
  'codeHash',
  'googleId',
  'google_client_id',
  'security_key',
]);

export function shouldEncryptColumn(columnName: string): boolean {
  if (!columnName) return false;
  if (PLAIN_EXACT.has(columnName)) return false;
  if (columnName.endsWith('Hash')) return false;
  if (PLAIN_COLUMN.test(columnName)) return false;
  return true;
}

export function encryptRow(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row) return {};
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) continue;
    if (!shouldEncryptColumn(key)) continue;
    if (typeof value === 'object') {
      out[key] = encryptValue(JSON.stringify(value));
    } else if (typeof value === 'string') {
      out[key] = encryptValue(value);
    }
  }
  return out;
}

export function decryptRow<T extends Record<string, any>>(row: T | null | undefined): T {
  if (!row || typeof row !== 'object') return row as unknown as T;
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== 'string' || !value) continue;
    if (isEncryptedValue(value) || isLegacyCbcValue(value)) {
      out[key] = decryptValue(value);
    }
  }
  return out as T;
}

export function encryptBindValue(columnName: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (!shouldEncryptColumn(columnName)) return value;
  if (typeof value === 'object') return encryptValue(JSON.stringify(value));
  if (typeof value === 'string') {
    if (!value) return value;
    return encryptValue(value);
  }
  return value;
}

export interface SqlBindMeta {
  kind: 'read' | 'write' | 'other';
  table?: string;
  columns: string[];
}

function extractEqualsColumns(clause: string): string[] {
  const cols: string[] = [];
  const re = /(?:^|AND|OR|,)\s*(\w+)\s*=\s*\?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(clause))) cols.push(match[1]);
  return cols;
}

function splitSqlList(list: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  for (const ch of list) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function placeholderColumns(columnList: string, sql: string): string[] {
  const columns = columnList.split(',').map((c) => c.trim());
  const valuesMatch = sql.match(/VALUES\s*\((.*)\)\s*$/i);
  if (!valuesMatch) return columns;
  const tokens = splitSqlList(valuesMatch[1]);
  if (tokens.length !== columns.length) return columns;
  return columns.filter((_, i) => tokens[i] === '?');
}

export function parseSqlBindMeta(sql: string): SqlBindMeta {
  const s = sql.replace(/\s+/g, ' ').trim();

  const insert = s.match(/^INSERT(?: OR \w+)? INTO (\w+) \(([^)]+)\)/i);
  if (insert) {
    return {
      kind: 'write',
      table: insert[1],
      columns: placeholderColumns(insert[2], s),
    };
  }

  const update = s.match(/^UPDATE (\w+) SET (.+?)(?: WHERE (.+))?$/i);
  if (update) {
    const setParts = splitSqlList(update[2]);
    const setCols = setParts
      .filter((part) => part.includes('?'))
      .map((part) => part.split('=')[0].trim());
    const whereCols = update[3] ? extractEqualsColumns(update[3]) : [];
    return { kind: 'write', table: update[1], columns: [...setCols, ...whereCols] };
  }

  const del = s.match(/^DELETE FROM (\w+)(?: WHERE (.+))?/i);
  if (del) {
    return { kind: 'write', table: del[1], columns: del[2] ? extractEqualsColumns(del[2]) : [] };
  }

  const select = s.match(/^SELECT .+ FROM (\w+)/i);
  if (select) {
    const where = s.match(/ WHERE (.+?)(?: ORDER| LIMIT|$)/i);
    return {
      kind: 'read',
      table: select[1],
      columns: where ? extractEqualsColumns(where[1]) : [],
    };
  }

  return { kind: 'other', columns: [] };
}

export function encodeSqlParams(meta: SqlBindMeta, params: unknown[]): unknown[] {
  if (!params.length || meta.kind === 'other' || !meta.columns.length) return params;
  return params.map((param, index) => {
    const col = meta.columns[index];
    if (!col) return param;
    return encryptBindValue(col, param);
  });
}

export function generateSecret(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generatePassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  if (!/[A-Z]/.test(out)) out = 'A' + out.slice(1);
  if (!/[a-z]/.test(out)) out = out.slice(0, 1) + 'a' + out.slice(2);
  if (!/[0-9]/.test(out)) out = out.slice(0, 2) + '7' + out.slice(3);
  if (!/[!@#$%]/.test(out)) out = out.slice(0, 3) + '!' + out.slice(4);
  return out;
}
