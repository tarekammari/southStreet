/**
 * Connect — links between two clients (like friends on Facebook or
 * contacts on WhatsApp). A client asks, the other accepts; only then can the two
 * message and call each other. The team needs no link: it talks to everyone.
 *
 * One row per pair (`link_key` = the two ids sorted). States:
 *   pending   — `requester_id` asked, the other has not answered yet
 *   accepted  — both are in each other's contacts
 *   declined  — the other said no (the requester still sees "sent", like Facebook)
 *   blocked   — `actor_id` blocked the other: no requests, no messages, no calls
 */
import { getSqliteDb } from '../sqlite';

export type LinkState = 'pending' | 'accepted' | 'declined' | 'blocked';
export type Link = {
  a: string;
  b: string;
  requesterId: string;
  actorId: string;
  state: LinkState;
  createdTs: number;
  updatedTs: number;
};

export const linkKey = (x: string, y: string) => [x, y].sort().join('|');

let ready = false;
function db() {
  const d = getSqliteDb();
  if (ready) return d;
  d.exec(`
    CREATE TABLE IF NOT EXISTS connect_links (
      link_key TEXT PRIMARY KEY, a_id TEXT NOT NULL, b_id TEXT NOT NULL, requester_id TEXT NOT NULL,
      actor_id TEXT NOT NULL, state_type TEXT NOT NULL, created_ts INTEGER NOT NULL, updated_ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS connect_links_a ON connect_links (a_id);
    CREATE INDEX IF NOT EXISTS connect_links_b ON connect_links (b_id);
  `);
  ready = true;
  return d;
}

function toLink(r: any): Link {
  return {
    a: String(r.a_id),
    b: String(r.b_id),
    requesterId: String(r.requester_id),
    actorId: String(r.actor_id),
    state: String(r.state_type) as LinkState,
    createdTs: Number(r.created_ts) || 0,
    updatedTs: Number(r.updated_ts) || 0,
  };
}

export function getLink(x: string, y: string): Link | null {
  const r = db().prepare('SELECT * FROM connect_links WHERE link_key = ?').get(linkKey(x, y));
  return r ? toLink(r) : null;
}

export function linksOf(userId: string): Link[] {
  return (db().prepare('SELECT * FROM connect_links WHERE a_id = ? OR b_id = ?').all(userId, userId) as any[]).map(toLink);
}

/** Ids of the clients I am linked with (accepted on both sides). */
export function friendIds(userId: string): Set<string> {
  return new Set(linksOf(userId).filter((l) => l.state === 'accepted').map((l) => (l.a === userId ? l.b : l.a)));
}

export function areFriends(x: string, y: string): boolean {
  return getLink(x, y)?.state === 'accepted';
}

export function saveLink(x: string, y: string, requesterId: string, actorId: string, state: LinkState) {
  const [a, b] = [x, y].sort();
  const now = Date.now();
  db().prepare(
    `INSERT INTO connect_links (link_key, a_id, b_id, requester_id, actor_id, state_type, created_ts, updated_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(link_key) DO UPDATE SET requester_id = excluded.requester_id, actor_id = excluded.actor_id, state_type = excluded.state_type, updated_ts = excluded.updated_ts`
  ).run(linkKey(a, b), a, b, requesterId, actorId, state, now, now);
}

export function deleteLink(x: string, y: string) {
  db().prepare('DELETE FROM connect_links WHERE link_key = ?').run(linkKey(x, y));
}

/** Newest change in my links (the live connection's fallback compares it). */
export function linksStamp(userId: string): number {
  return linksOf(userId).reduce((max, l) => Math.max(max, l.updatedTs), 0);
}
