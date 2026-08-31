import type { ActiveSession } from '@/lib/db';

export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

export const DEFAULT_USER_PHOTO = '/images/default-user.svg';

/** Accepts only values that a browser can load directly as an <img> source. */
export function isImageSource(value?: string | null): boolean {
  if (!value) return false;
  const src = String(value).trim();
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image');
}

export function resolveUserPhoto(avatar?: string | null, staffPhoto?: string | null): string {
  if (isImageSource(avatar)) return String(avatar).trim();
  if (isImageSource(staffPhoto)) return String(staffPhoto).trim();
  return DEFAULT_USER_PHOTO;
}

export type EnrichedUser = {
  id: string;
  name: string;
  email: string;
  username?: string;
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
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-DZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
