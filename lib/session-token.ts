/**
 * Where a request's session token comes from, and how the session cookie is set.
 *
 * The session lives in an httpOnly cookie: page scripts (and so any injected
 * script) cannot read it. Browsers keep only a non-secret marker in
 * localStorage ("cookie") so the UI knows someone is signed in; when that marker
 * is sent as "Authorization: Bearer cookie" it is ignored and the cookie is used.
 * Real Bearer tokens (scripts, API tools) still work.
 */
export const SESSION_COOKIE = 'south_street_token';
export const SESSION_MARKER = 'cookie';

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isJwtLike(value: string | null | undefined): value is string {
  return Boolean(value && JWT_SHAPE.test(value));
}

export function extractSessionToken(authorization: string | null, cookieHeader: string | null): string | null {
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (isJwtLike(bearer)) return bearer;
  const match = (cookieHeader || '').match(/(?:^|;\s*)south_street_token=([^;]+)/);
  const fromCookie = match ? decodeURIComponent(match[1]) : '';
  return isJwtLike(fromCookie) ? fromCookie : null;
}

/** Secure only when the site is really on HTTPS (a Secure cookie is dropped on plain http). */
function secureFor(req?: Request): boolean {
  if (/^https:\/\//i.test(process.env.APP_ORIGIN || '')) return true;
  return req?.headers.get('x-forwarded-proto') === 'https';
}

export function sessionCookieOptions(maxAgeSeconds: number, req?: Request) {
  return {
    httpOnly: true,
    secure: secureFor(req),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}
