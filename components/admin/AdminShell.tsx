'use client';

/**
 * AdminShell — shared chrome helpers for /admin.
 * Keeps existing inn-* layout; adds grouped nav, live indicator, session banner.
 */
import React from 'react';
import {
  BookOpen,
  Bot,
  Calendar,
  Cpu,
  Globe,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import type { DashSection } from '@/components/admin/userAccessDashboardHelpers';

export type AdminNavId =
  | 'overview'
  | 'sessions'
  | 'pending'
  | 'bookings'
  | 'security'
  | 'content'
  | 'sakhr'
  | 'server'
  | 'google'
  | 'site';

export type AdminNavItem = {
  id: AdminNavId;
  label: string;
  title: string;
  section?: DashSection;
  filter?: 'online' | 'pending' | 'all';
  href?: string;
  icon: React.ReactNode;
  badgeKey?: 'pendingAccess' | 'pendingBookings' | 'openSecurity' | 'online';
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    items: [
      {
        id: 'overview',
        label: 'لوحة المؤشرات',
        title: 'نظرة عامة',
        section: 'overview',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'users',
    label: 'المستخدمون / الوصول',
    items: [
      {
        id: 'sessions',
        label: 'الجلسات',
        title: 'الجلسات',
        section: 'users',
        filter: 'online',
        icon: <MessageCircle className="w-4 h-4" />,
        badgeKey: 'online',
      },
      {
        id: 'pending',
        label: 'الموافقات',
        title: 'الموافقات',
        section: 'users',
        filter: 'pending',
        icon: <Calendar className="w-4 h-4" />,
        badgeKey: 'pendingAccess',
      },
      {
        id: 'google',
        label: 'دخول جوجل',
        title: 'دخول جوجل',
        section: 'google',
        icon: <KeyRound className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'bookings',
    label: 'الحجوزات / الطلب',
    items: [
      {
        id: 'bookings',
        label: 'طلبات العمرة',
        title: 'طلبات العمرة',
        section: 'bookings',
        icon: <ShoppingBag className="w-4 h-4" />,
        badgeKey: 'pendingBookings',
      },
    ],
  },
  {
    id: 'security',
    label: 'الأمن',
    items: [
      {
        id: 'security',
        label: 'مركز الأمن',
        title: 'الجدار الناري / الأمن',
        section: 'security',
        icon: <ShieldCheck className="w-4 h-4" />,
        badgeKey: 'openSecurity',
      },
    ],
  },
  {
    id: 'content',
    label: 'المحتوى',
    items: [
      {
        id: 'content',
        label: 'محتوى الصفحات',
        title: 'المحتوى',
        section: 'content',
        icon: <FileText className="w-4 h-4" />,
      },
      {
        id: 'site',
        label: 'الموقع',
        title: 'الموقع',
        href: '/',
        icon: <Globe className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'server',
    label: 'الخادم',
    items: [
      {
        id: 'server',
        label: 'حالة الخادم',
        title: 'حالة الخادم',
        section: 'server',
        icon: <Cpu className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'ai',
    label: 'الذكاء / صخر',
    items: [
      {
        id: 'sakhr',
        label: 'معرفة صخر',
        title: 'صخر',
        section: 'sakhr',
        icon: <Bot className="w-4 h-4" />,
      },
    ],
  },
];

export function AdminLiveIndicator({ live }: { live: boolean }) {
  return (
    <span className={`adm-shell-live${live ? '' : ' is-idle'}`} title={live ? 'تحديث مباشر نشط' : 'بانتظار التحديث'}>
      <span className="adm-shell-live-dot" aria-hidden="true" />
      {live ? 'مباشر' : 'إيقاف'}
    </span>
  );
}

export function AdminSessionBanner({
  visible,
  onRelogin,
}: {
  visible: boolean;
  onRelogin: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="adm-session-banner" role="alert" dir="rtl">
      <span>انتهت جلسة الإدارة أو لم تعد صالحة (401). يرجى تسجيل الدخول مجدداً.</span>
      <button type="button" onClick={onRelogin}>
        إعادة الدخول
      </button>
    </div>
  );
}

export function AdminNavGroups({
  section,
  filter,
  badges,
  pulse,
  onItem,
}: {
  section: DashSection;
  filter: string;
  badges: Partial<Record<NonNullable<AdminNavItem['badgeKey']>, number>>;
  pulse?: Partial<Record<'pendingAccess' | 'pendingBookings' | 'openSecurity', boolean>>;
  onItem: (item: AdminNavItem) => void;
}) {
  const isActive = (item: AdminNavItem) => {
    if (item.href) return false;
    if (item.section === 'users' && item.filter) {
      return section === 'users' && filter === item.filter;
    }
    return Boolean(item.section && section === item.section);
  };

  return (
    <div className="adm-nav-groups">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.id} className="adm-nav-group">
          <span className="adm-nav-group-label">{group.label}</span>
          <nav className="inn-side-primary" aria-label={group.label}>
            {group.items.map((item) => {
              if (item.href) {
                return (
                  <a key={item.id} href={item.href} className="inn-side-link" title={item.title}>
                    {item.icon}
                    <span className="inn-side-label">{item.label}</span>
                  </a>
                );
              }
              const badge = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
              const pulseOn =
                (item.badgeKey === 'pendingAccess' && pulse?.pendingAccess) ||
                (item.badgeKey === 'pendingBookings' && pulse?.pendingBookings) ||
                (item.badgeKey === 'openSecurity' && pulse?.openSecurity);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`inn-side-link${isActive(item) ? ' is-active' : ''}`}
                  onClick={() => onItem(item)}
                  title={item.title}
                >
                  {item.icon}
                  <span className="inn-side-label">{item.label}</span>
                  {badge > 0 ? (
                    <span className={`inn-side-badge${pulseOn ? ' adm-badge-pulse' : ''}`}>{badge}</span>
                  ) : item.id === 'sessions' ? (
                    <span className="inn-side-dot" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

/** Re-export BookOpen for callers that need docs affordance. */
export { BookOpen };
