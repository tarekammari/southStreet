'use client';

/**
 * SS Connect control room (/connect-admin) — the Super Admin only.
 * Separate from the main dashboard (/admin): live activity, calls, people
 * (suspend, block calls, devices), group chats (from programmes, members,
 * group admins, announcements-only, close), announcements, rules for
 * everyone, and the log of every action. Never the content of private chats.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Ban, BellRing, Check, ClipboardList, Loader2, Lock, LogIn, Megaphone, MessageCircle, MicOff, Phone,
  PhoneOff, Plus, RefreshCw, Search, Settings, Shield, ShieldCheck, Smartphone, Trash2, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import './connect-admin.css';

type Tab = 'overview' | 'calls' | 'people' | 'groups' | 'broadcast' | 'settings' | 'audit';
type LiveCall = { id: string; state: string; caller: string; callee: string; startedTs: number; answeredTs: number | null; ringing: boolean; signed: boolean };
type Overview = {
  users: { total: number; online: number; byRole: Record<string, number>; suspended: number; callsBlocked: number };
  today: { messages: number; groupMessages: number; voiceNotes: number; calls: number; answered: number; missed: number; unreachable: number; declined: number; avgCallSeconds: number };
  week: { day: string; messages: number; calls: number }[];
  live: LiveCall[];
  groups: number;
  devices: { android: number; web: number };
  relay: boolean;
  settings: Rules;
};
type Rules = { calls: boolean; clientChat: boolean; relayOnly: boolean };
type Person = {
  id: string; name: string; role: string; roleLabel: string; photo: string; online: boolean; lastSeen: number;
  devices: { android: number; web: number }; messages7d: number; calls7d: number;
  suspended: boolean; callsBlocked: boolean; reason: string; untilTs: number | null;
};
type Group = { id: string; name: string; description: string; packageId: string | null; packageName: string | null; mode: 'all' | 'admins'; closed: boolean; createdTs: number; members: number };
type Member = { id: string; name: string; roleLabel: string; photo: string; groupRole: 'admin' | 'member' };
type Program = { id: string; name: string; startDate: string | null; people: number };
type LogRow = { ts: string; actor: string; action: string; details: string };

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: Activity },
  { id: 'calls', label: 'المكالمات الحية', icon: Phone },
  { id: 'people', label: 'المستخدمون', icon: Users },
  { id: 'groups', label: 'المجموعات', icon: MessageCircle },
  { id: 'broadcast', label: 'إعلان', icon: Megaphone },
  { id: 'settings', label: 'القواعد العامة', icon: Settings },
  { id: 'audit', label: 'السجل', icon: ClipboardList },
];

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function get<T>(view: string, extra = ''): Promise<T> {
  const res = await fetch(`/api/connect/admin?view=${view}${extra}`, { headers: authHeaders(), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'تعذّر التحميل', res.status);
  return data as T;
}

async function act<T = any>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/connect/admin', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'تعذّر التنفيذ', res.status);
  return data as T;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const when = (ts: number) => (ts ? new Date(ts).toLocaleString('ar-DZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ar-DZ', { weekday: 'short' });

function seen(p: Person) {
  if (p.online) return 'متصل الآن';
  if (!p.lastSeen) return 'لم يفتح التطبيق';
  return `آخر ظهور ${when(p.lastSeen)}`;
}

/* ---------------- small pieces ---------------- */

function Stat({ label, value, sub, icon: Icon, tone }: { label: string; value: string | number; sub?: string; icon: typeof Activity; tone?: 'good' | 'warn' }) {
  return (
    <div className="ca-stat">
      <span className={`ca-stat-icon${tone ? ` is-${tone}` : ''}`}><Icon className="w-5 h-5" /></span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        {sub ? <em>{sub}</em> : null}
      </div>
    </div>
  );
}

/** One series per chart (messages / calls have different scales: two charts, never two axes). */
function WeekBars({ title, data }: { title: string; data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="ca-chart">
      <figcaption>{title}</figcaption>
      <div className="ca-bars" role="img" aria-label={`${title}: ${data.map((d) => `${dayLabel(d.day)} ${d.value}`).join('، ')}`}>
        {data.map((d) => (
          <div key={d.day} className="ca-bar-col" title={`${dayLabel(d.day)} ${d.day.slice(5)} — ${d.value}`}>
            <span className="ca-bar-val">{d.value || ''}</span>
            <span className="ca-bar" style={{ height: `${Math.max(d.value ? 4 : 0, (d.value / max) * 100)}%` }} />
            <span className="ca-bar-day">{dayLabel(d.day)}</span>
          </div>
        ))}
      </div>
      <table className="ca-sr">
        <caption>{title}</caption>
        <tbody>{data.map((d) => <tr key={d.day}><th>{d.day}</th><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  return <span className="ca-avatar">{photo ? <img src={photo} alt="" /> : name.charAt(0)}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ca-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ca-modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button type="button" className="ca-icon" onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Switch({ on, onChange, label, hint, busy }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; busy?: boolean }) {
  return (
    <label className="ca-switch">
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/* ---------------- the page ---------------- */

export default function ConnectAdmin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [denied, setDenied] = useState<'signin' | 'forbidden' | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [now, setNow] = useState(Date.now());

  const fail = useCallback((e: unknown) => {
    const err = e as ApiError;
    if (err.status === 401) setDenied('signin');
    else if (err.status === 403) setDenied('forbidden');
    else setToast({ text: err.message || 'حدث خطأ', bad: true });
  }, []);

  const loadOverview = useCallback(() => get<Overview>('overview').then(setOv).catch(fail), [fail]);
  const loadPeople = useCallback(() => get<{ people: Person[] }>('people').then((d) => setPeople(d.people)).catch(fail), [fail]);
  const loadGroups = useCallback(() => get<{ groups: Group[] }>('groups').then((d) => setGroups(d.groups)).catch(fail), [fail]);
  const loadLog = useCallback(() => get<{ log: LogRow[] }>('audit').then((d) => setLog(d.log)).catch(fail), [fail]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Live: the overview and calls refresh every 5 s while on screen.
  useEffect(() => {
    if (denied || (tab !== 'overview' && tab !== 'calls')) return;
    const t = window.setInterval(() => document.visibilityState === 'visible' && void loadOverview(), 5000);
    return () => window.clearInterval(t);
  }, [tab, denied, loadOverview]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (tab === 'people' || tab === 'groups' || tab === 'broadcast') void loadPeople();
    if (tab === 'groups' || tab === 'broadcast') {
      void loadGroups();
      void get<{ programs: Program[] }>('programs').then((d) => setPrograms(d.programs)).catch(fail);
    }
    if (tab === 'audit') void loadLog();
  }, [tab, loadPeople, loadGroups, loadLog, fail]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const run = async (body: Record<string, unknown>, done: string, after?: () => void) => {
    try {
      await act(body);
      setToast({ text: done });
      after?.();
    } catch (e) {
      fail(e);
    }
  };

  if (denied) {
    return (
      <div className="ca-gate" dir="rtl">
        <div className="ca-gate-card">
          <span className="ca-gate-icon"><Shield className="w-8 h-8" /></span>
          <h1>لوحة SS Connect</h1>
          {denied === 'signin' ? (
            <>
              <p>هذه اللوحة للمدير العام فقط. سجّل الدخول بكلمة المرور ومفتاح الأمان ثم عد إلى هذه الصفحة.</p>
              <a className="ca-btn is-main" href="/admin"><LogIn className="w-5 h-5" /> تسجيل الدخول</a>
            </>
          ) : (
            <p>هذا الحساب لا يملك صلاحية لوحة SS Connect — هي للمدير العام فقط، بعد الدخول بمفتاح الأمان.</p>
          )}
          <button type="button" className="ca-btn" onClick={() => { setDenied(null); void loadOverview(); }}><RefreshCw className="w-4 h-4" /> إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ca-app" dir="rtl">
      <aside className="ca-side">
        <div className="ca-brand">
          <img src="/icons/connect-192.png" alt="" />
          <div>
            <b>SS Connect</b>
            <small>غرفة التحكم</small>
          </div>
        </div>
        <nav className="ca-nav" aria-label="أقسام اللوحة">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <t.icon className="w-5 h-5" />
              <span>{t.label}</span>
              {t.id === 'calls' && ov?.live.length ? <em>{ov.live.length}</em> : null}
            </button>
          ))}
        </nav>
        <p className="ca-privacy"><Lock className="w-4 h-4" /> اللوحة تعرض النشاط فقط — لا تعرض محتوى المحادثات الخاصة.</p>
      </aside>

      <main className="ca-main">
        {tab === 'overview' ? <OverviewTab ov={ov} now={now} onEnd={(id) => run({ action: 'end-call', id }, 'أُنهيت المكالمة', loadOverview)} /> : null}
        {tab === 'calls' ? <CallsTab calls={ov?.live || null} now={now} onEnd={(id) => run({ action: 'end-call', id }, 'أُنهيت المكالمة', loadOverview)} /> : null}
        {tab === 'people' ? <PeopleTab people={people} run={run} reload={loadPeople} /> : null}
        {tab === 'groups' ? <GroupsTab groups={groups} people={people || []} programs={programs} run={run} reload={loadGroups} fail={fail} /> : null}
        {tab === 'broadcast' ? <BroadcastTab groups={groups || []} people={people || []} run={run} /> : null}
        {tab === 'settings' ? <SettingsTab rules={ov?.settings || null} relay={Boolean(ov?.relay)} run={run} reload={loadOverview} /> : null}
        {tab === 'audit' ? <AuditTab log={log} reload={loadLog} /> : null}
      </main>

      {toast ? <div className={`ca-toast${toast.bad ? ' is-bad' : ''}`} role="status">{toast.text}</div> : null}
    </div>
  );
}

/* ---------------- tabs ---------------- */

function OverviewTab({ ov, now, onEnd }: { ov: Overview | null; now: number; onEnd: (id: string) => void }) {
  if (!ov) return <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const t = ov.today;
  return (
    <section>
      <header className="ca-head">
        <h1>نظرة عامة</h1>
        <span className="ca-live-dot">مباشر</span>
      </header>
      <div className="ca-stats">
        <Stat icon={Users} label="متصلون الآن" value={ov.users.online} sub={`من ${ov.users.total} مستخدم`} tone="good" />
        <Stat icon={Phone} label="مكالمات جارية" value={ov.live.length} sub={`اليوم ${t.calls} مكالمة`} />
        <Stat icon={MessageCircle} label="رسائل اليوم" value={t.messages} sub={`منها ${t.groupMessages} في المجموعات · ${t.voiceNotes} صوتية`} />
        <Stat icon={Check} label="مكالمات تم الرد عليها" value={t.answered} sub={`متوسط المدة ${clock(t.avgCallSeconds)}`} tone="good" />
        <Stat icon={PhoneOff} label="فائتة / تعذّر الوصول" value={`${t.missed} / ${t.unreachable}`} sub={`مرفوضة ${t.declined}`} tone={t.unreachable ? 'warn' : undefined} />
        <Stat icon={Ban} label="موقوفون" value={ov.users.suspended} sub={`مكالمات ممنوعة ${ov.users.callsBlocked}`} tone={ov.users.suspended ? 'warn' : undefined} />
        <Stat icon={Smartphone} label="الأجهزة" value={ov.devices.android + ov.devices.web} sub={`أندرويد ${ov.devices.android} · ويب ${ov.devices.web}`} />
        <Stat icon={ShieldCheck} label="خادم الوصل" value={ov.relay ? 'يعمل' : 'غير مضبوط'} sub={ov.settings.relayOnly ? 'كل المكالمات عبره' : 'عند الحاجة'} tone={ov.relay ? 'good' : 'warn'} />
      </div>
      <div className="ca-charts">
        <WeekBars title="الرسائل — آخر 7 أيام" data={ov.week.map((w) => ({ day: w.day, value: w.messages }))} />
        <WeekBars title="المكالمات — آخر 7 أيام" data={ov.week.map((w) => ({ day: w.day, value: w.calls }))} />
      </div>
      <h2 className="ca-sub">المكالمات الجارية</h2>
      <CallList calls={ov.live} now={now} onEnd={onEnd} />
      <h2 className="ca-sub">المستخدمون حسب الدور</h2>
      <div className="ca-chips">{Object.entries(ov.users.byRole).map(([k, v]) => <span key={k} className="ca-chip">{k} <b>{v}</b></span>)}</div>
    </section>
  );
}

function CallList({ calls, now, onEnd }: { calls: LiveCall[]; now: number; onEnd: (id: string) => void }) {
  const [confirm, setConfirm] = useState<LiveCall | null>(null);
  if (!calls.length) return <p className="ca-empty"><Phone className="w-5 h-5" /> لا توجد مكالمات جارية الآن.</p>;
  return (
    <>
      <ul className="ca-list">
        {calls.map((c) => (
          <li key={c.id} className="ca-row">
            <span className={`ca-state is-${c.state}`}>{c.state === 'active' ? 'جارية' : c.ringing ? 'يرنّ' : 'جارٍ الاتصال'}</span>
            <span className="ca-row-main">
              <b>{c.caller} ← {c.callee}</b>
              <small>
                {c.answeredTs ? `المدة ${clock((now - c.answeredTs) / 1000)}` : `منذ ${clock((now - c.startedTs) / 1000)}`}
                {c.signed ? ' · موقّعة ومشفّرة' : ''}
              </small>
            </span>
            <button type="button" className="ca-btn is-danger" onClick={() => setConfirm(c)}><PhoneOff className="w-4 h-4" /> إنهاء</button>
          </li>
        ))}
      </ul>
      {confirm ? (
        <Modal title="إنهاء المكالمة؟" onClose={() => setConfirm(null)}>
          <p className="ca-p">ستنتهي مكالمة {confirm.caller} مع {confirm.callee} فورًا على الهاتفين.</p>
          <div className="ca-actions">
            <button type="button" className="ca-btn" onClick={() => setConfirm(null)}>تراجع</button>
            <button type="button" className="ca-btn is-danger" onClick={() => { onEnd(confirm.id); setConfirm(null); }}>إنهاء المكالمة</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function CallsTab({ calls, now, onEnd }: { calls: LiveCall[] | null; now: number; onEnd: (id: string) => void }) {
  return (
    <section>
      <header className="ca-head">
        <h1>المكالمات الحية</h1>
        <span className="ca-live-dot">تتحدّث كل 5 ثوانٍ</span>
      </header>
      {calls ? <CallList calls={calls} now={now} onEnd={onEnd} /> : <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}
    </section>
  );
}

type Run = (body: Record<string, unknown>, done: string, after?: () => void) => Promise<void>;

function PeopleTab({ people, run, reload }: { people: Person[] | null; run: Run; reload: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'clients' | 'team' | 'stopped'>('all');
  const [stop, setStop] = useState<{ p: Person; kind: 'suspend' | 'block-calls' } | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (people || []).filter((p) =>
      (!text || p.name.toLowerCase().includes(text) || p.roleLabel.includes(text)) &&
      (filter === 'all' || (filter === 'online' && p.online) || (filter === 'clients' && p.role === 'PILGRIM_USER') ||
        (filter === 'team' && p.role !== 'PILGRIM_USER') || (filter === 'stopped' && (p.suspended || p.callsBlocked)))
    );
  }, [people, q, filter]);

  const isSuper = (p: Person) => p.role === 'SUPER_ADMIN';

  return (
    <section>
      <header className="ca-head">
        <h1>المستخدمون</h1>
        <button type="button" className="ca-icon" onClick={reload} aria-label="تحديث"><RefreshCw className="w-5 h-5" /></button>
      </header>
      <div className="ca-tools">
        <label className="ca-search"><Search className="w-4 h-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الدور" /></label>
        <div className="ca-seg" role="tablist" aria-label="تصفية">
          {([['all', 'الكل'], ['online', 'متصلون'], ['clients', 'العملاء'], ['team', 'الفريق'], ['stopped', 'موقوفون']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {!people ? <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <ul className="ca-list">
          {list.map((p) => (
            <li key={p.id} className="ca-row is-person">
              <span className="ca-who">
                <Avatar name={p.name} photo={p.photo} />
                {p.online ? <i className="ca-dot" /> : null}
              </span>
              <span className="ca-row-main">
                <b>{p.name} <small className="ca-role">{p.roleLabel}</small></b>
                <small>
                  {seen(p)} · {p.messages7d} رسالة و {p.calls7d} مكالمة هذا الأسبوع · <Smartphone className="w-3 h-3 ca-inline" /> {p.devices.android + p.devices.web}
                </small>
                {p.suspended || p.callsBlocked ? (
                  <small className="ca-flag">
                    {p.suspended ? 'موقوف' : 'المكالمات ممنوعة'}{p.reason ? ` — ${p.reason}` : ''}{p.untilTs ? ` · حتى ${when(p.untilTs)}` : ''}
                  </small>
                ) : null}
              </span>
              {isSuper(p) ? <span className="ca-chip">المدير العام</span> : (
                <span className="ca-row-actions">
                  {p.suspended ? (
                    <button type="button" className="ca-btn" onClick={() => run({ action: 'unsuspend', userId: p.id }, `رُفع الإيقاف عن ${p.name}`, reload)}><Check className="w-4 h-4" /> رفع الإيقاف</button>
                  ) : (
                    <button type="button" className="ca-btn is-danger" onClick={() => { setReason(''); setDays(''); setStop({ p, kind: 'suspend' }); }}><Ban className="w-4 h-4" /> إيقاف</button>
                  )}
                  {p.callsBlocked ? (
                    <button type="button" className="ca-btn" onClick={() => run({ action: 'allow-calls', userId: p.id }, `سُمح لـ ${p.name} بالمكالمات`, reload)}><Phone className="w-4 h-4" /> السماح بالمكالمات</button>
                  ) : (
                    <button type="button" className="ca-btn" onClick={() => { setReason(''); setDays(''); setStop({ p, kind: 'block-calls' }); }}><MicOff className="w-4 h-4" /> منع المكالمات</button>
                  )}
                  {p.devices.android + p.devices.web ? (
                    <button type="button" className="ca-icon" title="إزالة أجهزته (لن تصله الإشعارات حتى يفتح التطبيق من جديد)" aria-label="إزالة الأجهزة" onClick={() => run({ action: 'remove-devices', userId: p.id }, `أُزيلت أجهزة ${p.name}`, reload)}><Smartphone className="w-4 h-4" /></button>
                  ) : null}
                </span>
              )}
            </li>
          ))}
          {!list.length ? <li className="ca-empty">لا أحد بهذا البحث.</li> : null}
        </ul>
      )}
      {stop ? (
        <Modal title={stop.kind === 'suspend' ? `إيقاف ${stop.p.name}` : `منع المكالمات عن ${stop.p.name}`} onClose={() => setStop(null)}>
          <p className="ca-p">
            {stop.kind === 'suspend'
              ? 'لن يستطيع فتح SS Connect ولا المراسلة ولا الاتصال، وتنتهي مكالمته الجارية فورًا. يرى سبب الإيقاف.'
              : 'يبقى يراسل لكنه لا يتصل ولا يُتصل به، وتنتهي مكالمته الجارية فورًا.'}
          </p>
          <label className="ca-field"><span>السبب (يظهر له)</span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="مثال: إزعاج متكرر" /></label>
          <label className="ca-field"><span>المدة بالأيام (فارغ = حتى أرفعه)</span><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="مثال: 7" /></label>
          <div className="ca-actions">
            <button type="button" className="ca-btn" onClick={() => setStop(null)}>تراجع</button>
            <button type="button" className="ca-btn is-danger" onClick={() => { void run({ action: stop.kind, userId: stop.p.id, reason, days: days ? Number(days) : undefined }, stop.kind === 'suspend' ? `أُوقف ${stop.p.name}` : `مُنعت المكالمات عن ${stop.p.name}`, reload); setStop(null); }}>
              {stop.kind === 'suspend' ? 'إيقاف' : 'منع المكالمات'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function GroupsTab({ groups, people, programs, run, reload, fail }: { groups: Group[] | null; people: Person[]; programs: Program[]; run: Run; reload: () => void; fail: (e: unknown) => void }) {
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', packageId: '', mode: 'all' as 'all' | 'admins' });

  const create = async () => {
    try {
      const { group } = await act<{ group: Group }>({ action: 'group-create', ...form, packageId: form.packageId || null });
      setCreating(false);
      setForm({ name: '', description: '', packageId: '', mode: 'all' });
      reload();
      setOpen(group.id);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <section>
      <header className="ca-head">
        <h1>المجموعات</h1>
        <button type="button" className="ca-btn is-main" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> مجموعة جديدة</button>
      </header>
      {!groups ? <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : groups.length ? (
        <ul className="ca-grid">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" className={`ca-card${g.closed ? ' is-closed' : ''}`} onClick={() => setOpen(g.id)}>
                <span className="ca-card-top">
                  <span className="ca-avatar is-group"><Users className="w-5 h-5" /></span>
                  <b>{g.name}</b>
                </span>
                <small>{g.packageName ? `برنامج: ${g.packageName}` : g.description || 'مجموعة يدوية'}</small>
                <span className="ca-card-meta">
                  <span className="ca-chip">{g.members} عضو</span>
                  {g.mode === 'admins' ? <span className="ca-chip"><Megaphone className="w-3 h-3" /> إعلانات</span> : null}
                  {g.closed ? <span className="ca-chip is-warn"><Lock className="w-3 h-3" /> مغلقة</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="ca-empty"><MessageCircle className="w-5 h-5" /> لا مجموعات بعد. أنشئ مجموعة لبرنامج فينضم معتمروه ومرشده تلقائيًا.</p>}

      {creating ? (
        <Modal title="مجموعة جديدة" onClose={() => setCreating(false)}>
          <label className="ca-field"><span>من برنامج (اختياري)</span>
            <select value={form.packageId} onChange={(e) => {
              const p = programs.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, packageId: e.target.value, name: f.name || p?.name || '' }));
            }}>
              <option value="">— مجموعة يدوية —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.startDate ? ` · ${p.startDate}` : ''} ({p.people})</option>)}
            </select>
          </label>
          <label className="ca-field"><span>الاسم</span><input value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: عمرة رمضان — الفوج الأول" /></label>
          <label className="ca-field"><span>الوصف</span><input value={form.description} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
          <div className="ca-seg">
            <button type="button" className={form.mode === 'all' ? 'is-on' : ''} onClick={() => setForm((f) => ({ ...f, mode: 'all' }))}>الجميع يكتب</button>
            <button type="button" className={form.mode === 'admins' ? 'is-on' : ''} onClick={() => setForm((f) => ({ ...f, mode: 'admins' }))}>المشرفون فقط (إعلانات)</button>
          </div>
          {form.packageId ? <p className="ca-hint">ينضم تلقائيًا معتمرو البرنامج (الحجوزات غير الملغاة) ومرشده كمشرف.</p> : null}
          <div className="ca-actions">
            <button type="button" className="ca-btn" onClick={() => setCreating(false)}>تراجع</button>
            <button type="button" className="ca-btn is-main" disabled={!form.name.trim()} onClick={() => void create()}>إنشاء</button>
          </div>
        </Modal>
      ) : null}

      {open ? <GroupPanel id={open} people={people} run={run} onClose={() => setOpen(null)} onChanged={reload} fail={fail} /> : null}
    </section>
  );
}

function GroupPanel({ id, people, run, onClose, onChanged, fail }: { id: string; people: Person[]; run: Run; onClose: () => void; onChanged: () => void; fail: (e: unknown) => void }) {
  const [data, setData] = useState<{ group: Group; members: Member[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => get<{ group: Group; members: Member[] }>('group', `&id=${encodeURIComponent(id)}`).then(setData).catch(fail), [id, fail]);
  useEffect(() => {
    void load();
  }, [load]);

  const after = () => {
    void load();
    onChanged();
  };

  if (!data) return <Modal title="المجموعة" onClose={onClose}><div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div></Modal>;
  const g = data.group;
  const inGroup = new Set(data.members.map((m) => m.id));
  const candidates = people.filter((p) => !inGroup.has(p.id) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 40);

  return (
    <Modal title={g.name} onClose={onClose}>
      <p className="ca-p">{g.packageName ? `مرتبطة ببرنامج «${g.packageName}»` : 'مجموعة يدوية'}{g.description ? ` — ${g.description}` : ''}</p>
      <div className="ca-actions is-wrap">
        <button type="button" className="ca-btn" onClick={() => run({ action: 'group-update', id: g.id, mode: g.mode === 'all' ? 'admins' : 'all' }, g.mode === 'all' ? 'أصبحت للإعلانات: المشرفون فقط يكتبون' : 'أصبح الجميع يكتب', after)}>
          <Megaphone className="w-4 h-4" /> {g.mode === 'all' ? 'المشرفون فقط يكتبون' : 'الجميع يكتب'}
        </button>
        <button type="button" className="ca-btn" onClick={() => run({ action: 'group-update', id: g.id, closed: !g.closed }, g.closed ? 'فُتحت المجموعة' : 'أُغلقت المجموعة (للقراءة فقط)', after)}>
          <Lock className="w-4 h-4" /> {g.closed ? 'فتح المجموعة' : 'إغلاق المجموعة'}
        </button>
        {g.packageId ? <button type="button" className="ca-btn" onClick={() => run({ action: 'group-sync', id: g.id }, 'تمت مزامنة أعضاء البرنامج', after)}><RefreshCw className="w-4 h-4" /> مزامنة البرنامج</button> : null}
        <button type="button" className="ca-btn is-main" onClick={() => setAdding((a) => !a)}><UserPlus className="w-4 h-4" /> إضافة أعضاء</button>
        <button type="button" className="ca-btn is-danger" onClick={() => setConfirmDelete(true)}><Trash2 className="w-4 h-4" /> حذف</button>
      </div>

      {adding ? (
        <div className="ca-picker">
          <label className="ca-search"><Search className="w-4 h-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن شخص" autoFocus /></label>
          <ul>
            {candidates.map((p) => (
              <li key={p.id}>
                <Avatar name={p.name} photo={p.photo} />
                <span><b>{p.name}</b><small>{p.roleLabel}</small></span>
                <button type="button" className="ca-btn" onClick={() => run({ action: 'group-add', id: g.id, userIds: [p.id] }, `أُضيف ${p.name}`, after)}><Plus className="w-4 h-4" /> إضافة</button>
              </li>
            ))}
            {!candidates.length ? <li className="ca-empty">لا أحد للإضافة.</li> : null}
          </ul>
        </div>
      ) : null}

      <h4 className="ca-sub">الأعضاء ({data.members.length})</h4>
      <ul className="ca-members">
        {data.members.map((m) => (
          <li key={m.id}>
            <Avatar name={m.name} photo={m.photo} />
            <span><b>{m.name}</b><small>{m.roleLabel}{m.groupRole === 'admin' ? ' · مشرف المجموعة' : ''}</small></span>
            <button type="button" className="ca-icon" title={m.groupRole === 'admin' ? 'إلغاء الإشراف' : 'تعيين مشرفًا'} aria-label={m.groupRole === 'admin' ? 'إلغاء الإشراف' : 'تعيين مشرفًا'}
              onClick={() => run({ action: 'group-role', id: g.id, userId: m.id, role: m.groupRole === 'admin' ? 'member' : 'admin' }, m.groupRole === 'admin' ? `لم يعد ${m.name} مشرفًا` : `${m.name} مشرف الآن`, after)}>
              <ShieldCheck className={`w-4 h-4${m.groupRole === 'admin' ? ' ca-on' : ''}`} />
            </button>
            <button type="button" className="ca-icon" title="إخراج من المجموعة" aria-label="إخراج من المجموعة" onClick={() => run({ action: 'group-remove', id: g.id, userId: m.id }, `أُخرج ${m.name}`, after)}>
              <UserMinus className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>

      {confirmDelete ? (
        <div className="ca-confirm">
          <p>حذف «{g.name}» يمحو المجموعة ورسائلها نهائيًا من كل الأجهزة.</p>
          <div className="ca-actions">
            <button type="button" className="ca-btn" onClick={() => setConfirmDelete(false)}>تراجع</button>
            <button type="button" className="ca-btn is-danger" onClick={() => { void run({ action: 'group-delete', id: g.id }, 'حُذفت المجموعة', onChanged); onClose(); }}>حذف نهائي</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function BroadcastTab({ groups, people, run }: { groups: Group[]; people: Person[]; run: Run }) {
  const [target, setTarget] = useState<'all' | 'clients' | 'team' | 'group'>('all');
  const [groupId, setGroupId] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const count = target === 'group' ? groups.find((g) => g.id === groupId)?.members ?? 0
    : people.filter((p) => p.role !== 'SUPER_ADMIN' && (target === 'all' || (target === 'clients' ? p.role === 'PILGRIM_USER' : p.role !== 'PILGRIM_USER'))).length;

  const send = async () => {
    setSending(true);
    await run({ action: 'broadcast', target, groupId, text }, 'أُرسل الإعلان', () => setText(''));
    setSending(false);
  };

  return (
    <section>
      <header className="ca-head"><h1>إعلان</h1></header>
      <div className="ca-panel">
        <div className="ca-seg">
          {([['all', 'الجميع'], ['clients', 'العملاء'], ['team', 'الفريق'], ['group', 'مجموعة']] as const).map(([k, l]) => (
            <button key={k} type="button" className={target === k ? 'is-on' : ''} onClick={() => setTarget(k)}>{l}</button>
          ))}
        </div>
        {target === 'group' ? (
          <label className="ca-field"><span>المجموعة</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— اختر —</option>
              {groups.filter((g) => !g.closed).map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members})</option>)}
            </select>
          </label>
        ) : null}
        <label className="ca-field"><span>النص</span><textarea rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="مثال: موعد التجمع غدًا الساعة 6 صباحًا في بهو الفندق" /></label>
        <p className="ca-hint">
          {target === 'group' ? 'يُنشر في المجموعة باسمك.' : 'يصل كرسالة منك في محادثة كل شخص، مع إشعار.'} سيصل إلى {count} شخص.
        </p>
        <div className="ca-actions">
          <button type="button" className="ca-btn is-main" disabled={!text.trim() || sending || (target === 'group' && !groupId)} onClick={() => void send()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} إرسال الإعلان
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsTab({ rules, relay, run, reload }: { rules: Rules | null; relay: boolean; run: Run; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!rules) return <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const set = async (patch: Partial<Rules>, done: string) => {
    setBusy(true);
    await run({ action: 'settings', ...patch }, done, reload);
    setBusy(false);
  };
  return (
    <section>
      <header className="ca-head"><h1>القواعد العامة</h1></header>
      <div className="ca-panel">
        <Switch busy={busy} on={rules.calls} label="المكالمات الصوتية" hint="إيقافها ينهي المكالمات الجارية ويمنع الجميع من الاتصال (عدا المدير العام)." onChange={(v) => void set({ calls: v }, v ? 'فُعّلت المكالمات' : 'أُوقفت المكالمات للجميع')} />
        <Switch busy={busy} on={rules.clientChat} label="مراسلة العملاء فيما بينهم" hint="عند الإيقاف يراسل العملاء فريق الوكالة فقط، لا بعضهم بعضًا." onChange={(v) => void set({ clientChat: v }, v ? 'فُعّلت مراسلة العملاء' : 'أُوقفت مراسلة العملاء فيما بينهم')} />
        <Switch busy={busy || !relay} on={rules.relayOnly} label="كل المكالمات عبر خادم الوصل" hint={relay ? 'لا يرى أي طرف عنوان IP الطرف الآخر. تأخير بسيط إضافي.' : 'يتطلب خادم الوصل (TURN) — غير مضبوط.'} onChange={(v) => void set({ relayOnly: v }, v ? 'كل المكالمات عبر خادم الوصل' : 'الاتصال المباشر عند الإمكان')} />
      </div>
    </section>
  );
}

function AuditTab({ log, reload }: { log: LogRow[] | null; reload: () => void }) {
  return (
    <section>
      <header className="ca-head">
        <h1>السجل</h1>
        <button type="button" className="ca-icon" onClick={reload} aria-label="تحديث"><RefreshCw className="w-5 h-5" /></button>
      </header>
      {!log ? <div className="ca-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : log.length ? (
        <ul className="ca-list">
          {log.map((r, i) => (
            <li key={i} className="ca-row">
              <span className="ca-row-main">
                <b>{r.action}</b>
                <small>{r.details}</small>
              </span>
              <small className="ca-when">{r.actor} · {r.ts ? new Date(r.ts).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</small>
            </li>
          ))}
        </ul>
      ) : <p className="ca-empty"><ClipboardList className="w-5 h-5" /> لا إجراءات بعد.</p>}
    </section>
  );
}
