/**
 * Request threat classification.
 *
 * This module is imported by the Edge middleware, so it must stay free of Node
 * built-ins (no crypto/fs/path) and of any `better-sqlite3` import chain.
 */

export type ThreatKind =
  | 'CLEAN'
  | 'BOT'
  | 'SCANNER'
  | 'INJECTION'
  | 'TRAVERSAL'
  | 'AUTH_ABUSE'
  | 'FLOOD'
  | 'NO_AGENT'
  | 'BLOCKED';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SecurityEvent = {
  id: string;
  ts: string;
  ip: string;
  method: string;
  path: string;
  query: string;
  userAgent: string;
  referer: string;
  threat: ThreatKind;
  severity: Severity;
  reason: string;
  blocked: boolean;
  trusted: boolean;
  country: string;
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const THREAT_LABELS: Record<ThreatKind, string> = {
  CLEAN: 'طلب سليم',
  BOT: 'روبوت / زاحف',
  SCANNER: 'فحص ثغرات',
  INJECTION: 'محاولة حقن',
  TRAVERSAL: 'اختراق مسار',
  AUTH_ABUSE: 'ضغط على الدخول',
  FLOOD: 'إغراق بالطلبات',
  NO_AGENT: 'عميل مجهول',
  BLOCKED: 'محظور بالجدار',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: 'عادي',
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
  critical: 'حرج',
};

/** Crawlers and scanners that identify themselves in the User-Agent. */
const BOT_AGENTS =
  /(bot|crawl|spider|slurp|scrapy|curl|wget|python-requests|httpclient|okhttp|java\/|go-http|libwww|perl|nikto|sqlmap|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|wpscan|acunetix|nessus|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|censys|shodan)/i;

/** Search engines we do not want to flag as hostile. */
const FRIENDLY_BOTS = /(googlebot|bingbot|duckduckbot|applebot|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp)/i;

/** Paths that only exist on other stacks — requesting them means someone is probing. */
const SCANNER_PATHS =
  /(\/wp-admin|\/wp-login|\/wp-content|\/wp-includes|xmlrpc\.php|\/phpmyadmin|\/pma\/|\/mysql|\/adminer|\/\.env|\/\.git|\/\.svn|\/\.aws|\/\.ssh|\/config\.php|\/shell|\/cgi-bin|eval-stdin\.php|\/vendor\/phpunit|\/solr\/|\/actuator|\/jenkins|\/\.well-known\/security|\/backup|\/dump\.sql|\/db\.sql|\/id_rsa|\/composer\.json|\/server-status|\/telescope|\/debug\/)/i;

/** Classic SQLi / XSS / command-injection markers. */
const INJECTION_PATTERNS =
  /(union(\s|\+|%20)+select|select.+from.+information_schema|or\s+1\s*=\s*1|';?\s*drop\s+table|<script|javascript:|onerror\s*=|onload\s*=|\$\{jndi:|\/etc\/passwd|cmd\.exe|powershell|base64_decode|\bexec\s*\(|benchmark\s*\(|sleep\s*\(\s*\d)/i;

const TRAVERSAL_PATTERNS = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%252e%252e)/i;

const AUTH_PATHS = /^\/api\/(admin\/auth|auth\/(register|connect|google)|account\/security)/i;

/** Loopback and RFC1918 space — the operator's own network. */
export function isTrustedIp(ip: string): boolean {
  const value = (ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
  if (!value) return false;
  if (value === '::1' || value === 'localhost' || value === '127.0.0.1') return true;
  if (value.startsWith('127.')) return true;
  if (value.startsWith('10.')) return true;
  if (value.startsWith('192.168.')) return true;
  if (value.startsWith('169.254.')) return true;
  if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
  const m = value.match(/^172\.(\d{1,3})\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function normalizeIp(ip: string): string {
  return (ip || '').trim().replace(/^::ffff:/, '') || 'unknown';
}

export type Verdict = {
  threat: ThreatKind;
  severity: Severity;
  reason: string;
};

export type ClassifyInput = {
  path: string;
  query: string;
  method: string;
  userAgent: string;
  ip: string;
  /** Requests seen from this IP inside the current sliding window. */
  recentHits?: number;
  /** Failed auth attempts already recorded for this IP. */
  recentAuthHits?: number;
  floodThreshold?: number;
};

export function classifyRequest(input: ClassifyInput): Verdict {
  const path = input.path || '/';
  const query = input.query || '';
  const target = `${path}?${query}`;
  const ua = input.userAgent || '';
  const trusted = isTrustedIp(input.ip);

  if (TRAVERSAL_PATTERNS.test(target)) {
    return { threat: 'TRAVERSAL', severity: 'critical', reason: 'محاولة الوصول لمسارات خارج جذر التطبيق' };
  }

  if (INJECTION_PATTERNS.test(decodeSafely(target))) {
    return { threat: 'INJECTION', severity: 'critical', reason: 'نمط حقن SQL أو سكربت داخل الرابط' };
  }

  if (SCANNER_PATHS.test(path)) {
    return { threat: 'SCANNER', severity: 'high', reason: `فحص مسار غير موجود على هذا الخادم (${path})` };
  }

  const floodLimit = input.floodThreshold ?? 120;
  if (!trusted && (input.recentHits ?? 0) > floodLimit) {
    return { threat: 'FLOOD', severity: 'high', reason: `${input.recentHits} طلب خلال دقيقة واحدة من نفس العنوان` };
  }

  if (!trusted && AUTH_PATHS.test(path) && (input.recentAuthHits ?? 0) > 8) {
    return { threat: 'AUTH_ABUSE', severity: 'high', reason: `${input.recentAuthHits} محاولة دخول متتالية` };
  }

  if (!ua.trim()) {
    return { threat: 'NO_AGENT', severity: trusted ? 'info' : 'medium', reason: 'طلب بدون تعريف متصفح' };
  }

  if (BOT_AGENTS.test(ua) && !FRIENDLY_BOTS.test(ua)) {
    return { threat: 'BOT', severity: 'medium', reason: `أداة آلية: ${shortAgent(ua)}` };
  }

  if (FRIENDLY_BOTS.test(ua)) {
    return { threat: 'BOT', severity: 'info', reason: `زاحف معروف: ${shortAgent(ua)}` };
  }

  return { threat: 'CLEAN', severity: 'info', reason: '' };
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function shortAgent(ua: string): string {
  if (!ua) return 'غير معروف';
  const match = ua.match(/^[A-Za-z0-9._-]+/);
  return (match ? match[0] : ua).slice(0, 40);
}

export function isSuspicious(verdict: Verdict): boolean {
  return verdict.threat !== 'CLEAN' && SEVERITY_ORDER[verdict.severity] >= SEVERITY_ORDER.medium;
}
