'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  Bug,
  Database,
  Eraser,
  KeyRound,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
  Users,
} from 'lucide-react';
import {
  DATA_LABELS,
  SEVERITY_LABELS,
  THREAT_LABELS,
  type DataClass,
  type SecurityEvent,
  type Severity,
  type ThreatKind,
} from '@/lib/security-threats';

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

function token(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('south_street_token') || '';
}

function hhmmss(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

export default function SecurityCenter() {
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
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/security/monitor?limit=80${showAll ? '&all=1' : ''}`, {
        headers: { Authorization: `Bearer ${token()}` },
        cache: 'no-store',
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
    const rows = feed.map((event) => ({ event, fresh: !seenIds.current.has(event.id) }));
    for (const { event } of rows) seenIds.current.add(event.id);
    if (seenIds.current.size > 1200) seenIds.current = new Set(feed.map((e) => e.id));
    return rows;
  }, [feed]);

  const attacks = summary.totalThreats + summary.totalBlocked;
  const blockedRules = rules.filter((r) => r.type === 'BLOCK');

  return (
    <div className="sec-wrap">
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
      </section>

      <div className="sec-grid">
        <section className="sec-panel sec-panel-feed">
          <header className="sec-panel-head">
            <div className="sec-panel-title">
              <span className={`sec-live-dot${paused ? ' is-paused' : ''}`} />
              <h3>النشاط المهم</h3>
              <span className="sec-count">{summary.bufferSize} حدث</span>
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

          <ul className="sec-feed">
            {feedWithFlags.length === 0 ? (
              <li className="sec-feed-empty">
                <Activity className="w-5 h-5" />
                لا يوجد نشاط مهم بعد. نبضات الجلسة وتصفّح الصفحات مخفيّان هنا.
              </li>
            ) : (
              feedWithFlags.map(({ event, fresh }) => {
                const sensitiveRow = event.dataClass === 'users' || event.dataClass === 'secrets' || event.dataClass === 'auth';
                return (
                  <li
                    key={event.id}
                    className={`sec-row sev-${event.severity}${event.blocked ? ' is-blocked' : ''}${sensitiveRow ? ' is-sensitive' : ''}${event.dataClass === 'secrets' ? ' is-secrets' : ''}${fresh ? ' is-fresh' : ''}`}
                  >
                    <span className="sec-row-time" dir="ltr">{hhmmss(event.ts)}</span>
                    <span className={`sec-row-badge sev-${event.severity}`}>
                      {threatIcon(event.threat)}
                      {THREAT_LABELS[event.threat] || event.threat}
                    </span>
                    {event.dataLabel ? (
                      <span className={`sec-data-badge is-${event.dataClass || 'none'}`}>
                        {dataIcon(event.dataClass)}
                        {event.dataLabel}
                      </span>
                    ) : null}
                    <span className="sec-row-method" dir="ltr">{event.method}</span>
                    <span className="sec-row-path" dir="ltr" title={`${event.path}${event.query ? `?${event.query}` : ''}`}>
                      {event.path}
                    </span>
                    <span className="sec-row-ip" dir="ltr">{event.ip}</span>
                    {event.reason ? <span className="sec-row-reason">{event.reason}</span> : null}
                    {!event.trusted && event.ip !== 'unknown' ? (
                      <button
                        type="button"
                        className="sec-row-block"
                        onClick={() => callFirewall({ action: 'block', ip: event.ip, note: event.reason || event.dataLabel || 'حظر من السجل' })}
                        title={`حظر ${event.ip}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
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
    </div>
  );
}
