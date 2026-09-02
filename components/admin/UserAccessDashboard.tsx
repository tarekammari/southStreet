'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Cpu,
  Globe,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Square,
  Star,
  Triangle,
  UserCog,
  Users,
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
import {
  LOGIN_ROLE_LABELS,
  LOGIN_ROLE_OPTIONS,
  normalizeLoginRole,
  type LoginRole,
} from '@/lib/roles';
import SecurityCenter, {
  EMPTY_FW_COUNTS,
  EMPTY_FW_FILTERS,
  type FirewallDateFilter,
  type FirewallFilterCounts,
  type FirewallFilters,
  type FirewallScope,
} from '@/components/admin/SecurityCenter';
import UserProfileModal from '@/components/admin/UserProfileModal';
import GoogleLoginSettings from '@/components/admin/GoogleLoginSettings';
import ServerHealthPanel from '@/components/admin/ServerHealth';
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

type DashSection = 'users' | 'security' | 'google' | 'server';
type FilterKey = 'all' | 'online' | 'active' | 'pending' | 'suspended';
type RoleFilter = 'all' | LoginRole;
type FlyoutKey = 'accounts' | 'sessions' | 'types' | null;

const FILTER_PILLS: { id: FilterKey; label: string; tone: string }[] = [
  { id: 'all', label: 'الكل', tone: 'blue' },
  { id: 'online', label: 'متصل', tone: 'cyan' },
  { id: 'active', label: 'مفعّل', tone: 'yellow' },
  { id: 'pending', label: 'بانتظار', tone: 'purple' },
  { id: 'suspended', label: 'موقوف', tone: 'red' },
];

const ROLE_TONES: Record<LoginRole, string> = {
  SUPER_ADMIN: 'yellow',
  AGENCY_MANAGER: 'purple',
  ACCOUNTANT: 'cyan',
  GUIDE_MURSHID: 'green',
  AGENCY_AGENT: 'gold',
  PILGRIM_USER: 'blue',
};

const ROLE_PILLS: { id: RoleFilter; label: string; tone: string }[] = [
  { id: 'all', label: 'كل الأنواع', tone: 'blue' },
  ...LOGIN_ROLE_OPTIONS.map((option) => ({
    id: option.value as RoleFilter,
    label: option.label,
    tone: ROLE_TONES[option.value],
  })),
];

const FW_DATE_PILLS: { id: FirewallDateFilter; label: string; tone: string }[] = [
  { id: 'all', label: 'كل التواريخ', tone: 'blue' },
  { id: 'hour', label: 'آخر ساعة', tone: 'cyan' },
  { id: 'today', label: 'اليوم', tone: 'yellow' },
  { id: 'yesterday', label: 'أمس', tone: 'purple' },
  { id: 'day', label: '24 ساعة', tone: 'gold' },
  { id: 'week', label: '7 أيام', tone: 'green' },
];

const FW_SCOPE_PILLS: { id: FirewallScope; label: string; tone: string }[] = [
  { id: 'all', label: 'كل الاتصالات', tone: 'blue' },
  { id: 'important', label: 'المهم فقط', tone: 'yellow' },
  { id: 'blocked', label: 'محظور', tone: 'red' },
  { id: 'threat', label: 'تهديد', tone: 'purple' },
  { id: 'allow', label: 'مسموح', tone: 'cyan' },
];

function userLoginRole(user: { role?: string; email?: string; roleName?: string }): LoginRole {
  return normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
}

function roleLabelOf(user: { role?: string; email?: string; roleName?: string }): string {
  const named = (user.roleName || '').trim();
  if (named) return named;
  return LOGIN_ROLE_LABELS[userLoginRole(user)];
}

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

function RoleGlyph({ role }: { role: RoleFilter }) {
  if (role === 'SUPER_ADMIN') return <Shield className="w-3.5 h-3.5" />;
  if (role === 'AGENCY_MANAGER') return <Briefcase className="w-3.5 h-3.5" />;
  if (role === 'ACCOUNTANT') return <Calculator className="w-3.5 h-3.5" />;
  if (role === 'GUIDE_MURSHID') return <BookOpen className="w-3.5 h-3.5" />;
  if (role === 'AGENCY_AGENT') return <UserCog className="w-3.5 h-3.5" />;
  if (role === 'PILGRIM_USER') return <Landmark className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sideOpen, setSideOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(true);
  const [flyout, setFlyout] = useState<FlyoutKey>(null);
  const [detailLeaving, setDetailLeaving] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [section, setSection] = useState<DashSection>('users');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', phone: '', password: '', role: 'PILGRIM_USER' });
  const [liveIps, setLiveIps] = useState<LiveIpRow[]>([]);
  const [fwFilters, setFwFilters] = useState<FirewallFilters>(EMPTY_FW_FILTERS);
  const [fwCounts, setFwCounts] = useState<FirewallFilterCounts>(EMPTY_FW_COUNTS);
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('south_street_token') || ''}`,
      },
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

  const createUser = async () => {
    if (!createForm.name.trim() || !createForm.password.trim() || (!createForm.username.trim() && !createForm.email.trim())) {
      setToast('الاسم وكلمة المرور واسم المستخدم أو البريد مطلوبة');
      window.setTimeout(() => setToast(''), 3200);
      return;
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('south_street_token') || ''}`,
      },
      body: JSON.stringify(createForm),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setToast(data.message || 'تم إنشاء الحساب');
      setCreating(false);
      setCreateForm({ name: '', username: '', email: '', phone: '', password: '', role: 'PILGRIM_USER' });
      loadUsers(true);
    } else {
      setToast(data.error || 'تعذّر إنشاء الحساب');
    }
    window.setTimeout(() => setToast(''), 3200);
  };

  const deleteUser = async (userId: string) => {
    const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('south_street_token') || ''}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setToast(data.message || 'تم حذف الحساب');
      setDetailLeaving(true);
      loadUsers(true);
    } else {
      setToast(data.error || 'تعذّر حذف الحساب');
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
    if (roleFilter !== 'all') list = list.filter((u) => userLoginRole(u) === roleFilter);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const roleText = roleLabelOf(u).toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        u.displayIp.toLowerCase().includes(q) ||
        u.displayFingerprint.toLowerCase().includes(q) ||
        roleText.includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });
  }, [liveUsers, filter, roleFilter, query]);

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

  useEffect(() => {
    if (!detailLeaving) return;
    const id = window.setTimeout(() => {
      setProfileId(null);
      setDetailLeaving(false);
    }, 280);
    return () => window.clearTimeout(id);
  }, [detailLeaving]);

  const openProfile = (id: string) => {
    setDetailLeaving(false);
    setSection('users');
    setProfileId(id);
  };

  const goUsers = (patch: { filter?: FilterKey; role?: RoleFilter } = {}) => {
    setSection('users');
    setFlyout(null);
    if (patch.filter) setFilter(patch.filter);
    if (patch.role !== undefined) setRoleFilter(patch.role);
    if (profileId) setDetailLeaving(true);
  };

  const goSection = (next: DashSection) => {
    setSection(next);
    setFlyout(null);
    setDetailLeaving(false);
    setProfileId(null);
  };

  const patchFwFilters = useCallback((patch: Partial<FirewallFilters>) => {
    setFwFilters((current) => ({ ...current, ...patch }));
  }, []);

  const onFwCounts = useCallback((counts: FirewallFilterCounts) => {
    setFwCounts(counts);
  }, []);

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      all: liveUsers.length,
      SUPER_ADMIN: 0,
      AGENCY_MANAGER: 0,
      ACCOUNTANT: 0,
      GUIDE_MURSHID: 0,
      AGENCY_AGENT: 0,
      PILGRIM_USER: 0,
    };
    liveUsers.forEach((user) => {
      counts[userLoginRole(user)] += 1;
    });
    return counts;
  }, [liveUsers]);

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
  const fwMode = section === 'security';
  const workspaceLabel = fwMode ? 'الجدار الناري' : section === 'google' ? 'دخول جوجل' : section === 'server' ? 'حالة الخادم' : 'إدارة الحسابات';
  const roleFilterLabel = roleFilter === 'all' ? '' : LOGIN_ROLE_LABELS[roleFilter];
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
              <button type="button" className="inn-tool-btn" aria-label="بحث" onClick={() => goUsers({ filter: 'all' })}>
                <Search className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                className="inn-tool-btn inn-tool-bell"
                aria-label="إشعارات"
                onClick={() => goUsers({ filter: 'pending' })}
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
          <div className="inn-stage">
          {section === 'security' ? (
            <div key="security" className="inn-stage-pane is-active inn-swap">
              <SecurityCenter sideOpen={sideOpen} filters={fwFilters} onCounts={onFwCounts} />
            </div>
          ) : null}
          {section === 'google' ? (
            <div key="google" className="inn-stage-pane is-active inn-swap">
              <GoogleLoginSettings />
            </div>
          ) : null}
          {section === 'server' ? (
            <div key="server" className="inn-stage-pane is-active inn-swap">
              <ServerHealthPanel />
            </div>
          ) : null}

          <div
            className={`inn-stage-pane${section === 'users' ? ' is-active' : ''}`}
            aria-hidden={section !== 'users'}
          >
          <div className="inn-panel-wrap">
            <section className={`inn-panel inn-view-stack${profileUser ? ' is-detail' : ''}${detailLeaving ? ' is-leaving' : ''}`}>
              <div className="inn-view-list" aria-hidden={Boolean(profileUser) && !detailLeaving}>
              <div className="inn-panel-head">
                <div>
                  <h2 className="inn-panel-title">قائمة الحسابات</h2>
                  <p className="inn-panel-sub">
                    عرض {filtered.length} من {stats.total} حساب
                    {roleFilterLabel ? ` · ${roleFilterLabel}` : ''}
                    {' · '}{onlineCount} متصل الآن
                    {syncedAt ? ` · آخر مزامنة ${formatAdminDate(syncedAt)}` : ''}
                  </p>
                </div>
                <button type="button" className="fw-add-user" onClick={() => setCreating(true)}>
                  <Plus className="w-4 h-4" />
                  إضافة حساب
                </button>
              </div>

              {viewMode === 'list' ? (
                <div key={`list-${filter}-${roleFilter}`} className="ts-table-wrap inn-swap">
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
                              onClick={() => openProfile(user.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openProfile(user.id);
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
                                    <span className="ts-tags">
                                      <span className="ts-tag is-muted">{roleLabelOf(user)}</span>
                                    </span>
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
                <div key={`grid-${filter}-${roleFilter}`} className="inn-grid-cards inn-swap">
                  {filtered.map((user) => {
                    const { name } = splitName(user.name);
                    const presence = presenceOf(user);
                    return (
                      <article
                        key={user.id}
                        className={`inn-user-card is-clickable is-${presence}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openProfile(user.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openProfile(user.id);
                          }
                        }}
                      >
                        <div className="inn-user-card-top">
                          <UserAvatar user={user} size="lg" />
                          <span className={`ts-seen is-${presence}`}>{PRESENCE_LABELS[presence]}</span>
                        </div>
                        <h3 className="inn-user-card-name">{name}</h3>
                        <p className="inn-user-card-role" dir="ltr">{user.email || user.username || '—'}</p>
                        <span className="ts-tags">
                          <span className="ts-tag is-muted">{roleLabelOf(user)}</span>
                        </span>
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
                    onClose={() => setDetailLeaving(true)}
                    onPatch={(userId, body) => {
                      patchUser(userId, body);
                    }}
                    onBlockIp={blockIp}
                    onDelete={isSelf(profileUser) ? undefined : () => deleteUser(profileUser.id)}
                  />
                </div>
              ) : null}
            </section>
          </div>
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
                onClick={() => goUsers({ filter: 'all', role: 'all' })}
                title={workspaceLabel}
              >
                <span className="inn-side-workspace-icon">
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                <span className="inn-side-workspace-copy">
                  <strong>{workspaceLabel}</strong>
                  <em>{fwMode ? `${fwCounts.all} حدث · ${fwCounts.blocked} حظر` : `${stats.total} حساب · ${onlineCount} متصل`}</em>
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
                  onClick={() => goUsers({ filter: 'online' })}
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
                  onClick={() => goUsers({ filter: 'pending' })}
                  title="الموافقات"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="inn-side-label">الموافقات</span>
                  {stats.pending > 0 ? <span className="inn-side-badge">{stats.pending}</span> : null}
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'security' ? ' is-active' : ''}`}
                  onClick={() => goSection('security')}
                  title="الجدار الناري"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="inn-side-label">الجدار الناري</span>
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'server' ? ' is-active' : ''}`}
                  onClick={() => goSection('server')}
                  title="حالة الخادم"
                >
                  <Cpu className="w-4 h-4" />
                  <span className="inn-side-label">حالة الخادم</span>
                </button>
                <button
                  type="button"
                  className={`inn-side-link${section === 'google' ? ' is-active' : ''}`}
                  onClick={() => goSection('google')}
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

              {fwMode ? (
                <>
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
                      title="الوقت"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="inn-side-label">الوقت</span>
                      {accountsOpen ? <ChevronUp className="w-3.5 h-3.5 inn-side-label" /> : <ChevronDown className="w-3.5 h-3.5 inn-side-label" />}
                    </button>
                    <div className={`inn-side-fold${sideOpen && accountsOpen ? ' is-open' : ''}`}>
                      <div className="inn-side-fold-inner">
                        <ul className="inn-side-sub">
                          {FW_DATE_PILLS.map((pill) => (
                            <li key={pill.id}>
                              <button
                                type="button"
                                className={`inn-side-sub-item is-${pill.tone}${fwFilters.date === pill.id ? ' is-active' : ''}`}
                                onClick={() => patchFwFilters({ date: pill.id })}
                              >
                                <span className={`inn-side-shape is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                                <span className="inn-side-label">{pill.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div
                    className="inn-side-section"
                    onMouseEnter={() => { if (!sideOpen) setFlyout('types'); }}
                  >
                    <button
                      type="button"
                      className={`inn-side-section-toggle${typesOpen || fwFilters.scope !== 'all' ? ' is-open' : ''}`}
                      onClick={() => {
                        if (!sideOpen) {
                          setFlyout((v) => (v === 'types' ? null : 'types'));
                          return;
                        }
                        setTypesOpen((v) => !v);
                      }}
                      title="الحالة"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span className="inn-side-label">الحالة</span>
                      {typesOpen ? <ChevronUp className="w-3.5 h-3.5 inn-side-label" /> : <ChevronDown className="w-3.5 h-3.5 inn-side-label" />}
                    </button>
                    <div className={`inn-side-fold${sideOpen && typesOpen ? ' is-open' : ''}`}>
                      <div className="inn-side-fold-inner">
                        <ul className="inn-side-sub">
                          {FW_SCOPE_PILLS.map((pill) => (
                            <li key={pill.id}>
                              <button
                                type="button"
                                className={`inn-side-sub-item is-${pill.tone}${fwFilters.scope === pill.id ? ' is-active' : ''}`}
                                onClick={() => patchFwFilters({ scope: pill.id })}
                              >
                                <span className={`inn-side-shape is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                                <span className="inn-side-label">{pill.label}</span>
                                {fwCounts[pill.id] > 0 ? <span className="inn-side-count">{fwCounts[pill.id]}</span> : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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

                <div className={`inn-side-fold${sideOpen && accountsOpen ? ' is-open' : ''}`}>
                  <div className="inn-side-fold-inner">
                    <ul className="inn-side-sub">
                      {FILTER_PILLS.map((pill) => {
                        const count = filterCount(pill.id);
                        return (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-sub-item is-${pill.tone}${filter === pill.id && section === 'users' ? ' is-active' : ''}`}
                              onClick={() => goUsers({ filter: pill.id })}
                            >
                              <span className={`inn-side-shape is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                              <span className="inn-side-label">{pill.label}</span>
                              {count > 0 ? <span className="inn-side-count">{count}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>

              <div
                className="inn-side-section"
                onMouseEnter={() => { if (!sideOpen) setFlyout('types'); }}
              >
                <button
                  type="button"
                  className={`inn-side-section-toggle${typesOpen || roleFilter !== 'all' ? ' is-open' : ''}`}
                  onClick={() => {
                    if (!sideOpen) {
                      setFlyout((v) => (v === 'types' ? null : 'types'));
                      return;
                    }
                    setTypesOpen((v) => !v);
                  }}
                  title="النوع"
                >
                  <Users className="w-4 h-4" />
                  <span className="inn-side-label">النوع</span>
                  {typesOpen ? <ChevronUp className="w-3.5 h-3.5 inn-side-label" /> : <ChevronDown className="w-3.5 h-3.5 inn-side-label" />}
                </button>

                <div className={`inn-side-fold${sideOpen && typesOpen ? ' is-open' : ''}`}>
                  <div className="inn-side-fold-inner">
                    <ul className="inn-side-sub">
                      {ROLE_PILLS.map((pill) => {
                        const count = roleCounts[pill.id];
                        return (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-sub-item is-${pill.tone}${roleFilter === pill.id && section === 'users' ? ' is-active' : ''}`}
                              onClick={() => goUsers({ role: pill.id })}
                            >
                              <span className={`inn-side-shape is-${pill.tone}`}><RoleGlyph role={pill.id} /></span>
                              <span className="inn-side-label">{pill.label}</span>
                              {count > 0 ? <span className="inn-side-count">{count}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
                </>
              )}

              <div className="inn-side-tools">
                <div className="inn-side-search">
                  <Search className="w-4 h-4" />
                  <input
                    type="search"
                    value={fwMode ? fwFilters.query : query}
                    onChange={(e) => {
                      if (fwMode) {
                        patchFwFilters({ query: e.target.value });
                        return;
                      }
                      goUsers();
                      setQuery(e.target.value);
                    }}
                    placeholder={fwMode ? 'بحث في المسار، IP، المستخدم...' : 'بحث بالاسم، IP، البصمة...'}
                  />
                </div>
                <div className="inn-side-actions">
                  <button type="button" className="inn-side-cta" onClick={() => loadUsers(true)} disabled={refreshing} title="تحديث البيانات">
                    <RefreshCw className={`w-4 h-4${refreshing ? ' animate-spin' : ''}`} />
                    <span className="inn-side-label">تحديث البيانات</span>
                  </button>
                  {fwMode ? null : (
                  <div className="inn-view-toggle">
                    <button type="button" className={`inn-view-btn${viewMode === 'grid' ? ' is-active' : ''}`} onClick={() => setViewMode('grid')} aria-label="شبكة">
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button type="button" className={`inn-view-btn${viewMode === 'list' ? ' is-active' : ''}`} onClick={() => setViewMode('list')} aria-label="قائمة">
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                </div>
              </div>

              {!sideOpen && flyout ? (
                <div className="inn-side-flyout" role="dialog" aria-label="تفاصيل القائمة">
                  {flyout === 'accounts' ? (
                    fwMode ? (
                    <>
                      <p className="inn-side-flyout-title">تصفية الوقت</p>
                      <ul className="inn-side-flyout-list">
                        {FW_DATE_PILLS.map((pill) => (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-flyout-item${fwFilters.date === pill.id ? ' is-active' : ''}`}
                              onClick={() => patchFwFilters({ date: pill.id })}
                            >
                              <span className="inn-flyout-grip" aria-hidden="true" />
                              <span className={`inn-flyout-icon is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                              <span>
                                <strong>{pill.label}</strong>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                    ) : (
                    <>
                      <p className="inn-side-flyout-title">تصفية الحسابات</p>
                      <ul className="inn-side-flyout-list">
                        {FILTER_PILLS.map((pill) => (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-flyout-item${filter === pill.id ? ' is-active' : ''}`}
                              onClick={() => goUsers({ filter: pill.id })}
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
                    )
                  ) : flyout === 'types' ? (
                    fwMode ? (
                    <>
                      <p className="inn-side-flyout-title">تصفية الحالة</p>
                      <ul className="inn-side-flyout-list">
                        {FW_SCOPE_PILLS.map((pill) => (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-flyout-item${fwFilters.scope === pill.id ? ' is-active' : ''}`}
                              onClick={() => patchFwFilters({ scope: pill.id })}
                            >
                              <span className="inn-flyout-grip" aria-hidden="true" />
                              <span className={`inn-flyout-icon is-${pill.tone}`}><FilterShape tone={pill.tone} /></span>
                              <span>
                                <strong>{pill.label}</strong>
                                <em>{fwCounts[pill.id]} حدث</em>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                    ) : (
                    <>
                      <p className="inn-side-flyout-title">تصفية النوع</p>
                      <ul className="inn-side-flyout-list">
                        {ROLE_PILLS.map((pill) => (
                          <li key={pill.id}>
                            <button
                              type="button"
                              className={`inn-side-flyout-item${roleFilter === pill.id ? ' is-active' : ''}`}
                              onClick={() => goUsers({ role: pill.id })}
                            >
                              <span className="inn-flyout-grip" aria-hidden="true" />
                              <span className={`inn-flyout-icon is-${pill.tone}`}><RoleGlyph role={pill.id} /></span>
                              <span>
                                <strong>{pill.label}</strong>
                                <em>{roleCounts[pill.id]} حساب</em>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                    )
                  ) : (
                    <>
                      <p className="inn-side-flyout-title">متصل الآن</p>
                      <ul className="inn-side-flyout-list">
                        {onlineUsers.length === 0 ? (
                          <li className="inn-activity-empty">لا توجد جلسات نشطة</li>
                        ) : (
                          onlineUsers.map((user) => (
                            <li key={user.id}>
                              <button type="button" className="inn-side-flyout-item" onClick={() => openProfile(user.id)}>
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
                          <button type="button" className="inn-side-flyout-item" onClick={() => openProfile(user.id)}>
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
                <button type="button" className="inn-side-link" onClick={() => goSection('google')} title="الإعدادات">
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

      {creating ? (
        <div className="fw-modal" role="dialog" aria-modal="true" aria-label="إضافة حساب">
          <button type="button" className="fw-modal-bg" aria-label="إغلاق" onClick={() => setCreating(false)} />
          <form
            className="fw-modal-card"
            onSubmit={(e) => {
              e.preventDefault();
              createUser();
            }}
          >
            <h3>حساب جديد</h3>
            <label>الاسم<input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required /></label>
            <label>اسم المستخدم<input dir="ltr" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} /></label>
            <label>البريد<input dir="ltr" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} /></label>
            <label>الهاتف<input dir="ltr" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
            <label>كلمة المرور<input dir="ltr" type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required /></label>
            <label>
              الدور
              <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                {LOGIN_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <div className="fw-edit-acts">
              <button type="submit">إنشاء</button>
              <button type="button" className="is-ghost" onClick={() => setCreating(false)}>إلغاء</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
