import os from 'os';
import fs from 'fs';
import path from 'path';
import { getSecuritySummary } from '@/lib/security-monitor';
import { listSessions } from '@/lib/presence';
import { getSqliteDb } from '@/lib/sqlite';
import { resolveDbPath } from '@/lib/db-path';
import { collectTopUsers, type TopUserUsage } from '@/lib/top-users';
import { getAdminKeyMeta, type AdminKeyMeta } from '@/lib/admin-key';

export type HealthSample = {
  t: number;
  cpu: number;
  ram: number;
  disk: number;
};

export type DatabaseTableUsage = {
  name: string;
  label: string;
  rows: number;
  bytes: number;
  percent: number;
};

export type DatabaseUsage = {
  id: string;
  name: string;
  label: string;
  engine: string;
  path: string;
  bytes: number;
  walBytes: number;
  tables: number;
  rows: number;
  percentOfData: number;
  percentOfDisk: number;
  tablesUsage: DatabaseTableUsage[];
};

export type ServerHealth = {
  hostname: string;
  platform: string;
  arch: string;
  node: string;
  cores: number;
  cpuPercent: number;
  loadAvg: number[];
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
    processRss: number;
    processHeap: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  } | null;
  uptime: {
    process: number;
    system: number;
  };
  capacity: number;
  status: 'ok' | 'warn' | 'hot';
  traffic: {
    requestsPerMinute: number;
    blockedPerMinute: number;
    uniqueIps: number;
    sessions: number;
    totalRequests: number;
  };
  databases: DatabaseUsage[];
  topUsers: TopUserUsage[];
  adminKey: AdminKeyMeta;
  history: HealthSample[];
};

const HISTORY = 36;
const DB_CACHE_MS = 20000;
const g = globalThis as unknown as {
  __ssHealthCpu?: { cpu: NodeJS.CpuUsage; t: number };
  __ssHealthHist?: HealthSample[];
  __ssDbUsage?: { at: number; data: { tables: DatabaseTableUsage[]; rows: number; bytes: number } };
};

function cpuPercent(): number {
  const now = process.cpuUsage();
  const t = Date.now();
  const prev = g.__ssHealthCpu;
  g.__ssHealthCpu = { cpu: now, t };
  if (!prev) return 0;
  const elapsedUs = Math.max(1, (t - prev.t) * 1000);
  const used = now.user - prev.cpu.user + (now.system - prev.cpu.system);
  const cores = Math.max(1, os.cpus().length);
  return Math.max(0, Math.min(100, (used / elapsedUs / cores) * 100));
}

function readDisk(): ServerHealth['disk'] {
  try {
    const statfs = (fs as typeof fs & { statfsSync?: (p: string) => { bsize: number; blocks: number; bavail: number } })
      .statfsSync;
    if (!statfs) return null;
    const info = statfs(process.cwd());
    const total = Number(info.blocks) * Number(info.bsize);
    const free = Number(info.bavail) * Number(info.bsize);
    if (!total) return null;
    const used = Math.max(0, total - free);
    return {
      total,
      used,
      free,
      percent: Math.max(0, Math.min(100, (used / total) * 100)),
    };
  } catch {
    return null;
  }
}

function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

const TABLE_LABELS: Record<string, string> = {
  users: 'المستخدمون',
  sessions: 'الجلسات',
  access_requests: 'طلبات الدخول',
  ai_knowledge: 'معرفة صخر',
  agency_settings: 'إعدادات الوكالة',
  seasons: 'المواسم',
  hotels: 'الفنادق',
  flights: 'الرحلات',
  morshids: 'المرشدون',
  packages: 'الباقات',
  package_prices: 'أسعار الباقات',
  reservations: 'الحجوزات',
  receipts: 'الإيصالات',
  messages: 'الرسائل',
  audit_logs: 'سجل التدقيق',
  reviews: 'التقييمات',
  page_content: 'محتوى الصفحات',
  firewall_rules: 'قواعد الجدار',
  firewall_settings: 'إعدادات الجدار',
  security_incidents: 'حوادث الأمان',
  google_auth: 'دخول جوجل',
};

function tableLabel(name: string): string {
  return TABLE_LABELS[name] || name;
}

function listSqliteFiles(mainPath: string): { id: string; name: string; label: string; path: string; bytes: number }[] {
  const dir = path.dirname(mainPath);
  const base = path.basename(mainPath);
  const found = new Map<string, { id: string; name: string; label: string; path: string; bytes: number }>();
  const add = (filePath: string, label: string) => {
    const bytes = fileSize(filePath);
    if (!bytes) return;
    const name = path.basename(filePath);
    found.set(filePath, { id: name, name, label, path: filePath, bytes });
  };

  add(mainPath, 'قاعدة ساوث ستريت');

  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.(db|sqlite|sqlite3)$/i.test(entry)) continue;
      if (entry === base) continue;
      add(path.join(dir, entry), entry.replace(/\.(db|sqlite3?)$/i, ''));
    }
  } catch {
    /* directory listing is best-effort */
  }

  return [...found.values()].sort((a, b) => b.bytes - a.bytes);
}

function sqliteTableUsage(): { tables: DatabaseTableUsage[]; rows: number; bytes: number } {
  const cached = g.__ssDbUsage;
  if (cached && Date.now() - cached.at < DB_CACHE_MS) return cached.data;

  try {
    const db = getSqliteDb();
    const names = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[]
    ).map((row) => row.name);

    const sizeByTable = new Map<string, number>();
    try {
      const stats = db.prepare(`SELECT name AS tbl, SUM(pgsize) AS bytes FROM dbstat GROUP BY name`).all() as {
        tbl: string;
        bytes: number;
      }[];
      for (const row of stats) sizeByTable.set(row.tbl, Number(row.bytes) || 0);
    } catch {
      /* dbstat is optional */
    }

    const pageSize = Number(db.pragma('page_size', { simple: true }) || 4096);
    const pageCount = Number(db.pragma('page_count', { simple: true }) || 0);
    const fileBytes = pageSize * pageCount;

    const tables: DatabaseTableUsage[] = names.map((name) => {
      let rows = 0;
      try {
        rows = Number((db.prepare(`SELECT COUNT(*) AS c FROM "${name.replace(/"/g, '""')}"`).get() as { c: number })?.c) || 0;
      } catch {
        rows = 0;
      }
      return {
        name,
        label: tableLabel(name),
        rows,
        bytes: sizeByTable.get(name) || 0,
        percent: 0,
      };
    });

    const totalBytes = tables.reduce((sum, table) => sum + table.bytes, 0) || fileBytes || 1;
    const totalRows = tables.reduce((sum, table) => sum + table.rows, 0) || 1;
    for (const table of tables) {
      table.percent = table.bytes
        ? Math.round((table.bytes / totalBytes) * 1000) / 10
        : Math.round((table.rows / totalRows) * 1000) / 10;
    }

    const data = {
      tables: tables.sort((a, b) => b.percent - a.percent || b.rows - a.rows).slice(0, 14),
      rows: tables.reduce((sum, table) => sum + table.rows, 0),
      bytes: fileBytes || totalBytes,
    };
    g.__ssDbUsage = { at: Date.now(), data };
    return data;
  } catch {
    return { tables: [], rows: 0, bytes: 0 };
  }
}

function collectDatabases(diskTotal: number): DatabaseUsage[] {
  const mainPath = resolveDbPath();
  const files = listSqliteFiles(mainPath);
  const sqlite = sqliteTableUsage();
  const mainBase = path.basename(mainPath);
  const enriched = files.map((file) => {
    const isMain = file.name === mainBase;
    const walBytes = isMain ? fileSize(`${mainPath}-wal`) + fileSize(`${mainPath}-shm`) : 0;
    return { ...file, isMain, walBytes, bytes: file.bytes + walBytes };
  });
  const dataTotal = enriched.reduce((sum, file) => sum + file.bytes, 0) || 1;

  return enriched.map((file) => ({
    id: file.id,
    name: file.name,
    label: file.label,
    engine: 'SQLite',
    path: file.path,
    bytes: file.bytes,
    walBytes: file.walBytes,
    tables: file.isMain ? sqlite.tables.length : 0,
    rows: file.isMain ? sqlite.rows : 0,
    percentOfData: Math.round((file.bytes / dataTotal) * 1000) / 10,
    percentOfDisk: diskTotal ? Math.round((file.bytes / diskTotal) * 10000) / 100 : 0,
    tablesUsage: file.isMain ? sqlite.tables : [],
  }));
}

export function getServerHealth(): ServerHealth {
  const cpu = cpuPercent();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const ram = totalMem ? (usedMem / totalMem) * 100 : 0;
  const proc = process.memoryUsage();
  const disk = readDisk();
  const diskPct = disk?.percent ?? 0;
  const capacity = Math.max(cpu, ram, diskPct);
  const status: ServerHealth['status'] = capacity >= 88 ? 'hot' : capacity >= 70 ? 'warn' : 'ok';

  const sample: HealthSample = {
    t: Date.now(),
    cpu: Math.round(cpu * 10) / 10,
    ram: Math.round(ram * 10) / 10,
    disk: Math.round(diskPct * 10) / 10,
  };
  const hist = g.__ssHealthHist || [];
  hist.push(sample);
  if (hist.length > HISTORY) hist.splice(0, hist.length - HISTORY);
  g.__ssHealthHist = hist;

  let traffic = {
    requestsPerMinute: 0,
    blockedPerMinute: 0,
    uniqueIps: 0,
    sessions: 0,
    totalRequests: 0,
  };
  try {
    const summary = getSecuritySummary();
    traffic = {
      requestsPerMinute: summary.requestsPerMinute || 0,
      blockedPerMinute: summary.blockedPerMinute || 0,
      uniqueIps: summary.uniqueIps || 0,
      sessions: listSessions().length,
      totalRequests: summary.totalRequests || 0,
    };
  } catch {
    try {
      traffic.sessions = listSessions().length;
    } catch {
      /* optional */
    }
  }

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    node: process.version,
    cores: os.cpus().length,
    cpuPercent: sample.cpu,
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: sample.ram,
      processRss: proc.rss,
      processHeap: proc.heapUsed,
    },
    disk,
    uptime: {
      process: process.uptime(),
      system: os.uptime(),
    },
    capacity,
    status,
    traffic,
    databases: collectDatabases(disk?.total || 0),
    topUsers: (() => {
      try {
        return collectTopUsers(10);
      } catch {
        return [];
      }
    })(),
    adminKey: (() => {
      try {
        return getAdminKeyMeta();
      } catch {
        return { fingerprint: '', issuedAt: null };
      }
    })(),
    history: [...hist],
  };
}
