import type { ActiveSession } from '@/lib/db';

export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

export const DEFAULT_USER_PHOTO = '/images/persona.png';

/** Accepts only values that a browser can load directly as an <img> source. */
export function isImageSource(value?: string | null): boolean {
  if (!value) return false;
  const src = String(value).trim();
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image');
}

export function resolveUserPhoto(avatar?: string | null, staffPhoto?: string | null): string {
  const pick = (value?: string | null) => {
    if (!isImageSource(value)) return '';
    const src = String(value).trim();
    if (src === '/images/default-user.svg') return DEFAULT_USER_PHOTO;
    return src;
  };
  return pick(avatar) || pick(staffPhoto) || DEFAULT_USER_PHOTO;
}

export type EnrichedUser = {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  photo: string;
  role: string;
  roleName: string;
  status: string;
  createdAt?: string;
  lastLoginIp?: string;
  pcFingerprint?: string;
  loginEnabled?: boolean;
  googleLinked?: boolean;
  options?: string[];
  isOnline: boolean;
  lastLogin: string | null;
  lastActive: string | null;
  displayIp: string;
  displayFingerprint: string;
  userAgent: string | null;
};

function sessionTime(session: ActiveSession): number {
  const raw = session.lastActive || session.loginTime;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sameUser(session: ActiveSession, user: { id?: string; email?: string }): boolean {
  if (session.userId && user.id && session.userId === user.id) return true;
  const sessionEmail = (session.userEmail || '').trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  return Boolean(sessionEmail && userEmail && sessionEmail === userEmail);
}

export function enrichUsersWithSessions(users: any[], sessions: ActiveSession[]): EnrichedUser[] {
  const now = Date.now();

  return users.map((u) => {
    const userSessions = sessions
      .filter((s) => sameUser(s, u))
      .sort((a, b) => sessionTime(b) - sessionTime(a));

    const latest = userSessions[0];
    const lastActiveMs = latest ? sessionTime(latest) : 0;
    const isOnline = Boolean(latest && lastActiveMs > 0 && now - lastActiveMs < ONLINE_WINDOW_MS);

    return {
      ...u,
      isOnline,
      lastLogin: latest?.loginTime || null,
      lastActive: latest?.lastActive || latest?.loginTime || null,
      displayIp: latest?.ip || u.lastLoginIp || '—',
      displayFingerprint: latest?.pcPrint || u.pcFingerprint || '—',
      userAgent: latest?.userAgent || null,
    };
  });
}

export function formatAdminDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('ar-DZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type Presence = 'connected' | 'inactive' | 'offline';

export const PRESENCE_LABELS: Record<Presence, string> = {
  connected: 'متصل',
  inactive: 'خامل',
  offline: 'غير متصل',
};

const INACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Live heartbeat, idle within 24h, or fully offline. */
export function presenceOf(user: { isOnline?: boolean; lastActive?: string | null; lastLogin?: string | null }): Presence {
  if (user.isOnline) return 'connected';
  const raw = user.lastActive || user.lastLogin;
  if (!raw) return 'offline';
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t) || t <= 0) return 'offline';
  return Date.now() - t < INACTIVE_WINDOW_MS ? 'inactive' : 'offline';
}

export const JOURNEY_STEPS = [
  { id: 'registered', label: 'تسجيل' },
  { id: 'review', label: 'مراجعة' },
  { id: 'activated', label: 'تفعيل' },
  { id: 'signedin', label: 'دخول' },
  { id: 'live', label: 'متصل' },
] as const;

/** How far the account has moved through onboarding → live session. */
export function journeyIndex(user: EnrichedUser): number {
  if (user.isOnline) return 4;
  if (user.lastLogin || user.lastActive) return 3;
  if (user.status === 'APPROVED' && user.loginEnabled !== false) return 2;
  if (user.status === 'PENDING_APPROVAL' || user.status === 'REJECTED') return 1;
  return 0;
}

export type AccountTone = 'progress' | 'live' | 'idle' | 'off' | 'hold';

export function accountStatusOf(user: EnrichedUser): { label: string; tone: AccountTone } {
  if (user.status === 'PENDING_APPROVAL') return { label: 'قيد المعالجة', tone: 'progress' };
  if (user.status === 'SUSPENDED' || user.loginEnabled === false) return { label: 'موقوف', tone: 'hold' };
  if (user.status === 'REJECTED') return { label: 'مرفوض', tone: 'off' };
  const presence = presenceOf(user);
  if (presence === 'connected') return { label: 'متصل', tone: 'live' };
  if (presence === 'inactive') return { label: 'خامل', tone: 'idle' };
  return { label: 'غير متصل', tone: 'off' };
}

export function deviceLabel(userAgent?: string | null): string {
  if (!userAgent) return 'جهاز غير معروف';
  const ua = userAgent.toLowerCase();
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('android')
      ? 'Android'
      : ua.includes('iphone') || ua.includes('ipad')
        ? 'iOS'
        : ua.includes('mac os')
          ? 'macOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'نظام آخر';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome')
      ? 'Chrome'
      : ua.includes('firefox')
        ? 'Firefox'
        : ua.includes('safari')
          ? 'Safari'
          : 'متصفح';
  return `${browser} · ${os}`;
}
