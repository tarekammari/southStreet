'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Mic,
  Phone,
  Power,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_LABELS, normalizeLoginRole, type LoginRole } from '@/lib/roles';
import {
  accountStatusOf,
  DEFAULT_USER_PHOTO,
  deviceLabel,
  formatAdminDate,
  presenceOf,
  type EnrichedUser,
} from '@/lib/user-access-view';
import UserActivityMap from '@/components/admin/UserActivityMap';
import { authHeaders, getAuthToken, apiFetch, jsonAuthHeaders } from '@/lib/api-client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

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
  onDelete,
  embedded = false,
  viewerRole = 'AGENCY_MANAGER',
  assignableRoles = [],
}: {
  user: EnrichedUser;
  isSelf: boolean;
  onClose: () => void;
  onPatch: (userId: string, body: Record<string, unknown>) => void;
  onBlockIp: (ip: string) => void;
  onDelete?: () => void;
  embedded?: boolean;
  peers?: EnrichedUser[];
  /** Who is looking: decides which actions are offered (the API enforces the same rules). */
  viewerRole?: LoginRole;
  assignableRoles?: LoginRole[];
}) {
  const [tab, setTab] = useState<TabKey>('data');
  const [closing, setClosing] = useState(false);
  const [role, setRole] = useState(user.role);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'reject' | 'revoke' | 'reset-keys'>(null);
  const [draft, setDraft] = useState({
    name: user.name,
    email: user.email || '',
    username: user.username || '',
    phone: user.phone || '',
    password: '',
  });
  const [photoBroken, setPhotoBroken] = useState(false);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [history, setHistory] = useState<UserHistoryEvent[]>([]);

  const { name, note } = splitName(user.name);
  const isActive = user.status === 'APPROVED' && user.loginEnabled !== false;
  const targetRole = normalizeLoginRole(user.role);
  const targetIsAdmin = targetRole === 'AGENCY_MANAGER';
  const targetPrivileged = targetRole === 'SUPER_ADMIN' || targetIsAdmin;
  const securityKeyCount = Number((user as { securityKeys?: number }).securityKeys) || 0;
  // Mirrors lib/permissions: the Super Admin is untouchable; Admins are managed by the Super Admin only.
  const lockedReason = isSelf
    ? ''
    : targetRole === 'SUPER_ADMIN'
      ? 'حساب المشرف العام محمي ولا يُعدَّل من التطبيق.'
      : targetIsAdmin && viewerRole !== 'SUPER_ADMIN'
        ? 'حسابات المشرفين يديرها المشرف العام فقط.'
        : '';
  const canEdit = !lockedReason;
  const canManageAccess = canEdit && !isSelf;
  const roleChoices = assignableRoles.includes(targetRole) ? assignableRoles : [targetRole, ...assignableRoles];
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
    setEditing(false);
    setConfirmDelete(false);
    setDraft({
      name: user.name,
      email: user.email || '',
      username: user.username || '',
      phone: user.phone || '',
      password: '',
    });
    setPhotoBroken(false);
    setActivity(seedActivity(user));
    setDevices([]);
    setHistory([]);
    const token = typeof window !== 'undefined' ? getAuthToken() : null;
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
  }, [user]);

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
        { label: 'جوجل', value: targetPrivileged ? 'غير مسموح لحسابات الإدارة' : user.googleLinked ? 'مرتبط' : 'غير مرتبط' },
        ...(targetPrivileged
          ? [{ label: 'مفاتيح الأمان', value: securityKeyCount ? `${securityKeyCount} مفتاح مسجّل` : 'لم يُفعَّل بعد — يلزم رابط تفعيل' }]
          : []),
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
  }, [tab, status.label, user, roleLabel, isActive, name, mail, phone, targetPrivileged, securityKeyCount]);

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
            {tab === 'data' && editing ? (
              <form
                className="fw-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  onPatch(user.id, isSelf
                    ? {
                        name: draft.name,
                        email: draft.email,
                        username: draft.username,
                        phone: draft.phone,
                      }
                    : {
                        email: draft.email,
                        username: draft.username,
                        password: targetPrivileged ? undefined : draft.password || undefined,
                      });
                  setEditing(false);
                }}
              >
                <h3>{isSelf ? 'تعديل بياناتي' : 'تعديل صلاحيات الحساب'}</h3>
                {!isSelf ? (
                  <p className="fw-lock-note">الاسم والهاتف بيانات شخصية أنشأها صاحب الحساب. للإدارة صلاحية الدور، الدخول، وكلمة المرور فقط.</p>
                ) : null}
                <label>
                  الاسم
                  <input value={isSelf ? draft.name : name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required disabled={!isSelf} />
                </label>
                <label>اسم المستخدم<input dir="ltr" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></label>
                <label>البريد<input dir="ltr" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                <label>
                  الهاتف
                  <input dir="ltr" value={isSelf ? draft.phone : phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} disabled={!isSelf} />
                </label>
                {!targetPrivileged && !isSelf ? (
                  <label>كلمة مرور جديدة<input dir="ltr" type="text" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="اتركها فارغة للإبقاء" minLength={8} autoComplete="new-password" /></label>
                ) : (
                  <p className="fw-lock-note">
                    {isSelf
                      ? 'لتغيير كلمة مرورك استعمل «أمان الحساب».'
                      : 'كلمة مرور المشرف تُعيَّن عبر رابط التفعيل فقط.'}
                  </p>
                )}
                <div className="fw-edit-acts">
                  <button type="submit">حفظ</button>
                  <button type="button" className="is-ghost" onClick={() => setEditing(false)}>إلغاء</button>
                </div>
              </form>
            ) : tab !== 'history' ? (
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

            {tab === 'access' && lockedReason ? (
              <p className="upm-lock"><ShieldCheck className="w-4 h-4" aria-hidden /> {lockedReason}</p>
            ) : null}

            {tab === 'access' && canManageAccess ? (
              <div className="upm-table-actions">
                <label>
                  تغيير الدور
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    {roleChoices.map((value) => (
                      <option key={value} value={value} disabled={!assignableRoles.includes(value)}>
                        {LOGIN_ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="upm-btn upm-btn-primary"
                  disabled={normalizeLoginRole(role) === targetRole}
                  onClick={() => onPatch(user.id, { role })}
                >
                  حفظ الدور
                </button>
              </div>
            ) : null}

            {tab === 'access' && canManageAccess && targetIsAdmin ? (
              <div className="upm-table-actions">
                <button type="button" className="upm-btn upm-btn-primary" onClick={() => onPatch(user.id, { action: 'invite-link' })}>
                  <ShieldCheck className="w-4 h-4" />
                  {securityKeyCount ? 'إصدار رابط مفتاح إضافي' : 'إصدار رابط التفعيل'}
                </button>
                {securityKeyCount ? (
                  <button type="button" className="upm-btn upm-btn-danger" onClick={() => setConfirmAction('reset-keys')}>
                    إعادة ضبط المفاتيح
                  </button>
                ) : null}
              </div>
            ) : null}

            {tab !== 'history' ? (
            <div className="upm-table-actions">
              {tab === 'data' && !editing && lockedReason ? (
                <p className="upm-lock"><ShieldCheck className="w-4 h-4" aria-hidden /> {lockedReason}</p>
              ) : null}
              {tab === 'data' && !editing && canEdit ? (
                <button type="button" className="upm-btn upm-btn-primary" onClick={() => setEditing(true)}>
                  {isSelf ? 'تعديل بياناتي' : 'تعديل الصلاحيات'}
                </button>
              ) : null}
              {!canManageAccess ? null : user.status === 'PENDING_APPROVAL' ? (
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
                    onClick={() => setConfirmAction('reject')}
                  >
                    رفض
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`upm-btn ${isActive ? 'upm-btn-danger' : 'upm-btn-ok'}`}
                  onClick={() => {
                    if (isActive) setConfirmAction('revoke');
                    else onPatch(user.id, { status: 'APPROVED', loginEnabled: true });
                  }}
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
              {onDelete && canManageAccess && tab === 'data' ? (
                confirmDelete ? (
                  <>
                    <button type="button" className="upm-btn upm-btn-danger" onClick={onDelete}>
                      <Trash2 className="w-4 h-4" />
                      تأكيد الحذف
                    </button>
                    <button type="button" className="upm-btn upm-btn-ghost" onClick={() => setConfirmDelete(false)}>
                      إلغاء
                    </button>
                  </>
                ) : (
                  <button type="button" className="upm-btn upm-btn-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="w-4 h-4" />
                    حذف الحساب
                  </button>
                )
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

  const confirmDialog = (
    <AdminConfirmDialog
      open={Boolean(confirmAction)}
      title={
        confirmAction === 'reject'
          ? 'رفض طلب الوصول؟'
          : confirmAction === 'reset-keys'
            ? 'إعادة ضبط مفاتيح المشرف؟'
            : 'إيقاف / سحب صلاحية الدخول؟'
      }
      message={
        confirmAction === 'reject'
          ? 'سيتم رفض حساب المستخدم وتعطيل تسجيل الدخول.'
          : confirmAction === 'reset-keys'
            ? 'ستُحذف كل مفاتيح الأمان ورموز الاسترداد لهذا المشرف، وتُغلق جلساته. سيصدر رابط تفعيل جديد.'
            : 'سيتم تعليق الحساب وتعطيل الدخول إلى أن تتم إعادة التفعيل.'
      }
      confirmLabel={confirmAction === 'reject' ? 'رفض' : confirmAction === 'reset-keys' ? 'إعادة الضبط' : 'إيقاف'}
      danger
      onCancel={() => setConfirmAction(null)}
      onConfirm={() => {
        if (confirmAction === 'reject') {
          onPatch(user.id, { status: 'REJECTED', loginEnabled: false });
        } else if (confirmAction === 'revoke') {
          onPatch(user.id, { status: 'SUSPENDED', loginEnabled: false });
        } else if (confirmAction === 'reset-keys') {
          onPatch(user.id, { action: 'reset-security' });
        }
        setConfirmAction(null);
      }}
    />
  );

  if (embedded) {
    return (
      <>
        <div className="upm-embedded" role="region" aria-label={`ملف ${name}`}>
          {panel}
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <div className={`upm-overlay${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`ملف ${name}`}>
        <button type="button" className="upm-backdrop" aria-label="إغلاق" onClick={dismiss} />
        {panel}
      </div>
      {confirmDialog}
    </>
  );
}