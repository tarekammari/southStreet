'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Globe,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Star,
  Triangle,
  X,
} from 'lucide-react';
import {
  DEFAULT_USER_PHOTO,
  deviceLabel,
  formatAdminDate,
  isImageSource,
  PRESENCE_LABELS,
  presenceOf,
  type EnrichedUser,
} from '@/lib/user-access-view';
import SecurityCenter from '@/components/admin/SecurityCenter';
import UserProfileModal from '@/components/admin/UserProfileModal';
import GoogleLoginSettings from '@/components/admin/GoogleLoginSettings';
import PresenceTimeline from '@/components/admin/PresenceTimeline';

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

const FILTER_PILLS: { id: FilterKey; label: string; tone: string }[] = [
  { id: 'all', label: 'الكل', tone: 'blue' },
  { id: 'online', label: 'متصل', tone: 'cyan' },
  { id: 'active', label: 'مفعّل', tone: 'yellow' },
  { id: 'pending', label: 'بانتظار', tone: 'purple' },
  { id: 'suspended', label: 'موقوف', tone: 'red' },
];

const AGENCY_LOGO_FALLBACK = '/images/south_street_logo.png';

function resolveAgencyLogo(logo?: string | null): string {
  if (!logo) return AGENCY_LOGO_FALLBACK;
  const src = String(logo).trim();
  if (!src || src.startsWith('file:') || /^[a-zA-Z]:[\\/]/.test(src)) return AGENCY_LOGO_FALLBACK;
  if (src.startsWith('images/')) return `/${src}`;
  if (isImageSource(src)) return src;
  return AGENCY_LOGO_FALLBACK;
}

function FilterShape({ tone }: { tone: string }) {
  if (tone === 'purple') return <Triangle className="w-3 h-3" fill="currentColor" />;
  if (tone === 'red') return <Square className="w-3 h-3" fill="currentColor" />;
  if (tone === 'yellow') return <Star className="w-3.5 h-3.5" fill="currentColor" />;
  return <Circle className="w-3 h-3" fill="currentColor" />;
}

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

function BrandLogo({ src, name }: { src: string; name: string }) {
  const [url, setUrl] = useState(src);

  useEffect(() => {
    setUrl(src);
  }, [src]);

  return (
    <span className="inn-brand-lockup">
      <img
        src={url}
        alt={name}
        decoding="async"
        onError={() => {
          if (url !== AGENCY_LOGO_FALLBACK) setUrl(AGENCY_LOGO_FALLBACK);
        }}
      />
    </span>
  );
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
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sideOpen, setSideOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [flyout, setFlyout] = useState<'accounts' | 'sessions' | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [section, setSection] = useState<'users' | 'security' | 'google'>('users');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [liveIps, setLiveIps] = useState<LiveIpRow[]>([]);
  const [agency, setAgency] = useState<{ name: string; legal: string; logo: string }>({
    name: 'ساوث ستريت',
    legal: 'South Street',
    logo: AGENCY_LOGO_FALLBACK,
  });

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
    fetch('/api/admin/agency')
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error) return;
        setAgency({
          name: String(data.agency_name || 'ساوث ستريت').trim() || 'ساوث ستريت',
          legal: String(data.legal_name || 'South Street').trim() || 'South Street',
          logo: resolveAgencyLogo(data.logo),
        });
      })
      .catch(() => { /* keep default branding */ });
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
  const workspaceLabel = section === 'security' ? 'الجدار الناري' : section === 'google' ? 'دخول جوجل' : 'إدارة الحسابات';
  const filterCount = (id: FilterKey) => {
    if (id === 'online') return onlineCount;
    if (id === 'active') return stats.active;
    if (id === 'pending') return stats.pending;
    if (id === 'suspended') return stats.suspended;
    return stats.total;
  };

  return (
    <div className={`inn-shell${sideOpen ? '' : ' is-side-collapsed'}${profileUser ? ' is-detail-open' : ''}`}>
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
              title={sideOpen ? 'طي القائمة الجانبية' : 'توسيع القائمة الجانبية'}
            >
              {sideOpen ? <PanelLeftClose className="w-[18px] h-[18px]" /> : <PanelLeftOpen className="w-[18px] h-[18px]" />}
            </button>

            <Link href="/" className="inn-logo inn-logo-compact" aria-label="الصفحة الرئيسية">
              <BrandLogo src={agency.logo} name={agency.name} />
            </Link>

            <div className="inn-profile-chip">
              <span className="inn-profile-photo">
                <img
                  src={me?.photo || DEFAULT_USER_PHOTO}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_USER_PHOTO;
                  }}
                />
              </span>
              <span className="inn-profile-copy">
                <strong>{splitName(currentUser?.name || me?.name || 'Admin').name}</strong>
                <em>{todayLabel}</em>
              </span>
            </div>

            <div className="inn-topnav-tools">
              <span className="inn-live-clock" title="توقيت الخادم المحلي">
                <Clock className="w-[14px] h-[14px]" />
                <span dir="ltr">{clock}</span>
              </span>
              <button type="button" className="inn-tool-btn" aria-label="بحث" onClick={() => { setSection('users'); setFilter('all'); setProfileId(null); }}>
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                className="inn-tool-btn inn-tool-bell"
                aria-label="إشعارات"
                onClick={() => { setSection('users'); setFilter('pending'); setProfileId(null); }}
              >
                <Bell className="w-[18px] h-[18px]" />
                {stats.pending > 0 ? <span className="inn-bell-badge">{stats.pending}</span> : null}
              </button>
              <button type="button" className="inn-tool-btn" onClick={endSessionAndLogout} title="تسجيل الخروج">
                <LogOut className="w-[16px] h-[16px]" />
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
          <div className="inn-panel-wrap">
            <section className={`inn-panel inn-view-stack${profileUser ? ' is-detail' : ''}`}>
              <div className="inn-view-list" aria-hidden={Boolean(profileUser)}>
              <div className="inn-panel-head">
                <div>
                  <h2 className="inn-panel-title">قائمة الحسابات</h2>
                  <p className="inn-panel-sub">
                    عرض {filtered.length} من {stats.total} حساب · {onlineCount} متصل الآن
                    {syncedAt ? ` · آخر مزامنة ${formatAdminDate(syncedAt)}` : ''}
                  </p>
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="ts-table-wrap">
                  {loading ? (
                    <p className="inn-empty">جاري التحميل...</p>
                  ) : filtered.length === 0 ? (
                    <p className="inn-empty">لا توجد نتائج</p>
                  ) : (
                    <table className="ts-table">
                      <thead>
                        <tr>
                          <th>المستخدم</th>
                          <th>IP</th>
                          <th>الجهاز</th>
                          <th>الاتصال</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((user) => {
                          const { name } = splitName(user.name);
                          const presence = presenceOf(user);
                          return (
                            <tr
                              key={user.id}
                              className={`ts-row is-${presence}`}
                              tabIndex={0}
                              onClick={() => setProfileId(user.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setProfileId(user.id);
                                }
                              }}
                            >
                              <td>
                                <div className="ts-name">
                                  <span className={`ts-dot is-${presence}`} title={PRESENCE_LABELS[presence]} />
                                  <UserAvatar user={user} />
                                  <div className="ts-name-copy">
                                    <span className="ts-name-link">
                                      {name}
                                      {user.id === me?.id ? <span className="inn-you">أنت</span> : null}
                                    </span>
                                    <span className="ts-name-sub" dir="ltr">{user.email || user.username || '—'}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <code className="ts-ip" dir="ltr">{user.displayIp}</code>
                              </td>
                              <td>
                                <span className="ts-os">{deviceLabel(user.userAgent)}</span>
                              </td>
                              <td>
                                <div className={`ts-seen is-${presence}`}>
                                  {presence === 'connected' ? 'متصل' : PRESENCE_LABELS[presence]}
                                </div>
                                <PresenceTimeline presence={presence} compact />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="inn-grid-cards">
                  {filtered.map((user) => {
                    const { name } = splitName(user.name);
                    const presence = presenceOf(user);
                    return (
                      <article
                        key={user.id}
                        className={`inn-user-card is-clickable is-${presence}`}
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
                          <span className={`ts-seen is-${presence}`}>{PRESENCE_LABELS[presence]}</span>
                        </div>
                        <h3 className="inn-user-card-name">{name}</h3>
                        <p className="inn-user-card-role" dir="ltr">{user.email || user.username || '—'}</p>
                        <dl className="inn-user-card-meta">
                          <div><dt>IP</dt><dd dir="ltr">{user.displayIp}</dd></div>
                          <div><dt>الجهاز</dt><dd>{deviceLabel(user.userAgent)}</dd></div>
                        </dl>
                        <PresenceTimeline presence={presence} compact />
                      </article>
                    );
                  })}
                </div>
              )}
              </div>
              {profileUser ? (
                <div className="inn-view-detail">
                  <UserProfileModal
                    key={profileUser.id}
                    embedded
                    user={profileUser}
                    isSelf={profileUser.id === me?.id}
                    onClose={() => setProfileId(null)}
                    onPatch={(userId, body) => {
                      patchUser(userId, body);
                    }}
                    onBlockIp={blockIp}
                  />
                </div>
              ) : null}
            </section>
          </div>
          </div>
            </div>

            <aside
              id="inn-side-panel"
              className={`inn-side${sideOpen ? ' is-open' : ' is-collapsed'}`}
              onMouseLeave={() => setFlyout(null)}
            >
              <div className="inn-side-head">
                <h2 className="inn-side-heading">القائمة</h2>
                <button type="button" className="inn-side-close" onClick={() => {
                  setSideOpen(false);
                  try { localStorage.setItem('south_street_admin_side', '0'); } catch { /* ignore */ }
                }} aria-label="طي القائمة">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <Link href="/" className="inn-side-brand" aria-label="الصفحة الرئيسية" title="الصفحة الرئيسية">
                <BrandLogo src={agency.logo} name={agency.name} />
              </Link>

              <button
                type="button"
                className="inn-side-workspace"
                onClick={() => { setSection('users'); setFilter('all'); setProfileId(null); }}
                title={workspaceLabel}
              >
                <span className="inn-side-workspace-icon">
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                <span className="inn-side-workspace-copy">
                  <strong>{workspaceLabel}</strong>
                  <em>{stats.total} حساب · {onlineCount} متصل</em>
                </span>
                <span className="inn-side-workspace-chevs inn-side-label">
                  <ChevronUp className="w-3 h-3" />
                  <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              <nav className="inn-side-primary" aria-label="القائمة الرئيسية">
                <button
                  type="button"
                  className={`inn-side-link${section === 'users' && filter === 'online' ? ' is-active' : ''}`}
                  onClick={() => { setSection('users'); setFilter('online'); setProfileId(null); }}
                  onMouseEnter={() => { if (!sideOpen) setFlyout('sessions'); }}
                  title="الجلسات"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="inn-side-label">الجلسات</span>
                  {onlineCount > 0 ? <span className="inn-side-badge">{onlineCount}</span> : <span className="inn-side-dot" />}
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'users' && filter === 'pending' ? ' is-active' : ''}`}
                  onClick={() => { setSection('users'); setFilter('pending'); setProfileId(null); }}
                  title="الموافقات"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="inn-side-label">الموافقات</span>
                  {stats.pending > 0 ? <span className="inn-side-badge">{stats.pending}</span> : null}
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'security' ? ' is-active' : ''}`}
                  onClick={() => { setSection('security'); setProfileId(null); }}
                  title="الجدار الناري"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="inn-side-label">الجدار الناري</span>
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'google' ? ' is-active' : ''}`}
                  onClick={() => { setSection('google'); setProfileId(null); }}
                  title="دخول جوجل"
                >
                  <KeyRound className="w-4 h-4" />
                  <span className="inn-side-label">دخول جوجل</span>
                </button>
                <Link href="/" className="inn-side-link" title="الموقع">
                  <Globe className="w-4 h-4" />
                  <span className="inn-side-label">الموقع</span>
                </Link>
              </nav>

              <div className="inn-side-rule" />

              <div
                className="inn-side-section"
                onMouseEnter={() => { if (!sideOpen) setFlyout('accounts'); }}
              >
                <button
                  type="button"
                  className={`inn-side-section-toggle${accountsOpen ? ' is-open' : ''}`}
                  onClick={() => {
                    if (!sideOpen) {
                      setFlyout((v) => (v === 'accounts' ? null : 'accounts'));
                      return;
                    }
                    setAccountsOpen((v) => !v);
                  }}
                  title="الحسابات"
                >
                  <List className="w-4 h-4" />
                  <span className="inn-side-label">الحسابات</span>
                  {accountsOpen ? <ChevronUp className="w-3.5 h-3.5 inn-side-label" /> : <ChevronDown className="w-3.5 h-3.5 inn-side-label" />}
                </button>

                {sideOpen && accountsOpen ? (
                  <ul className="inn-side-sub">
                    {FILTER_PILLS.map((pill) => {
                      const count = filterCount(pill.id);
                      return (
                        <li key={pill.id}>
                          <button
                            type="button"
                            className={`inn-side-sub-item is-${pill.tone}${filter === pill.id && section === 'users' ? ' is-active' : ''}`}
                            onClick={() => { setSection('users'); setFilter(pill.id); setProfileId(null); }}
                          >
                            <span className={`inn-side-shape is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                            <span className="inn-side-label">{pill.label}</span>
                            {count > 0 ? <span className="inn-side-count">{count}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div className="inn-side-tools">
                <div className="inn-side-search">
                  <Search className="w-4 h-4" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => { setSection('users'); setQuery(e.target.value); setProfileId(null); }}
                    placeholder="بحث بالاسم، IP، البصمة..."
                  />
                </div>
                <div className="inn-side-actions">
                  <button type="button" className="inn-side-cta" onClick={() => loadUsers(true)} disabled={refreshing} title="تحديث البيانات">
                    <RefreshCw className={`w-4 h-4${refreshing ? ' animate-spin' : ''}`} />
                    <span className="inn-side-label">تحديث البيانات</span>
                  </button>
                  <div className="inn-view-toggle">
                    <button type="button" className={`inn-view-btn${viewMode === 'grid' ? ' is-active' : ''}`} onClick={() => setViewMode('grid')} aria-label="شبكة">
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button type="button" className={`inn-view-btn${viewMode === 'list' ? ' is-active' : ''}`} onClick={() => setViewMode('list')} aria-label="قائمة">
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {!sideOpen && flyout ? (
                <div className="inn-side-flyout" role="dialog" aria-label="تفاصيل القائمة">
                  {flyout === 'accounts' ? (
                    <>
                      <p className="inn-side-flyout-title">تصفية الحسابات</p>
                      <ul className="inn-side-flyout-list">
                        {FILTER_PILLS.map((pill) => (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-flyout-item${filter === pill.id ? ' is-active' : ''}`}
                              onClick={() => { setSection('users'); setFilter(pill.id); setProfileId(null); }}
                            >
                              <span className="inn-flyout-grip" aria-hidden="true" />
                              <span className={`inn-flyout-icon is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                              <span>
                                <strong>{pill.label}</strong>
                                <em>{filterCount(pill.id)} حساب</em>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="inn-side-flyout-title">متصل الآن</p>
                      <ul className="inn-side-flyout-list">
                        {onlineUsers.length === 0 ? (
                          <li className="inn-activity-empty">لا توجد جلسات نشطة</li>
                        ) : (
                          onlineUsers.map((user) => (
                            <li key={user.id}>
                              <button type="button" className="inn-side-flyout-item" onClick={() => { setSection('users'); setProfileId(user.id); }}>
                                <span className="inn-flyout-grip" aria-hidden="true" />
                                <span className="inn-flyout-icon">{initials(splitName(user.name).name)}</span>
                                <span>
                                  <strong>{splitName(user.name).name}</strong>
                                  <em dir="ltr">{user.displayIp} · {deviceLabel(user.userAgent)}</em>
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </>
                  )}
                </div>
              ) : null}

              {sideOpen ? (
                <div className="inn-side-live">
                  <p className="inn-side-live-title">
                    <span className="inn-online-pulse" />
                    متصل الآن
                    {liveIps.some((entry) => !entry.trusted) ? ` · ${liveIps.filter((entry) => !entry.trusted).length} خارجي` : ''}
                  </p>
                  <ul className="inn-side-flyout-list">
                    {onlineUsers.length === 0 ? (
                      <li className="inn-activity-empty">لا توجد جلسات نشطة</li>
                    ) : (
                      onlineUsers.slice(0, 6).map((user) => (
                        <li key={user.id}>
                          <button type="button" className="inn-side-flyout-item" onClick={() => { setSection('users'); setProfileId(user.id); }}>
                            <span className="inn-flyout-grip" aria-hidden="true" />
                            <span className="inn-flyout-icon">{initials(splitName(user.name).name)}</span>
                            <span>
                              <strong>{splitName(user.name).name}</strong>
                              <em dir="ltr">{user.displayIp} · {deviceLabel(user.userAgent)}</em>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="inn-side-bottom">
                <button type="button" className="inn-side-link" onClick={() => { setSection('google'); setProfileId(null); }} title="الإعدادات">
                  <Settings className="w-4 h-4" />
                  <span className="inn-side-label">الإعدادات</span>
                </button>
                <button type="button" className="inn-side-link" onClick={endSessionAndLogout} title="تسجيل الخروج">
                  <LogOut className="w-4 h-4" />
                  <span className="inn-side-label">خروج</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>

    </div>
  );
}
