'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Mic,
  Phone,
  Power,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import {
  accountStatusOf,
  DEFAULT_USER_PHOTO,
  deviceLabel,
  formatAdminDate,
  presenceOf,
  type EnrichedUser,
} from '@/lib/user-access-view';
import UserActivityMap from '@/components/admin/UserActivityMap';

type TabKey = 'data' | 'session' | 'access' | 'history';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'data', label: 'البيانات' },
  { id: 'session', label: 'الجلسة' },
  { id: 'access', label: 'الصلاحيات' },
  { id: 'history', label: 'السجل' },
];

type UserDevice = {
  id: string;
  ip: string;
  fingerprint: string;
  userAgent: string;
  device: string;
  firstSeen: string;
  lastSeen: string;
  active: boolean;
};

type UserHistoryEvent = {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail: string;
  ip?: string;
  device?: string;
};

function splitName(full: string): { name: string; note: string } {
  const match = full.trim().match(/^(.*?)\s*[（(]\s*([^）)]*?)\s*[）)]$/);
  if (match) return { name: match[1], note: match[2] };
  return { name: full.trim(), note: '' };
}

function userCode(user: EnrichedUser): string {
  const raw = (user.username || user.id || 'user').replace(/^usr[_-]?/i, '');
  const slug = raw.replace(/[^a-z0-9]+/gi, '').slice(0, 8) || 'user';
  return `ss.${slug}`.toLowerCase();
}

function seedActivity(user: EnrichedUser): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (raw?: string | null, n = 1) => {
    if (!raw) return;
    const t = new Date(raw);
    if (!Number.isFinite(t.getTime())) return;
    const key = t.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + n;
  };
  bump(user.createdAt, 1);
  bump(user.lastLogin, 2);
  bump(user.lastActive, 1);
  return counts;
}

function useSessionClock(isOnline: boolean, startedAt: string | null) {
  const [label, setLabel] = useState('--:--');

  useEffect(() => {
    const tick = () => {
      if (!startedAt) {
        setLabel('--:--');
        return;
      }
      if (!isOnline) {
        const formatted = formatAdminDate(startedAt);
        setLabel(formatted.includes(' ') ? formatted.split(' ').pop() || formatted : formatted);
        return;
      }
      const started = new Date(startedAt).getTime();
      if (!Number.isFinite(started)) {
        setLabel('--:--');
        return;
      }
      const s = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, '0');
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setLabel(hh === '00' ? `${mm}:${ss}` : `${hh}:${mm}:${ss}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isOnline, startedAt]);

  return label;
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
  peers?: EnrichedUser[];
}) {
  const [tab, setTab] = useState<TabKey>('data');
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState(user.role);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [history, setHistory] = useState<UserHistoryEvent[]>([]);

  const { name, note } = splitName(user.name);
  const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
  const canBlockIp = Boolean(user.displayIp && user.displayIp !== '—' && user.displayIp !== 'N/A');
  const presence = presenceOf(user);
  const status = accountStatusOf(user);
  const roleLabel = note || user.roleName || user.role;
  const phone = (user.phone || '').trim();
  const mail = user.email || user.username || '';
  const clock = useSessionClock(Boolean(user.isOnline), user.lastActive || user.lastLogin);
  const isPlaceholder = photoBroken || !user.photo || user.photo === DEFAULT_USER_PHOTO;
  const photo = isPlaceholder ? DEFAULT_USER_PHOTO : user.photo;

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
    setTab('data');
    setPhotoBroken(false);
    setActivity(seedActivity(user));
    setDevices([]);
    setHistory([]);
    const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
    fetch(`/api/admin/users?activityFor=${encodeURIComponent(user.id)}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.activity && typeof data.activity === 'object') {
          setActivity({ ...seedActivity(user), ...data.activity });
        }
        if (Array.isArray(data?.devices)) setDevices(data.devices);
        if (Array.isArray(data?.events)) setHistory(data.events);
      })
      .catch(() => { /* heatmap stays on known dates */ });
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

  const rows = useMemo(() => {
    if (tab === 'session') {
      return [
        { label: 'الاتصال', value: status.label },
        { label: 'آخر نشاط', value: formatAdminDate(user.lastActive || user.lastLogin) },
        { label: 'آخر دخول', value: formatAdminDate(user.lastLogin) },
        { label: 'عنوان IP', value: user.displayIp, ltr: true },
        { label: 'الجهاز', value: deviceLabel(user.userAgent) },
        { label: 'البصمة', value: user.displayFingerprint, ltr: true },
        { label: 'المتصفح', value: user.userAgent || 'لم تُسجّل أي جلسة', ltr: true },
      ];
    }
    if (tab === 'access') {
      return [
        { label: 'الدور', value: roleLabel },
        { label: 'الحالة', value: isActive ? 'مفعّل' : 'موقوف' },
        { label: 'جوجل', value: user.googleLinked ? 'مرتبط' : 'غير مرتبط' },
        { label: 'الأقسام', value: (user.options || []).join(' · ') || '—' },
      ];
    }
    return [
      { label: 'الاسم', value: name },
      { label: 'المعرّف', value: userCode(user), ltr: true },
      { label: 'البريد', value: mail || '—', ltr: true },
      { label: 'الهاتف', value: phone || '—' },
      { label: 'الدور', value: roleLabel },
      { label: 'الحالة', value: status.label },
      { label: 'تاريخ الإنشاء', value: formatAdminDate(user.createdAt) },
    ];
  }, [tab, status.label, user, roleLabel, isActive, name, mail, phone]);

  const panel = (
    <div className={`upm-panel upm-studio-wrap${closing ? ' is-closing' : ''}${embedded ? ' is-embedded' : ''}`}>
      <div className="upm-studio">
        <aside className={`upm-studio-photo is-${presence}${isPlaceholder ? ' is-placeholder' : ''}`}>
          <img
            src={photo}
            alt={name}
            onError={() => {
              if (!isPlaceholder) setPhotoBroken(true);
            }}
          />
          <div className="upm-studio-shade" />

          <div className="upm-studio-pills">
            <span className="upm-studio-pill">
              {name}
              {isSelf ? ' · أنت' : ''}
            </span>
            <span className="upm-studio-pill is-time" dir="ltr">{clock}</span>
          </div>

          <div className="upm-studio-tools">
            {phone ? (
              <a className="upm-studio-tool is-call" href={`tel:${phone}`} title="اتصال" aria-label="اتصال">
                <Phone className="w-4 h-4" />
              </a>
            ) : (
              <span className="upm-studio-tool is-off" title="لا يوجد رقم">
                <Phone className="w-4 h-4" />
              </span>
            )}
            <a
              className="upm-studio-tool"
              href={photo}
              target="_blank"
              rel="noreferrer"
              title="الكاميرا"
              aria-label="الكاميرا"
            >
              <Video className="w-4 h-4" />
            </a>
            <span className={`upm-studio-tool${user.isOnline ? '' : ' is-off'}`} title={user.isOnline ? 'الميكروفون' : 'غير متصل'}>
              <Mic className="w-4 h-4" />
            </span>
          </div>
        </aside>

        <div className="upm-studio-main" dir="rtl">
          <header className="upm-studio-head">
            {embedded ? (
              <button type="button" className="upm-studio-back" onClick={dismiss}>
                <ArrowRight className="w-4 h-4" />
                رجوع
              </button>
            ) : (
              <button type="button" className="upm-studio-back" onClick={dismiss} aria-label="إغلاق">
                <X className="w-4 h-4" />
                إغلاق
              </button>
            )}
            <h2>تفاصيل الحساب</h2>
            <nav className="upm-seg">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`upm-seg-btn${tab === item.id ? ' is-active' : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </header>

          <div className="upm-table-wrap">
            <div key={tab} className="upm-table-swap">
            {tab !== 'history' ? (
            <table className="upm-table">
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td dir={row.ltr ? 'ltr' : undefined}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
              <div className="upm-history">
                <section className="upm-history-block">
                  <h3>أجهزة الدخول</h3>
                  {devices.length === 0 ? (
                    <p className="upm-history-empty">لا توجد أجهزة مسجّلة بعد</p>
                  ) : (
                    <ul className="upm-device-list">
                      {devices.map((item) => (
                        <li key={item.id} className={item.active ? 'is-live' : ''}>
                          <div>
                            <strong>{item.device}</strong>
                            <span>{item.active ? 'جلسة نشطة' : 'جلسة سابقة'}</span>
                          </div>
                          <p dir="ltr">{item.ip}</p>
                          <em>{formatAdminDate(item.lastSeen)}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="upm-history-block">
                  <h3>سجل النشاط والأوامر</h3>
                  {history.length === 0 ? (
                    <p className="upm-history-empty">لا يوجد سجل بعد</p>
                  ) : (
                    <ol className="upm-timeline">
                      {history.map((item) => (
                        <li key={item.id} className={`is-${item.kind}`}>
                          <time>{formatAdminDate(item.at)}</time>
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                          {item.ip || item.device ? (
                            <em>{[item.device, item.ip].filter(Boolean).join(' · ')}</em>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            )}

            {tab === 'access' ? (
              <div className="upm-table-actions">
                <label>
                  تغيير الدور
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    {LOGIN_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="upm-btn upm-btn-primary"
                  disabled={role === user.role}
                  onClick={() => onPatch(user.id, { role })}
                >
                  حفظ الدور
                </button>
              </div>
            ) : null}

            {tab !== 'history' ? (
            <div className="upm-table-actions">
              {user.status === 'PENDING_APPROVAL' ? (
                <>
                  <button
                    type="button"
                    className="upm-btn upm-btn-ok"
                    onClick={() => onPatch(user.id, { status: 'APPROVED', role, loginEnabled: true })}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    موافقة
                  </button>
                  <button
                    type="button"
                    className="upm-btn upm-btn-danger"
                    onClick={() => onPatch(user.id, { status: 'REJECTED', loginEnabled: false })}
                  >
                    رفض
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
                  {isActive ? 'إيقاف' : 'تفعيل'}
                </button>
              )}
              {canBlockIp ? (
                <button type="button" className="upm-btn upm-btn-ghost" onClick={() => onBlockIp(user.displayIp)}>
                  <Ban className="w-4 h-4" />
                  حظر IP
                </button>
              ) : null}
            </div>
            ) : null}
            </div>
          </div>

          <UserActivityMap counts={activity} />
        </div>
      </div>
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
