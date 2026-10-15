/**
 * South Street Connect — clients connecting with each other.
 *
 *  - Requests: a client asks, the other accepts / declines / blocks. Asking
 *    someone who already asked you simply connects you both.
 *  - Directory: every client sees the other clients (name and photo only —
 *    never phone or email) and can ask to connect; search by name.
 *  - Lookup: a client is also found by an exact phone number, email or client
 *    code. Staff are never found this way: clients see only the Super Admin
 *    and the guides.
 *  - Suggestions ("قد تعرفهم"): a light ranking of the clients you most likely
 *    know — same trip, same departure dates, same guide, contacts in common.
 */
import { getSqliteDb } from '../sqlite';
import { isOnline, isTeam, userById, activeUsers, type ConnectUser } from './store';
import { deleteLink, friendIds, getLink, linksOf, saveLink, type Link } from './links';
import { publish } from './bus';
import { pushTo } from './push';

export type PersonState = 'none' | 'sent' | 'received' | 'friend' | 'blocked';
export type PersonCard = ConnectUser & { state: PersonState; reason: string; online: boolean };

const DAY = 86_400_000;
const MAX_REQUESTS_PER_DAY = 20;
const MAX_PENDING = 40;
/** After a "no", the same person may ask again only after this long. */
const ASK_AGAIN_MS = 14 * DAY;
const MAX_SUGGESTIONS = 12;

const isClient = (u: ConnectUser) => !isTeam(u.role);
const otherOf = (l: Link, me: string) => (l.a === me ? l.b : l.a);

/** How I see the link with someone (a "no" or their block is never shown: I still see "sent"). */
export function stateFor(meId: string, link: Link | null): PersonState {
  if (!link) return 'none';
  if (link.state === 'accepted') return 'friend';
  if (link.state === 'blocked') return link.actorId === meId ? 'blocked' : 'sent';
  if (link.state === 'declined') return link.requesterId === meId ? 'sent' : 'none';
  return link.requesterId === meId ? 'sent' : 'received';
}

function card(me: ConnectUser, u: ConnectUser, reason = ''): PersonCard {
  return { ...u, state: stateFor(me.id, getLink(me.id, u.id)), reason, online: isOnline(u.id) };
}

function notify(userId: string) {
  publish(userId, { type: 'people', ts: Date.now() });
}

/* ---------------- lists ---------------- */

/** Requests waiting for my answer, the ones I sent, the people I blocked, and suggestions. */
export function peopleFor(me: ConnectUser) {
  if (!isClient(me)) return { requests: [], sent: [], blocked: [], suggestions: [], everyone: [] };
  const links = linksOf(me.id);
  const pick = (want: PersonState) =>
    links
      .filter((l) => stateFor(me.id, l) === want)
      .sort((x, y) => y.updatedTs - x.updatedTs)
      .map((l) => userById(otherOf(l, me.id)))
      .filter((u): u is ConnectUser => Boolean(u))
      .map((u) => card(me, u, want === 'received' ? reasonFor(me, u) : ''));
  const suggestions = suggestionsFor(me);
  const suggested = new Set(suggestions.map((p) => p.id));
  return {
    requests: pick('received'),
    sent: pick('sent'),
    blocked: pick('blocked'),
    suggestions,
    everyone: directory(me).filter((p) => !suggested.has(p.id) && p.state !== 'received').slice(0, DIRECTORY_PAGE),
  };
}

/* ---------------- directory ---------------- */

const DIRECTORY_PAGE = 60;
const fold = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '') // harakat, tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

/**
 * The other clients a client may connect with (not yet friends; people who
 * blocked me or whom I blocked are left out). Online first, then by name.
 * With [search]: names containing it (Arabic letters folded: أ/ا, ة/ه, ى/ي).
 */
export function directory(me: ConnectUser, search = ''): PersonCard[] {
  if (!isClient(me)) return [];
  const q = fold(search);
  const links = new Map(linksOf(me.id).map((l) => [otherOf(l, me.id), l]));
  return activeUsers()
    .filter((u) => u.id !== me.id && isClient(u) && (!q || fold(u.name).includes(q)))
    .map((u) => ({ ...u, state: stateFor(me.id, links.get(u.id) || null), reason: '', online: isOnline(u.id) }))
    .filter((p) => p.state !== 'friend' && p.state !== 'blocked' && links.get(p.id)?.state !== 'blocked')
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'ar'))
    .slice(0, q ? 40 : 500);
}

/* ---------------- suggestions ---------------- */

type Trip = { packageId: string; name: string; seasonId: string; morshidId: string; start: number; city: string };

function tripsByClient(): Map<string, Trip[]> {
  const d = getSqliteDb();
  const packages = new Map(
    (d.prepare('SELECT package_id, name, season_id, morshid_id, start_date, departure_city FROM packages').all() as any[]).map((p) => [
      String(p.package_id),
      {
        packageId: String(p.package_id),
        name: String(p.name || ''),
        seasonId: String(p.season_id || ''),
        morshidId: String(p.morshid_id || ''),
        start: Date.parse(String(p.start_date || '')) || 0,
        city: String(p.departure_city || '').trim(),
      } satisfies Trip,
    ])
  );
  const out = new Map<string, Trip[]>();
  for (const r of d.prepare('SELECT customer_id, package_id, reservation_status FROM reservations').all() as any[]) {
    if (/CANCEL|REJECT/i.test(String(r.reservation_status || ''))) continue;
    const trip = packages.get(String(r.package_id));
    const who = String(r.customer_id || '');
    if (!trip || !who) continue;
    if (!out.has(who)) out.set(who, []);
    out.get(who)!.push(trip);
  }
  return out;
}

/**
 * Scores every client I am not linked with; the strongest real tie wins the
 * label. Without a real tie (trip, guide, contacts in common) nobody is shown.
 */
function rank(me: ConnectUser, trips: Map<string, Trip[]>, myFriends: Set<string>, friendsOf: (id: string) => Set<string>) {
  const mine = trips.get(me.id) || [];
  return (u: ConnectUser): { score: number; reason: string } => {
    const theirs = trips.get(u.id) || [];
    let score = 0;
    const reasons: [number, string][] = [];
    const sameTrip = theirs.find((t) => mine.some((m) => m.packageId === t.packageId));
    if (sameTrip) {
      score += 60;
      reasons.push([60, `معك في رحلة «${sameTrip.name}»`]);
    }
    const sameDates = theirs.find((t) => mine.some((m) => m.packageId !== t.packageId && m.start && t.start && Math.abs(m.start - t.start) <= 3 * DAY && (!m.city || !t.city || m.city === t.city)));
    if (sameDates) {
      score += 30;
      reasons.push([30, 'يسافر في نفس أيام رحلتك']);
    }
    const sameGuide = theirs.find((t) => t.morshidId && mine.some((m) => m.morshidId === t.morshidId && m.packageId !== t.packageId));
    if (sameGuide) {
      score += 20;
      reasons.push([20, 'مع نفس مرشدك']);
    }
    if (theirs.some((t) => t.seasonId && mine.some((m) => m.seasonId === t.seasonId))) score += 8;
    const mutual = [...friendsOf(u.id)].filter((id) => myFriends.has(id)).length;
    if (mutual) {
      const points = Math.min(4, mutual) * 25;
      score += points;
      reasons.push([points, mutual === 1 ? 'جهة اتصال مشتركة' : `${mutual} جهات اتصال مشتركة`]);
    }
    if (!reasons.length) return { score: 0, reason: '' };
    if (isOnline(u.id)) score += 5;
    return { score, reason: reasons.sort((x, y) => y[0] - x[0])[0][1] };
  };
}

function suggestionsFor(me: ConnectUser): PersonCard[] {
  const linked = new Set(linksOf(me.id).map((l) => otherOf(l, me.id)));
  const myFriends = friendIds(me.id);
  const cache = new Map<string, Set<string>>();
  const friendsOf = (id: string) => cache.get(id) || cache.set(id, friendIds(id)).get(id)!;
  const score = rank(me, tripsByClient(), myFriends, friendsOf);
  return activeUsers()
    .filter((u) => u.id !== me.id && isClient(u) && !linked.has(u.id))
    .map((u) => ({ u, ...score(u) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.u.name.localeCompare(y.u.name, 'ar'))
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => ({ ...x.u, state: 'none' as const, reason: x.reason, online: isOnline(x.u.id) }));
}

/** Why someone asking me might be known to me (shown under the request). */
function reasonFor(me: ConnectUser, u: ConnectUser): string {
  const myFriends = friendIds(me.id);
  return rank(me, tripsByClient(), myFriends, (id) => friendIds(id))(u).reason;
}

/* ---------------- lookup ---------------- */

const digits = (s: string) => String(s || '').replace(/\D/g, '');

/** Exact phone (last 9 digits, so 0661… and +213661… match), email or client code. */
export function lookup(me: ConnectUser, query: string): PersonCard | null {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 4) return null;
  const qDigits = digits(q);
  const rows = getSqliteDb().prepare('SELECT id, email, phone, code FROM users').all() as any[];
  const hit = rows.find((r) => {
    if (String(r.id) === me.id) return false;
    if (q.includes('@')) return String(r.email || '').trim().toLowerCase() === q;
    if (String(r.code || '').trim().toLowerCase() === q) return true;
    const phone = digits(r.phone);
    return qDigits.length >= 9 && phone.length >= 9 && phone.slice(-9) === qDigits.slice(-9);
  });
  const u = hit ? userById(String(hit.id)) : null;
  // Only clients are found this way; the team a client may reach is already in the list.
  if (!u || !isClient(u)) return null;
  // Someone who blocked me is simply "not found".
  const link = getLink(me.id, u.id);
  if (link?.state === 'blocked' && link.actorId !== me.id) return null;
  return card(me, u);
}

/* ---------------- actions ---------------- */

export type PeopleAction = 'request' | 'accept' | 'decline' | 'block' | 'unblock' | 'cancel' | 'remove';
type Result = { ok: true; state: PersonState } | { ok: false; error: string; status: number };

export function act(me: ConnectUser, peerId: string, action: PeopleAction): Result {
  const peer = userById(peerId);
  if (!peer || peer.id === me.id) return { ok: false, error: 'الحساب غير موجود', status: 404 };
  if (!isClient(me) || !isClient(peer)) return { ok: false, error: 'فريق الوكالة متاح دائماً بدون طلب', status: 400 };
  const link = getLink(me.id, peer.id);
  const state = stateFor(me.id, link);
  const done = (): Result => {
    notify(me.id);
    notify(peer.id);
    return { ok: true, state: stateFor(me.id, getLink(me.id, peer.id)) };
  };

  switch (action) {
    case 'request': {
      if (state === 'friend' || state === 'blocked') return { ok: true, state };
      // They asked me already: asking back means yes.
      if (state === 'received') return act(me, peer.id, 'accept');
      // Blocked by them / declined lately: look "sent", tell nobody.
      if (link?.state === 'blocked') return { ok: true, state: 'sent' };
      if (link?.state === 'declined' && link.requesterId === me.id && Date.now() - link.updatedTs < ASK_AGAIN_MS) return { ok: true, state: 'sent' };
      if (link?.state === 'pending') return { ok: true, state: 'sent' };
      const mine = linksOf(me.id).filter((l) => l.requesterId === me.id && l.state === 'pending');
      if (mine.length >= MAX_PENDING) return { ok: false, error: 'لديك طلبات كثيرة بانتظار الرد', status: 429 };
      if (mine.filter((l) => Date.now() - l.updatedTs < DAY).length >= MAX_REQUESTS_PER_DAY) {
        return { ok: false, error: 'وصلت إلى حد الطلبات اليوم — حاول غداً', status: 429 };
      }
      saveLink(me.id, peer.id, me.id, me.id, 'pending');
      void pushTo(peer.id, {
        kind: 'message',
        title: 'طلب تواصل جديد',
        body: `${me.name} يريد التواصل معك على Connect`,
        tag: `people-${me.id}`,
        url: '/connect?tab=contacts',
      });
      return done();
    }
    case 'accept': {
      if (state !== 'received') return { ok: true, state };
      saveLink(me.id, peer.id, link!.requesterId, me.id, 'accepted');
      void pushTo(peer.id, {
        kind: 'message',
        title: `${me.name} قبل طلبك`,
        body: 'يمكنكما الآن المراسلة والاتصال على Connect',
        tag: `people-${me.id}`,
        url: `/connect?chat=${me.id}`,
      });
      return done();
    }
    case 'decline':
      if (state !== 'received') return { ok: true, state };
      saveLink(me.id, peer.id, link!.requesterId, me.id, 'declined');
      return done();
    case 'cancel':
      // A declined request stays until the wait is over, so cancelling cannot skip it.
      if (link && link.requesterId === me.id && (link.state === 'pending' || (link.state === 'declined' && Date.now() - link.updatedTs >= ASK_AGAIN_MS))) {
        deleteLink(me.id, peer.id);
      }
      return done();
    case 'remove':
      if (state === 'friend') deleteLink(me.id, peer.id);
      return done();
    case 'block':
      saveLink(me.id, peer.id, link?.requesterId || me.id, me.id, 'blocked');
      return done();
    case 'unblock':
      if (state === 'blocked') deleteLink(me.id, peer.id);
      return done();
  }
  return { ok: false, error: 'إجراء غير معروف', status: 400 };
}
