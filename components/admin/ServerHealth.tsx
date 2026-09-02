'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Activity, Database, HardDrive, KeyRound, Power, Radio, Server } from 'lucide-react';
import type { DatabaseUsage, ServerHealth } from '@/lib/server-health';
import type { TopUserUsage } from '@/lib/top-users';

const LIME = '#c6f250';
const DONUT = ['#f4f4f5', '#a78bfa', '#2ee6a6', '#c6f250', '#fb8a3c', '#38bdf8', '#f472b6', '#facc15'];

function token(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('south_street_token') || '';
}

function bytes(value: number): string {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}ي ${h}س`;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د ${s % 60}ث`;
}

function toneOf(value: number): 'ok' | 'warn' | 'hot' {
  if (value >= 88) return 'hot';
  if (value >= 70) return 'warn';
  return 'ok';
}

function delta(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function downloadKey(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'southstreet_admin.key';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const uid = useId().replace(/:/g, '');
  const { line, area } = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' };
    const max = Math.max(8, ...values);
    const w = 140;
    const h = 42;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (Math.min(max, v) / max) * (h - 8) - 4;
      return [x, y] as const;
    });
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { line: d, area: `${d} L${w} ${h} L0 ${h} Z` };
  }, [values]);

  return (
    <svg className="srv-mini" viewBox="0 0 140 42" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`ms-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#ms-${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Donut({
  slices,
  center,
  caption,
}: {
  slices: { label: string; value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 58;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="srv-donut">
      <div className="srv-donut-ring">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
          {slices.map((slice) => {
            const len = (slice.value / total) * c;
            const el = (
              <circle
                key={slice.label}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="srv-donut-core">
          <span>{caption}</span>
          <strong>{center}</strong>
        </div>
      </div>
      <ul className="srv-legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} />
            <em>{slice.label}</em>
            <b>{((slice.value / total) * 100).toFixed(slice.value / total >= 0.1 ? 0 : 1)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChart({ values, color = '#e7e7ea' }: { values: number[]; color?: string }) {
  const uid = useId().replace(/:/g, '');
  const max = Math.max(12, ...values, 1);
  const w = 320;
  const h = 148;
  const gap = 3;
  const bar = values.length ? (w - gap * (values.length - 1)) / values.length : 8;
  return (
    <svg className="srv-bars" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`bar-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const bh = Math.max(4, (v / max) * (h - 8));
        return (
          <rect
            key={i}
            x={i * (bar + gap)}
            y={h - bh}
            width={Math.max(2, bar)}
            height={bh}
            rx={Math.min(4, bar / 2)}
            fill={`url(#bar-${uid})`}
          />
        );
      })}
    </svg>
  );
}

function SemiGauge({ value, label }: { value: number; label: string }) {
  const uid = useId().replace(/:/g, '');
  const clamped = Math.min(100, Math.max(0, value));
  const theta = Math.PI * (1 - clamped / 100);
  const cx = 120;
  const cy = 118;
  const r = 78;
  const nx = cx + r * Math.cos(theta);
  const ny = cy - r * Math.sin(theta);
  return (
    <div className="srv-semi">
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id={`gg-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#c6f250" />
            <stop offset="55%" stopColor="#fb8a3c" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M42 118 A78 78 0 0 1 198 118" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
        <path d="M42 118 A78 78 0 0 1 198 118" fill="none" stroke={`url(#gg-${uid})`} strokeWidth="14" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx={nx} cy={ny} r="5.5" fill="#fff" />
        <circle cx={cx} cy={cy} r="7" fill="#1a1a1c" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="srv-semi-copy">
        <strong>{Math.round(clamped)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  series,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  series: number[];
  color: string;
}) {
  const change = delta(series);
  const up = change >= 0;
  return (
    <article className="srv-kpi">
      <span>{label}</span>
      <div className="srv-kpi-row">
        <strong>{value}</strong>
        <em className={up ? 'is-up' : 'is-down'}>
          {up ? '+' : ''}
          {change.toFixed(1)}
        </em>
      </div>
      <p>{hint}</p>
      <MiniSpark values={series} color={color} />
    </article>
  );
}

export default function ServerHealthPanel() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [error, setError] = useState('');
  const [openDb, setOpenDb] = useState<string | null>(null);
  const [tab, setTab] = useState<'key' | 'stop'>('key');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [stopping, setStopping] = useState(false);

  const load = useCallback(async () => {
    if (stopping) return;
    try {
      const res = await fetch('/api/admin/server-health', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token()}` },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذّر قراءة حالة الخادم');
        return;
      }
      setError('');
      setHealth(data as ServerHealth);
    } catch {
      setError('تعذّر الاتصال بمراقبة الخادم');
    }
  }, [stopping]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [load]);

  const command = useCallback(async (action: 'rotate-key' | 'stop') => {
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/server-health', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ action, confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || 'تعذّر تنفيذ الإجراء');
        return;
      }
      if (action === 'rotate-key') {
        downloadKey(data.fileName, data.fileContent);
        setNotice('تم توليد المفتاح الجديد. الملف السابق لم يعد صالحاً.');
        setHealth((prev) =>
          prev
            ? {
                ...prev,
                adminKey: {
                  fingerprint: data.fingerprint || prev.adminKey?.fingerprint || '',
                  issuedAt: data.issuedAt || prev.adminKey?.issuedAt || null,
                },
              }
            : prev
        );
      } else {
        setStopping(true);
        setNotice('جاري إيقاف الخادم…');
      }
      setConfirm(false);
    } catch {
      setNotice('تعذّر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  }, []);

  const databases = health?.databases || [];
  const dbBytes = databases.reduce((sum, db) => sum + db.bytes, 0);
  const mainDb: DatabaseUsage | undefined = databases.find((db) => db.tablesUsage.length) || databases[0];
  const statusLabel = health?.status === 'hot' ? 'ضغط مرتفع' : health?.status === 'warn' ? 'تحت المراقبة' : 'يعمل بثبات';

  useEffect(() => {
    if (!openDb && mainDb) setOpenDb(mainDb.id);
  }, [mainDb, openDb]);

  const active = databases.find((db) => db.id === openDb) || mainDb;
  const cpuSeries = health?.history.map((s) => s.cpu) || [];
  const ramSeries = health?.history.map((s) => s.ram) || [];
  const diskSeries = health?.history.map((s) => s.disk) || [];
  const slices = (active?.tablesUsage?.length
    ? active.tablesUsage.slice(0, 8).map((table, i) => ({
        label: table.label,
        value: Math.max(0.4, table.percent),
        color: DONUT[i % DONUT.length],
      }))
    : databases.map((db, i) => ({
        label: db.label,
        value: Math.max(0.4, db.percentOfData),
        color: DONUT[i % DONUT.length],
      })));

  return (
    <div className="inn-panel-wrap">
      <section className="inn-panel srv-panel">
        <div className="srv-top">
          <div>
            <h2>حالة الخادم</h2>
            <p>{health ? `${health.hostname} · Node ${health.node}` : 'جاري القياس…'}</p>
          </div>
          <div className="srv-top-actions">
            <span className={`srv-live is-${health?.status || 'ok'}`}>
              <i />
              {health ? statusLabel : 'اتصال'}
            </span>
            <span className="srv-pill" dir="ltr">{health ? `${health.platform}/${health.arch}` : '—'}</span>
          </div>
        </div>

        {error ? <p className="sec-error">{error}</p> : null}

        <div className="srv-ticker">
          <span><Activity /> تشغيل التطبيق {health ? duration(health.uptime.process) : '—'}</span>
          <span><HardDrive /> الجهاز {health ? duration(health.uptime.system) : '—'}</span>
          <span><Radio /> {health?.traffic.requestsPerMinute ?? 0} طلب / د</span>
          <span><Server /> {health?.traffic.sessions ?? 0} جلسة</span>
          <span><Database /> {bytes(dbBytes)}</span>
        </div>

        <div className="srv-kpis">
          <KpiCard
            label="المعالج"
            value={`${Math.round(health?.cpuPercent || 0)}%`}
            hint={`${health?.cores || 0} نواة`}
            series={cpuSeries}
            color={LIME}
          />
          <KpiCard
            label="الذاكرة"
            value={`${Math.round(health?.memory.percent || 0)}%`}
            hint={health ? `${bytes(health.memory.used)} / ${bytes(health.memory.total)}` : '—'}
            series={ramSeries}
            color="#fb8a3c"
          />
          <KpiCard
            label="التخزين"
            value={`${Math.round(health?.disk?.percent || 0)}%`}
            hint={health?.disk ? `${bytes(health.disk.used)} / ${bytes(health.disk.total)}` : '—'}
            series={diskSeries}
            color="#38bdf8"
          />
          <KpiCard
            label="الجلسات"
            value={String(health?.traffic.sessions ?? 0)}
            hint={`${health?.traffic.requestsPerMinute ?? 0} طلب / د`}
            series={ramSeries}
            color="#a78bfa"
          />
        </div>

        <div className="srv-board">
          <article className="srv-card">
            <header>
              <div>
                <h3>توزيع البيانات</h3>
                <p>{active?.label || 'قواعد البيانات'}</p>
              </div>
              {databases.length > 1 ? (
                <select
                  value={active?.id || ''}
                  onChange={(e) => setOpenDb(e.target.value)}
                >
                  {databases.map((db) => (
                    <option key={db.id} value={db.id}>{db.label}</option>
                  ))}
                </select>
              ) : null}
            </header>
            {slices.length ? (
              <Donut slices={slices} center={bytes(active?.bytes || dbBytes)} caption="الحجم" />
            ) : (
              <p className="inn-empty">لا توجد بيانات ظاهرة.</p>
            )}
          </article>

          <article className="srv-card">
            <header>
              <div>
                <h3>حمل المعالج</h3>
                <p>
                  <b>{Math.round(health?.cpuPercent || 0)}%</b>
                  <em className={delta(cpuSeries) >= 0 ? 'is-up' : 'is-down'}>
                    {delta(cpuSeries) >= 0 ? '+' : ''}
                    {delta(cpuSeries).toFixed(1)}
                  </em>
                </p>
              </div>
              <span className="srv-chip">مباشر</span>
            </header>
            <BarChart values={cpuSeries.length ? cpuSeries : [2, 4, 3, 6, 2, 5, 3]} />
          </article>

          <div className="srv-side">
            <article className="srv-card srv-card-gauge">
              <header>
                <div>
                  <h3>مؤشر الصحة</h3>
                  <p>أعلى ضغط بين المعالج والذاكرة والقرص</p>
                </div>
              </header>
              <SemiGauge value={health?.capacity || 0} label={statusLabel} />
            </article>

            <article className="srv-card srv-trade">
              <div className="srv-tabs">
                <button type="button" className={tab === 'key' ? 'is-on' : ''} onClick={() => { setTab('key'); setConfirm(false); setNotice(''); }}>
                  مفتاح
                </button>
                <button type="button" className={tab === 'stop' ? 'is-on' : ''} onClick={() => { setTab('stop'); setConfirm(false); setNotice(''); }}>
                  إيقاف
                </button>
              </div>

              {tab === 'key' ? (
                <>
                  <label>البصمة الحالية</label>
                  <div className="srv-field" dir="ltr">
                    {health?.adminKey?.fingerprint ? `•••• ${health.adminKey.fingerprint}` : '—'}
                  </div>
                  <p className="srv-hint">توليد ملف جديد يُبطل southstreet_admin.key السابق فوراً.</p>
                  {confirm ? (
                    <div className="srv-confirm-row">
                      <button type="button" className="srv-cta" disabled={busy} onClick={() => command('rotate-key')}>
                        {busy ? 'جاري التوليد…' : 'تأكيد التوليد'}
                      </button>
                      <button type="button" className="srv-ghost" onClick={() => setConfirm(false)}>إلغاء</button>
                    </div>
                  ) : (
                    <button type="button" className="srv-cta" onClick={() => setConfirm(true)}>
                      <KeyRound className="w-4 h-4" />
                      توليد مفتاح جديد
                    </button>
                  )}
                </>
              ) : (
                <>
                  <label>حالة العملية</label>
                  <div className="srv-field">{stopping ? 'جاري الإيقاف' : 'يعمل'}</div>
                  <p className="srv-hint">إيقاف Node يغلق الموقع حتى إعادة التشغيل يدوياً.</p>
                  {confirm ? (
                    <div className="srv-confirm-row">
                      <button type="button" className="srv-cta is-hot" disabled={busy || stopping} onClick={() => command('stop')}>
                        {busy || stopping ? 'جاري الإيقاف…' : 'تأكيد الإيقاف'}
                      </button>
                      <button type="button" className="srv-ghost" disabled={stopping} onClick={() => setConfirm(false)}>إلغاء</button>
                    </div>
                  ) : (
                    <button type="button" className="srv-cta is-hot" disabled={stopping} onClick={() => setConfirm(true)}>
                      <Power className="w-4 h-4" />
                      إيقاف الخادم
                    </button>
                  )}
                </>
              )}
              {notice ? <p className={`srv-note${stopping ? ' is-hot' : ''}`}>{notice}</p> : null}
            </article>
          </div>
        </div>

        <article className="srv-card srv-market">
          <header>
            <div>
              <h3>أكبر عشرة مستخدمين</h3>
              <p>النشاط وقواعد البيانات والجداول المستخدمة</p>
            </div>
          </header>
          {(health?.topUsers || []).length === 0 ? (
            <p className="inn-empty">لا يوجد نشاط كافٍ لترتيب المستخدمين بعد.</p>
          ) : (
            <div className="srv-table">
              <div className="srv-tr srv-th">
                <span>المستخدم</span>
                <span>القاعدة / الجداول</span>
                <span>جلسات</span>
                <span>الحصة</span>
              </div>
              {(health?.topUsers || []).map((user: TopUserUsage, index) => {
                const tables = user.databases.flatMap((db) => db.tables.map((t) => t.label)).slice(0, 3);
                return (
                  <div className="srv-tr" key={user.id}>
                    <span className="srv-user-cell">
                      <b className={`srv-av is-${index + 1}`}>{index + 1}</b>
                      <span>
                        <strong>{user.name}</strong>
                        <small>{user.roleLabel}{user.username ? ` · @${user.username}` : ''}</small>
                      </span>
                    </span>
                    <span className="srv-db-cell">
                      {user.databases[0]?.label || '—'}
                      {tables.length ? ` · ${tables.join('، ')}` : ''}
                    </span>
                    <span>{user.sessions}</span>
                    <span className="srv-chg is-up">
                      {user.percent.toFixed(user.percent >= 10 ? 0 : 1)}%
                      <i style={{ width: `${Math.min(100, Math.max(8, user.percent))}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
