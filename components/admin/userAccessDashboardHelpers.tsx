'use client';

import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Briefcase,
  Calculator,
  Circle,
  Landmark,
  Shield,
  Square,
  Star,
  Triangle,
  UserCog,
  Users
} from 'lucide-react';
import {
  DEFAULT_USER_PHOTO,
  isImageSource,
  type EnrichedUser,
} from '@/lib/user-access-view';
import {
  LOGIN_ROLE_LABELS,
  LOGIN_ROLE_OPTIONS,
  normalizeLoginRole,
  type LoginRole,
} from '@/lib/roles';
import {
  EMPTY_FW_COUNTS,
  type FirewallDateFilter,
  type FirewallScope,
} from '@/components/admin/SecurityCenter';

export type DashboardStats = {
  total: number;
  online: number;
  pending: number;
  suspended: number;
  active: number;
  sessions: number;
  neverLoggedIn: number;
  liveIps: number;
};

export type LiveIpRow = {
  ip: string;
  hits: number;
  trusted?: boolean;
  lastPath?: string;
  lastSeen?: string;
  agent?: string;
};

export const EMPTY_STATS: DashboardStats = {
  total: 0,
  online: 0,
  pending: 0,
  suspended: 0,
  active: 0,
  sessions: 0,
  neverLoggedIn: 0,
  liveIps: 0,
};

export const HEARTBEAT_MS = 45000;
export const REFRESH_MS = 10000;

export type DashSection = 'overview' | 'users' | 'security' | 'google' | 'server' | 'bookings' | 'content' | 'sakhr' | 'backups';
export type FilterKey = 'all' | 'online' | 'active' | 'pending' | 'suspended';
export type RoleFilter = 'all' | LoginRole;
export type FlyoutKey = 'accounts' | 'sessions' | 'types' | null;

export const FILTER_PILLS: { id: FilterKey; label: string; tone: string }[] = [
  { id: 'all', label: 'الكل', tone: 'blue' },
  { id: 'online', label: 'متصل', tone: 'cyan' },
  { id: 'active', label: 'مفعّل', tone: 'yellow' },
  { id: 'pending', label: 'بانتظار', tone: 'purple' },
  { id: 'suspended', label: 'موقوف', tone: 'red' },
];

export const ROLE_TONES: Record<LoginRole, string> = {
  SUPER_ADMIN: 'yellow',
  AGENCY_MANAGER: 'purple',
  ACCOUNTANT: 'cyan',
  GUIDE_MURSHID: 'green',
  AGENCY_AGENT: 'gold',
  PILGRIM_USER: 'blue',
};

export const ROLE_PILLS: { id: RoleFilter; label: string; tone: string }[] = [
  { id: 'all', label: 'كل الأنواع', tone: 'blue' },
  ...LOGIN_ROLE_OPTIONS.map((option) => ({
    id: option.value as RoleFilter,
    label: option.label,
    tone: ROLE_TONES[option.value],
  })),
];

export const FW_DATE_PILLS: { id: FirewallDateFilter; label: string; tone: string }[] = [
  { id: 'all', label: 'كل التواريخ', tone: 'blue' },
  { id: 'hour', label: 'آخر ساعة', tone: 'cyan' },
  { id: 'today', label: 'اليوم', tone: 'yellow' },
  { id: 'yesterday', label: 'أمس', tone: 'purple' },
  { id: 'day', label: '24 ساعة', tone: 'gold' },
  { id: 'week', label: '7 أيام', tone: 'green' },
];

export const FW_SCOPE_PILLS: { id: FirewallScope; label: string; tone: string }[] = [
  { id: 'all', label: 'كل الاتصالات', tone: 'blue' },
  { id: 'important', label: 'المهم فقط', tone: 'yellow' },
  { id: 'blocked', label: 'محظور', tone: 'red' },
  { id: 'threat', label: 'تهديد', tone: 'purple' },
  { id: 'allow', label: 'مسموح', tone: 'cyan' },
];

export function userLoginRole(user: { role?: string; email?: string; roleName?: string }): LoginRole {
  return normalizeLoginRole(user.role, { email: user.email, roleName: user.roleName });
}

export function roleLabelOf(user: { role?: string; email?: string; roleName?: string }): string {
  const named = (user.roleName || '').trim();
  if (named) return named;
  return LOGIN_ROLE_LABELS[userLoginRole(user)];
}

export const AGENCY_LOGO_FALLBACK = '/images/south_street_logo.png';

export function resolveAgencyLogo(logo?: string | null): string {
  if (!logo) return AGENCY_LOGO_FALLBACK;
  const src = String(logo).trim();
  if (!src || src.startsWith('file:') || /^[a-zA-Z]:[\\/]/.test(src)) return AGENCY_LOGO_FALLBACK;
  if (src.startsWith('images/')) return `/${src}`;
  if (isImageSource(src)) return src;
  return AGENCY_LOGO_FALLBACK;
}

export function FilterShape({ tone }: { tone: string }) {
  if (tone === 'purple') return <Triangle className="w-3 h-3" fill="currentColor" />;
  if (tone === 'red') return <Square className="w-3 h-3" fill="currentColor" />;
  if (tone === 'yellow') return <Star className="w-3.5 h-3.5" fill="currentColor" />;
  return <Circle className="w-3 h-3" fill="currentColor" />;
}

export function RoleGlyph({ role }: { role: RoleFilter }) {
  if (role === 'SUPER_ADMIN') return <Shield className="w-3.5 h-3.5" />;
  if (role === 'AGENCY_MANAGER') return <Briefcase className="w-3.5 h-3.5" />;
  if (role === 'ACCOUNTANT') return <Calculator className="w-3.5 h-3.5" />;
  if (role === 'GUIDE_MURSHID') return <BookOpen className="w-3.5 h-3.5" />;
  if (role === 'AGENCY_AGENT') return <UserCog className="w-3.5 h-3.5" />;
  if (role === 'PILGRIM_USER') return <Landmark className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return name.slice(0, 2) || '؟';
}

/** Names may include a parenthetical title — keep the title out of the name line. */
export function splitName(full: string): { name: string; note: string } {
  const match = full.trim().match(/^(.*?)\s*[ï¼ˆ(]\s*([^ï¼‰)]*?)\s*[ï¼‰)]$/);
  if (match) return { name: match[1], note: match[2] };
  return { name: full.trim(), note: '' };
}

export function BrandLogo({ src, name }: { src: string; name: string }) {
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

export function UserAvatar({
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


