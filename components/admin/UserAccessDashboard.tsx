'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Bell,
  Clock,
  KeyRound,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_LABELS, LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import { DEFAULT_USER_PHOTO, formatAdminDate, type EnrichedUser } from '@/lib/user-access-view';
import SecurityCenter from '@/components/admin/SecurityCenter';
import UserProfileModal from '@/components/admin/UserProfileModal';
import GoogleLoginSettings from '@/components/admin/GoogleLoginSettings';

type DashboardStats = {
  total: number;
  online: number;
  pending: number;
  suspended: number;
  active: number;
  sessions: number;
  neverLoggedIn: number;
  liveIps: number;
};

type LiveIpRow = {
  ip: string;
  hits: number;
  trusted?: boolean;
  lastPath?: string;
  lastSeen?: string;
  agent?: string;
};

const EMPTY_STATS: DashboardStats = {
  total: 0,
  online: 0,
  pending: 0,
  suspended: 0,
  active: 0,
  sessions: 0,
  neverLoggedIn: 0,
  liveIps: 0,
};

const HEARTBEAT_MS = 45000;
const REFRESH_MS = 20000;

type FilterKey = 'all' | 'online' | 'active' | 'pending' | 'suspended';

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'مفعّل',
  PENDING_APPROVAL: 'جديد',
  REJECTED: 'مرفوض',
  SUSPENDED: 'موقوف',
};

const FILTER_PILLS: { id: FilterKey; label: string; dot?: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'online', label: 'متصل', dot: 'orange' },
  { id: 'active', label: 'مفعّل', dot: 'green' },
  { id: 'pending', label: 'بانتظار', dot: 'purple' },
  { id: 'suspended', label: 'موقوف', dot: 'pink' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return name.slice(0, 2) || '؟';
}

/** Names are stored as "طارق العماري (المدير العام)" — keep the title out of the name line. */
function splitName(full: string): { name: string; note: string } {
  const match = full.trim().match(/^(.*?)\s*[（(]\s*([^）)]*?)\s*[）)]$/);
  if (match) return { name: match[1], note: match[2] };
  return { name: full.trim(), note: '' };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `${min}د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}س`;
  return `${Math.floor(hr / 24)}ي`;
}

function clockTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function deviceLabel(userAgent?: string | null): string {
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

function UserAvatar({
  user,
  size,
}: {
  user: EnrichedUser;
  size?: 'sm' | 'lg';
}) {
  const [broken, setBroken] = useState(false);

  return (
    <span
      className={`inn-avatar${size ? ` inn-avatar-${size}` : ''}${user.isOnline ? ' is-live' : ''}`}
      title={user.name}
    >
      {broken ? (
        <span className="inn-avatar-initials">{initials(user.name)}</span>
      ) : (
        <img
          className="inn-avatar-img"
          src={user.photo || DEFAULT_USER_PHOTO}
          alt={user.name}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}

function statusTone(user: EnrichedUser): string {
  if (user.status === 'PENDING_APPROVAL') return 'new';
  if (user.status === 'SUSPENDED' || user.loginEnabled === false) return 'cancelled';
  if (user.isOnline) return 'checked-in';
  if (user.status === 'APPROVED') return 'confirmed';
  if (user.status === 'REJECTED') return 'cancelled';
  return 'completed';
}

export default function UserAccessDashboard({
  currentUser,
  onLogout,
}: {
  currentUser: { id?: string; name?: string; role?: string; email?: string };
  onLogout: () => void;
}) {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sideOpen, setSideOpen] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [section, setSection] = useState<'users' | 'security' | 'google'>('users');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [liveIps, setLiveIps] = useState<LiveIpRow[]>([]);

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
      const res = await fetch('/api/admin/users', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setStats({ ...EMPTY_STATS, ...(data.stats || {}) });
      setLiveIps(Array.isArray(data.liveIps) ? data.liveIps : []);
      setSyncedAt(data.serverTime || new Date().toISOString());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /** Marks the signed-in admin as active so "online now" reflects live presence. */
  const sendHeartbeat = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
    if (!token) return;
    try {
      await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
        credentials: 'same-origin',
      });
    } catch {
      /* presence is best-effort; the dashboard keeps working offline */
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('south_street_token');
    if (token) {
      document.cookie = `south_street_token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`;
    }
    try {
      const saved = localStorage.getItem('south_street_admin_side');
      if (saved === '0') setSideOpen(false);
      else if (saved === '1') setSideOpen(true);
      else setSideOpen(window.innerWidth >= 1180);
    } catch {
      setSideOpen(window.innerWidth >= 1180);
    }
  }, []);

  const toggleSide = useCallback(() => {
    setSideOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem('south_street_admin_side', next ? '1' : '0');
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      await sendHeartbeat();
      if (alive) loadUsers(true);
    };

    sendHeartbeat().then(() => {
      if (alive) loadUsers();
    });

    const refresh = window.setInterval(() => loadUsers(true), REFRESH_MS);
    const beat = window.setInterval(tick, HEARTBEAT_MS);
    return () => {
      alive = false;
      window.clearInterval(refresh);
      window.clearInterval(beat);
    };
  }, [loadUsers, sendHeartbeat]);

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  const endSessionAndLogout = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
    if (token) {
      try {
        await fetch('/api/session/heartbeat', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      } catch {
        /* fall through to the local sign-out either way */
      }
    }
    onLogout();
  }, [onLogout]);

  const patchUser = async (userId: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...body }),
    });
    const data = await res.json();
    if (res.ok) {
      setToast(data.message || 'تم التحديث');
      loadUsers(true);
    } else {
      setToast(data.error || 'فشل التحديث');
    }
    window.setTimeout(() => setToast(''), 3200);
  };

  const toggleActive = (user: EnrichedUser) => {
    const suspend = user.status === 'APPROVED' && user.loginEnabled !== false;
    if (suspend) patchUser(user.id, { status: 'SUSPENDED', loginEnabled: false });
    else patchUser(user.id, { status: 'APPROVED', loginEnabled: true });
  };

  const isSelf = useCallback(
    (user: EnrichedUser) =>
      Boolean(
        (currentUser?.id && user.id === currentUser.id) ||
        (currentUser?.email && user.email && user.email === currentUser.email)
      ),
    [currentUser]
  );

  const liveUsers = useMemo(
    () =>
      users.map((user) => {
        if (!isSelf(user)) return user;
        return {
          ...user,
          isOnline: true,
          lastActive: user.lastActive || new Date().toISOString(),
          displayIp: !user.displayIp || user.displayIp === '—' ? 'هذا الجهاز' : user.displayIp,
        };
      }),
    [users, isSelf]
  );

  const filtered = useMemo(() => {
    let list = [...liveUsers];
    if (filter === 'online') list = list.filter((u) => u.isOnline);
    if (filter === 'active') list = list.filter((u) => u.status === 'APPROVED' && u.loginEnabled !== false);
    if (filter === 'pending') list = list.filter((u) => u.status === 'PENDING_APPROVAL');
    if (filter === 'suspended') list = list.filter((u) => u.status === 'SUSPENDED' || u.loginEnabled === false);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        u.displayIp.toLowerCase().includes(q) ||
        u.displayFingerprint.toLowerCase().includes(q)
    );
  }, [liveUsers, filter, query]);

  const onlineUsers = useMemo(() => {
    const list = liveUsers
      .filter((u) => u.isOnline)
      .sort((a, b) => new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime());
    if (list.length > 0 || !currentUser) return list;
    return [
      {
        id: currentUser.id || 'self',
        name: currentUser.name || 'Admin',
        email: currentUser.email || '',
        photo: DEFAULT_USER_PHOTO,
        role: currentUser.role || 'SUPER_ADMIN',
        roleName: '',
        status: 'APPROVED',
        isOnline: true,
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        displayIp: 'هذا الجهاز',
        displayFingerprint: '—',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      } as EnrichedUser,
    ];
  }, [liveUsers, currentUser]);

  const onlineCount = Math.max(onlineUsers.length, currentUser ? 1 : 0);
  const remoteIps = useMemo(() => liveIps.filter((entry) => !entry.trusted), [liveIps]);

  const recentLogins = useMemo(
    () =>
      users
        .filter((u) => u.lastLogin)
        .sort((a, b) => new Date(b.lastLogin || 0).getTime() - new Date(a.lastLogin || 0).getTime())
        .slice(0, 6),
    [users]
  );

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, { total: number; online: number }>();
    for (const u of liveUsers) {
      const key = u.roleName || u.role;
      const entry = counts.get(key) || { total: 0, online: 0 };
      entry.total += 1;
      if (u.isOnline) entry.online += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [liveUsers]);

  const me = useMemo(
    () => liveUsers.find((u) => isSelf(u)),
    [liveUsers, isSelf]
  );

  const profileUser = useMemo(() => users.find((u) => u.id === profileId) || null, [users, profileId]);

  const blockIp = useCallback(async (ip: string) => {
    const res = await fetch('/api/security/firewall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('south_street_token') || ''}`,
      },
      body: JSON.stringify({ action: 'block', ip, note: 'حظر من ملف المستخدم' }),
    });
    const data = await res.json().catch(() => ({}));
    setToast(res.ok ? data.message || `تم حظر ${ip}` : data.error || 'تعذّر حظر العنوان');
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const todayLabel = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const activePct = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className={`inn-shell${sideOpen ? '' : ' is-side-hidden'}`}>
      <div className="inn-frame">
        {/* ── Dark header block ── */}
        <header className="inn-dark">
          <div className="inn-topnav">
            <button
              type="button"
              className={`inn-side-toggle${sideOpen ? ' is-open' : ''}`}
              onClick={toggleSide}
              aria-expanded={sideOpen}
              aria-controls="inn-side-panel"
              title={sideOpen ? 'إخفاء اللوحة الجانبية' : 'إظهار اللوحة الجانبية'}
            >
              {sideOpen ? <PanelLeftClose className="w-[18px] h-[18px]" /> : <PanelLeftOpen className="w-[18px] h-[18px]" />}
            </button>

            <div className="inn-logo">
              <span className="inn-logo-mark">
                <img src="/images/south_street_logo_trans.png" alt="" />
              </span>
              <span>South Street</span>
            </div>

            <nav className="inn-menu" aria-label="القائمة الرئيسية">
              <button
                type="button"
                className={`inn-menu-link${section === 'users' && filter === 'all' ? ' is-active' : ''}`}
                onClick={() => { setSection('users'); setFilter('all'); }}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={`inn-menu-link${section === 'users' && filter === 'online' ? ' is-active' : ''}`}
                onClick={() => { setSection('users'); setFilter('online'); }}
              >
                الجلسات
              </button>
              <button
                type="button"
                className={`inn-menu-link${section === 'users' && filter === 'pending' ? ' is-active' : ''}`}
                onClick={() => { setSection('users'); setFilter('pending'); }}
              >
                الموافقات
              </button>
              <button
                type="button"
                className={`inn-menu-link inn-menu-shield${section === 'security' ? ' is-active' : ''}`}
                onClick={() => setSection('security')}
              >
                <ShieldCheck className="w-4 h-4" />
                الجدار الناري
              </button>
              <button
                type="button"
                className={`inn-menu-link inn-menu-shield${section === 'google' ? ' is-active' : ''}`}
                onClick={() => setSection('google')}
              >
                <KeyRound className="w-4 h-4" />
                دخول جوجل
              </button>
              <Link href="/" className="inn-menu-link">الموقع</Link>
            </nav>

            <div className="inn-topnav-tools">
              <span className="inn-live-clock" title="توقيت الخادم المحلي">
                <Clock className="w-[14px] h-[14px]" />
                <span dir="ltr">{clock}</span>
              </span>
              <button type="button" className="inn-tool-btn" aria-label="بحث" onClick={() => setFilter('all')}>
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button type="button" className="inn-tool-btn" aria-label="رسائل">
                <Mail className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                className="inn-tool-btn inn-tool-bell"
                aria-label="إشعارات"
                onClick={() => setFilter('pending')}
              >
                <Bell className="w-[18px] h-[18px]" />
                {stats.pending > 0 ? <span className="inn-bell-badge">{stats.pending}</span> : null}
              </button>
              <button type="button" className="inn-avatar-btn" onClick={endSessionAndLogout} title="تسجيل الخروج">
                <img src={me?.photo || DEFAULT_USER_PHOTO} alt={currentUser?.name || 'Admin'} />
              </button>
            </div>
          </div>

          <div className="inn-hero">
            <div>
              <h1 className="inn-hero-title">مرحباً، {firstName(currentUser?.name || 'Admin')}!</h1>
              <p className="inn-hero-date">
                {todayLabel}
                {syncedAt ? <span className="inn-hero-sync"> · آخر مزامنة {clockTime(syncedAt)}</span> : null}
              </p>
            </div>
            <div className="inn-hero-actions">
              <span className="inn-online-chip">
                <span className="inn-online-pulse" />
                {onlineCount} متصل الآن
              </span>
              <button type="button" className="inn-cta" onClick={() => loadUsers(true)} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4${refreshing ? ' animate-spin' : ''}`} />
                تحديث البيانات
              </button>
            </div>
          </div>

          <div className="inn-filters-row" hidden={section !== 'users'}>
            <div className="inn-filters">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  className={`inn-filter-pill${filter === pill.id ? ' is-active' : ''}`}
                  onClick={() => setFilter(pill.id)}
                >
                  {pill.dot ? <span className={`inn-filter-dot inn-dot-${pill.dot}`} /> : null}
                  {pill.label}
                </button>
              ))}
            </div>
            <div className="inn-view-toggle">
              <button type="button" className={`inn-view-btn${viewMode === 'list' ? ' is-active' : ''}`} onClick={() => setViewMode('list')} aria-label="قائمة">
                <List className="w-4 h-4" />
              </button>
              <button type="button" className={`inn-view-btn${viewMode === 'grid' ? ' is-active' : ''}`} onClick={() => setViewMode('grid')} aria-label="شبكة">
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Light body ── */}
        <div className="inn-body" dir="rtl">
          {toast ? <div className="inn-toast">{toast}</div> : null}

          {sideOpen ? (
            <button
              type="button"
              className="inn-side-backdrop"
              aria-label="إغلاق اللوحة الجانبية"
              onClick={() => {
                setSideOpen(false);
                try { localStorage.setItem('south_street_admin_side', '0'); } catch { /* ignore */ }
              }}
            />
          ) : null}

          <div className={`inn-layout${sideOpen ? '' : ' is-collapsed'}`}>
            <div className="inn-main">
          {section === 'security' ? <SecurityCenter sideOpen={sideOpen} /> : null}
          {section === 'google' ? <GoogleLoginSettings /> : null}

          <div hidden={section !== 'users'}>
          <section className="inn-quick-row">
            <button type="button" className="inn-quick inn-quick-green" onClick={() => setFilter('active')}>
              <UserPlus className="w-5 h-5" />
              <span>حسابات مفعّلة</span>
              <strong>{stats.active}</strong>
            </button>
            <button type="button" className="inn-quick inn-quick-dark" onClick={() => setFilter('suspended')}>
              <LogOut className="w-5 h-5" />
              <span>حسابات موقوفة</span>
              <strong>{stats.suspended}</strong>
            </button>
            <button
              type="button"
              className="inn-metric inn-metric-live"
              onClick={() => setFilter('online')}
            >
              <span className="inn-metric-label">متصل الآن</span>
              <div className="inn-metric-row">
                <strong>{onlineCount}</strong>
                <span className="inn-metric-note">من {stats.total}</span>
              </div>
            </button>
            <article className="inn-metric">
              <span className="inn-metric-label">نسبة التفعيل</span>
              <div className="inn-metric-row">
                <strong>{activePct}%</strong>
                <span className="inn-metric-note">{stats.pending} بانتظار</span>
              </div>
            </article>
            <article className="inn-metric">
              <span className="inn-metric-label">إجمالي المستخدمين</span>
              <div className="inn-metric-row">
                <strong>{stats.total}</strong>
                <Users className="w-4 h-4 inn-metric-icon" />
              </div>
            </article>
          </section>

          <div className="inn-panel-wrap">
            <section className="inn-panel">
              <div className="inn-panel-head">
                <div>
                  <h2 className="inn-panel-title">قائمة الحسابات</h2>
                  <p className="inn-panel-sub">
                    عرض {filtered.length} من {stats.total} حساب · {onlineCount} متصل الآن
                  </p>
                </div>
                <div className="inn-panel-search">
                  <Search className="w-4 h-4" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="بحث بالاسم، IP، البصمة..."
                  />
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="inn-rows">
                  {loading ? (
                    <p className="inn-empty">جاري التحميل...</p>
                  ) : filtered.length === 0 ? (
                    <p className="inn-empty">لا توجد نتائج</p>
                  ) : (
                    filtered.map((user) => {
                      const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
                      const isPending = user.status === 'PENDING_APPROVAL';
                      const tone = statusTone(user);
                      const { name, note } = splitName(user.name);
                      const perms = user.options || [];

                      return (
                        <article
                          key={user.id}
                          className={`inn-row is-clickable${user.isOnline ? ' is-live-row' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setProfileId(user.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setProfileId(user.id);
                            }
                          }}
                        >
                          <div className="inn-row-identity">
                            <UserAvatar user={user} />
                            <div className="inn-row-id-text">
                              <p className="inn-row-name" title={user.name}>
                                {name}
                                {user.id === me?.id ? <span className="inn-you">أنت</span> : null}
                              </p>
                              <span className="inn-row-sub">
                                {note ? <span className="inn-row-note">{note}</span> : null}
                                <span className="inn-row-email" dir="ltr" title={user.email || user.username || ''}>
                                  {user.email || user.username || '—'}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="inn-row-fields">
                            <div className="inn-field">
                              <span className="inn-field-label">IP</span>
                              <b className="inn-field-value inn-mono" dir="ltr">{user.displayIp}</b>
                            </div>
                            <div className="inn-field">
                              <span className="inn-field-label">البصمة</span>
                              <b className="inn-field-value inn-mono" dir="ltr" title={user.displayFingerprint}>
                                {user.displayFingerprint}
                              </b>
                            </div>
                            <div className="inn-field inn-field-date">
                              <span className="inn-field-label">{user.isOnline ? 'نشط منذ' : 'آخر دخول'}</span>
                              <b
                                className={`inn-field-value${user.isOnline ? ' is-live-value' : ''}`}
                                title={formatAdminDate(user.lastActive || user.lastLogin)}
                              >
                                {user.isOnline
                                  ? timeAgo(user.lastActive)
                                  : formatAdminDate(user.lastLogin || user.lastActive)}
                              </b>
                            </div>
                            <div className="inn-field">
                              <span className="inn-field-label">الدور</span>
                              <b className="inn-field-value">{user.roleName || user.role}</b>
                            </div>
                            <div className="inn-field inn-field-perms">
                              <span className="inn-field-label">الصلاحيات</span>
                              <span className="inn-perms" title={perms.join('، ')}>
                                {perms.length === 0 ? (
                                  <b className="inn-field-value">—</b>
                                ) : (
                                  <>
                                    {perms.slice(0, 2).map((perm) => (
                                      <span key={perm} className="inn-perm-chip">{perm}</span>
                                    ))}
                                    {perms.length > 2 ? <span className="inn-perm-more">+{perms.length - 2}</span> : null}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="inn-row-end" onClick={(e) => e.stopPropagation()}>
                            <span className={`inn-status inn-status-${tone}`}>
                              {user.isOnline ? 'متصل' : STATUS_LABEL[user.status] || user.status}
                            </span>

                            {isPending ? (
                              <div className="inn-row-actions">
                                <select
                                  className="inn-select"
                                  value={pendingRoles[user.id] || user.role}
                                  onChange={(e) => setPendingRoles((m) => ({ ...m, [user.id]: e.target.value }))}
                                >
                                  {LOGIN_ROLE_OPTIONS.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                                <button type="button" className="inn-mini inn-mini-ok" onClick={() => patchUser(user.id, { status: 'APPROVED', role: pendingRoles[user.id] || user.role, loginEnabled: true })}>✓</button>
                                <button type="button" className="inn-mini inn-mini-no" onClick={() => patchUser(user.id, { status: 'REJECTED', loginEnabled: false })}>✕</button>
                              </div>
                            ) : (
                              <label className="inn-switch" title={isActive ? 'إيقاف' : 'تفعيل'}>
                                <input type="checkbox" checked={isActive} onChange={() => toggleActive(user)} />
                                <span className="inn-switch-track" />
                              </label>
                            )}

                            <button
                              type="button"
                              className="inn-row-action"
                              aria-label="عرض الملف"
                              onClick={() => setProfileId(user.id)}
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="inn-grid-cards">
                  {filtered.map((user) => {
                    const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
                    const tone = statusTone(user);
                    const { name, note } = splitName(user.name);
                    return (
                      <article
                        key={user.id}
                        className="inn-user-card is-clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => setProfileId(user.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setProfileId(user.id);
                          }
                        }}
                      >
                        <div className="inn-user-card-top">
                          <UserAvatar user={user} size="lg" />
                          <span className={`inn-status inn-status-${tone}`}>{user.isOnline ? 'متصل' : STATUS_LABEL[user.status]}</span>
                        </div>
                        <h3 className="inn-user-card-name">{name}</h3>
                        <p className="inn-user-card-role">{note || user.roleName || user.role}</p>
                        <dl className="inn-user-card-meta">
                          <div><dt>IP</dt><dd dir="ltr">{user.displayIp}</dd></div>
                          <div><dt>البصمة</dt><dd dir="ltr">{user.displayFingerprint}</dd></div>
                          <div><dt>آخر دخول</dt><dd>{formatAdminDate(user.lastLogin || user.lastActive)}</dd></div>
                          <div><dt>الصلاحيات</dt><dd>{(user.options || []).slice(0, 2).join('، ') || '—'}</dd></div>
                        </dl>
                        <div className="inn-user-card-foot" onClick={(e) => e.stopPropagation()}>
                          <label className="inn-switch" title={isActive ? 'إيقاف' : 'تفعيل'}>
                            <input type="checkbox" checked={isActive} onChange={() => toggleActive(user)} />
                            <span className="inn-switch-track" />
                          </label>
                          <button
                            type="button"
                            className="inn-row-action"
                            aria-label="عرض الملف"
                            onClick={() => setProfileId(user.id)}
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          </div>
            </div>

            <aside id="inn-side-panel" className={`inn-side${sideOpen ? ' is-open' : ''}`}>
              <div className="inn-side-head">
                <h2 className="inn-side-heading">لوحة الجلسات</h2>
                <button type="button" className="inn-side-close" onClick={() => {
                  setSideOpen(false);
                  try { localStorage.setItem('south_street_admin_side', '0'); } catch { /* ignore */ }
                }} aria-label="إخفاء اللوحة">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <article className="inn-side-card inn-side-card-live">
                <h3 className="inn-side-title">
                  <span className="inn-online-pulse" />
                  متصل الآن ({onlineCount})
                </h3>
                <ul className="inn-activity">
                  {onlineUsers.length === 0 ? (
                    <li className="inn-activity-empty">لا توجد جلسات نشطة خلال آخر 15 دقيقة</li>
                  ) : (
                    onlineUsers.map((user) => (
                      <li key={user.id} className="inn-activity-item is-live">
                        <UserAvatar user={user} size="sm" />
                        <div className="inn-activity-copy">
                          <p title={user.name}>
                            {splitName(user.name).name}
                            {user.id === me?.id ? <span className="inn-you">أنت</span> : null}
                          </p>
                          <span>
                            <span dir="ltr">{user.displayIp}</span> · {deviceLabel(user.userAgent)}
                          </span>
                        </div>
                        <time title={formatAdminDate(user.lastActive)}>{timeAgo(user.lastActive)}</time>
                      </li>
                    ))
                  )}
                </ul>
              </article>

              {remoteIps.length > 0 ? (
              <article className="inn-side-card inn-side-card-live">
                <h3 className="inn-side-title">
                  <span className="inn-online-pulse" />
                  اتصالات خارجية ({remoteIps.length})
                </h3>
                <ul className="inn-activity">
                  {remoteIps.map((entry) => (
                      <li key={entry.ip} className="inn-activity-item is-live">
                        <div className="inn-activity-copy">
                          <p dir="ltr" title={entry.ip}>{entry.ip}</p>
                          <span>
                            {entry.hits} طلب
                            {entry.lastPath ? ` · ${entry.lastPath}` : ''}
                          </span>
                        </div>
                        <time>{timeAgo(entry.lastSeen)}</time>
                      </li>
                    ))}
                </ul>
              </article>
              ) : null}

              <article className="inn-side-card">
                <h3 className="inn-side-title">آخر تسجيلات الدخول</h3>
                <ul className="inn-activity">
                  {recentLogins.length === 0 ? (
                    <li className="inn-activity-empty">لم يسجّل أي مستخدم دخوله بعد</li>
                  ) : (
                    recentLogins.map((user) => (
                      <li key={user.id} className={`inn-activity-item${user.isOnline ? ' is-live' : ''}`}>
                        <UserAvatar user={user} size="sm" />
                        <div className="inn-activity-copy">
                          <p title={user.name}>{splitName(user.name).name}</p>
                          <span>{formatAdminDate(user.lastLogin)}</span>
                        </div>
                        <time>{timeAgo(user.lastLogin)}</time>
                      </li>
                    ))
                  )}
                </ul>
              </article>

              <article className="inn-side-card inn-side-stats">
                <h3 className="inn-side-title">توزيع الأدوار</h3>
                <ul className="inn-role-list">
                  {roleBreakdown.map(([role, count]) => (
                    <li key={role}>
                      <span>{role}</span>
                      <span className="inn-role-count">
                        {count.online > 0 ? <em className="inn-role-online">{count.online} متصل</em> : null}
                        <strong>{count.total}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="inn-side-facts">
                  <div>
                    <dt>جلسات مسجّلة</dt>
                    <dd>{stats.sessions}</dd>
                  </div>
                  <div>
                    <dt>لم يسجّل دخولاً</dt>
                    <dd>{stats.neverLoggedIn}</dd>
                  </div>
                </dl>
                <p className="inn-side-foot">
                  {LOGIN_ROLE_LABELS[currentUser?.role as keyof typeof LOGIN_ROLE_LABELS] || 'مدير'}
                  {' · '}
                  تحديث تلقائي كل {REFRESH_MS / 1000} ثانية
                </p>
              </article>
            </aside>
          </div>
        </div>
      </div>

      {profileUser ? (
        <UserProfileModal
          user={profileUser}
          isSelf={profileUser.id === me?.id}
          onClose={() => setProfileId(null)}
          onPatch={(userId, body) => {
            patchUser(userId, body);
            setProfileId(null);
          }}
          onBlockIp={blockIp}
        />
      ) : null}
    </div>
  );
}
