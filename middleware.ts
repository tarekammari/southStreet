import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import {
  classifyRequest,
  classifyAsset,
  resolveRequestIp,
  peekJwtIdentity,
  resolveConnectionGeo,
  resolveHttpVersion,
  buildRequestLine,
  type SecurityEvent,
  type Verdict,
} from '@/lib/security-threats';
import { INGEST_HEADER, INGEST_TOKEN } from '@/lib/security-transport';

/**
 * Every request passes through here so the admin firewall can see real traffic.
 *
 * The Edge runtime cannot open SQLite, so events are batched in the isolate and
 * flushed to a Node route. That same flush returns the current policy, which is
 * cached here and used to reject blocked addresses on the next request.
 */

type EdgeState = {
  queue: SecurityEvent[];
  blocked: Set<string>;
  allowed: Set<string>;
  floodLimit: number;
  firewallOn: boolean;
  blockBots: boolean;
  blockScanners: boolean;
  blockInjection: boolean;
  blockXss: boolean;
  blockExploits: boolean;
  listenAll: boolean;
  policyAt: number;
  flushAt: number;
  hits: Map<string, { count: number; windowStart: number; auth: number }>;
};

const g = globalThis as unknown as { __ssEdgeSecurity?: EdgeState };

function edge(): EdgeState {
  if (!g.__ssEdgeSecurity) {
    g.__ssEdgeSecurity = {
      queue: [],
      blocked: new Set(),
      allowed: new Set(),
      floodLimit: 60,
      firewallOn: true,
      blockBots: true,
      blockScanners: true,
      blockInjection: true,
      blockXss: true,
      blockExploits: true,
      listenAll: true,
      policyAt: 0,
      flushAt: 0,
      hits: new Map(),
    };
  }
  return g.__ssEdgeSecurity;
}

const POLICY_TTL_MS = 10_000;
const FLUSH_EVERY_MS = 2_000;
const FLUSH_AT_COUNT = 25;
const RATE_WINDOW_MS = 60_000;

function countHit(s: EdgeState, ip: string, isAuthPath: boolean) {
  const now = Date.now();
  const rec = s.hits.get(ip);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    s.hits.set(ip, { count: 1, windowStart: now, auth: isAuthPath ? 1 : 0 });
    return { count: 1, auth: isAuthPath ? 1 : 0 };
  }
  rec.count += 1;
  if (isAuthPath) rec.auth += 1;
  // Keep the map from growing without bound on a busy host.
  if (s.hits.size > 500) {
    for (const [key, value] of s.hits) {
      if (now - value.windowStart > RATE_WINDOW_MS) s.hits.delete(key);
    }
  }
  return { count: rec.count, auth: rec.auth };
}

function shouldBlock(s: EdgeState, ip: string, verdict: Verdict): boolean {
  if (!s.firewallOn) return false;
  if (s.allowed.has(ip)) return false;
  if (s.blocked.has(ip)) return true;
  if (s.blockInjection && (verdict.threat === 'INJECTION' || verdict.threat === 'TRAVERSAL')) return true;
  if (s.blockXss && (verdict.threat === 'XSS' || verdict.threat === 'SSTI')) return true;
  if (s.blockExploits && (verdict.threat === 'SSRF' || verdict.threat === 'WEBSHELL' || verdict.threat === 'ZERO_DAY' || verdict.threat === 'HEADER_ABUSE' || verdict.threat === 'METHOD_ABUSE')) {
    return true;
  }
  if (s.blockScanners && verdict.threat === 'SCANNER') return true;
  if (s.blockBots && verdict.threat === 'BOT' && verdict.severity !== 'info') return true;
  if (verdict.threat === 'FLOOD' || verdict.threat === 'AUTH_ABUSE') return true;
  return false;
}

async function flush(origin: string, s: EdgeState) {
  const batch = s.queue.splice(0, s.queue.length);
  s.flushAt = Date.now();
  try {
    const res = await fetch(`${origin}/api/security/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [INGEST_HEADER]: INGEST_TOKEN },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) return;
    const policy = await res.json();
    s.blocked = new Set(policy?.blocked || []);
    s.allowed = new Set(policy?.allowed || []);
    s.firewallOn = policy?.settings?.enabled !== false;
    s.blockBots = Boolean(policy?.settings?.blockBots);
    s.blockScanners = policy?.settings?.blockScanners !== false;
    s.blockInjection = policy?.settings?.blockInjection !== false;
    s.blockXss = policy?.settings?.blockXss !== false;
    s.blockExploits = policy?.settings?.blockExploits !== false;
    s.listenAll = policy?.settings?.listenAll !== false;
    s.floodLimit = Number(policy?.settings?.floodLimit) || 60;
    s.policyAt = Date.now();
  } catch {
    /* monitoring must never take the site down */
  }
}

function blockedPage(banned: boolean): string {
  const msg = banned
    ? 'تم إيقاف الوصول من هذه الشبكة مؤقتاً لأسباب أمنية. إن كان ذلك خطأً فتواصل مع الوكالة.'
    : 'طلبات كثيرة من هذه الشبكة في وقت قصير. ستُعاد المحاولة تلقائياً خلال لحظات…';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${
    banned ? '' : '<meta http-equiv="refresh" content="30">'
  }<title>ساوث ستريت</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7f5;font-family:Tajawal,system-ui,sans-serif;color:#0f172a}main{max-width:360px;margin:16px;padding:28px 24px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 20px 40px -24px rgba(15,23,42,.25)}h1{font-size:1.15rem;margin:12px 0 6px}p{color:#64748b;line-height:1.8;margin:0}i{display:block;width:34px;height:34px;margin:0 auto;border-radius:50%;border:3px solid #d1fae5;border-top-color:#047857;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><main>${
    banned ? '' : '<i></i>'
  }<h1>لحظة من فضلك</h1><p>${msg}</p></main></body></html>`;
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const s = edge();
  const url = request.nextUrl;
  const ip = resolveRequestIp({
    forwarded: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    fallback: '',
  });

  const userAgent = request.headers.get('user-agent') || '';
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || request.nextUrl.host || '';
  const origin = request.headers.get('origin') || '';

  // CSRF: an API call that changes data must come from this site's own pages.
  // (The session cookie is SameSite=Lax too; this check is the second lock.)
  if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    let foreign = request.headers.get('sec-fetch-site') === 'cross-site';
    if (!foreign && origin) {
      try {
        foreign = new URL(origin).host !== host;
      } catch {
        foreign = true;
      }
    }
    if (foreign) {
      return NextResponse.json({ error: 'طلب مرفوض: مصدره موقع آخر', code: 'CROSS_SITE' }, { status: 403 });
    }
  }

  const contentType = request.headers.get('content-type') || '';
  const accept = request.headers.get('accept') || '';
  const scheme = (
    request.headers.get('x-forwarded-proto') ||
    request.nextUrl.protocol.replace(':', '') ||
    'https'
  ).toLowerCase();
  const httpVersion = resolveHttpVersion({
    forwardedHttp: request.headers.get('x-http-version') || request.headers.get('x-forwarded-http-version'),
    cfHttp: request.headers.get('cf-http-version'),
    altUsed: request.headers.get('alt-used'),
  });
  const isAuthPath =
    url.pathname.startsWith('/api/admin/auth') ||
    (url.pathname.startsWith('/api/auth') && url.pathname !== '/api/auth/config');
  // Pictures, fonts and icons are not counted towards the flood limit: one page
  // load fetches dozens of them, and a reload or two on a phone is not an attack.
  // They are still checked for scanners and attacks below.
  const staticAsset =
    /^\/(images|fonts|icons|og|uploads|videos)\//.test(url.pathname) ||
    url.pathname.startsWith('/api/staff-image/') ||
    /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|mp3|css|js|map|webmanifest)$/i.test(url.pathname);
  // A signed-in visitor (session cookie / bearer token) gets a wider allowance:
  // families and hotel groups share one Wi-Fi address. The Connect app's own API
  // traffic (messages, live stream, call set-up) is authenticated by its routes
  // and is not counted at all — a call must never trip the flood limit.
  const signedIn = Boolean(request.cookies.get('south_street_token')?.value || request.headers.get('authorization'));
  const uncounted = staticAsset || (signedIn && url.pathname.startsWith('/api/connect/')) || url.pathname === '/api/public/catalog';
  const counters = uncounted ? { count: 0, auth: 0 } : countHit(s, ip, isAuthPath);
  const query = url.search.replace(/^\?/, '').slice(0, 400);

  const verdict = classifyRequest({
    path: url.pathname,
    query,
    method: request.method,
    userAgent,
    ip,
    host,
    contentType,
    origin,
    recentHits: counters.count,
    recentAuthHits: counters.auth,
    floodThreshold: signedIn ? s.floodLimit * 4 : s.floodLimit,
  });

  const blocked = shouldBlock(s, ip, verdict);
  const asset = classifyAsset(url.pathname, request.method);
  const skipNoise = !s.listenAll && asset.noise && verdict.threat === 'CLEAN' && !blocked;

  if (!skipNoise) {
    const geo = resolveConnectionGeo({
      ip,
      country:
        request.headers.get('x-vercel-ip-country') ||
        request.headers.get('cf-ipcountry') ||
        request.headers.get('cloudfront-viewer-country') ||
        request.headers.get('x-country-code'),
      city: request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity'),
      region: request.headers.get('x-vercel-ip-country-region') || request.headers.get('cf-region'),
    });
    const cookieToken = request.cookies.get('south_street_token')?.value;
    const actor = peekJwtIdentity(cookieToken) || peekJwtIdentity(request.headers.get('authorization'));
    s.queue.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      ip,
      method: request.method,
      path: url.pathname,
      query,
      userAgent: userAgent.slice(0, 300),
      referer: (request.headers.get('referer') || '').slice(0, 200),
      threat: blocked && s.blocked.has(ip) ? 'BLOCKED' : verdict.threat,
      severity: blocked ? 'critical' : verdict.severity,
      reason: blocked ? `${verdict.reason || 'عنوان محظور'} — تم الرفض` : verdict.reason,
      blocked,
      trusted: false,
      country: geo.country,
      countryName: geo.countryName,
      city: geo.city,
      region: geo.region,
      geoId: geo.geoId,
      userId: actor?.userId || '',
      userName: actor?.userName || '',
      userRole: actor?.userRole || '',
      userRoleName: actor?.userRoleName || '',
      noise: false,
      dataClass: asset.dataClass,
      dataLabel: asset.dataLabel,
      scheme,
      httpVersion,
      host: host.slice(0, 180),
      origin: origin.slice(0, 180),
      contentType: contentType.slice(0, 120),
      accept: accept.slice(0, 160),
      requestLine: buildRequestLine({
        method: request.method,
        path: url.pathname,
        query,
        httpVersion,
      }).slice(0, 420),
    });
  }

  const stale = Date.now() - s.policyAt > POLICY_TTL_MS;
  const due = s.queue.length >= FLUSH_AT_COUNT || Date.now() - s.flushAt > FLUSH_EVERY_MS;
  if (stale || due) {
    event.waitUntil(flush(url.origin, s));
  }

  if (blocked) {
    // A page opened in the browser / installed app gets a readable page that
    // retries by itself (flood limits clear within a minute), not raw JSON.
    const isPage = request.method === 'GET' && (request.headers.get('sec-fetch-mode') === 'navigate' || accept.includes('text/html'));
    if (isPage) {
      return new NextResponse(blockedPage(s.blocked.has(ip)), {
        status: 429,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '30', 'Cache-Control': 'no-store' },
      });
    }
    return new NextResponse(
      JSON.stringify({ error: 'تم رفض الطلب من جدار الحماية', code: 'FIREWALL_BLOCK' }),
      { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Build assets are noise. The whole /api/security prefix is skipped so the
    // dashboard's own polling does not recurse into — or drown out — the feed.
    '/((?!_next/|favicon.ico|api/security/|api/session/heartbeat).*)',
  ],
};
