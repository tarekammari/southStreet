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
  | 'XSS'
  | 'SSTI'
  | 'SSRF'
  | 'TRAVERSAL'
  | 'WEBSHELL'
  | 'ZERO_DAY'
  | 'HEADER_ABUSE'
  | 'METHOD_ABUSE'
  | 'AUTH_ABUSE'
  | 'FLOOD'
  | 'NO_AGENT'
  | 'BLOCKED';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** What kind of application data this request touches. */
export type DataClass = 'none' | 'public' | 'session' | 'database' | 'users' | 'secrets' | 'auth';

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
  countryName?: string;
  city?: string;
  region?: string;
  geoId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  userRoleName?: string;
  noise?: boolean;
  dataClass?: DataClass;
  dataLabel?: string;
  /** http / https */
  scheme?: string;
  /** HTTP/1.1 or HTTP/2 */
  httpVersion?: string;
  host?: string;
  origin?: string;
  contentType?: string;
  accept?: string;
  /** e.g. GET /api/users?id=1 HTTP/1.1 */
  requestLine?: string;
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const THREAT_LABELS: Record<ThreatKind, string> = {
  CLEAN: 'سليم',
  BOT: 'روبوت',
  SCANNER: 'فحص ثغرات',
  INJECTION: 'حقن SQL',
  XSS: 'حقن سكربت',
  SSTI: 'حقن قوالب',
  SSRF: 'طلب خادم داخلي',
  TRAVERSAL: 'اختراق مسار',
  WEBSHELL: 'صدفة ويب',
  ZERO_DAY: 'استغلال معروف',
  HEADER_ABUSE: 'تلاعب بالترويسة',
  METHOD_ABUSE: 'طريقة HTTP محظورة',
  AUTH_ABUSE: 'اقتحام دخول',
  FLOOD: 'إغراق / DDoS',
  NO_AGENT: 'عميل مجهول',
  BLOCKED: 'محظور',
};

export const DATA_LABELS: Record<DataClass, string> = {
  none: '',
  public: '',
  session: 'جلسة',
  database: 'قاعدة البيانات',
  users: 'بيانات المستخدمين',
  secrets: 'كلمات المرور والمفاتيح',
  auth: 'محاولة دخول',
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
  /(bot|crawl|spider|slurp|scrapy|curl|wget|python-requests|httpclient|okhttp|java\/|go-http|libwww|perl|nikto|sqlmap|nmap|masscan|zgrab|nuclei|dirbuster|gobuster|ffuf|feroxbuster|wfuzz|wpscan|acunetix|nessus|openvas|burpsuite|sqlninja|hydra|medusa|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|censys|shodan|zmap|httpx|katana)/i;

/** Search engines we do not want to flag as hostile. */
const FRIENDLY_BOTS = /(googlebot|bingbot|duckduckbot|applebot|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp)/i;

/** Paths that only exist on other stacks — requesting them means someone is probing. */
const SCANNER_PATHS =
  /(\/wp-admin|\/wp-login|\/wp-content|\/wp-includes|xmlrpc\.php|\/phpmyadmin|\/pma\/|\/mysql|\/adminer|\/\.env|\/\.git|\/\.svn|\/\.aws|\/\.ssh|\/config\.php|\/shell|\/cgi-bin|eval-stdin\.php|\/vendor\/phpunit|\/solr\/|\/actuator|\/jenkins|\/\.well-known\/security|\/backup|\/dump\.sql|\/db\.sql|\/id_rsa|\/composer\.json|\/server-status|\/telescope|\/debug\/|\/phpinfo|\/info\.php|\/elmah|\/trace\.axd|\/web\.config|\/crossdomain\.xml|\/sitemap\.xml\.bak)/i;

/** Classic SQLi / command-injection markers. */
const INJECTION_PATTERNS =
  /(union(\s|\+|%20)+select|select.+from.+information_schema|or\s+1\s*=\s*1|and\s+1\s*=\s*1|';?\s*drop\s+table|waitfor\s+delay|xp_cmdshell|load_file\s*\(|into\s+(out|dump)file|\/etc\/passwd|cmd\.exe|powershell|base64_decode|\bexec\s*\(|benchmark\s*\(|sleep\s*\(\s*\d|pg_sleep|information_schema\.tables)/i;

const XSS_PATTERNS =
  /(<script[\s>]|javascript:|vbscript:|data:text\/html|on(error|load|click|mouseover|focus|submit|toggle|pointer)\s*=|<iframe|<svg[\s/][^>]*onload|<img[^>]+onerror|expression\s*\()/i;

const SSTI_PATTERNS =
  /(\{\{[^}]{0,80}(7\s*\*\s*7|config|self\.__class__|lipsum|request\.application)|\$\{jndi:|\$\{[^}]{0,40}7\s*\*\s*7|<%[=#][^%]{0,80}%>|#\{[^}]{0,40}\}|freemarker\.template)/i;

const SSRF_PATTERNS =
  /(169\.254\.169\.254|metadata\.google\.internal|metadata\.amazonaws\.com|latest\/meta-data|file:\/\/\/|gopher:\/\/|dict:\/\/|ldap:\/\/\/|0\.0\.0\.0(:\d+)?\/|127\.0\.0\.1:\d{2,5}\/)/i;

const TRAVERSAL_PATTERNS = /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%252e%252e|%c0%ae%c0%ae)/i;

const WEBSHELL_PATTERNS =
  /(\/c99|\/r57|\/weevely|\/wso\.php|\/b374k|\/filesman|eval-stdin|phpunit\/.*eval|\/alfa\.php|\/mini\.php|\/shell\.php|\/cmd\.php|\/backdoor|\/webshell)/i;

const ZERO_DAY_PATHS =
  /(\/cgi-bin\/luci|thinkphp|\/index\.php\?s=|\/vendor\/phpunit|\/solr\/.*config|\/actuator\/(gateway|env|heapdump)|\/_ignition\/execute-solution|\/debug\/default\/view|\/console\/|struts2|\/manager\/html|\/jmx-console|\/invoker\/JMX|\/owa\/auth|\/autodiscover|\/HNAP1|\/GponForm|\/setup\.cgi|\/boafrm\/|\/cgi-bin\/nas_sharing|\/wp-json\/.*exploit|\$\{jndi:)/i;

const NULL_BYTE = /(%00|\x00)/i;
const CRLF_INJECTION = /(%0d%0a|%0a%0d|\r\n)/i;
const GRAPHQL_INTROSPECTION = /__schema|__type\s*\{/;

const ABUSED_METHODS = new Set(['TRACE', 'TRACK', 'CONNECT', 'DEBUG', 'PROPFIND', 'MOVE', 'COPY', 'LOCK', 'UNLOCK']);

const AUTH_PATHS = /^\/api\/(admin\/auth|auth\/(register|connect|google)|account\/security)/i;

const CATALOG_GET =
  /^\/api\/(admin\/(content|packages|hotels|morshids|seasons|agency)|reviews|auth\/config)$/i;

export function classifyAsset(path: string, method: string): {
  noise: boolean;
  dataClass: DataClass;
  dataLabel: string;
} {
  const p = path || '/';
  const m = (method || 'GET').toUpperCase();

  if (/^\/api\/(admin\/auth|auth\/)/i.test(p)) {
    return { noise: false, dataClass: 'auth', dataLabel: DATA_LABELS.auth };
  }
  if (/^\/api\/(admin\/(security-key|credentials)|account\/security)/i.test(p)) {
    return { noise: false, dataClass: 'secrets', dataLabel: DATA_LABELS.secrets };
  }
  if (/^\/api\/(admin\/users|users)\b/i.test(p)) {
    return { noise: false, dataClass: 'users', dataLabel: DATA_LABELS.users };
  }
  if (/^\/api\/admin\/db-tables/i.test(p)) {
    return { noise: false, dataClass: 'database', dataLabel: 'جداول قاعدة البيانات' };
  }
  if (p.startsWith('/api/session/heartbeat')) {
    return { noise: true, dataClass: 'session', dataLabel: '' };
  }
  if (m === 'GET' && CATALOG_GET.test(p)) {
    return { noise: true, dataClass: 'public', dataLabel: '' };
  }
  if (p.startsWith('/api/') && m !== 'GET') {
    return { noise: false, dataClass: 'database', dataLabel: DATA_LABELS.database };
  }
  if (p.startsWith('/api/admin/')) {
    return { noise: false, dataClass: 'database', dataLabel: DATA_LABELS.database };
  }
  if (m === 'GET' && !p.startsWith('/api/')) {
    return { noise: true, dataClass: 'public', dataLabel: '' };
  }
  return { noise: false, dataClass: 'none', dataLabel: '' };
}

export function isSensitiveData(dataClass?: DataClass): boolean {
  return dataClass === 'users' || dataClass === 'secrets' || dataClass === 'auth' || dataClass === 'database';
}

export function isImportantEvent(event: {
  threat: ThreatKind;
  blocked?: boolean;
  noise?: boolean;
  dataClass?: DataClass;
}): boolean {
  if (event.blocked) return true;
  if (event.threat !== 'CLEAN') return true;
  if (isSensitiveData(event.dataClass)) return true;
  return !event.noise;
}

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

/**
 * Local Next.js has no x-forwarded-for, so the firewall used to label every
 * request as "unknown" and then flood-block the operator's own dashboard.
 */
export function resolveRequestIp(input: {
  forwarded?: string | null;
  realIp?: string | null;
  fallback?: string | null;
}): string {
  const forwarded = (input.forwarded || '').split(',')[0].trim();
  const real = (input.realIp || '').trim();
  const fallback = (input.fallback || '').trim();
  const normalized = normalizeIp(forwarded || real || fallback);
  if (!normalized || normalized === 'unknown' || normalized === '::1' || normalized === 'localhost') return '127.0.0.1';
  return normalized;
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
  host?: string;
  contentType?: string;
  origin?: string;
  /** Requests seen from this IP inside the current sliding window. */
  recentHits?: number;
  /** Failed auth attempts already recorded for this IP. */
  recentAuthHits?: number;
  floodThreshold?: number;
};

export function classifyRequest(input: ClassifyInput): Verdict {
  const path = input.path || '/';
  const query = input.query || '';
  const method = (input.method || 'GET').toUpperCase();
  const target = `${path}?${query}`;
  const decoded = decodeSafely(target);
  const ua = input.userAgent || '';
  const trusted = isTrustedIp(input.ip);
  const host = input.host || '';
  const origin = input.origin || '';
  const contentType = input.contentType || '';
  const haystack = `${decoded} ${host} ${origin} ${contentType}`;

  if (ABUSED_METHODS.has(method)) {
    return { threat: 'METHOD_ABUSE', severity: 'high', reason: `طريقة HTTP غير مسموحة (${method})` };
  }

  if (NULL_BYTE.test(target) || CRLF_INJECTION.test(haystack)) {
    return { threat: 'HEADER_ABUSE', severity: 'critical', reason: 'محاولة حقن ترويسة أو بايت فارغ' };
  }

  if (host && /[\s<>'"]/.test(host)) {
    return { threat: 'HEADER_ABUSE', severity: 'high', reason: 'ترويسة Host غير صالحة' };
  }

  if (TRAVERSAL_PATTERNS.test(target)) {
    return { threat: 'TRAVERSAL', severity: 'critical', reason: 'محاولة الوصول لمسارات خارج جذر التطبيق' };
  }

  if (WEBSHELL_PATTERNS.test(path) || WEBSHELL_PATTERNS.test(decoded)) {
    return { threat: 'WEBSHELL', severity: 'critical', reason: 'محاولة رفع أو استدعاء صدفة ويب' };
  }

  if (ZERO_DAY_PATHS.test(path) || ZERO_DAY_PATHS.test(haystack)) {
    return { threat: 'ZERO_DAY', severity: 'critical', reason: `محاولة استغلال معروف على ${path}` };
  }

  if (SSRF_PATTERNS.test(decoded)) {
    return { threat: 'SSRF', severity: 'critical', reason: 'محاولة الوصول لموارد داخلية عبر الرابط' };
  }

  if (SSTI_PATTERNS.test(decoded)) {
    return { threat: 'SSTI', severity: 'critical', reason: 'نمط حقن قوالب الخادم' };
  }

  if (XSS_PATTERNS.test(decoded)) {
    return { threat: 'XSS', severity: 'high', reason: 'نمط حقن سكربت داخل الرابط' };
  }

  if (INJECTION_PATTERNS.test(decoded) || GRAPHQL_INTROSPECTION.test(decoded)) {
    return { threat: 'INJECTION', severity: 'critical', reason: 'نمط حقن SQL أو استعلام غير مشروع داخل الرابط' };
  }

  if (SCANNER_PATHS.test(path)) {
    return { threat: 'SCANNER', severity: 'high', reason: `فحص مسار غير موجود على هذا الخادم (${path})` };
  }

  const floodLimit = input.floodThreshold ?? 60;
  if (!trusted && (input.recentHits ?? 0) > floodLimit) {
    return { threat: 'FLOOD', severity: 'high', reason: `${input.recentHits} طلب خلال دقيقة واحدة من نفس العنوان` };
  }

  if (!trusted && AUTH_PATHS.test(path) && (input.recentAuthHits ?? 0) > 4) {
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

export function resolveHttpVersion(headers: {
  forwardedHttp?: string | null;
  cfHttp?: string | null;
  altUsed?: string | null;
}): string {
  const raw = (headers.forwardedHttp || headers.cfHttp || '').trim();
  if (/^HTTP\/\d/i.test(raw)) return raw.toUpperCase().replace(/HTTP\/2\.0/i, 'HTTP/2');
  if (raw === '2' || raw === 'h2' || raw === 'h2c') return 'HTTP/2';
  if (raw === '3' || raw === 'h3') return 'HTTP/3';
  if (raw === '1.0') return 'HTTP/1.0';
  if (headers.altUsed) return 'HTTP/2';
  return 'HTTP/1.1';
}

export function buildRequestLine(input: {
  method: string;
  path: string;
  query?: string;
  httpVersion?: string;
}): string {
  const method = (input.method || 'GET').toUpperCase();
  const path = input.path || '/';
  const qs = input.query ? `?${input.query}` : '';
  const version = input.httpVersion || 'HTTP/1.1';
  return `${method} ${path}${qs} ${version}`;
}

export function parseQueryPairs(query?: string | null): { key: string; value: string }[] {
  const raw = String(query || '').replace(/^\?/, '');
  if (!raw) return [];
  return raw.split('&').slice(0, 24).map((part) => {
    const eq = part.indexOf('=');
    if (eq < 0) return { key: decodeSafely(part), value: '' };
    return { key: decodeSafely(part.slice(0, eq)), value: decodeSafely(part.slice(eq + 1)).slice(0, 180) };
  });
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

const COUNTRY_NAMES: Record<string, string> = {
  DZ: 'الجزائر',
  SA: 'السعودية',
  AE: 'الإمارات',
  EG: 'مصر',
  MA: 'المغرب',
  TN: 'تونس',
  LY: 'ليبيا',
  MR: 'موريتانيا',
  FR: 'فرنسا',
  US: 'الولايات المتحدة',
  GB: 'بريطانيا',
  DE: 'ألمانيا',
  IT: 'إيطاليا',
  ES: 'إسبانيا',
  TR: 'تركيا',
  QA: 'قطر',
  KW: 'الكويت',
  BH: 'البحرين',
  OM: 'عُمان',
  JO: 'الأردن',
  LB: 'لبنان',
  IQ: 'العراق',
  SY: 'سوريا',
  YE: 'اليمن',
  PS: 'فلسطين',
  CN: 'الصين',
  RU: 'روسيا',
  IN: 'الهند',
  PK: 'باكستان',
  NL: 'هولندا',
  BE: 'بلجيكا',
  CA: 'كندا',
  AU: 'أستراليا',
  BR: 'البرازيل',
  NG: 'نيجيريا',
  SN: 'السنغال',
};

export type ConnectionGeo = {
  country: string;
  countryName: string;
  city: string;
  region: string;
  geoId: string;
};

function fingerprint(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
}

function slugPart(value: string, fallback: string): string {
  const slug = (value || '')
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 10);
  return slug || fallback;
}

export function countryNameOf(code: string): string {
  const cc = (code || '').trim().toUpperCase();
  if (!cc) return 'غير معروف';
  return COUNTRY_NAMES[cc] || cc;
}

export function flagEmoji(code: string): string {
  const cc = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}

/** Edge-safe geo label. Private IPs map to the agency's home country. */
export function resolveConnectionGeo(input: {
  ip: string;
  country?: string | null;
  city?: string | null;
  region?: string | null;
}): ConnectionGeo {
  const ip = normalizeIp(input.ip);
  const headerCountry = (input.country || '').trim().toUpperCase();
  const headerCity = (input.city || '').trim();
  const headerRegion = (input.region || '').trim();
  const local = isTrustedIp(ip);

  const country = headerCountry || (local ? 'DZ' : '');
  const countryName = countryNameOf(country);
  const city = headerCity || (local ? 'الجهاز المحلي' : '');
  const region = headerRegion || (local ? 'خادم الوكالة' : '');
  const place = local ? 'LOCAL' : slugPart(headerRegion || headerCity, country ? 'WAN' : 'UNK');
  const geoId = `GEO-${country || 'XX'}-${place}-${fingerprint(ip)}`;

  return { country, countryName, city, region, geoId };
}

export type RequestActor = {
  userId: string;
  userName: string;
  userRole: string;
  userRoleName: string;
};

function utf8FromBinary(binary: string): string {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
  return new TextDecoder('utf-8').decode(bytes);
}

/** Fix Arabic that was decoded as Latin-1 (Ø·Ø§Ø±Ù …). */
export function repairMojibake(value?: string | null): string {
  const text = String(value || '');
  if (!text) return '';
  if (/[\u0600-\u06FF]/.test(text) && !/[À-ÿ]{2,}/.test(text)) return text;
  if (!/[À-ÿ]/.test(text)) return text;
  try {
    const fixed = utf8FromBinary(text);
    if (/[\u0600-\u06FF]/.test(fixed)) return fixed;
  } catch {
    /* keep original */
  }
  return text;
}

/** Decode a JWT payload without verifying it — telemetry only, never authorization. */
export function peekJwtIdentity(token?: string | null): RequestActor | null {
  let raw = (token || '').trim().replace(/^Bearer\s+/i, '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* already decoded */
  }
  if (!raw || raw.split('.').length < 2) return null;
  try {
    const payload = raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(utf8FromBinary(atob(pad))) as {
      sub?: string;
      name?: string;
      role?: string;
      roleName?: string;
      username?: string;
    };
    if (!json.sub && !json.name) return null;
    return {
      userId: String(json.sub || ''),
      userName: repairMojibake(json.name || json.username || ''),
      userRole: String(json.role || ''),
      userRoleName: repairMojibake(json.roleName || ''),
    };
  } catch {
    return null;
  }
}
