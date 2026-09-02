'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Check,
  Eraser,
  Pause,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import {
  DATA_LABELS,
  SEVERITY_LABELS,
  THREAT_LABELS,
  countryNameOf,
  flagEmoji,
  parseQueryPairs,
  repairMojibake,
  type SecurityEvent,
  type Severity,
} from '@/lib/security-threats';
import { LOGIN_ROLE_LABELS, normalizeLoginRole, type LoginRole } from '@/lib/roles';

type FirewallRule = {
  id: string;
  ip: string;
  type: 'BLOCK' | 'ALLOW';
  active: boolean;
  note: string;
  createdAt?: string;
  createdBy?: string;
  hits?: number;
};

type FirewallSettings = {
  enabled: boolean;
  blockBots: boolean;
  blockScanners: boolean;
  blockInjection: boolean;
  blockXss: boolean;
  blockExploits: boolean;
  autoBan: boolean;
  autoBanHits: number;
  listenAll: boolean;
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
  xss: number;
  exploits: number;
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
  xss: 0,
  exploits: 0,
};

const DEFAULT_SETTINGS: FirewallSettings = {
  enabled: true,
  blockBots: true,
  blockScanners: true,
  blockInjection: true,
  blockXss: true,
  blockExploits: true,
  autoBan: true,
  autoBanHits: 5,
  listenAll: true,
  floodLimit: 60,
};

const POLL_MS = 8000;
const FEED_PAGE = 80;

export type FirewallDateFilter = 'all' | 'hour' | 'today' | 'yesterday' | 'day' | 'week';
export type FirewallScope = 'all' | 'important' | 'blocked' | 'threat' | 'allow';
export type FirewallFilters = {
  date: FirewallDateFilter;
  scope: FirewallScope;
  query: string;
  role: string;
};
export type FirewallFilterCounts = Record<FirewallScope, number>;
export const EMPTY_FW_FILTERS: FirewallFilters = {
  date: 'all',
  scope: 'all',
  query: '',
  role: '',
};
export const EMPTY_FW_COUNTS: FirewallFilterCounts = {
  all: 0,
  important: 0,
  blocked: 0,
  threat: 0,
  allow: 0,
};

type FwTab = 'live' | 'rules' | 'protect';

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

function methodOf(event: SecurityEvent): string {
  return (event.method || 'GET').toUpperCase();
}

function httpVersionOf(event: SecurityEvent): string {
  return event.httpVersion || 'HTTP/1.1';
}

function schemeOf(event: SecurityEvent): string {
  return (event.scheme || 'https').toUpperCase();
}

function requestLineOf(event: SecurityEvent): string {
  if (event.requestLine) return event.requestLine;
  const qs = event.query ? `?${event.query}` : '';
  return `${methodOf(event)} ${event.path || '/'}${qs} ${httpVersionOf(event)}`;
}

function pathOnly(event: SecurityEvent): string {
  return event.path || '/';
}

export default function SecurityCenter({
  sideOpen = true,
  filters = EMPTY_FW_FILTERS,
  onCounts,
}: {
  sideOpen?: boolean;
  filters?: FirewallFilters;
  onCounts?: (counts: FirewallFilterCounts) => void;
}) {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [feed, setFeed] = useState<SecurityEvent[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [settings, setSettings] = useState<FirewallSettings>(DEFAULT_SETTINGS);
  const [paused, setPaused] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  const [tab, setTab] = useState<FwTab>('live');
  const [visible, setVisible] = useState(FEED_PAGE);
  const [editing, setEditing] = useState<FirewallRule | null>(null);
  const dateFilter = filters.date;
  const roleFilter = filters.role;
  const scope = filters.scope;
  const search = filters.query.trim().toLowerCase();
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/security/monitor?limit=400&all=1', {
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
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    } catch {
      setError('تعذّر الاتصال بخدمة المراقبة');
    }
  }, []);

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
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      flash(data.message || 'تم التنفيذ');
      load();
    } else {
      flash(data.error || 'فشل تنفيذ الإجراء');
    }
  };

  const patchSettings = (patch: Partial<FirewallSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    callFirewall({ action: 'settings', ...next });
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

    const inDate = (event: SecurityEvent) => {
      const ts = Date.parse(event.ts) || 0;
      if (dateFilter === 'hour' && now - ts > 60 * 60 * 1000) return false;
      if (dateFilter === 'today' && ts < todayMs) return false;
      if (dateFilter === 'yesterday' && (ts < todayMs - 86400000 || ts >= todayMs)) return false;
      if (dateFilter === 'day' && now - ts > 86400000) return false;
      if (dateFilter === 'week' && now - ts > 7 * 86400000) return false;
      return true;
    };

    const inRole = (event: SecurityEvent) => {
      if (!roleFilter) return true;
      if (!event.userRole) return false;
      return normalizeLoginRole(event.userRole) === roleFilter;
    };

    const inQuery = (event: SecurityEvent) => {
      if (!search) return true;
      const origin = displayIp(event.ip).ip.toLowerCase();
      const actor = actorNameOf(event).toLowerCase();
      const line = requestLineOf(event).toLowerCase();
      return origin.includes(search) || actor.includes(search) || line.includes(search) || (event.path || '').toLowerCase().includes(search);
    };

    const inScope = (event: SecurityEvent): boolean => {
      if (scope === 'blocked') return event.blocked;
      if (scope === 'threat') return event.threat !== 'CLEAN' || event.blocked;
      if (scope === 'allow') return !event.blocked && event.threat === 'CLEAN';
      if (scope === 'important') return event.blocked || event.threat !== 'CLEAN' || Boolean(event.dataClass && event.dataClass !== 'none' && event.dataClass !== 'public');
      return true;
    };

    const dated = feed.filter((event) => inDate(event) && inRole(event) && inQuery(event));
    const rows = dated
      .filter(inScope)
      .map((event) => ({ event, fresh: !seenIds.current.has(event.id) }));

    for (const { event } of rows) seenIds.current.add(event.id);
    if (seenIds.current.size > 2400) seenIds.current = new Set(feed.map((e) => e.id));
    return rows;
  }, [feed, dateFilter, roleFilter, scope, search]);

  useEffect(() => {
    if (!onCounts) return;
    const now = Date.now();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const todayMs = startToday.getTime();
    const dated = feed.filter((event) => {
      const ts = Date.parse(event.ts) || 0;
      if (dateFilter === 'hour' && now - ts > 60 * 60 * 1000) return false;
      if (dateFilter === 'today' && ts < todayMs) return false;
      if (dateFilter === 'yesterday' && (ts < todayMs - 86400000 || ts >= todayMs)) return false;
      if (dateFilter === 'day' && now - ts > 86400000) return false;
      if (dateFilter === 'week' && now - ts > 7 * 86400000) return false;
      return true;
    });
    onCounts({
      all: dated.length,
      important: dated.filter((e) => e.blocked || e.threat !== 'CLEAN').length,
      blocked: dated.filter((e) => e.blocked).length,
      threat: dated.filter((e) => e.threat !== 'CLEAN' || e.blocked).length,
      allow: dated.filter((e) => !e.blocked && e.threat === 'CLEAN').length,
    });
  }, [feed, dateFilter, onCounts]);

  useEffect(() => {
    setVisible(FEED_PAGE);
  }, [dateFilter, roleFilter, scope, search]);

  const visibleRows = feedWithFlags.slice(0, visible);

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
  const selectedQuery = selected ? parseQueryPairs(selected.query) : [];

  const saveEditedRule = () => {
    if (!editing) return;
    callFirewall({
      action: 'update',
      id: editing.id,
      ip: editing.ip,
      type: editing.type,
      note: editing.note,
      active: editing.active,
    });
    setEditing(null);
  };

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
                {summary.uniqueIps || 0} اتصال
                {' · '}
                {summary.requestsPerMinute || 0}/د
                {' · '}
                {summary.totalBlocked} مرفوض
                {' · '}
                {attacks} تهديد
                {blockedCount ? ` · ${blockedCount} حظر` : ''}
              </p>
            </div>
            <div className="fw-head-tools">
              <label className="inn-switch" title={settings.enabled ? 'إيقاف الجدار' : 'تشغيل الجدار'}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => patchSettings({ enabled: e.target.checked })}
                />
                <span className="inn-switch-track" />
              </label>
              <button type="button" className="sec-icon-btn" onClick={() => setPaused((v) => !v)} title={paused ? 'استئناف' : 'إيقاف مؤقت'}>
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button type="button" className="sec-icon-btn" onClick={clearFeed} title="مسح السجل">
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="fw-kpis" aria-label="مؤشرات الجدار الناري">
            <span><b>{summary.totalRequests}</b> طلب</span>
            <span><b>{summary.totalBlocked}</b> حظر</span>
            <span><b>{summary.injection}</b> SQL</span>
            <span><b>{summary.xss || 0}</b> XSS</span>
            <span><b>{summary.exploits || 0}</b> استغلال</span>
            <span><b>{summary.flood}</b> إغراق</span>
            <span><b>{summary.authAttacks}</b> دخول</span>
            <span><b>{summary.uniqueIps}</b> IP</span>
          </div>

          <nav className="fw-tabs" aria-label="أقسام الجدار الناري">
            <button type="button" className={tab === 'live' ? 'is-active' : ''} onClick={() => setTab('live')}>النشاط</button>
            <button type="button" className={tab === 'rules' ? 'is-active' : ''} onClick={() => setTab('rules')}>القواعد</button>
            <button type="button" className={tab === 'protect' ? 'is-active' : ''} onClick={() => setTab('protect')}>الحماية</button>
          </nav>

          {tab === 'live' ? (
            <>
              <div className="ts-table-wrap fw-feed">
                {visibleRows.length === 0 ? (
                  <p className="inn-empty">
                    {dateFilter !== 'all' || scope !== 'all' || search || roleFilter
                      ? 'لا توجد نتائج مطابقة للتصفية الحالية.'
                      : 'لا يوجد نشاط بعد.'}
                  </p>
                ) : (
                  <table className="ts-table fw-table">
                    <thead>
                      <tr>
                        <th>الوقت</th>
                        <th>البروتوكول</th>
                        <th>الطلب</th>
                        <th>العنوان</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(({ event }) => {
                        const origin = displayIp(event.ip);
                        const method = methodOf(event);
                        const qs = event.query ? `?${event.query}` : '';
                        return (
                          <tr
                            key={event.id}
                            className={`ts-row fw-row${event.blocked ? ' is-blocked' : event.threat !== 'CLEAN' ? ' is-threat' : ''}`}
                            tabIndex={0}
                            onClick={() => setSelected(event)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelected(event);
                              }
                            }}
                          >
                            <td className="fw-time">{hhmmss(event.ts)}</td>
                            <td>
                              <span className="fw-proto">
                                <em className={`fw-method is-${method.toLowerCase()}`}>{method}</em>
                                <span>{httpVersionOf(event)}</span>
                              </span>
                            </td>
                            <td className="fw-req" dir="ltr" title={requestLineOf(event)}>
                              <b>{pathOnly(event)}</b>
                              {qs ? <i>{qs}</i> : null}
                            </td>
                            <td dir="ltr" className="fw-ip">{origin.ip}</td>
                            <td>
                              <span className={`fw-status${event.blocked ? ' is-block' : event.threat !== 'CLEAN' ? ' is-warn' : ' is-ok'}`}>
                                {event.blocked ? 'BLOCK' : event.threat !== 'CLEAN' ? THREAT_LABELS[event.threat] : 'ALLOW'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {feedWithFlags.length > visible ? (
                  <button type="button" className="fw-more" onClick={() => setVisible((n) => n + FEED_PAGE)}>
                    عرض المزيد ({feedWithFlags.length - visible} متبقٍ)
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === 'rules' ? (
            <div className="fw-rules">
              <form
                className="fw-rule-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualIp.trim()) return;
                  callFirewall({ action: 'block', ip: manualIp.trim(), note: manualNote.trim() || 'إضافة يدوية' });
                  setManualIp('');
                  setManualNote('');
                }}
              >
                <input
                  type="text"
                  dir="ltr"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="IP"
                  required
                />
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="ملاحظة"
                />
                <button type="submit"><Plus className="w-3.5 h-3.5" /> حظر</button>
                <button
                  type="button"
                  className="is-allow"
                  onClick={() => {
                    if (!manualIp.trim()) return;
                    callFirewall({ action: 'allow', ip: manualIp.trim(), note: manualNote.trim() || 'عنوان موثوق' });
                    setManualIp('');
                    setManualNote('');
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> سماح
                </button>
              </form>

              {rules.length === 0 ? (
                <p className="inn-empty">لا توجد قواعد بعد. أضف عنواناً للحظر أو السماح.</p>
              ) : (
                <table className="ts-table fw-table">
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>النوع</th>
                      <th>الحالة</th>
                      <th>الإصابات</th>
                      <th>ملاحظة</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="fw-row">
                        <td dir="ltr">{rule.ip}</td>
                        <td>
                          <span className={`fw-status ${rule.type === 'BLOCK' ? 'is-block' : 'is-ok'}`}>
                            {rule.type === 'BLOCK' ? 'BLOCK' : 'ALLOW'}
                          </span>
                        </td>
                        <td>{rule.active ? 'نشط' : 'متوقف'}</td>
                        <td>{rule.hits || 0}</td>
                        <td>{rule.note || '—'}</td>
                        <td className="fw-rule-acts">
                          <button type="button" title="تعديل" onClick={() => setEditing(rule)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={rule.active ? 'إيقاف' : 'تشغيل'}
                            onClick={() => callFirewall({ action: 'toggle', id: rule.id, active: !rule.active })}
                          >
                            {rule.active ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button type="button" title="حذف" onClick={() => callFirewall({ action: 'remove', id: rule.id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {editing ? (
                <div className="fw-edit">
                  <h3>تعديل القاعدة</h3>
                  <label>
                    العنوان
                    <input dir="ltr" value={editing.ip} onChange={(e) => setEditing({ ...editing, ip: e.target.value })} />
                  </label>
                  <label>
                    النوع
                    <select
                      value={editing.type}
                      onChange={(e) => setEditing({ ...editing, type: e.target.value as 'BLOCK' | 'ALLOW' })}
                    >
                      <option value="BLOCK">حظر</option>
                      <option value="ALLOW">سماح</option>
                    </select>
                  </label>
                  <label>
                    ملاحظة
                    <input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
                  </label>
                  <label className="fw-check">
                    <input
                      type="checkbox"
                      checked={editing.active}
                      onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    />
                    نشط
                  </label>
                  <div className="fw-edit-acts">
                    <button type="button" onClick={saveEditedRule}><Check className="w-3.5 h-3.5" /> حفظ</button>
                    <button type="button" className="is-ghost" onClick={() => setEditing(null)}>إلغاء</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'protect' ? (
            <div className="fw-protect">
              {[
                { key: 'blockInjection', label: 'حقن SQL والأوامر', hint: 'Union Select، Sleep، أوامر النظام' },
                { key: 'blockXss', label: 'حقن السكربت والقوالب', hint: 'XSS و SSTI و Log4Shell' },
                { key: 'blockExploits', label: 'الاستغلالات الحديثة', hint: 'Webshell، SSRF، Zero-day، ترويسات HTTP' },
                { key: 'blockScanners', label: 'ماسحات الثغرات', hint: 'wordpress، phpMyAdmin، ملفات .env' },
                { key: 'blockBots', label: 'الروبوتات العدائية', hint: 'sqlmap، nmap، nuclei، curl المسيء' },
                { key: 'autoBan', label: 'حظر تلقائي', hint: 'يحظر العنوان بعد تكرار التهديدات' },
                { key: 'listenAll', label: 'الاستماع لكل اتصال', hint: 'يسجّل GET و POST وكل المسارات' },
              ].map((item) => (
                <label key={item.key} className="fw-protect-row">
                  <span>
                    <b>{item.label}</b>
                    <em>{item.hint}</em>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[item.key as keyof FirewallSettings])}
                    onChange={(e) => patchSettings({ [item.key]: e.target.checked } as Partial<FirewallSettings>)}
                  />
                </label>
              ))}
              <label className="fw-protect-row">
                <span>
                  <b>حد الإغراق / دقيقة</b>
                  <em>يُرفض العنوان إذا تجاوز هذا العدد من الطلبات</em>
                </span>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={settings.floodLimit}
                  onChange={(e) => patchSettings({ floodLimit: Number(e.target.value) || 60 })}
                />
              </label>
              <label className="fw-protect-row">
                <span>
                  <b>عتبة الحظر التلقائي</b>
                  <em>عدد التهديدات قبل إضافة قاعدة حظر</em>
                </span>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={settings.autoBanHits}
                  onChange={(e) => patchSettings({ autoBanHits: Number(e.target.value) || 5 })}
                />
              </label>
            </div>
          ) : null}
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
                    <pre className="fw-http" dir="ltr">{`${requestLineOf(selected)}
Host: ${selected.host || '—'}
Scheme: ${schemeOf(selected)}
Origin: ${selected.origin || '—'}
Accept: ${selected.accept || '—'}
Content-Type: ${selected.contentType || '—'}
Referer: ${selected.referer || '—'}
User-Agent: ${selected.userAgent || '—'}`}</pre>
                    {selectedQuery.length ? (
                      <table className="upm-table">
                        <tbody>
                          {selectedQuery.map((pair, i) => (
                            <tr key={`${pair.key}-${i}`}>
                              <th dir="ltr">{pair.key || 'GET'}</th>
                              <td dir="ltr">{pair.value || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                    <table className="upm-table">
                      <tbody>
                        <tr><th>الوقت</th><td>{fullStamp(selected.ts)}</td></tr>
                        <tr><th>المستخدم</th><td>{actorNameOf(selected)}</td></tr>
                        <tr><th>الدور</th><td>{roleLabel(selected.userRole, selected.userRoleName)}</td></tr>
                        <tr><th>العنوان</th><td dir="ltr">{selectedOrigin.ip}{selectedOrigin.local ? ' · هذا الجهاز' : ''}</td></tr>
                        <tr><th>الدولة</th><td>{flagEmoji(selectedCountry)} {selectedCountryName}</td></tr>
                        <tr><th>التصنيف</th><td>{THREAT_LABELS[selected.threat] || selected.threat}</td></tr>
                        <tr><th>البيانات</th><td>{selected.dataLabel || DATA_LABELS[selected.dataClass || 'none'] || 'عام'}</td></tr>
                        <tr><th>الخطورة</th><td>{SEVERITY_LABELS[selected.severity as Severity] || selected.severity}</td></tr>
                        <tr><th>الجهاز</th><td>{agentLabel(selected.userAgent)}</td></tr>
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
                      {selectedOrigin.local ? null : (
                        <button
                          type="button"
                          className="upm-btn upm-btn-ok"
                          onClick={() => callFirewall({ action: 'allow', ip: selected.ip, note: 'سماح من التفاصيل' })}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          سماح
                        </button>
                      )}
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
