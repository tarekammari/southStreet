const USER_KEY = 'south_street_user';
const TOKEN_KEY = 'south_street_token';

let leaving = false;
let syncingProfile: Promise<any | null> | null = null;

function isImageSource(value?: string | null): boolean {
  if (!value) return false;
  const src = String(value).trim();
  return src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image');
}

/** Prefer a same-origin avatar URL so Google photos load the same on every page. */
export function profilePhotoSrc(avatar?: string | null, photoUrl?: string | null): string {
  if (photoUrl && String(photoUrl).startsWith('/')) return String(photoUrl);
  if (!isImageSource(avatar)) return '';
  const src = String(avatar).trim();
  if (src.startsWith('http://') || src.startsWith('https://')) return '/api/account/avatar';
  return src;
}

export function readStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: any) {
  if (typeof window === 'undefined' || !user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('southstreet:session-updated', { detail: user }));
}

/** Pull avatar/name from DB so home and portal show the same Google photo. */
export async function syncSessionProfile(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  writeAuthCookie(token);
  if (syncingProfile) return syncingProfile;

  syncingProfile = (async () => {
    try {
      const res = await fetch('/api/account/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return readStoredUser();
      const data = await res.json();
      const next = data?.user;
      if (!next?.id) return readStoredUser();
      const prev = readStoredUser() || {};
      const merged = {
        ...prev,
        ...next,
        avatar: isImageSource(next.avatar) ? next.avatar : (isImageSource(prev.avatar) ? prev.avatar : next.avatar),
        photoUrl: next.photoUrl || (isImageSource(next.avatar) ? '/api/account/avatar' : ''),
      };
      writeStoredUser(merged);
      return merged;
    } catch {
      return readStoredUser();
    } finally {
      syncingProfile = null;
    }
  })();

  return syncingProfile;
}

function clearAuthCookie() {
  const expire = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${TOKEN_KEY}=; Path=/; ${expire}; SameSite=Lax`;
  document.cookie = `${TOKEN_KEY}=; Path=/; ${expire}`;
}

function writeAuthCookie(token: string) {
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function clearClientSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
  clearAuthCookie();
}

export async function logoutAndReload(redirectTo?: string) {
  if (typeof window === 'undefined' || leaving) return;
  leaving = true;

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      await fetch('/api/session/heartbeat', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* still sign out locally */
    }
  }

  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* cookie is also cleared below */
  }

  clearClientSession();
  const next = redirectTo || `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
  window.location.replace(next);
}

export function enterSessionAndReload(token: string, user: unknown, redirectTo: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  writeAuthCookie(token);
  window.location.assign(redirectTo);
}
