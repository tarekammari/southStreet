/**
 * WhatsApp conversations and messages (the dashboard inbox + Sakhr's memory).
 * Phone numbers are looked up by HMAC hash; texts are encrypted at rest like
 * every other text column. Tables are created on first use.
 */
import { getSqliteDb } from '../sqlite';
import { lookupHash } from '../db-crypto';

export type WaConversation = {
  phoneHash: string;
  phone: string;
  name: string;
  userId: string;
  botEnabled: boolean;
  lastTs: number;
  unread: number;
  lastText: string;
};

export type WaMessage = { id: string; direction: 'in' | 'out'; author: 'customer' | 'bot' | 'agent'; body: string; ts: number; agentName?: string };

let ready = false;
function db() {
  const d = getSqliteDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS wa_conversations (
        phone_hash TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        name TEXT,
        user_id TEXT,
        bot_enabled INTEGER DEFAULT 1,
        last_ts INTEGER DEFAULT 0,
        unread INTEGER DEFAULT 0,
        last_text TEXT
      );
      CREATE TABLE IF NOT EXISTS wa_messages (
        msg_id TEXT PRIMARY KEY,
        phone_hash TEXT NOT NULL,
        direction_type TEXT NOT NULL,
        author_type TEXT NOT NULL,
        agent_name TEXT,
        body TEXT,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS wa_messages_phone ON wa_messages (phone_hash, ts);
    `);
    ready = true;
  }
  return d;
}

/** 0555 02 36 25 / +213 555… / 00213 555… → 213555023625 (digits, country code, no plus). */
export function normalizePhone(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `213${d.slice(1)}`; // Algerian local format
  return d;
}

export const phoneHash = (phone: string) => lookupHash(`wa:${normalizePhone(phone)}`);

/** Records a message once (WhatsApp may deliver the same webhook twice). Returns false if already seen. */
export function saveMessage(phone: string, msg: { id: string; direction: 'in' | 'out'; author: WaMessage['author']; body: string; agentName?: string }, profileName?: string, userId?: string): boolean {
  const d = db();
  const hash = phoneHash(phone);
  const ts = Date.now();
  const res = d
    .prepare('INSERT OR IGNORE INTO wa_messages (msg_id, phone_hash, direction_type, author_type, agent_name, body, ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(msg.id, hash, msg.direction, msg.author, msg.agentName || '', msg.body.slice(0, 4000), ts);
  if (res.changes === 0) return false;
  const existing = d.prepare('SELECT phone_hash FROM wa_conversations WHERE phone_hash = ?').get(hash);
  if (existing) {
    d.prepare(
      `UPDATE wa_conversations SET last_ts = ?, last_text = ?, unread = unread + ?${profileName ? ', name = ?' : ''}${userId ? ', user_id = ?' : ''} WHERE phone_hash = ?`
    ).run(...[ts, msg.body.slice(0, 160), msg.direction === 'in' ? 1 : 0, ...(profileName ? [profileName] : []), ...(userId ? [userId] : []), hash]);
  } else {
    d.prepare('INSERT INTO wa_conversations (phone_hash, phone, name, user_id, bot_enabled, last_ts, unread, last_text) VALUES (?, ?, ?, ?, 1, ?, ?, ?)')
      .run(hash, normalizePhone(phone), profileName || '', userId || '', ts, msg.direction === 'in' ? 1 : 0, msg.body.slice(0, 160));
  }
  return true;
}

export function conversation(phoneOrHash: string, byHash = false): WaConversation | null {
  const hash = byHash ? phoneOrHash : phoneHash(phoneOrHash);
  const r = db().prepare('SELECT * FROM wa_conversations WHERE phone_hash = ?').get(hash) as any;
  return r ? toConversation(r) : null;
}

export function listConversations(limit = 100): WaConversation[] {
  return (db().prepare('SELECT * FROM wa_conversations ORDER BY last_ts DESC LIMIT ?').all(limit) as any[]).map(toConversation);
}

export function messages(phoneHashValue: string, limit = 60): WaMessage[] {
  const rows = db()
    .prepare('SELECT * FROM wa_messages WHERE phone_hash = ? ORDER BY ts DESC LIMIT ?')
    .all(phoneHashValue, limit) as any[];
  return rows.reverse().map((r) => ({
    id: String(r.msg_id),
    direction: r.direction_type === 'out' ? 'out' : 'in',
    author: r.author_type === 'bot' ? 'bot' : r.author_type === 'agent' ? 'agent' : 'customer',
    body: String(r.body || ''),
    ts: Number(r.ts) || 0,
    agentName: r.agent_name ? String(r.agent_name) : undefined,
  }));
}

export function setBotEnabled(phoneHashValue: string, enabled: boolean) {
  db().prepare('UPDATE wa_conversations SET bot_enabled = ? WHERE phone_hash = ?').run(enabled ? 1 : 0, phoneHashValue);
}

export function markRead(phoneHashValue: string) {
  db().prepare('UPDATE wa_conversations SET unread = 0 WHERE phone_hash = ?').run(phoneHashValue);
}

export function unreadTotal(): number {
  try {
    const r = db().prepare('SELECT SUM(unread) AS n FROM wa_conversations').get() as { n?: number };
    return Number(r?.n) || 0;
  } catch {
    return 0;
  }
}

function toConversation(r: any): WaConversation {
  return {
    phoneHash: String(r.phone_hash),
    phone: String(r.phone || ''),
    name: String(r.name || ''),
    userId: String(r.user_id || ''),
    botEnabled: Number(r.bot_enabled) !== 0,
    lastTs: Number(r.last_ts) || 0,
    unread: Number(r.unread) || 0,
    lastText: String(r.last_text || ''),
  };
}
