import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { SESSION_COOKIE, SESSION_MARKER, extractSessionToken, sessionCookieOptions } from '@/lib/session-token';
import { normalizeLoginRole, LOGIN_ROLE_LABELS } from '@/lib/roles';
import { getBrand } from '@/lib/brand-server';
import { connectName } from '@/lib/brand';

export const dynamic = 'force-dynamic';

/**
 * Google sign-in for the Connect apps (Android / Windows).
 *
 * Google refuses its sign-in inside an app's embedded browser, so the app opens
 * /app-signin in the real browser. Once signed in there:
 *   POST  (browser, with its session)  → a one-time code, valid 2 minutes;
 *   GET ?code=… (inside the app)       → the app gets the same session and opens /connect.
 * The code travels back to the app through its own link (ssconnect://signin?code=…).
 */
type Handoff = { token: string; exp: number };
const g = globalThis as unknown as { __ssHandoffs?: Map<string, Handoff> };
const codes = (g.__ssHandoffs ||= new Map());
const TTL_MS = 120_000;

function sweep() {
  const now = Date.now();
  for (const [k, v] of codes) if (v.exp < now) codes.delete(k);
}

export async function POST(req: Request) {
  const token = extractSessionToken(req.headers.get('authorization'), req.headers.get('cookie'));
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'سجّل الدخول أولاً' }, { status: 401 });
  sweep();
  const code = crypto.randomBytes(24).toString('base64url');
  codes.set(code, { token, exp: Date.now() + TTL_MS });
  return NextResponse.json({ code }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  sweep();
  const code = new URL(req.url).searchParams.get('code') || '';
  const entry = codes.get(code);
  codes.delete(code); // single use
  const payload = entry ? verifyToken(entry.token) : null;
  if (!entry || !payload) {
    return new NextResponse(page('انتهت صلاحية رابط الدخول. ارجع وحاول مرة أخرى.', null), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const role = normalizeLoginRole(payload.role);
  const user = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    username: payload.username,
    role,
    roleName: payload.roleName || LOGIN_ROLE_LABELS[role],
  };
  const res = new NextResponse(page('تم تسجيل الدخول…', user), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  res.cookies.set(SESSION_COOKIE, entry.token, sessionCookieOptions(60 * 60 * 24, req));
  return res;
}

/** Stores the same "signed in" marker as the site's own login, then opens Connect. */
function page(message: string, user: Record<string, unknown> | null): string {
  const script = user
    ? `<script>try{localStorage.setItem('south_street_token',${JSON.stringify(SESSION_MARKER)});localStorage.setItem('south_street_user',${JSON.stringify(
        JSON.stringify(user)
      ).replace(/</g, '\\u003c')});}catch(e){}location.replace('/connect');</script>`
    : `<p><a href="/connect">العودة إلى Connect</a></p>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${connectName(getBrand())}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Tajawal,system-ui,sans-serif;background:#f4f6f5;color:#0f172a;text-align:center}a{color:#047857;font-weight:700}</style></head><body><main><p>${message}</p>${script}</main></body></html>`;
}
