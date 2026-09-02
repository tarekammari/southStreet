'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Calendar,
  Eraser,
  Filter,
  Globe,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import {
  DATA_LABELS,
  SEVERITY_LABELS,
  THREAT_LABELS,
  countryNameOf,
  flagEmoji,
  repairMojibake,
  type SecurityEvent,
  type Severity,
} from '@/lib/security-threats';
import { LOGIN_ROLE_LABELS, LOGIN_ROLE_OPTIONS, normalizeLoginRole, type LoginRole } from '@/lib/roles';

type FirewallRule = {
  id: string;
  ip: string;
  type: 'BLOCK' | 'ALLOW';
  active: boolean;
  note: string;
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
  uniqueIps: number;
  bufferSize: number;
  injection: number;
  flood: number;
  authAttacks: number;
  sensitiveHits: number;
};

const EMPTY_SUMMARY: Summary = {
  totalRequests: 0,
  totalBlocked: 0,
  totalThreats: 0,
  totalBots: 0,
  requestsPerMinute: 0,
  uniqueIps: 0,
  bufferSize: 0,
  injection: 0,
  flood: 0,
  authAttacks: 0,
  sensitiveHits: 0,
};

const POLL_MS = 8000;

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
  if (!userAgent) return 'جهاز غير معروف';
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

export default function SecurityCenter({ sideOpen = true }: { sideOpen?: boolean }) {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [feed, setFeed] = useState<SecurityEvent[]>([]);
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
    for (const event of feed) {
      if (event.userName) {
        const name = actorNameOf(event);
        if (name && name !== 'زائر غير مسجّل') users.set(name, name);
      }
      ips.add(displayIp(event.ip).ip);
    }
    return {
      users: [...users.keys()].sort((a, b) => a.localeCompare(b, 'ar')),
      ips: [...ips],
    };
  }, [feed]);

  const filtersOn = dateFilter !== 'all' || Boolean(userFilter || ipFilter || roleFilter);
  const attacks = summary.totalThreats + summary.totalBlocked;
  const blockedCount = rules.filter((rule) => rule.type === 'BLOCK' && rule.active).length;
  void sideOpen;

  const selectedOrigin = selected ? displayIp(selected.ip) : null;
  const selectedCountry = selected
    ? selected.country || (selectedOrigin?.local ? 'DZ' : '')
    : '';
  const selectedCountryName = selected
    ? selected.countryName || countryNameOf(selectedCountry)
    : '';

  return (
    <div className="inn-panel-wrap">
      {toast ? <div className="inn-toast">{toast}</div> : null}
      {error ? <div className="sec-error">{error}</div> : null}

      <section className={`inn-panel inn-view-stack${selected ? ' is-detail' : ''}`}>
        <div className="inn-view-list" aria-hidden={Boolean(selected)}>
          <div className="inn-panel-head">
            <div>
              <h2 className="inn-panel-title">الجدار الناري</h2>
              <p className="inn-panel-sub">
                {settings.enabled ? 'يعمل' : 'متوقف'}
                {' · '}
                {summary.uniqueIps || 0} اتصال حي
                {' · '}
                {summary.sensitiveHits || 0} بيانات حسّاسة
                {' · '}
                {summary.totalBlocked} مرفوض
                {' · '}
                {attacks} هجوم
                {' · '}
                {feedWithFlags.length} حدث
                {blockedCount ? ` · ${blockedCount} حظر` : ''}
              </p>
            </div>
            <div className="fw-head-tools">
              <label className="inn-switch" title={settings.enabled ? 'إيقاف الجدار' : 'تشغيل الجدار'}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => callFirewall({ action: 'settings', ...settings, enabled: e.target.checked })}
                />
                <span className="inn-switch-track" />
              </label>
              <button
                type="button"
                className={`sec-chip${showAll ? ' is-active' : ''}`}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'المهم فقط' : 'كل الطلبات'}
              </button>
              <button type="button" className="sec-icon-btn" onClick={() => setPaused((v) => !v)} title={paused ? 'استئناف' : 'إيقاف مؤقت'}>
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button type="button" className="sec-icon-btn" onClick={clearFeed} title="مسح السجل">
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="fw-filters" role="search">
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
              </select>
            </label>
            <form
              className="fw-block-form"
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
              <button type="submit">حظر</button>
            </form>
            {filtersOn ? (
              <button type="button" className="sec-filter-clear" onClick={() => {
                setDateFilter('all');
                setUserFilter('');
                setIpFilter('');
                setRoleFilter('');
              }}>
                مسح الفلاتر
              </button>
            ) : null}
          </div>

          <div className="ts-table-wrap">
            {feedWithFlags.length === 0 ? (
              <p className="inn-empty">
                {filtersOn ? 'لا توجد نتائج مطابقة للتصفية الحالية.' : 'لا يوجد نشاط مهم بعد.'}
              </p>
            ) : (
              <table className="ts-table">
                <thead>
                  <tr>
                    <th>الوقت</th>
                    <th>المستخدم</th>
                    <th>المسار</th>
                    <th>العنوان</th>
                    <th>التصنيف</th>
                    <th>الجهاز</th>
                  </tr>
                </thead>
                <tbody>
                  {feedWithFlags.map(({ event }) => {
                    const origin = displayIp(event.ip);
                    const fullPath = `${event.path}${event.query ? `?${event.query}` : ''}`;
                    const actorName = actorNameOf(event);
                    return (
                      <tr
                        key={event.id}
                        className={`ts-row${event.blocked ? ' is-blocked' : ''}`}
                        tabIndex={0}
                        onClick={() => setSelected(event)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(event);
                          }
                        }}
                      >
                        <td>{hhmmss(event.ts)}</td>
                        <td>
                          <span className="ts-user">
                            <b>{actorName}</b>
                            <em>{event.method}</em>
                          </span>
                        </td>
                        <td dir="ltr">{fullPath || '—'}</td>
                        <td dir="ltr">{origin.ip}</td>
                        <td>{THREAT_LABELS[event.threat] || event.threat}</td>
                        <td>{agentLabel(event.userAgent)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && selectedOrigin ? (
          <div className="inn-view-detail">
            <div className="upm-embedded" role="region" aria-label="تفاصيل الاتصال">
              <div className="upm-panel upm-studio-wrap is-embedded">
                <div className="fw-detail" dir="rtl">
                  <header className="upm-studio-head">
                    <button type="button" className="upm-studio-back" onClick={() => setSelected(null)}>
                      <ArrowRight className="w-4 h-4" />
                      رجوع
                    </button>
                    <h2>تفاصيل الاتصال</h2>
                  </header>
                  <div className="upm-table-wrap">
                    <table className="upm-table">
                      <tbody>
                        <tr><th>الوقت</th><td>{fullStamp(selected.ts)}</td></tr>
                        <tr><th>المستخدم</th><td>{actorNameOf(selected)}</td></tr>
                        <tr><th>الدور</th><td>{roleLabel(selected.userRole, selected.userRoleName)}</td></tr>
                        <tr><th>الطريقة</th><td dir="ltr">{selected.method}</td></tr>
                        <tr><th>المسار</th><td dir="ltr">{`${selected.path}${selected.query ? `?${selected.query}` : ''}` || '—'}</td></tr>
                        <tr><th>العنوان</th><td dir="ltr">{selectedOrigin.ip}{selectedOrigin.local ? ' · هذا الجهاز' : ''}</td></tr>
                        <tr><th>الدولة</th><td>{flagEmoji(selectedCountry)} {selectedCountryName}</td></tr>
                        <tr><th>التصنيف</th><td>{THREAT_LABELS[selected.threat] || selected.threat}</td></tr>
                        <tr><th>البيانات</th><td>{selected.dataLabel || DATA_LABELS[selected.dataClass || 'none'] || 'عام'}</td></tr>
                        <tr><th>الخطورة</th><td>{SEVERITY_LABELS[selected.severity as Severity] || selected.severity}</td></tr>
                        <tr><th>الجهاز</th><td>{agentLabel(selected.userAgent)}</td></tr>
                        <tr><th>المرجع</th><td dir="ltr">{selected.referer || '—'}</td></tr>
                        {selected.reason ? <tr><th>السبب</th><td>{selected.reason}</td></tr> : null}
                      </tbody>
                    </table>
                    <div className="upm-table-actions">
                      <button type="button" className="upm-btn upm-btn-ghost" onClick={() => setSelected(null)}>
                        رجوع
                      </button>
                      {!selected.trusted && !selectedOrigin.local && selected.ip !== 'unknown' ? (
                        <button
                          type="button"
                          className="upm-btn upm-btn-danger"
                          onClick={() => callFirewall({ action: 'block', ip: selected.ip, note: selected.reason || selected.dataLabel || 'حظر من التفاصيل' })}
                        >
                          <Ban className="w-4 h-4" />
                          حظر هذا العنوان
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
