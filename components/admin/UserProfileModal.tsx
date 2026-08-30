'use client';

import React, { useEffect, useState } from 'react';
import {
  Ban,
  CalendarDays,
  Fingerprint,
  Globe,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Power,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import { DEFAULT_USER_PHOTO, formatAdminDate, type EnrichedUser } from '@/lib/user-access-view';

type TabKey = 'overview' | 'security' | 'permissions';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'security', label: 'الأمان والجلسة' },
  { id: 'permissions', label: 'الصلاحيات' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return name.slice(0, 2) || '؟';
}

function splitName(full: string): { name: string; note: string } {
  const match = full.trim().match(/^(.*?)\s*[（(]\s*([^）)]*?)\s*[）)]$/);
  if (match) return { name: match[1], note: match[2] };
  return { name: full.trim(), note: '' };
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

export default function UserProfileModal({
  user,
  isSelf,
  onClose,
  onPatch,
  onBlockIp,
}: {
  user: EnrichedUser;
  isSelf: boolean;
  onClose: () => void;
  onPatch: (userId: string, body: Record<string, unknown>) => void;
  onBlockIp: (ip: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState(user.role);

  const { name, note } = splitName(user.name);
  const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
  const canBlockIp = user.displayIp && user.displayIp !== '—' && user.displayIp !== 'N/A';

  const dismiss = () => {
    setClosing(true);
    window.setTimeout(onClose, 190);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`upm-overlay${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`ملف ${name}`}>
      <button type="button" className="upm-backdrop" aria-label="إغلاق" onClick={dismiss} />

      <div className={`upm-panel${closing ? ' is-closing' : ''}`} dir="rtl">
        <button type="button" className="upm-close" onClick={dismiss} aria-label="إغلاق">
          <X className="w-4 h-4" />
        </button>

        {/* ── Hero ── */}
        <header className={`upm-hero${user.isOnline ? ' is-live' : ''}`}>
          <div className="upm-hero-glow" />
          <div className="upm-avatar-wrap">
            <span className={`upm-avatar${user.isOnline ? ' is-live' : ''}`}>
              <img src={user.photo || DEFAULT_USER_PHOTO} alt={user.name} onError={(e) => { (e.currentTarget.style.display = 'none'); }} />
              <b className="upm-avatar-initials">{initials(user.name)}</b>
            </span>
            {user.isOnline ? <span className="upm-ring" /> : null}
          </div>

          <div className="upm-hero-text">
            <h2 className="upm-name">
              {name}
              {isSelf ? <span className="upm-self">أنت</span> : null}
            </h2>
            <p className="upm-sub">{note || user.roleName || user.role}</p>
            <div className="upm-badges">
              <span className={`upm-badge${user.isOnline ? ' is-live' : ' is-idle'}`}>
                <span className="upm-dot" />
                {user.isOnline ? 'متصل الآن' : 'غير متصل'}
              </span>
              <span className={`upm-badge${isActive ? ' is-ok' : ' is-off'}`}>
                {isActive ? 'الحساب مفعّل' : 'الحساب موقوف'}
              </span>
              {user.googleLinked ? <span className="upm-badge is-info">مرتبط بجوجل</span> : null}
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav className="upm-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`upm-tab${tab === t.id ? ' is-active' : ''}`}
              style={{ animationDelay: `${90 + i * 55}ms` }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="upm-body" key={tab}>
          {tab === 'overview' ? (
            <div className="upm-cards">
              <Card icon={<UserRound className="w-4 h-4" />} label="الاسم الكامل" value={user.name} delay={0} />
              <Card icon={<Mail className="w-4 h-4" />} label="البريد الإلكتروني" value={user.email || user.username || '—'} ltr delay={1} />
              <Card icon={<KeyRound className="w-4 h-4" />} label="اسم المستخدم" value={user.username || '—'} ltr delay={2} />
              <Card icon={<ShieldCheck className="w-4 h-4" />} label="الدور" value={user.roleName || user.role} delay={3} />
              <Card icon={<CalendarDays className="w-4 h-4" />} label="تاريخ الإنشاء" value={formatAdminDate(user.createdAt)} delay={4} />
              <Card icon={<CalendarDays className="w-4 h-4" />} label="آخر دخول" value={formatAdminDate(user.lastLogin)} delay={5} />
            </div>
          ) : null}

          {tab === 'security' ? (
            <div className="upm-cards">
              <Card icon={<Globe className="w-4 h-4" />} label="عنوان IP الأخير" value={user.displayIp} ltr delay={0} />
              <Card icon={<Fingerprint className="w-4 h-4" />} label="بصمة الجهاز" value={user.displayFingerprint} ltr delay={1} />
              <Card icon={<MonitorSmartphone className="w-4 h-4" />} label="الجهاز والمتصفح" value={deviceLabel(user.userAgent)} delay={2} />
              <Card
                icon={<ShieldCheck className="w-4 h-4" />}
                label="آخر نشاط مسجّل"
                value={formatAdminDate(user.lastActive || user.lastLogin)}
                delay={3}
              />
              <div className="upm-card upm-card-wide" style={{ animationDelay: '260ms' }}>
                <span className="upm-card-label">تعريف المتصفح الكامل</span>
                <p className="upm-ua" dir="ltr">{user.userAgent || 'لم تُسجّل أي جلسة بعد'}</p>
              </div>
            </div>
          ) : null}

          {tab === 'permissions' ? (
            <div className="upm-perms">
              <div className="upm-role-picker" style={{ animationDelay: '60ms' }}>
                <label className="upm-card-label">تغيير الدور</label>
                <div className="upm-role-row">
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    {LOGIN_ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="upm-btn upm-btn-primary"
                    disabled={role === user.role}
                    onClick={() => onPatch(user.id, { role })}
                  >
                    حفظ الدور
                  </button>
                </div>
              </div>

              <div className="upm-chips" style={{ animationDelay: '140ms' }}>
                <span className="upm-card-label">أقسام اللوحة المتاحة</span>
                <div>
                  {(user.options || []).length === 0 ? (
                    <p className="upm-empty">لا توجد صلاحيات مرتبطة بهذا الدور</p>
                  ) : (
                    (user.options || []).map((option, i) => (
                      <span key={option} className="upm-chip" style={{ animationDelay: `${170 + i * 45}ms` }}>
                        {option}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Footer actions ── */}
        <footer className="upm-foot">
          {user.status === 'PENDING_APPROVAL' ? (
            <>
              <button
                type="button"
                className="upm-btn upm-btn-ok"
                onClick={() => onPatch(user.id, { status: 'APPROVED', role, loginEnabled: true })}
              >
                <ShieldCheck className="w-4 h-4" />
                الموافقة وتفعيل الدخول
              </button>
              <button
                type="button"
                className="upm-btn upm-btn-danger"
                onClick={() => onPatch(user.id, { status: 'REJECTED', loginEnabled: false })}
              >
                رفض الطلب
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`upm-btn ${isActive ? 'upm-btn-danger' : 'upm-btn-ok'}`}
              onClick={() =>
                onPatch(
                  user.id,
                  isActive
                    ? { status: 'SUSPENDED', loginEnabled: false }
                    : { status: 'APPROVED', loginEnabled: true }
                )
              }
            >
              <Power className="w-4 h-4" />
              {isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
            </button>
          )}

          {canBlockIp ? (
            <button type="button" className="upm-btn upm-btn-ghost" onClick={() => onBlockIp(user.displayIp)}>
              <Ban className="w-4 h-4" />
              حظر {user.displayIp} في الجدار
            </button>
          ) : null}

          <button type="button" className="upm-btn upm-btn-ghost upm-btn-end" onClick={dismiss}>
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  ltr,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
  delay: number;
}) {
  return (
    <div className="upm-card" style={{ animationDelay: `${60 + delay * 45}ms` }}>
      <span className="upm-card-icon">{icon}</span>
      <div className="upm-card-text">
        <span className="upm-card-label">{label}</span>
        <p className="upm-card-value" dir={ltr ? 'ltr' : undefined} title={value}>{value}</p>
      </div>
    </div>
  );
}
