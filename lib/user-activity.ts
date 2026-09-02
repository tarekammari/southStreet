import { getSqliteDb } from '@/lib/sqlite';
import { listUserSessions } from '@/lib/presence';
import { getLiveFeed } from '@/lib/security-monitor';
import { deviceLabel } from '@/lib/user-access-view';

function dayKey(raw?: string | null): string | null {
  if (!raw) return null;
  const t = new Date(raw);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toISOString().slice(0, 10);
}

function bump(counts: Record<string, number>, raw?: string | null, n = 1) {
  const key = dayKey(raw);
  if (!key) return;
  counts[key] = (counts[key] || 0) + n;
}

export type UserDevice = {
  id: string;
  ip: string;
  fingerprint: string;
  userAgent: string;
  device: string;
  firstSeen: string;
  lastSeen: string;
  active: boolean;
};

export type UserHistoryKind =
  | 'created'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'login'
  | 'logout'
  | 'command'
  | 'message'
  | 'request';

export type UserHistoryEvent = {
  id: string;
  at: string;
  kind: UserHistoryKind;
  title: string;
  detail: string;
  ip?: string;
  device?: string;
};

export type UserHistory = {
  activity: Record<string, number>;
  devices: UserDevice[];
  events: UserHistoryEvent[];
};

function commandTitle(action: string): string {
  const map: Record<string, string> = {
    'تسجيل دخول ناجح': 'دخول إلى التطبيق',
    'فشل تسجيل دخول': 'محاولة دخول فاشلة',
    'فشل دخول QR': 'محاولة دخول برمز QR',
    'إصدار كود مستخدم جديد': 'إصدار رمز مستخدم',
    'إصدار سند قبض رقمي': 'إصدار سند قبض',
    'تقييم جديد بانتظار المراجعة': 'إضافة تقييم',
    'مراجعة تقييم': 'مراجعة تقييم',
    AI_CONVERSATION: 'محادثة مع صخر',
    'حظر عنوان IP': 'حظر عنوان في الجدار',
    'اعتماد عنوان IP موثوق': 'اعتماد عنوان موثوق',
    'حذف قاعدة جدار حماية': 'حذف قاعدة من الجدار',
    'تعديل إعدادات جدار الحماية': 'تعديل إعدادات الجدار',
    'موافقة على حساب': 'الموافقة على الحساب',
    'رفض حساب': 'رفض الحساب',
    'إيقاف حساب': 'إيقاف الحساب',
    'تفعيل حساب': 'تفعيل الحساب',
    'تغيير دور': 'تغيير الدور',
  };
  return map[action] || action;
}

function kindOfAction(action: string): UserHistoryKind {
  if (action.includes('دخول ناجح')) return 'login';
  if (action.includes('فشل')) return 'login';
  if (action.includes('موافقة')) return 'approved';
  if (action.includes('رفض')) return 'rejected';
  if (action.includes('إيقاف')) return 'suspended';
  if (action.includes('تفعيل')) return 'approved';
  return 'command';
}

function pushEvent(events: UserHistoryEvent[], event: UserHistoryEvent, counts: Record<string, number>, n = 1) {
  events.push(event);
  bump(counts, event.at, n);
}

/** Daily app-use counts for a GitHub-style contribution map. */
export function collectUserActivity(userId: string): Record<string, number> {
  return collectUserHistory(userId).activity;
}

/** Devices, account lifecycle, logins, and commands for one user. */
export function collectUserHistory(userId: string): UserHistory {
  const activity: Record<string, number> = {};
  const events: UserHistoryEvent[] = [];
  const devices: UserDevice[] = [];

  try {
    const db = getSqliteDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | {
          id?: string;
          name?: string;
          email?: string;
          username?: string;
          status?: string;
          createdAt?: string;
          lastLoginIp?: string;
          pcFingerprint?: string;
          loginEnabled?: number | boolean;
        }
      | undefined;

    const email = (user?.email || '').trim();
    const name = (user?.name || '').trim();
    const firstName = name.split(/\s+/)[0] || '';

    if (user?.createdAt) {
      pushEvent(events, {
        id: `created-${userId}`,
        at: user.createdAt,
        kind: 'created',
        title: 'إنشاء الحساب',
        detail: 'تم تسجيل الحساب في النظام.',
      }, activity, 1);
    }

    try {
      const requests = db
        .prepare(
          `SELECT * FROM access_requests
           WHERE userId = ? OR (? != '' AND userEmail = ?)
           ORDER BY requestTime DESC`
        )
        .all(userId, email, email) as {
          id?: string;
          requestTime?: string;
          status?: string;
          ip?: string;
          userAgent?: string;
          pcPrint?: string;
        }[];
      for (const req of requests) {
        const status = String(req.status || 'PENDING_APPROVAL');
        const kind: UserHistoryKind =
          status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'pending';
        const title =
          kind === 'approved' ? 'الموافقة على الحساب' : kind === 'rejected' ? 'رفض الطلب' : 'طلب تفعيل الحساب';
        pushEvent(events, {
          id: `req-${req.id || req.requestTime}`,
          at: req.requestTime || user?.createdAt || new Date().toISOString(),
          kind,
          title,
          detail: `حالة الطلب: ${status === 'APPROVED' ? 'مقبول' : status === 'REJECTED' ? 'مرفوض' : 'بانتظار المراجعة'}.`,
          ip: req.ip,
          device: deviceLabel(req.userAgent),
        }, activity, 1);
      }
    } catch {
      /* access_requests may be missing */
    }

    if (!events.some((e) => e.kind === 'approved' || e.kind === 'rejected' || e.kind === 'pending')) {
      const status = String(user?.status || '');
      if (status === 'PENDING_APPROVAL') {
        pushEvent(events, {
          id: `status-pending-${userId}`,
          at: user?.createdAt || new Date().toISOString(),
          kind: 'pending',
          title: 'بانتظار التحقق',
          detail: 'الحساب لم يُعتمد بعد.',
        }, activity);
      } else if (status === 'APPROVED') {
        pushEvent(events, {
          id: `status-approved-${userId}`,
          at: user?.createdAt || new Date().toISOString(),
          kind: 'approved',
          title: 'التحقق من الحساب',
          detail: 'الحساب مفعّل ويمكنه الدخول.',
        }, activity);
      } else if (status === 'REJECTED') {
        pushEvent(events, {
          id: `status-rejected-${userId}`,
          at: user?.createdAt || new Date().toISOString(),
          kind: 'rejected',
          title: 'رفض الحساب',
          detail: 'لم تُقبل صلاحية الدخول.',
        }, activity);
      } else if (status === 'SUSPENDED' || user?.loginEnabled === 0 || user?.loginEnabled === false) {
        pushEvent(events, {
          id: `status-suspended-${userId}`,
          at: user?.createdAt || new Date().toISOString(),
          kind: 'suspended',
          title: 'إيقاف الحساب',
          detail: 'تم إيقاف صلاحية الدخول.',
        }, activity);
      }
    }

    const sessions = listUserSessions(userId, email);
    const deviceMap = new Map<string, UserDevice>();
    for (const session of sessions) {
      const device = deviceLabel(session.userAgent);
      const ip = session.ip || '—';
      const key = `${ip}|${device}`;
      const first = session.loginTime || session.lastActive || '';
      const last = session.lastActive || session.loginTime || first;
      const live = !session.endedAt;
      const prev = deviceMap.get(key);
      if (!prev) {
        deviceMap.set(key, {
          id: session.id,
          ip,
          fingerprint: session.pcPrint || '—',
          userAgent: session.userAgent || '',
          device,
          firstSeen: first,
          lastSeen: last,
          active: live,
        });
      } else {
        if (first && (!prev.firstSeen || first < prev.firstSeen)) prev.firstSeen = first;
        if (last && last > prev.lastSeen) prev.lastSeen = last;
        if (live) prev.active = true;
      }
    }

    for (const device of deviceMap.values()) {
      pushEvent(events, {
        id: `login-${device.id}`,
        at: device.firstSeen,
        kind: 'login',
        title: 'دخول من جهاز',
        detail: `${device.device} · ${device.ip}`,
        ip: device.ip,
        device: device.device,
      }, activity, 2);
      if (device.active) bump(activity, device.lastSeen, 1);
    }

    if (user?.lastLoginIp || user?.pcFingerprint) {
      const key = user.pcFingerprint || user.lastLoginIp || 'legacy';
      if (!deviceMap.has(key) && !Array.from(deviceMap.values()).some((d) => d.ip === user.lastLoginIp)) {
        deviceMap.set(key, {
          id: `legacy-${userId}`,
          ip: user.lastLoginIp || '—',
          fingerprint: user.pcFingerprint || '—',
          userAgent: '',
          device: 'جهاز محفوظ',
          firstSeen: user.createdAt || '',
          lastSeen: user.createdAt || '',
          active: false,
        });
      }
    }

    devices.push(...deviceMap.values());

    const auditClauses = ['actorName = ?'];
    const auditArgs: string[] = [name || userId];
    if (firstName && firstName !== name) {
      auditClauses.push('actorName LIKE ?');
      auditArgs.push(`%${firstName}%`);
    }
    if (email) {
      auditClauses.push('details LIKE ?');
      auditArgs.push(`%${email}%`);
    }
    auditClauses.push('details LIKE ?');
    auditArgs.push(`%${userId}%`);
    if (user?.username) {
      auditClauses.push('details LIKE ?');
      auditArgs.push(`%${user.username}%`);
    }

    try {
      const logs = db
        .prepare(
          `SELECT id, timestamp, actorName, action, details, ip FROM audit_logs
           WHERE ${auditClauses.join(' OR ')}
           ORDER BY timestamp DESC LIMIT 200`
        )
        .all(...auditArgs) as {
          id?: string;
          timestamp?: string;
          actorName?: string;
          action?: string;
          details?: string;
          ip?: string;
        }[];
      for (const log of logs) {
        const action = log.action || 'أمر';
        pushEvent(events, {
          id: `audit-${log.id || log.timestamp}`,
          at: log.timestamp || '',
          kind: kindOfAction(action),
          title: commandTitle(action),
          detail: log.details || log.actorName || '',
          ip: log.ip,
        }, activity, 1);
      }
    } catch {
      /* audit_logs may be empty */
    }

    try {
      const messages = db
        .prepare('SELECT id, time, chatId FROM messages WHERE senderId = ? ORDER BY time DESC LIMIT 80')
        .all(userId) as { id?: string; time?: string; chatId?: string }[];
      for (const msg of messages) {
        pushEvent(events, {
          id: `msg-${msg.id || msg.time}`,
          at: msg.time || '',
          kind: 'message',
          title: 'رسالة داخل التطبيق',
          detail: msg.chatId ? `محادثة ${msg.chatId}` : 'إرسال رسالة',
        }, activity, 1);
      }
    } catch {
      /* messages table may be empty */
    }

    try {
      const skip = /\/api\/(admin\/users|session\/heartbeat|security\/(monitor|ingest))$/;
      const feed = getLiveFeed(200, { important: false });
      for (const event of feed) {
        if (skip.test(event.path || '')) continue;
        const sameUser =
          event.userId === userId ||
          (name && event.userName === name);
        if (!sameUser) continue;
        pushEvent(events, {
          id: `reqlog-${event.id}`,
          at: event.ts,
          kind: 'request',
          title: `${event.method} ${event.path}`,
          detail: event.reason || event.dataLabel || 'نشاط داخل التطبيق',
          ip: event.ip,
          device: deviceLabel(event.userAgent),
        }, activity, 1);
      }
    } catch {
      /* live feed is optional */
    }
  } catch {
    /* history stays empty if sqlite is unavailable */
  }

  const seen = new Set<string>();
  const uniqueEvents = events
    .filter((event) => {
      const day = dayKey(event.at) || event.at;
      const key = `${event.kind}|${day}|${event.title}|${event.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(event.at);
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  devices.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));

  return { activity, devices, events: uniqueEvents };
}
