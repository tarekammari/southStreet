'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  Ban,
  Camera,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Link2,
  Loader2,
  Monitor,
  Pencil,
  Phone,
  QrCode,
  RotateCcw,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { LOGIN_ROLE_LABELS, type LoginRole } from '@/lib/roles';
import { LANGUAGE_OPTIONS } from '@/lib/record-field-options';
import {
  CATEGORY_LABEL,
  MEMBER_TYPES,
  fullDate,
  memberState,
  relativeTime,
  roleLabel,
  roleTone,
  deviceLabel,
  type Member,
  type Viewer,
} from './teamModel';
import {
  deleteAccount,
  deleteStaff,
  issueCredentials,
  loadActivity,
  patchAccount,
  patchStaff,
  uploadPhoto,
  type Activity,
} from './teamApi';
import { ConfirmDialog, CopyField, MemberAvatar, StateBadge, type Secret } from './TeamBits';

type Tab = 'profile' | 'access' | 'activity';

type Draft = {
  name: string;
  phone: string;
  email: string;
  title: string;
  category: string;
  specialization: string;
  experience_years: string;
  languages: string[];
  image: string;
};

function draftOf(m: Member): Draft {
  return {
    name: m.name || '',
    phone: m.phone || '',
    email: m.email && !m.email.endsWith('@southstreet.dz') ? m.email : '',
    title: m.staff?.title || '',
    category: m.staff?.category || '',
    specialization: m.staff?.specialization || '',
    experience_years: m.staff?.experience_years != null ? String(m.staff.experience_years) : '',
    languages: m.staff?.languages || [],
    image: m.staff?.photo || '',
  };
}

export default function MemberDrawer({
  member,
  viewer,
  onClose,
  onChanged,
  onSecret,
  onToast,
}: {
  member: Member;
  viewer: Viewer;
  onClose: () => void;
  onChanged: () => void;
  onSecret: (secret: Secret) => void;
  onToast: (text: string, tone?: 'ok' | 'error') => void;
}) {
  const [tab, setTab] = useState<Tab>('profile');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(member));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; label: string; danger?: boolean; run: () => Promise<void> }>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityError, setActivityError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isSelf = viewer.id === member.id;
  const isTop = member.role === 'SUPER_ADMIN';
  const isStaff = Boolean(member.staffId && member.staff);
  const canManage = !isTop && !isSelf && (viewer.role === 'SUPER_ADMIN' || member.role !== 'AGENCY_MANAGER');
  const canEditProfile = canManage || isSelf;
  const state = memberState(member);

  // A different member, or fresh data for this one, resets the form.
  useEffect(() => {
    setDraft(draftOf(member));
    setEditing(false);
  }, [member]);

  useEffect(() => {
    setTab('profile');
    setActivity(null);
  }, [member.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirm) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirm]);

  useEffect(() => {
    if (tab !== 'activity' || activity) return;
    setActivityError('');
    void loadActivity(member.id).then((r) => (r.ok ? setActivity(r.data) : setActivityError(r.error)));
  }, [tab, activity, member.id]);

  /** Staff types this viewer may assign (a type decides the login role). */
  const staffTypes = useMemo(
    () => MEMBER_TYPES.filter((t) => t.category && (viewer.assignableRoles.includes(t.role) || t.category === member.staff?.category)),
    [viewer.assignableRoles, member.staff?.category]
  );

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      if (!draft.name.trim()) {
        onToast('الاسم مطلوب', 'error');
        return;
      }
      const original = draftOf(member);
      if (isStaff && member.staffId) {
        const r = await patchStaff(member.staffId, {
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          roleName: draft.title.trim(),
          category: draft.category,
          specialization: draft.specialization.trim(),
          experience_years: draft.experience_years === '' ? null : Number(draft.experience_years),
          languages: draft.languages,
          ...(draft.image !== original.image ? { image: draft.image } : {}),
        });
        if (!r.ok) return onToast(r.error, 'error');
        if (draft.email.trim() !== original.email) {
          const e = await patchAccount(member.id, { email: draft.email.trim() });
          if (!e.ok) return onToast(e.error, 'error');
        }
      } else {
        const r = await patchAccount(member.id, { name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim() });
        if (!r.ok) return onToast(r.error, 'error');
      }
      setEditing(false);
      onToast('تم حفظ التعديلات');
      onChanged();
    });

  const setStatus = (status: 'APPROVED' | 'SUSPENDED' | 'REJECTED', message: string) =>
    run(status, async () => {
      const r = await patchAccount(member.id, { status });
      if (!r.ok) return onToast(r.error, 'error');
      onToast(message);
      onChanged();
    });

  const changeRole = (role: LoginRole) =>
    run('role', async () => {
      const r = await patchAccount(member.id, { role });
      if (!r.ok) return onToast(r.error, 'error');
      if (r.data.invite?.url) {
        onSecret({ title: 'رابط تفعيل المشرف', name: member.name, inviteUrl: r.data.invite.url, inviteMinutes: r.data.invite.expiresInMinutes });
      }
      onToast(r.data.message || 'تم تغيير الدور');
      onChanged();
    });

  const credentials = (action: 'rotate-password' | 'rotate-qr') =>
    run(action, async () => {
      const r = await issueCredentials(member.id, action);
      if (!r.ok) return onToast(r.error, 'error');
      onSecret({
        title: action === 'rotate-password' ? 'كلمة مرور جديدة' : 'رمز QR جديد',
        name: member.name,
        username: r.data.account?.username || member.username,
        password: r.data.password,
        qrImage: r.data.qrImage,
      });
      onChanged();
    });

  const adminLink = (action: 'invite-link' | 'reset-security') =>
    run(action, async () => {
      const r = await patchAccount(member.id, { action });
      if (!r.ok) return onToast(r.error, 'error');
      if (r.data.invite?.url) {
        onSecret({
          title: action === 'reset-security' ? 'أُعيد ضبط المفاتيح — رابط تفعيل جديد' : 'رابط تفعيل المشرف',
          name: member.name,
          inviteUrl: r.data.invite.url,
          inviteMinutes: r.data.invite.expiresInMinutes,
        });
      }
      onChanged();
    });

  const remove = () =>
    run('delete', async () => {
      const r = isStaff && member.staffId ? await deleteStaff(member.staffId) : await deleteAccount(member.id);
      if (!r.ok) return onToast(r.error, 'error');
      onToast(r.data.message || 'تم الحذف');
      onClose();
      onChanged();
    });

  const pickPhoto = async (file?: File | null) => {
    if (!file) return;
    await run('photo', async () => {
      const r = await uploadPhoto(file);
      if (!r.ok) return onToast(r.error, 'error');
      setDraft((d) => ({ ...d, image: r.data.url }));
    });
  };

  const field = (label: string, value?: React.ReactNode, opts?: { ltr?: boolean; wide?: boolean }) => (
    <div className={`tm-field${opts?.wide ? ' is-wide' : ''}`}>
      <dt>{label}</dt>
      <dd dir={opts?.ltr ? 'ltr' : undefined}>{value || <span className="tm-empty-value">—</span>}</dd>
    </div>
  );

  return (
    <>
      <div className="tm-drawer-backdrop" onClick={onClose} />
      <aside className="tm-drawer" role="dialog" aria-modal="true" aria-label={member.name}>
        <header className="tm-drawer-head">
          <div className="tm-drawer-top">
            <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="إغلاق">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="tm-drawer-id">
            <div className="tm-drawer-photo">
              <MemberAvatar member={{ ...member, photo: editing && draft.image ? draft.image : member.photo }} size={72} />
              {editing && isStaff ? (
                <>
                  <button type="button" className="tm-photo-btn" onClick={() => fileRef.current?.click()} aria-label="تغيير الصورة">
                    {busy === 'photo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </>
              ) : null}
            </div>
            <div className="tm-drawer-names">
              <h2>{member.name}{isSelf ? <span className="tm-you">أنت</span> : null}</h2>
              <p>{member.staff?.title || roleLabel(member)}</p>
              <div className="tm-drawer-badges">
                <span className={`tm-role is-${roleTone(member.role)}`}>{roleLabel(member)}</span>
                <StateBadge member={member} />
                {member.isOnline ? <span className="tm-online">متصل الآن</span> : null}
              </div>
            </div>
          </div>
          <nav className="tm-drawer-tabs" role="tablist">
            {([
              ['profile', 'الملف', UserRound],
              ['access', 'الدخول والأمان', KeyRound],
              ['activity', 'النشاط', ActivityIcon],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="tm-drawer-body">
          {tab === 'profile' && !editing ? (
            <section className="tm-section">
              <div className="tm-section-head">
                <h3>المعلومات الشخصية</h3>
                {canEditProfile ? (
                  <button type="button" className="tm-btn is-small" onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5" /> تعديل
                  </button>
                ) : null}
              </div>
              <dl className="tm-fields">
                {field('الاسم الكامل', member.name)}
                {field('الهاتف', member.phone ? <a href={`tel:${member.phone}`} className="tm-link"><Phone className="w-3.5 h-3.5" />{member.phone}</a> : null, { ltr: true })}
                {field('البريد الإلكتروني', member.email && !member.email.endsWith('@southstreet.dz') ? member.email : null, { ltr: true })}
                {field('نوع العضو', roleLabel(member))}
                {isStaff ? (
                  <>
                    {field('المسمى الوظيفي', member.staff?.title)}
                    {field('سنوات الخبرة', member.staff?.experience_years != null ? `${member.staff.experience_years} سنوات` : null)}
                    {field('التخصص', member.staff?.specialization, { wide: true })}
                    {field(
                      'اللغات',
                      member.staff?.languages?.length ? (
                        <span className="tm-chips">{member.staff.languages.map((l) => <span key={l} className="tm-chip">{l}</span>)}</span>
                      ) : null,
                      { wide: true }
                    )}
                  </>
                ) : null}
                {field('تاريخ الانضمام', fullDate(member.createdAt))}
              </dl>
            </section>
          ) : null}

          {tab === 'profile' && editing ? (
            <form
              className="tm-section tm-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="tm-section-head"><h3>تعديل الملف</h3></div>
              <div className="tm-form-grid">
                <label className="tm-input is-wide">
                  <span>الاسم الكامل *</span>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} required />
                </label>
                <label className="tm-input">
                  <span>الهاتف</span>
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" inputMode="tel" maxLength={40} />
                </label>
                <label className="tm-input">
                  <span>البريد الإلكتروني</span>
                  <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} dir="ltr" type="email" maxLength={160} />
                </label>
                {isStaff ? (
                  <>
                    <label className="tm-input">
                      <span>نوع العضو</span>
                      <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} disabled={!canManage}>
                        {staffTypes.map((t) => <option key={t.id} value={t.category}>{t.label}</option>)}
                      </select>
                    </label>
                    <label className="tm-input">
                      <span>المسمى الوظيفي</span>
                      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} />
                    </label>
                    <label className="tm-input">
                      <span>سنوات الخبرة</span>
                      <input value={draft.experience_years} onChange={(e) => setDraft({ ...draft, experience_years: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" dir="ltr" maxLength={2} />
                    </label>
                    <label className="tm-input is-wide">
                      <span>التخصص / المهام</span>
                      <input value={draft.specialization} onChange={(e) => setDraft({ ...draft, specialization: e.target.value })} maxLength={160} />
                    </label>
                    <div className="tm-input is-wide">
                      <span>اللغات</span>
                      <div className="tm-chips is-pickable">
                        {LANGUAGE_OPTIONS.map((o) => {
                          const on = draft.languages.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              className={`tm-chip${on ? ' is-on' : ''}`}
                              aria-pressed={on}
                              onClick={() => setDraft((cur) => ({ ...cur, languages: cur.languages.includes(o.value) ? cur.languages.filter((x) => x !== o.value) : [...cur.languages, o.value] }))}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {isStaff && draft.category !== member.staff?.category ? (
                <p className="tm-note">تغيير نوع العضو يغيّر صلاحياته في البوابة إلى «{CATEGORY_LABEL[draft.category]}» ويُنهي جلساته المفتوحة.</p>
              ) : null}
              <footer className="tm-form-foot">
                <button type="button" className="tm-btn" onClick={() => { setDraft(draftOf(member)); setEditing(false); }}>إلغاء</button>
                <button type="submit" className="tm-btn is-primary" disabled={busy === 'save'}>
                  {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} حفظ التعديلات
                </button>
              </footer>
            </form>
          ) : null}

          {tab === 'access' ? (
            <>
              <section className="tm-section">
                <div className="tm-section-head"><h3>حالة الحساب</h3></div>
                <div className={`tm-status-card is-${state}`}>
                  <div>
                    <strong><StateBadge member={member} /></strong>
                    <p>
                      {state === 'active' && 'يمكنه الدخول إلى بوابته حسب دوره.'}
                      {state === 'pending' && 'طلب انضمام جديد ينتظر قرارك.'}
                      {state === 'suspended' && 'الدخول موقوف، وتبقى بياناته محفوظة.'}
                      {state === 'invited' && 'لم يُسجّل مفتاح الأمان بعد. أرسل له رابط التفعيل.'}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="tm-status-actions">
                      {state === 'pending' ? (
                        <>
                          <button type="button" className="tm-btn is-primary" disabled={!!busy} onClick={() => setStatus('APPROVED', 'تم قبول الحساب')}>
                            <CheckCircle2 className="w-4 h-4" /> قبول
                          </button>
                          <button type="button" className="tm-btn is-danger-soft" disabled={!!busy} onClick={() => setStatus('REJECTED', 'تم رفض الطلب')}>رفض</button>
                        </>
                      ) : state === 'suspended' ? (
                        <button type="button" className="tm-btn is-primary" disabled={!!busy} onClick={() => setStatus('APPROVED', 'أُعيد تفعيل الحساب')}>
                          <RotateCcw className="w-4 h-4" /> إعادة التفعيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tm-btn is-danger-soft"
                          disabled={!!busy}
                          onClick={() =>
                            setConfirm({
                              title: 'إيقاف الحساب؟',
                              body: `لن يتمكن ${member.name} من الدخول، وتُغلق جلساته المفتوحة فوراً. يمكنك إعادة تفعيله لاحقاً.`,
                              label: 'إيقاف الحساب',
                              danger: true,
                              run: () => setStatus('SUSPENDED', 'تم إيقاف الحساب'),
                            })
                          }
                        >
                          <Ban className="w-4 h-4" /> إيقاف الحساب
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="tm-section">
                <div className="tm-section-head"><h3>طريقة الدخول</h3></div>
                {member.username ? <CopyField label="اسم المستخدم" value={member.username} /> : null}
                {member.privileged ? (
                  <div className="tm-method">
                    <Fingerprint className="w-5 h-5" />
                    <div>
                      <strong>مفتاح أمان (Windows Hello / مفتاح USB)</strong>
                      <p>{member.securityKeys ? `${member.securityKeys} مفتاح مسجّل` : 'لا يوجد مفتاح مسجّل بعد'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="tm-method">
                    <KeyRound className="w-5 h-5" />
                    <div>
                      <strong>كلمة مرور أو رمز QR{member.googleLinked ? ' أو حساب Google' : ''}</strong>
                      <p>كلمات المرور لا تُحفظ بنص واضح: عند الحاجة أصدر كلمة جديدة.</p>
                    </div>
                  </div>
                )}

                {canManage ? (
                  <div className="tm-action-list">
                    {member.privileged ? (
                      viewer.role === 'SUPER_ADMIN' ? (
                        <>
                          <button type="button" className="tm-action" disabled={!!busy} onClick={() => adminLink('invite-link')}>
                            <Link2 className="w-4 h-4" />
                            <span><strong>رابط تفعيل</strong><em>يسجّل به المشرف مفتاح الأمان الخاص به</em></span>
                            {busy === 'invite-link' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          </button>
                          <button
                            type="button"
                            className="tm-action"
                            disabled={!!busy}
                            onClick={() =>
                              setConfirm({
                                title: 'إعادة ضبط مفاتيح الأمان؟',
                                body: 'تُحذف كل المفاتيح المسجّلة لهذا المشرف ويُصدر رابط تفعيل جديد. استعملها عند ضياع الجهاز.',
                                label: 'إعادة الضبط',
                                danger: true,
                                run: () => adminLink('reset-security'),
                              })
                            }
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span><strong>إعادة ضبط المفاتيح</strong><em>عند ضياع الجهاز أو تغييره</em></span>
                          </button>
                        </>
                      ) : null
                    ) : (
                      <>
                        <button type="button" className="tm-action" disabled={!!busy} onClick={() => credentials('rotate-password')}>
                          <KeyRound className="w-4 h-4" />
                          <span><strong>كلمة مرور جديدة</strong><em>تُعرض مرة واحدة وتُغلق الجلسات القديمة</em></span>
                          {busy === 'rotate-password' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        </button>
                        <button type="button" className="tm-action" disabled={!!busy} onClick={() => credentials('rotate-qr')}>
                          <QrCode className="w-4 h-4" />
                          <span><strong>رمز QR جديد</strong><em>للدخول السريع من الهاتف</em></span>
                          {busy === 'rotate-qr' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </section>

              {canManage && !isStaff ? (
                <section className="tm-section">
                  <div className="tm-section-head"><h3>الدور</h3></div>
                  <label className="tm-input">
                    <span>دور الحساب</span>
                    <select
                      value={member.role}
                      disabled={busy === 'role'}
                      onChange={(e) => {
                        const next = e.target.value as LoginRole;
                        setConfirm({
                          title: 'تغيير الدور؟',
                          body: `سيصبح ${member.name} «${LOGIN_ROLE_LABELS[next]}» وتُغلق جلساته المفتوحة.`,
                          label: 'تغيير الدور',
                          run: () => changeRole(next),
                        });
                      }}
                    >
                      {[member.role, ...viewer.assignableRoles.filter((r) => r !== member.role && (r === 'AGENCY_MANAGER' || r === 'PILGRIM_USER'))].map((r) => (
                        <option key={r} value={r}>{LOGIN_ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </label>
                </section>
              ) : null}

              {canManage ? (
                <section className="tm-section tm-danger-zone">
                  <div className="tm-section-head"><h3>منطقة الخطر</h3></div>
                  <button
                    type="button"
                    className="tm-btn is-danger"
                    disabled={!!busy}
                    onClick={() =>
                      setConfirm({
                        title: `حذف ${member.name}؟`,
                        body: isStaff
                          ? 'يُحذف ملف العضو ويُوقف حسابه نهائياً. لا يمكن حذف مرشد ما زال مرتبطاً ببرامج أو رواتب.'
                          : 'يُحذف الحساب نهائياً ولا يمكن التراجع.',
                        label: 'حذف نهائي',
                        danger: true,
                        run: remove,
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4" /> حذف العضو
                  </button>
                </section>
              ) : null}
            </>
          ) : null}

          {tab === 'activity' ? (
            <>
              <section className="tm-section">
                <div className="tm-section-head"><h3>آخر ظهور</h3></div>
                <dl className="tm-fields">
                  {field('آخر نشاط', member.isOnline ? 'متصل الآن' : relativeTime(member.lastActive))}
                  {field('آخر دخول', fullDate(member.lastLogin))}
                  {field('عنوان IP', member.displayIp && member.displayIp !== '—' ? member.displayIp : null, { ltr: true })}
                  {field('الجهاز', deviceLabel(member.userAgent))}
                </dl>
              </section>
              <section className="tm-section">
                <div className="tm-section-head"><h3>الأجهزة والسجل</h3></div>
                {activityError ? <p className="tm-muted">{activityError}</p> : null}
                {!activity && !activityError ? <p className="tm-muted"><Loader2 className="w-4 h-4 animate-spin inline" /> جاري التحميل…</p> : null}
                {activity ? (
                  <>
                    {activity.devices.length ? (
                      <ul className="tm-devices">
                        {activity.devices.slice(0, 6).map((d) => (
                          <li key={d.id}>
                            <Monitor className="w-4 h-4" />
                            <span><strong>{d.device || 'جهاز'}</strong><em dir="ltr">{d.ip}</em></span>
                            <time>{d.active ? 'نشط الآن' : relativeTime(d.lastSeen)}</time>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {activity.events.length ? (
                      <ol className="tm-timeline">
                        {activity.events.slice(0, 25).map((ev) => (
                          <li key={ev.id}>
                            <span className="tm-timeline-dot" />
                            <div>
                              <strong>{ev.title}</strong>
                              {ev.detail ? <p>{ev.detail}</p> : null}
                              <time>{fullDate(ev.at)}</time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="tm-muted">لا يوجد نشاط مسجّل بعد.</p>
                    )}
                  </>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </aside>

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const task = confirm.run;
            setConfirm(null);
            void task();
          }}
        />
      ) : null}
    </>
  );
}
