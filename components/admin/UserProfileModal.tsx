'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Fingerprint,
  Globe,
  MonitorSmartphone,
  Power,
  ShieldCheck,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import {
  DEFAULT_USER_PHOTO,
  deviceLabel,
  formatAdminDate,
  PRESENCE_LABELS,
  presenceOf,
  type EnrichedUser,
} from '@/lib/user-access-view';
import PresenceTimeline from '@/components/admin/PresenceTimeline';

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

export default function UserProfileModal({
  user,
  isSelf,
  onClose,
  onPatch,
  onBlockIp,
  embedded = false,
}: {
  user: EnrichedUser;
  isSelf: boolean;
  onClose: () => void;
  onPatch: (userId: string, body: Record<string, unknown>) => void;
  onBlockIp: (ip: string) => void;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState(user.role);

  const { name, note } = splitName(user.name);
  const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
  const canBlockIp = user.displayIp && user.displayIp !== '—' && user.displayIp !== 'N/A';
  const presence = presenceOf(user);

  const dismiss = () => {
    if (embedded) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, 190);
  };

  useEffect(() => {
    setRole(user.role);
    setTab('overview');
  }, [user.id, user.role]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    if (embedded) {
      return () => document.removeEventListener('keydown', onKey);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const panel = (
      <div className={`upm-panel${closing ? ' is-closing' : ''}${embedded ? ' is-embedded' : ''}`} dir="rtl">
        {embedded ? (
          <button type="button" className="upm-back" onClick={dismiss}>
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
        ) : (
          <button type="button" className="upm-close" onClick={dismiss} aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        )}

        {/* ── Hero ── */}
        <header className={`upm-hero is-${presence}`}>
          <div className="upm-hero-glow" />
          <div className="upm-avatar-wrap">
            <span className={`upm-avatar${presence === 'connected' ? ' is-live' : ''}`}>
              <img src={user.photo || DEFAULT_USER_PHOTO} alt={user.name} onError={(e) => { (e.currentTarget.style.display = 'none'); }} />
              <b className="upm-avatar-initials">{initials(user.name)}</b>
            </span>
            <span className={`ts-dot is-${presence}`} />
          </div>

          <div className="upm-hero-text">
            <h2 className="upm-name">
              {name}
              {isSelf ? <span className="upm-self">أنت</span> : null}
            </h2>
            <p className="upm-sub">{note || user.roleName || user.role} · {user.email || user.username || '—'}</p>
            <div className="upm-badges">
              <span className={`upm-badge is-${presence}`}>
                <span className="upm-dot" />
                {PRESENCE_LABELS[presence]}
                {presence === 'connected' ? ' الآن' : ''}
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
            <div className="upm-machine">
              <section className="upm-timeline-card">
                <h3>خط الاتصال</h3>
                <PresenceTimeline presence={presence} />
                <p className="upm-timeline-note">
                  {presence === 'connected'
                    ? 'الجلسة نشطة خلال آخر 15 دقيقة.'
                    : presence === 'inactive'
                      ? 'ظهر خلال آخر 24 ساعة ثم أصبح خاملًا.'
                      : 'لا نشاط حديث، الجهاز غير متصل.'}
                </p>
              </section>

              <dl className="upm-props">
                <div>
                  <dt>المالك</dt>
                  <dd>{name}</dd>
                </div>
                <div>
                  <dt>البريد</dt>
                  <dd dir="ltr">{user.email || user.username || '—'}</dd>
                </div>
                <div>
                  <dt>نظام التشغيل</dt>
                  <dd>{deviceLabel(user.userAgent)}</dd>
                </div>
                <div>
                  <dt>الدور</dt>
                  <dd>{user.roleName || user.role}</dd>
                </div>
                <div>
                  <dt>تاريخ الإنشاء</dt>
                  <dd>{formatAdminDate(user.createdAt)}</dd>
                </div>
                <div>
                  <dt>آخر ظهور</dt>
                  <dd>{formatAdminDate(user.lastActive || user.lastLogin)}</dd>
                </div>
              </dl>

              <section className="upm-addr-card">
                <h3>العناوين</h3>
                <ul>
                  <li>
                    <span>IP</span>
                    <code dir="ltr">{user.displayIp}</code>
                  </li>
                  <li>
                    <span>البصمة</span>
                    <code dir="ltr">{user.displayFingerprint}</code>
                  </li>
                </ul>
              </section>
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
            {embedded ? 'رجوع' : 'إغلاق'}
          </button>
        </footer>
      </div>
  );

  if (embedded) {
    return (
      <div className="upm-embedded" role="region" aria-label={`ملف ${name}`}>
        {panel}
      </div>
    );
  }

  return (
    <div className={`upm-overlay${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`ملف ${name}`}>
      <button type="button" className="upm-backdrop" aria-label="إغلاق" onClick={dismiss} />
      {panel}
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
