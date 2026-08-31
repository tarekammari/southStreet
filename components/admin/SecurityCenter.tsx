'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  Bug,
  Calendar,
  Database,
  Eraser,
  Eye,
  Filter,
  Globe,
  KeyRound,
  MapPin,
  Monitor,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  DATA_LABELS,
  SEVERITY_LABELS,
  THREAT_LABELS,
  countryNameOf,
  flagEmoji,
  repairMojibake,
  type DataClass,
  type SecurityEvent,
  type Severity,
  type ThreatKind,
} from '@/lib/security-threats';
import { LOGIN_ROLE_LABELS, LOGIN_ROLE_OPTIONS, normalizeLoginRole, type LoginRole } from '@/lib/roles';

type IpSummary = {
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

type FirewallRule = {
  id: string;
  ip: string;
  type: 'BLOCK' | 'ALLOW';
  active: boolean;
  note: string;
  createdAt: string;
  createdBy: string;
  hits: number;
};

type FirewallSettings = {
  enabled: boolean;
  blockBots: boolean;
  blockScanners: boolean;
  blockInjection: boolean;
  floodLimit: number;
};

type Summary = {
  totalRequests: number;
  totalBlocked: number;
  totalThreats: number;
  totalBots: number;
  requestsPerMinute: number;
  blockedPerMinute: number;
  threatsPerMinute: number;
  uniqueIps: number;
  untrustedIps: number;
  criticalInBuffer: number;
  bufferSize: number;
  uptimeSince: string;
  injection: number;
  flood: number;
  scanners: number;
  authAttacks: number;
  sensitiveHits: number;
};

type AttackReport = {
  threat: ThreatKind;
  label: string;
  count: number;
  lastAt: string;
  lastIp: string;
  lastPath: string;
  lastNote: string;
};

const EMPTY_SUMMARY: Summary = {
  totalRequests: 0,
  totalBlocked: 0,
  totalThreats: 0,
  totalBots: 0,
  requestsPerMinute: 0,
  blockedPerMinute: 0,
  threatsPerMinute: 0,
  uniqueIps: 0,
  untrustedIps: 0,
  criticalInBuffer: 0,
  bufferSize: 0,
  uptimeSince: new Date().toISOString(),
  injection: 0,
  flood: 0,
  scanners: 0,
  authAttacks: 0,
  sensitiveHits: 0,
};

const POLL_MS = 3000;

type DateFilter = 'all' | 'hour' | 'today' | 'yesterday' | 'day' | 'week';

function roleLabel(role?: string | null, roleName?: string | null): string {
  const named = repairMojibake(roleName);
  if (named) return named;
  if (!role) return 'زائر';
  return LOGIN_ROLE_LABELS[role as LoginRole] || role;
}

function actorNameOf(event: SecurityEvent): string {
  return repairMojibake(event.userName) || 'زائر غير مسجّل';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return name.slice(0, 2) || '؟';
}

function token(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('south_street_token') || '';
}

function hhmmss(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fullStamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-DZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function displayIp(ip?: string | null): { ip: string; local: boolean } {
  const raw = (ip || '').trim().replace(/^::ffff:/i, '');
  if (!raw || raw === 'unknown') return { ip: '127.0.0.1', local: true };
  if (raw === '::1' || raw === 'localhost' || raw.startsWith('127.')) {
    return { ip: raw === '::1' ? '127.0.0.1' : raw, local: true };
  }
  return { ip: raw, local: false };
}

function agentLabel(userAgent?: string | null): string {
  if (!userAgent) return 'عميل غير معروف';
  const ua = userAgent.toLowerCase();
  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('android')
      ? 'Android'
      : ua.includes('iphone') || ua.includes('ipad')
        ? 'iOS'
        : ua.includes('mac os')
          ? 'macOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'نظام آخر';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome')
      ? 'Chrome'
      : ua.includes('firefox')
        ? 'Firefox'
        : ua.includes('safari')
          ? 'Safari'
          : 'متصفح';
  return `${browser} · ${os}`;
}

function threatIcon(threat: ThreatKind) {
  if (threat === 'BLOCKED' || threat === 'AUTH_ABUSE') return <Ban className="w-3.5 h-3.5" />;
  if (threat === 'INJECTION' || threat === 'TRAVERSAL' || threat === 'FLOOD') return <Siren className="w-3.5 h-3.5" />;
  if (threat === 'SCANNER' || threat === 'BOT') return <Bug className="w-3.5 h-3.5" />;
  return <ShieldAlert className="w-3.5 h-3.5" />;
}

function dataIcon(dataClass?: DataClass) {
  if (dataClass === 'secrets') return <KeyRound className="w-3.5 h-3.5" />;
  if (dataClass === 'users') return <Users className="w-3.5 h-3.5" />;
  if (dataClass === 'database' || dataClass === 'auth') return <Database className="w-3.5 h-3.5" />;
  return null;
}

export default function SecurityCenter({ sideOpen = true }: { sideOpen?: boolean }) {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [feed, setFeed] = useState<SecurityEvent[]>([]);
  const [sensitive, setSensitive] = useState<SecurityEvent[]>([]);
  const [reports, setReports] = useState<AttackReport[]>([]);
  const [ips, setIps] = useState<IpSummary[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [settings, setSettings] = useState<FirewallSettings>({
    enabled: true,
    blockBots: true,
    blockScanners: true,
    blockInjection: true,
    floodLimit: 60,
  });
  const [showAll, setShowAll] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [userFilter, setUserFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/security/monitor?limit=200${showAll ? '&all=1' : ''}`, {
        headers: { Authorization: `Bearer ${token()}` },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'تعذّر قراءة بيانات المراقبة');
        return;
      }
      const data = await res.json();
      setError('');
      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
      setFeed(data.feed || []);
      setSensitive(data.sensitive || []);
      setReports(data.reports || []);
      setIps(data.ips || []);
      setRules(data.rules || []);
      if (data.settings) setSettings(data.settings);
    } catch {
      setError('تعذّر الاتصال بخدمة المراقبة');
    }
  }, [showAll]);

  useEffect(() => {
    load();
    if (paused) return;
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, paused]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const callFirewall = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/security/firewall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.rules) setRules(data.rules);
      if (data.settings) setSettings(data.settings);
      flash(data.message || 'تم التنفيذ');
      load();
    } else {
      flash(data.error || 'فشل تنفيذ الإجراء');
    }
  };

  const clearFeed = async () => {
    await fetch('/api/security/monitor', { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    seenIds.current.clear();
    flash('تم مسح السجل الحي');
    load();
  };

  const feedWithFlags = useMemo(() => {
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const todayMs = startToday.getTime();

    const rows = feed
      .filter((event) => {
        const ts = Date.parse(event.ts) || 0;
        if (dateFilter === 'hour' && now - ts > 60 * 60 * 1000) return false;
        if (dateFilter === 'today' && ts < todayMs) return false;
        if (dateFilter === 'yesterday' && (ts < todayMs - 86400000 || ts >= todayMs)) return false;
        if (dateFilter === 'day' && now - ts > 86400000) return false;
        if (dateFilter === 'week' && now - ts > 7 * 86400000) return false;
        if (userFilter && actorNameOf(event) !== userFilter && event.userId !== userFilter) return false;
        if (ipFilter && displayIp(event.ip).ip !== ipFilter) return false;
        if (roleFilter) {
          if (!event.userRole) return false;
          if (normalizeLoginRole(event.userRole) !== roleFilter) return false;
        }
        return true;
      })
      .map((event) => ({ event, fresh: !seenIds.current.has(event.id) }));

    for (const { event } of rows) seenIds.current.add(event.id);
    if (seenIds.current.size > 1200) seenIds.current = new Set(feed.map((e) => e.id));
    return rows;
  }, [feed, dateFilter, userFilter, ipFilter, roleFilter]);

  const filterOptions = useMemo(() => {
    const users = new Map<string, string>();
    const ips = new Set<string>();
    const roles = new Map<string, string>();
    for (const event of feed) {
      if (event.userName) {
        const name = actorNameOf(event);
        if (name && name !== 'زائر غير مسجّل') users.set(name, name);
      }
      ips.add(displayIp(event.ip).ip);
      if (event.userRole) roles.set(event.userRole, roleLabel(event.userRole, event.userRoleName));
    }
    return {
      users: [...users.keys()].sort((a, b) => a.localeCompare(b, 'ar')),
      ips: [...ips],
      roles: [...roles.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ar')),
    };
  }, [feed]);

  const filtersOn = dateFilter !== 'all' || Boolean(userFilter || ipFilter || roleFilter);

  const clearFilters = () => {
    setDateFilter('all');
    setUserFilter('');
    setIpFilter('');
    setRoleFilter('');
  };

  const attacks = summary.totalThreats + summary.totalBlocked;
  const blockedRules = rules.filter((r) => r.type === 'BLOCK');

  return (
    <div className={`sec-wrap${sideOpen ? ' is-with-rail' : ' is-side-hidden'}`}>
      {toast ? <div className="sec-toast">{toast}</div> : null}
      {error ? <div className="sec-error">{error}</div> : null}

      <section className="sec-stats">
        <article className={`sec-stat sec-stat-shield${settings.enabled ? ' is-on' : ' is-off'}`}>
          <span className="sec-stat-icon">
            {settings.enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </span>
          <div>
            <p className="sec-stat-label">الجدار الناري</p>
            <strong className="sec-stat-value">{settings.enabled ? 'يعمل' : 'متوقف'}</strong>
          </div>
          <label className="inn-switch" title={settings.enabled ? 'إيقاف الجدار' : 'تشغيل الجدار'}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => callFirewall({ action: 'settings', ...settings, enabled: e.target.checked })}
            />
            <span className="inn-switch-track" />
          </label>
        </article>

        <article className={`sec-stat${attacks > 0 ? ' is-danger' : ''}`}>
          <p className="sec-stat-label">هجمات مرصودة</p>
          <strong className="sec-stat-value">{attacks}</strong>
          <span className="sec-stat-sub">حقن {summary.injection || 0} · إغراق {summary.flood || 0} · روبوت {summary.totalBots}</span>
        </article>

        <article className={`sec-stat${summary.totalBlocked > 0 ? ' is-danger' : ''}`}>
          <p className="sec-stat-label">مرفوض</p>
          <strong className="sec-stat-value">{summary.totalBlocked}</strong>
          <span className="sec-stat-sub">{summary.authAttacks || 0} اقتحام دخول</span>
        </article>

        <article className={`sec-stat${summary.sensitiveHits > 0 ? ' is-warn' : ''}`}>
          <p className="sec-stat-label">بيانات حسّاسة</p>
          <strong className="sec-stat-value">{summary.sensitiveHits || 0}</strong>
          <span className="sec-stat-sub">مستخدمون · كلمات مرور · قاعدة البيانات</span>
        </article>

        <article className="sec-stat sec-stat-live">
          <p className="sec-stat-label">اتصالات حية</p>
          <strong className="sec-stat-value">{summary.uniqueIps || 0}</strong>
          <span className="sec-stat-sub">{summary.requestsPerMinute || 0} طلب/دقيقة على هذا الخادم</span>
        </article>
      </section>

      <div className="sec-grid">
        <section className="sec-panel sec-panel-feed">
          <header className="sec-panel-head">
            <div className="sec-panel-title">
              <span className={`sec-live-dot${paused ? ' is-paused' : ''}`} />
              <h3>النشاط المهم</h3>
              <span className="sec-count">{feedWithFlags.length} / {summary.bufferSize} حدث</span>
            </div>
            <div className="sec-panel-tools">
              <button
                type="button"
                className={`sec-chip${showAll ? ' is-active' : ''}`}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'إخفاء الضجيج' : 'كل الطلبات'}
              </button>
              <button type="button" className="sec-icon-btn" onClick={() => setPaused((v) => !v)} title={paused ? 'استئناف' : 'إيقاف مؤقت'}>
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button type="button" className="sec-icon-btn" onClick={clearFeed} title="مسح السجل">
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="sec-filters" role="search">
            <span className="sec-filters-label">
              <Filter className="w-3.5 h-3.5" />
              تصفية
            </span>
            <label className="sec-filter">
              <Calendar className="w-3.5 h-3.5" />
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
                <option value="all">كل التواريخ</option>
                <option value="hour">آخر ساعة</option>
                <option value="today">اليوم</option>
                <option value="yesterday">أمس</option>
                <option value="day">آخر 24 ساعة</option>
                <option value="week">آخر 7 أيام</option>
              </select>
            </label>
            <label className="sec-filter">
              <UserRound className="w-3.5 h-3.5" />
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                <option value="">كل المستخدمين</option>
                {filterOptions.users.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="sec-filter">
              <Globe className="w-3.5 h-3.5" />
              <select value={ipFilter} onChange={(e) => setIpFilter(e.target.value)}>
                <option value="">كل العناوين</option>
                {filterOptions.ips.map((ip) => (
                  <option key={ip} value={ip}>{ip}</option>
                ))}
              </select>
            </label>
            <label className="sec-filter">
              <Users className="w-3.5 h-3.5" />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">كل الأدوار</option>
                {LOGIN_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {filterOptions.roles
                  .filter(([value]) => !LOGIN_ROLE_OPTIONS.some((opt) => opt.value === value))
                  .map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
              </select>
            </label>
            {filtersOn ? (
              <button type="button" className="sec-filter-clear" onClick={clearFilters}>
                مسح الفلاتر
              </button>
            ) : null}
          </div>

          <div className="sec-ledger">
            <div className="sec-ledger-head" aria-hidden="true">
              <span>الوقت</span>
              <span>الطريقة</span>
              <span>المسار</span>
              <span>المستخدم</span>
              <span>العنوان</span>
              <span>الدولة</span>
              <span>معرّف جغرافي</span>
              <span>التصنيف</span>
              <span>البيانات</span>
              <span>الخطورة</span>
              <span>الجهاز</span>
              <span className="sec-ledger-col-action">إجراء</span>
            </div>
            <ul className="sec-feed">
            {feedWithFlags.length === 0 ? (
              <li className="sec-feed-empty">
                <Activity className="w-5 h-5" />
                {filtersOn
                  ? 'لا توجد نتائج مطابقة للتصفية الحالية.'
                  : 'لا يوجد نشاط مهم بعد. نبضات الجلسة وتصفّح الصفحات مخفيّان هنا.'}
              </li>
            ) : (
              feedWithFlags.map(({ event, fresh }) => {
                const sensitiveRow = event.dataClass === 'users' || event.dataClass === 'secrets' || event.dataClass === 'auth';
                const origin = displayIp(event.ip);
                const fullPath = `${event.path}${event.query ? `?${event.query}` : ''}`;
                const country = event.country || (origin.local ? 'DZ' : '');
                const countryName = event.countryName || countryNameOf(country);
                const geoId = event.geoId || '—';
                const actorName = actorNameOf(event);
                const actorRole = roleLabel(event.userRole, event.userRoleName);
                return (
                  <li
                    key={event.id}
                    className={`sec-act sev-${event.severity}${event.blocked ? ' is-blocked' : ''}${sensitiveRow ? ' is-sensitive' : ''}${event.dataClass === 'secrets' ? ' is-secrets' : ''}${fresh ? ' is-fresh' : ''}${origin.local ? ' is-local' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(event)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(event);
                      }
                    }}
                  >
                    <span className="sec-act-pair">
                      <em>الوقت</em>
                      <b className="sec-act-time" dir="ltr" title={fullStamp(event.ts)}>{hhmmss(event.ts)}</b>
                    </span>
                    <span className="sec-act-pair">
                      <em>الطريقة</em>
                      <b className={`sec-act-method is-${event.method.toLowerCase()}`} dir="ltr">{event.method}</b>
                    </span>
                    <span className="sec-act-pair">
                      <em>المسار</em>
                      <b className="sec-act-path" dir="ltr" title={fullPath}>{fullPath || '—'}</b>
                    </span>
                    <span className="sec-act-user" title={`${actorName} · ${actorRole}`}>
                      <i>{initialsOf(actorName)}</i>
                      <span>
                        <b>{actorName}</b>
                        <em>{actorRole}</em>
                      </span>
                    </span>
                    <span className="sec-act-pair">
                      <em>العنوان</em>
                      <b className="sec-act-ip" dir="ltr" title={event.ip}>
                        {origin.ip}
                        {origin.local ? <i>هذا الجهاز</i> : null}
                      </b>
                    </span>
                    <span className="sec-act-geo" title={[countryName, event.city, event.region].filter(Boolean).join(' · ')}>
                      <b>{flagEmoji(country) || <Globe className="w-3.5 h-3.5" />}</b>
                      <span>
                        <strong>{countryName}</strong>
                        <em>{event.city || event.region || country || '—'}</em>
                      </span>
                    </span>
                    <span className="sec-act-geoid" dir="ltr" title={geoId}>
                      <MapPin className="w-3 h-3" />
                      {geoId}
                    </span>
                    <span className={`sec-act-pill sev-${event.severity}`}>
                      {threatIcon(event.threat)}
                      {THREAT_LABELS[event.threat] || event.threat}
                    </span>
                    <span className={`sec-act-pill is-data is-${event.dataClass || 'none'}`}>
                      {dataIcon(event.dataClass)}
                      {event.dataLabel || DATA_LABELS[event.dataClass || 'none'] || 'عام'}
                    </span>
                    <span className={`sec-act-chip sev-${event.severity}`}>
                      {SEVERITY_LABELS[event.severity] || event.severity}
                    </span>
                    <span className="sec-act-chip" title={event.userAgent || ''}>
                      <Monitor className="w-3 h-3" />
                      {agentLabel(event.userAgent)}
                    </span>
                    <span className="sec-act-action">
                      <span className="sec-act-view" aria-hidden="true">
                        <Eye className="w-3.5 h-3.5" />
                        تفاصيل
                      </span>
                      {!event.trusted && !origin.local && event.ip !== 'unknown' ? (
                        <button
                          type="button"
                          className="sec-act-block"
                          onClick={(e) => {
                            e.stopPropagation();
                            callFirewall({ action: 'block', ip: event.ip, note: event.reason || event.dataLabel || 'حظر من السجل' });
                          }}
                          title={`حظر ${event.ip}`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          حظر
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })
            )}
            </ul>
          </div>
        </section>

        <aside className="sec-side">
          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>تقرير الهجمات</h3>
              </div>
            </header>
            <ul className="sec-report-list">
              {reports.length === 0 ? (
                <li className="sec-feed-empty">لا توجد محاولات هجوم مسجّلة</li>
              ) : (
                reports.map((row) => (
                  <li key={row.threat} className={`sec-report sev-${row.threat === 'INJECTION' || row.threat === 'FLOOD' ? 'critical' : 'high'}`}>
                    <div className="sec-report-head">
                      <span className="sec-row-badge sev-critical">
                        {threatIcon(row.threat)}
                        {row.label}
                      </span>
                      <strong>{row.count}</strong>
                    </div>
                    <p className="sec-report-meta">
                      آخرها {hhmmss(row.lastAt)} · <span dir="ltr">{row.lastIp}</span>
                    </p>
                    <p className="sec-report-path" dir="ltr">{row.lastPath}</p>
                    {row.lastNote ? <p className="sec-row-reason">{row.lastNote}</p> : null}
                    {row.lastIp && row.lastIp !== 'unknown' ? (
                      <button
                        type="button"
                        className="sec-mini-btn is-danger"
                        onClick={() => callFirewall({ action: 'block', ip: row.lastIp, note: row.lastNote || row.label })}
                      >
                        حظر العنوان
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>كلمات المرور والمستخدمون</h3>
              </div>
            </header>
            <ul className="sec-ip-list">
              {sensitive.length === 0 ? (
                <li className="sec-feed-empty">لا وصول حديث لبيانات الحسابات</li>
              ) : (
                sensitive.slice(0, 12).map((event) => (
                  <li key={event.id} className="sec-ip is-sensitive-hit">
                    <div className="sec-ip-main">
                      <span className="sec-ip-addr">{event.dataLabel || DATA_LABELS[event.dataClass || 'none'] || 'بيانات حسّاسة'}</span>
                      <span className="sec-ip-meta">
                        {hhmmss(event.ts)} · <span dir="ltr">{event.ip}</span>
                      </span>
                      <span className="sec-ip-path" dir="ltr">{event.method} {event.path}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>العناوين</h3>
              </div>
            </header>
            <ul className="sec-ip-list">
              {ips.length === 0 ? (
                <li className="sec-feed-empty">لا عناوين بعد</li>
              ) : (
                ips.slice(0, 8).map((entry) => (
                  <li key={entry.ip} className={`sec-ip${entry.ruled === 'BLOCK' ? ' is-blocked' : ''}`}>
                    <div className="sec-ip-main">
                      <span className="sec-ip-addr" dir="ltr">{entry.ip}</span>
                      <span className="sec-ip-meta">{entry.hits} طلب · {entry.threats} تهديد</span>
                    </div>
                    <div className="sec-ip-actions">
                      <span className={`sec-sev sev-${entry.worst}`}>{SEVERITY_LABELS[entry.worst]}</span>
                      {entry.ruled === 'BLOCK' ? (
                        <span className="sec-tag-blocked">محظور</span>
                      ) : (
                        <button
                          type="button"
                          className="sec-mini-btn is-danger"
                          onClick={() => callFirewall({ action: 'block', ip: entry.ip, note: `حظر يدوي — ${entry.lastPath}` })}
                        >
                          حظر
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>قواعد الحظر</h3>
                <span className="sec-count">{blockedRules.length}</span>
              </div>
            </header>
            <form
              className="sec-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualIp.trim()) return;
                callFirewall({ action: 'block', ip: manualIp.trim(), note: 'إضافة يدوية' });
                setManualIp('');
              }}
            >
              <input
                type="text"
                dir="ltr"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="IP للحظر"
              />
              <button type="submit" className="sec-add-btn">حظر</button>
            </form>
            <ul className="sec-rule-list">
              {rules.length === 0 ? (
                <li className="sec-feed-empty">لا قواعد بعد</li>
              ) : (
                rules.map((rule) => (
                  <li key={rule.id} className={`sec-rule${rule.type === 'ALLOW' ? ' is-allow' : ''}${rule.active ? '' : ' is-off'}`}>
                    <div>
                      <span className="sec-rule-ip" dir="ltr">{rule.ip}</span>
                      <span className="sec-rule-note">{rule.note || 'محظور'}</span>
                    </div>
                    <button type="button" className="sec-mini-btn is-danger" onClick={() => callFirewall({ action: 'remove', id: rule.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>

      {selected ? (
        <div className="sec-detail-overlay" onClick={() => setSelected(null)} role="presentation">
          <div
            className="sec-detail"
            role="dialog"
            aria-modal="true"
            aria-label="تفاصيل الاتصال"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const origin = displayIp(selected.ip);
              const country = selected.country || (origin.local ? 'DZ' : '');
              const countryName = selected.countryName || countryNameOf(country);
              const name = actorNameOf(selected);
              const role = roleLabel(selected.userRole, selected.userRoleName);
              const fullPath = `${selected.path}${selected.query ? `?${selected.query}` : ''}`;
              return (
                <>
                  <header className="sec-detail-hero">
                    <span className="sec-detail-avatar">{initialsOf(name)}</span>
                    <div className="sec-detail-hero-copy">
                      <p className="sec-detail-kicker">تفاصيل الاتصال</p>
                      <h3>{name}</h3>
                      <p>{role} · {fullStamp(selected.ts)}</p>
                    </div>
                    <div className="sec-detail-badges">
                      <span className={`sec-detail-badge is-threat sev-${selected.severity}`}>
                        {THREAT_LABELS[selected.threat] || selected.threat}
                      </span>
                      <span className={`sec-detail-badge is-severity sev-${selected.severity}`}>
                        {SEVERITY_LABELS[selected.severity] || selected.severity}
                      </span>
                      {selected.blocked ? (
                        <span className="sec-detail-badge is-blocked">مرفوض</span>
                      ) : null}
                    </div>
                    <button type="button" className="sec-detail-close" onClick={() => setSelected(null)} aria-label="إغلاق">
                      <X className="w-4 h-4" />
                    </button>
                  </header>

                  <div className="sec-detail-body">
                    <section className="sec-detail-section">
                      <h4>الطلب</h4>
                      <dl className="sec-detail-grid">
                        <div>
                          <dt>الوقت</dt>
                          <dd dir="ltr">{fullStamp(selected.ts)}</dd>
                        </div>
                        <div>
                          <dt>الطريقة</dt>
                          <dd><span className="sec-detail-code">{selected.method}</span></dd>
                        </div>
                        <div className="is-wide">
                          <dt>المسار</dt>
                          <dd dir="ltr" className="sec-detail-mono">{fullPath || '—'}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="sec-detail-section">
                      <h4>المستخدم والشبكة</h4>
                      <dl className="sec-detail-grid">
                        <div>
                          <dt>المستخدم</dt>
                          <dd>{name}</dd>
                        </div>
                        <div>
                          <dt>الدور</dt>
                          <dd>{role}</dd>
                        </div>
                        <div>
                          <dt>العنوان</dt>
                          <dd dir="ltr">{origin.ip}{origin.local ? ' · هذا الجهاز' : ''}</dd>
                        </div>
                        <div>
                          <dt>الدولة</dt>
                          <dd>{flagEmoji(country)} {countryName}</dd>
                        </div>
                        <div>
                          <dt>المدينة / المنطقة</dt>
                          <dd>{[selected.city, selected.region].filter(Boolean).join(' · ') || '—'}</dd>
                        </div>
                        <div>
                          <dt>معرّف جغرافي</dt>
                          <dd dir="ltr" className="sec-detail-mono">{selected.geoId || '—'}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="sec-detail-section">
                      <h4>التصنيف الأمني</h4>
                      <dl className="sec-detail-grid">
                        <div>
                          <dt>التصنيف</dt>
                          <dd>{THREAT_LABELS[selected.threat] || selected.threat}</dd>
                        </div>
                        <div>
                          <dt>البيانات</dt>
                          <dd>{selected.dataLabel || DATA_LABELS[selected.dataClass || 'none'] || 'عام'}</dd>
                        </div>
                        <div>
                          <dt>الخطورة</dt>
                          <dd>{SEVERITY_LABELS[selected.severity] || selected.severity}</dd>
                        </div>
                        <div>
                          <dt>المصدر</dt>
                          <dd>{selected.blocked ? 'مرفوض' : origin.local || selected.trusted ? 'محلي موثوق' : 'خارجي'}</dd>
                        </div>
                        {selected.reason ? (
                          <div className="is-wide">
                            <dt>السبب</dt>
                            <dd>{selected.reason}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </section>

                    <section className="sec-detail-section">
                      <h4>العميل والمراجع</h4>
                      <dl className="sec-detail-grid">
                        <div>
                          <dt>الجهاز</dt>
                          <dd>{agentLabel(selected.userAgent)}</dd>
                        </div>
                        <div className="is-wide">
                          <dt>وكيل المستخدم</dt>
                          <dd dir="ltr" className="sec-detail-mono is-wrap">{selected.userAgent || '—'}</dd>
                        </div>
                        <div className="is-wide">
                          <dt>المرجع</dt>
                          <dd dir="ltr" className="sec-detail-mono is-wrap">{selected.referer || '—'}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>

                  <footer className="sec-detail-foot">
                    <button type="button" className="sec-detail-dismiss" onClick={() => setSelected(null)}>
                      إغلاق
                    </button>
                    {!selected.trusted && !origin.local && selected.ip !== 'unknown' ? (
                      <button
                        type="button"
                        className="sec-detail-block"
                        onClick={() => callFirewall({ action: 'block', ip: selected.ip, note: selected.reason || selected.dataLabel || 'حظر من التفاصيل' })}
                      >
                        <Ban className="w-4 h-4" />
                        حظر هذا العنوان
                      </button>
                    ) : null}
                  </footer>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
