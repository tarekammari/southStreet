import { getSqliteDb } from '@/lib/sqlite';
import {
  isTrustedIp,
  normalizeIp,
  SEVERITY_ORDER,
  type SecurityEvent,
  type Severity,
  type ThreatKind,
} from '@/lib/security-threats';

/**
 * Live request telemetry lives in memory: it is high volume, short lived, and the
 * SQLite layer encrypts TEXT columns with a random IV (which would make it both
 * slow and unsearchable). Only firewall rules and notable incidents are persisted.
 */
const LIVE_BUFFER_SIZE = 600;
const INCIDENT_KEEP = 1500;
const RATE_WINDOW_MS = 60_000;

type IpStat = {
  ip: string;
  hits: number;
  authHits: number;
  blocked: number;
  threats: number;
  firstSeen: number;
  lastSeen: number;
  lastPath: string;
  lastAgent: string;
  worst: Severity;
};

type MonitorState = {
  live: SecurityEvent[];
  ips: Map<string, IpStat>;
  window: { start: number; total: number; blocked: number; threats: number };
  totals: { requests: number; blocked: number; threats: number; bots: number };
  bootedAt: number;
};

const g = globalThis as unknown as { __ssSecurityMonitor?: MonitorState };

function state(): MonitorState {
  if (!g.__ssSecurityMonitor) {
    g.__ssSecurityMonitor = {
      live: [],
      ips: new Map(),
      window: { start: Date.now(), total: 0, blocked: 0, threats: 0 },
      totals: { requests: 0, blocked: 0, threats: 0, bots: 0 },
      bootedAt: Date.now(),
    };
  }
  return g.__ssSecurityMonitor;
}

/* ────────────────────────────── persistence ────────────────────────────── */

let tablesReady = false;

function db() {
  const database = getSqliteDb();
  if (!tablesReady) {
    // `rule_key` / `rule_type` / `status` stay plaintext under the DB crypto layer,
    // which is what makes exact-match lookups on an IP possible.
    database.exec(`
      CREATE TABLE IF NOT EXISTS firewall_rules (
        id TEXT PRIMARY KEY,
        rule_key TEXT NOT NULL,
        rule_type TEXT NOT NULL DEFAULT 'BLOCK',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        note TEXT,
        createdAt TEXT,
        createdBy TEXT,
        hits INTEGER DEFAULT 0
      );

      -- occurred_ms is an INTEGER because the crypto layer encrypts TEXT with a
      -- random IV, which would make ORDER BY on a timestamp string meaningless.
      CREATE TABLE IF NOT EXISTS security_incidents (
        id TEXT PRIMARY KEY,
        occurred_ms INTEGER,
        rule_key TEXT,
        rule_type TEXT,
        status TEXT,
        method TEXT,
        path TEXT,
        agent TEXT,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS firewall_settings (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        block_bots INTEGER DEFAULT 0,
        block_scanners INTEGER DEFAULT 1,
        block_injection INTEGER DEFAULT 1,
        flood_limit INTEGER DEFAULT 120
      );

      CREATE INDEX IF NOT EXISTS idx_fw_rules_key ON firewall_rules(rule_key);
      CREATE INDEX IF NOT EXISTS idx_incidents_at ON security_incidents(occurred_ms);
    `);
    tablesReady = true;
  }
  return database;
}

export type FirewallSettings = {
  enabled: boolean;
  blockBots: boolean;
  blockScanners: boolean;
  blockInjection: boolean;
  floodLimit: number;
};

const DEFAULT_SETTINGS: FirewallSettings = {
  enabled: true,
  blockBots: false,
  blockScanners: true,
  blockInjection: true,
  floodLimit: 120,
};

export function getFirewallSettings(): FirewallSettings {
  try {
    const row = db().prepare('SELECT * FROM firewall_settings WHERE id = ?').get('main') as any;
    if (!row) {
      db().exec(
        `INSERT INTO firewall_settings (id, status, block_bots, block_scanners, block_injection, flood_limit)
         VALUES ('main', 'ACTIVE', 0, 1, 1, 120)`
      );
      return DEFAULT_SETTINGS;
    }
    return {
      enabled: row.status !== 'OFF',
      blockBots: Boolean(row.block_bots),
      blockScanners: Boolean(row.block_scanners),
      blockInjection: Boolean(row.block_injection),
      floodLimit: Number(row.flood_limit) || 120,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateFirewallSettings(patch: Partial<FirewallSettings>): FirewallSettings {
  const current = getFirewallSettings();
  const next = { ...current, ...patch };
  try {
    const args = [
      next.enabled ? 'ACTIVE' : 'OFF',
      next.blockBots ? 1 : 0,
      next.blockScanners ? 1 : 0,
      next.blockInjection ? 1 : 0,
      Number(next.floodLimit) || 120,
    ] as const;

    const updated = db()
      .prepare(
        `UPDATE firewall_settings
         SET status = ?, block_bots = ?, block_scanners = ?, block_injection = ?, flood_limit = ?
         WHERE id = 'main'`
      )
      .run(...args);

    if (updated.changes === 0) {
      db()
        .prepare(
          `INSERT INTO firewall_settings (id, status, block_bots, block_scanners, block_injection, flood_limit)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run('main', ...args);
    }
  } catch {
    /* settings fall back to defaults if the table is unavailable */
  }
  invalidatePolicy();
  return next;
}

export type FirewallRule = {
  id: string;
  ip: string;
  type: 'BLOCK' | 'ALLOW';
  active: boolean;
  note: string;
  createdAt: string;
  createdBy: string;
  hits: number;
};

export function listRules(): FirewallRule[] {
  try {
    const rows = db().prepare('SELECT * FROM firewall_rules').all() as any[];
    return rows
      .map((r) => ({
        id: r.id,
        ip: r.rule_key,
        type: (r.rule_type === 'ALLOW' ? 'ALLOW' : 'BLOCK') as 'BLOCK' | 'ALLOW',
        active: r.status !== 'OFF',
        note: r.note || '',
        createdAt: r.createdAt || '',
        createdBy: r.createdBy || '',
        hits: Number(r.hits) || 0,
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export function upsertRule(input: {
  ip: string;
  type?: 'BLOCK' | 'ALLOW';
  note?: string;
  createdBy?: string;
}): FirewallRule[] {
  const ip = normalizeIp(input.ip);
  if (!ip || ip === 'unknown') return listRules();

  const existing = db().prepare('SELECT id FROM firewall_rules WHERE rule_key = ?').get(ip) as any;
  if (existing) {
    db()
      .prepare('UPDATE firewall_rules SET rule_type = ?, status = ?, note = ? WHERE id = ?')
      .run(input.type || 'BLOCK', 'ACTIVE', input.note || '', existing.id);
  } else {
    db()
      .prepare(
        `INSERT INTO firewall_rules (id, rule_key, rule_type, status, note, createdAt, createdBy, hits)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, 0)`
      )
      .run(
        `fw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ip,
        input.type || 'BLOCK',
        input.note || '',
        new Date().toISOString(),
        input.createdBy || 'admin'
      );
  }
  invalidatePolicy();
  return listRules();
}

export function setRuleStatus(id: string, active: boolean): FirewallRule[] {
  db().prepare('UPDATE firewall_rules SET status = ? WHERE id = ?').run(active ? 'ACTIVE' : 'OFF', id);
  invalidatePolicy();
  return listRules();
}

export function deleteRule(id: string): FirewallRule[] {
  db().prepare('DELETE FROM firewall_rules WHERE id = ?').run(id);
  invalidatePolicy();
  return listRules();
}

/* ─────────────────────────── policy (edge cache) ─────────────────────────── */

export type SecurityPolicy = {
  version: number;
  blocked: string[];
  allowed: string[];
  settings: FirewallSettings;
};

let policyCache: SecurityPolicy | null = null;

function invalidatePolicy() {
  policyCache = null;
}

export function getPolicy(): SecurityPolicy {
  if (policyCache) return policyCache;
  const rules = listRules().filter((r) => r.active);
  policyCache = {
    version: Date.now(),
    blocked: rules.filter((r) => r.type === 'BLOCK').map((r) => r.ip),
    allowed: rules.filter((r) => r.type === 'ALLOW').map((r) => r.ip),
    settings: getFirewallSettings(),
  };
  return policyCache;
}

/* ─────────────────────────────── ingestion ─────────────────────────────── */

function rollWindow(s: MonitorState) {
  if (Date.now() - s.window.start > RATE_WINDOW_MS) {
    s.window = { start: Date.now(), total: 0, blocked: 0, threats: 0 };
    for (const stat of s.ips.values()) {
      if (Date.now() - stat.lastSeen > RATE_WINDOW_MS) {
        stat.hits = 0;
        stat.authHits = 0;
      }
    }
  }
}

export function recordEvents(events: SecurityEvent[]): void {
  if (!events?.length) return;
  const s = state();
  rollWindow(s);

  const incidents: SecurityEvent[] = [];

  for (const raw of events) {
    const event: SecurityEvent = {
      ...raw,
      ip: normalizeIp(raw.ip),
      trusted: isTrustedIp(raw.ip),
    };

    s.live.push(event);
    s.totals.requests += 1;
    s.window.total += 1;
    if (event.blocked) {
      s.totals.blocked += 1;
      s.window.blocked += 1;
    }
    if (event.threat !== 'CLEAN') {
      s.totals.threats += 1;
      s.window.threats += 1;
    }
    if (event.threat === 'BOT') s.totals.bots += 1;

    const stat = s.ips.get(event.ip) || {
      ip: event.ip,
      hits: 0,
      authHits: 0,
      blocked: 0,
      threats: 0,
      firstSeen: Date.parse(event.ts) || Date.now(),
      lastSeen: 0,
      lastPath: '',
      lastAgent: '',
      worst: 'info' as Severity,
    };
    stat.hits += 1;
    stat.lastSeen = Date.parse(event.ts) || Date.now();
    stat.lastPath = event.path;
    stat.lastAgent = event.userAgent;
    if (event.blocked) stat.blocked += 1;
    if (event.threat !== 'CLEAN') stat.threats += 1;
    if (event.path.startsWith('/api/admin/auth') || event.path.startsWith('/api/auth')) stat.authHits += 1;
    if (SEVERITY_ORDER[event.severity] > SEVERITY_ORDER[stat.worst]) stat.worst = event.severity;
    s.ips.set(event.ip, stat);

    if (event.blocked || SEVERITY_ORDER[event.severity] >= SEVERITY_ORDER.medium) {
      incidents.push(event);
    }
  }

  if (s.live.length > LIVE_BUFFER_SIZE) {
    s.live = s.live.slice(s.live.length - LIVE_BUFFER_SIZE);
  }

  if (incidents.length) persistIncidents(incidents);
  bumpRuleHits(events);
}

function persistIncidents(events: SecurityEvent[]) {
  try {
    const database = db();
    const insert = database.prepare(
      `INSERT OR IGNORE INTO security_incidents
       (id, occurred_ms, rule_key, rule_type, status, method, path, agent, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = database.transaction(() => {
      for (const e of events) {
        insert.run(
          e.id,
          Date.parse(e.ts) || Date.now(),
          e.ip,
          e.threat,
          e.blocked ? 'BLOCKED' : e.severity.toUpperCase(),
          e.method,
          `${e.path}${e.query ? `?${e.query}` : ''}`.slice(0, 400),
          (e.userAgent || '').slice(0, 300),
          e.reason
        );
      }
    });
    tx();

    const count = (database.prepare('SELECT COUNT(*) AS c FROM security_incidents').get() as any)?.c || 0;
    if (count > INCIDENT_KEEP) {
      database
        .prepare(
          `DELETE FROM security_incidents WHERE id IN (
             SELECT id FROM security_incidents ORDER BY occurred_ms ASC LIMIT ?
           )`
        )
        .run(count - INCIDENT_KEEP);
    }
  } catch {
    /* incident history is best-effort; the live feed is the source of truth */
  }
}

function bumpRuleHits(events: SecurityEvent[]) {
  const blockedIps = [...new Set(events.filter((e) => e.blocked).map((e) => normalizeIp(e.ip)))];
  if (!blockedIps.length) return;
  try {
    const stmt = db().prepare('UPDATE firewall_rules SET hits = hits + 1 WHERE rule_key = ?');
    for (const ip of blockedIps) stmt.run(ip);
  } catch {
    /* counters are cosmetic */
  }
}

/* ──────────────────────────────── reading ──────────────────────────────── */

export type IpSummary = {
  ip: string;
  hits: number;
  blocked: number;
  threats: number;
  worst: Severity;
  trusted: boolean;
  lastSeen: string;
  lastPath: string;
  agent: string;
  ruled: 'BLOCK' | 'ALLOW' | null;
};

export function getLiveFeed(limit = 120, options?: { severity?: Severity; onlyThreats?: boolean }): SecurityEvent[] {
  const s = state();
  let feed = [...s.live].reverse();
  if (options?.onlyThreats) feed = feed.filter((e) => e.threat !== 'CLEAN');
  if (options?.severity) {
    const min = SEVERITY_ORDER[options.severity];
    feed = feed.filter((e) => SEVERITY_ORDER[e.severity] >= min);
  }
  return feed.slice(0, limit);
}

export function getIpSummaries(limit = 20): IpSummary[] {
  const s = state();
  const rules = new Map(listRules().filter((r) => r.active).map((r) => [r.ip, r.type]));
  return [...s.ips.values()]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, limit)
    .map((stat) => ({
      ip: stat.ip,
      hits: stat.hits,
      blocked: stat.blocked,
      threats: stat.threats,
      worst: stat.worst,
      trusted: isTrustedIp(stat.ip),
      lastSeen: new Date(stat.lastSeen).toISOString(),
      lastPath: stat.lastPath,
      agent: stat.lastAgent,
      ruled: (rules.get(stat.ip) as 'BLOCK' | 'ALLOW') || null,
    }));
}

export type IncidentRow = {
  id: string;
  at: string;
  ip: string;
  threat: ThreatKind;
  status: string;
  method: string;
  path: string;
  agent: string;
  note: string;
};

export function listIncidents(limit = 60): IncidentRow[] {
  try {
    const rows = db()
      .prepare('SELECT * FROM security_incidents ORDER BY occurred_ms DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      at: new Date(Number(r.occurred_ms) || 0).toISOString(),
      ip: r.rule_key,
      threat: r.rule_type as ThreatKind,
      status: r.status,
      method: r.method,
      path: r.path,
      agent: r.agent,
      note: r.note || '',
    }));
  } catch {
    return [];
  }
}

export function getSecuritySummary() {
  const s = state();
  rollWindow(s);
  const live = s.live;
  const uniqueIps = s.ips.size;
  const untrusted = [...s.ips.values()].filter((v) => !isTrustedIp(v.ip)).length;
  const critical = live.filter((e) => e.severity === 'critical').length;

  return {
    uptimeSince: new Date(s.bootedAt).toISOString(),
    totalRequests: s.totals.requests,
    totalBlocked: s.totals.blocked,
    totalThreats: s.totals.threats,
    totalBots: s.totals.bots,
    requestsPerMinute: s.window.total,
    blockedPerMinute: s.window.blocked,
    threatsPerMinute: s.window.threats,
    uniqueIps,
    untrustedIps: untrusted,
    criticalInBuffer: critical,
    bufferSize: live.length,
  };
}

/** Sliding-window counters the middleware uses for flood detection. */
export function getIpCounters(ip: string): { hits: number; authHits: number } {
  const stat = state().ips.get(normalizeIp(ip));
  return { hits: stat?.hits || 0, authHits: stat?.authHits || 0 };
}

export function clearLiveFeed(): void {
  const s = state();
  s.live = [];
  s.ips.clear();
  s.window = { start: Date.now(), total: 0, blocked: 0, threats: 0 };
}
