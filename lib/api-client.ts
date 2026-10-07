/**
 * Auth-aware fetch helpers for browser code.
 * Token key and Bearer header match lib/client-session.ts conventions.
 */
import { fetchJsonList as fetchJsonListBase } from './fetch-json';

export const AUTH_TOKEN_KEY = 'south_street_token';
export const AUTH_USER_KEY = 'south_street_user';

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Build Authorization header (and optional JSON Content-Type) from the stored session token. */
export function authHeaders(opts?: { json?: boolean }): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (opts?.json) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Convenience: Authorization + Content-Type application/json. */
export function jsonAuthHeaders(): HeadersInit {
  return authHeaders({ json: true });
}

export type ApiFetchInit = RequestInit & {
  /** Force Content-Type: application/json when true. */
  json?: boolean;
  /** When false, skip Authorization even if a token exists. Default true. */
  auth?: boolean;
};

/**
 * fetch wrapper that attaches Bearer from localStorage when available.
 * Does not change URLs or response handling — callers still read res/json themselves.
 */
export async function apiFetch(input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> {
  const { json, auth = true, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders || {});

  if (json && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(input, { ...rest, headers });
  if (
    typeof window !== 'undefined' &&
    res.status === 401 &&
    auth &&
    typeof input === 'string' &&
    (input.includes('/api/admin') ||
      input.includes('/api/security') ||
      input.includes('/api/bookings/confirm') ||
      input.includes('/api/session'))
  ) {
    window.dispatchEvent(new CustomEvent('southstreet:admin-session-expired'));
  }
  return res;
}

/** Re-export list helper unchanged for existing callers. */
export async function fetchJsonList<T>(url: string): Promise<T[]> {
  return fetchJsonListBase<T>(url);
}

export { fetchJsonListBase };