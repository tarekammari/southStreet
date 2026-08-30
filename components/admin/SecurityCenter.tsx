'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  Bug,
  CheckCircle2,
  Eraser,
  Globe,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Trash2,
} from 'lucide-react';
import {
  SEVERITY_LABELS,
  THREAT_LABELS,
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
  if (threat === 'BLOCKED') return <Ban className="w-3.5 h-3.5" />;
  if (threat === 'INJECTION' || threat === 'TRAVERSAL') return <Siren className="w-3.5 h-3.5" />;
  if (threat === 'SCANNER') return <Bug className="w-3.5 h-3.5" />;
  if (threat === 'BOT') return <Globe className="w-3.5 h-3.5" />;
  if (threat === 'CLEAN') return <CheckCircle2 className="w-3.5 h-3.5" />;
  return <ShieldAlert className="w-3.5 h-3.5" />;
}

export default function SecurityCenter() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [feed, setFeed] = useState<SecurityEvent[]>([]);
  const [ips, setIps] = useState<IpSummary[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [settings, setSettings] = useState<FirewallSettings>({
    enabled: true,
    blockBots: false,
    blockScanners: true,
    blockInjection: true,
    floodLimit: 120,
  });
  const [onlyThreats, setOnlyThreats] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [pulseKey, setPulseKey] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/security/monitor?limit=140${onlyThreats ? '&threats=1' : ''}`, {
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
      setIps(data.ips || []);
      setRules(data.rules || []);
      if (data.settings) setSettings(data.settings);
      setPulseKey((k) => k + 1);
    } catch {
      setError('تعذّر الاتصال بخدمة المراقبة');
    }
  }, [onlyThreats]);

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

  /** Rows that arrived since the previous poll animate in. */
  const feedWithFlags = useMemo(() => {
    const rows = feed.map((event) => ({ event, fresh: !seenIds.current.has(event.id) }));
    for (const { event } of rows) seenIds.current.add(event.id);
    if (seenIds.current.size > 1200) seenIds.current = new Set(feed.map((e) => e.id));
    return rows;
  }, [feed]);

  const blockedRules = rules.filter((r) => r.type === 'BLOCK');
  const allowedRules = rules.filter((r) => r.type === 'ALLOW');

  return (
    <div className="sec-wrap">
      {toast ? <div className="sec-toast">{toast}</div> : null}
      {error ? <div className="sec-error">{error}</div> : null}

      {/* ── Status strip ── */}
      <section className="sec-stats">
        <article className={`sec-stat sec-stat-shield${settings.enabled ? ' is-on' : ' is-off'}`}>
          <span className="sec-stat-icon">
            {settings.enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </span>
          <div>
            <p className="sec-stat-label">حالة الجدار الناري</p>
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

        <article className="sec-stat">
          <p className="sec-stat-label">طلبات / دقيقة</p>
          <strong key={`rpm-${pulseKey}`} className="sec-stat-value sec-tick">{summary.requestsPerMinute}</strong>
          <span className="sec-stat-sub">{summary.totalRequests} منذ الإقلاع</span>
        </article>

        <article className={`sec-stat${summary.totalBlocked > 0 ? ' is-danger' : ''}`}>
          <p className="sec-stat-label">طلبات محظورة</p>
          <strong className="sec-stat-value">{summary.totalBlocked}</strong>
          <span className="sec-stat-sub">{summary.blockedPerMinute} خلال الدقيقة</span>
        </article>

        <article className={`sec-stat${summary.totalThreats > 0 ? ' is-warn' : ''}`}>
          <p className="sec-stat-label">تهديدات مرصودة</p>
          <strong className="sec-stat-value">{summary.totalThreats}</strong>
          <span className="sec-stat-sub">{summary.totalBots} روبوت</span>
        </article>

        <article className="sec-stat">
          <p className="sec-stat-label">عناوين متصلة</p>
          <strong className="sec-stat-value">{summary.uniqueIps}</strong>
          <span className="sec-stat-sub">{summary.untrustedIps} غير موثوق</span>
        </article>
      </section>

      <div className="sec-grid">
        {/* ── Live request stream ── */}
        <section className="sec-panel sec-panel-feed">
          <header className="sec-panel-head">
            <div className="sec-panel-title">
              <span className={`sec-live-dot${paused ? ' is-paused' : ''}`} />
              <h3>حركة الخادم المباشرة</h3>
              <span className="sec-count">{summary.bufferSize} حدث</span>
            </div>
            <div className="sec-panel-tools">
              <button
                type="button"
                className={`sec-chip${onlyThreats ? ' is-active' : ''}`}
                onClick={() => setOnlyThreats((v) => !v)}
              >
                التهديدات فقط
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
                لا توجد حركة مسجّلة بعد. تصفّح الموقع في تبويب آخر لترى الطلبات هنا مباشرة.
              </li>
            ) : (
              feedWithFlags.map(({ event, fresh }) => (
                <li
                  key={event.id}
                  className={`sec-row sev-${event.severity}${event.blocked ? ' is-blocked' : ''}${fresh ? ' is-fresh' : ''}`}
                >
                  <span className="sec-row-time" dir="ltr">{hhmmss(event.ts)}</span>
                  <span className={`sec-row-badge sev-${event.severity}`}>
                    {threatIcon(event.threat)}
                    {THREAT_LABELS[event.threat] || event.threat}
                  </span>
                  <span className="sec-row-method" dir="ltr">{event.method}</span>
                  <span className="sec-row-path" dir="ltr" title={`${event.path}${event.query ? `?${event.query}` : ''}`}>
                    {event.path}
                    {event.query ? <em>?{event.query}</em> : null}
                  </span>
                  <span className="sec-row-ip" dir="ltr" title={event.userAgent}>
                    {event.ip}
                    {event.trusted ? <b className="sec-tag-trusted">موثوق</b> : null}
                  </span>
                  {event.reason ? <span className="sec-row-reason">{event.reason}</span> : null}
                  {!event.trusted && event.ip !== 'unknown' ? (
                    <button
                      type="button"
                      className="sec-row-block"
                      onClick={() => callFirewall({ action: 'block', ip: event.ip, note: event.reason || 'حظر من السجل الحي' })}
                      title={`حظر ${event.ip}`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        {/* ── Connections + firewall ── */}
        <aside className="sec-side">
          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>العناوين المتصلة</h3>
              </div>
            </header>
            <ul className="sec-ip-list">
              {ips.length === 0 ? (
                <li className="sec-feed-empty">لا توجد عناوين بعد</li>
              ) : (
                ips.map((entry) => (
                  <li key={entry.ip} className={`sec-ip${entry.trusted ? ' is-trusted' : ''}${entry.ruled === 'BLOCK' ? ' is-blocked' : ''}`}>
                    <div className="sec-ip-main">
                      <span className="sec-ip-addr" dir="ltr">{entry.ip}</span>
                      <span className="sec-ip-meta">
                        {entry.hits} طلب · {entry.threats} تهديد
                        {entry.trusted ? ' · شبكة داخلية' : ''}
                      </span>
                      <span className="sec-ip-path" dir="ltr" title={entry.agent}>{entry.lastPath}</span>
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
                      {entry.ruled !== 'ALLOW' ? (
                        <button
                          type="button"
                          className="sec-mini-btn"
                          onClick={() => callFirewall({ action: 'allow', ip: entry.ip })}
                        >
                          توثيق
                        </button>
                      ) : (
                        <span className="sec-tag-trusted">مسموح</span>
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
                <h3>قواعد الجدار الناري</h3>
                <span className="sec-count">{blockedRules.length} حظر · {allowedRules.length} سماح</span>
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
                placeholder="مثال: 203.0.113.45"
              />
              <button type="submit" className="sec-add-btn">حظر</button>
            </form>

            <ul className="sec-rule-list">
              {rules.length === 0 ? (
                <li className="sec-feed-empty">لا توجد قواعد بعد</li>
              ) : (
                rules.map((rule) => (
                  <li key={rule.id} className={`sec-rule${rule.type === 'ALLOW' ? ' is-allow' : ''}${rule.active ? '' : ' is-off'}`}>
                    <div>
                      <span className="sec-rule-ip" dir="ltr">{rule.ip}</span>
                      <span className="sec-rule-note">{rule.note || (rule.type === 'ALLOW' ? 'عنوان موثوق' : 'محظور')}</span>
                      {rule.hits > 0 ? <span className="sec-rule-hits">{rule.hits} محاولة مرفوضة</span> : null}
                    </div>
                    <div className="sec-rule-actions">
                      <label className="inn-switch" title={rule.active ? 'تعطيل' : 'تفعيل'}>
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={(e) => callFirewall({ action: 'toggle', id: rule.id, active: e.target.checked })}
                        />
                        <span className="inn-switch-track" />
                      </label>
                      <button type="button" className="sec-mini-btn is-danger" onClick={() => callFirewall({ action: 'remove', id: rule.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="sec-panel">
            <header className="sec-panel-head">
              <div className="sec-panel-title">
                <h3>سياسات الحماية</h3>
              </div>
            </header>
            <ul className="sec-toggles">
              {[
                { key: 'blockInjection' as const, label: 'رفض محاولات الحقن والاختراق', hint: 'SQLi · XSS · تجاوز المسار' },
                { key: 'blockScanners' as const, label: 'رفض فاحصي الثغرات', hint: 'wp-admin · .env · phpMyAdmin' },
                { key: 'blockBots' as const, label: 'رفض الروبوتات الآلية', hint: 'curl · python-requests · scrapers' },
              ].map((row) => (
                <li key={row.key}>
                  <div>
                    <p>{row.label}</p>
                    <span>{row.hint}</span>
                  </div>
                  <label className="inn-switch">
                    <input
                      type="checkbox"
                      checked={settings[row.key]}
                      onChange={(e) => callFirewall({ action: 'settings', ...settings, [row.key]: e.target.checked })}
                    />
                    <span className="inn-switch-track" />
                  </label>
                </li>
              ))}
              <li>
                <div>
                  <p>حد الإغراق لكل دقيقة</p>
                  <span>يُعتبر ما فوقه هجوم إغراق</span>
                </div>
                <input
                  type="number"
                  min={20}
                  max={1000}
                  className="sec-num"
                  value={settings.floodLimit}
                  onChange={(e) => setSettings((s) => ({ ...s, floodLimit: Number(e.target.value) }))}
                  onBlur={() => callFirewall({ action: 'settings', ...settings })}
                />
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
