'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  Calculator,
  Camera,
  Compass,
  Crown,
  Loader2,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { LANGUAGE_OPTIONS } from '@/lib/record-field-options';
import { MEMBER_TYPES, type MemberType, type Viewer } from './teamModel';
import { createAccount, createStaff, uploadPhoto } from './teamApi';
import type { Secret } from './TeamBits';

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  religious_guide: BookOpenCheck,
  women_guide: Users,
  field_guide: Compass,
  accountant: Calculator,
  staff: Briefcase,
  manager: Crown,
  pilgrim: UserRound,
};

type Form = {
  name: string;
  phone: string;
  email: string;
  username: string;
  title: string;
  specialization: string;
  experience_years: string;
  languages: string[];
  image: string;
};

const EMPTY: Form = { name: '', phone: '', email: '', username: '', title: '', specialization: '', experience_years: '', languages: ['العربية'], image: '' };

export default function AddMemberWizard({
  viewer,
  presetType,
  onClose,
  onCreated,
  onToast,
}: {
  viewer: Viewer;
  presetType?: string;
  onClose: () => void;
  onCreated: (secret: Secret) => void;
  onToast: (text: string, tone?: 'ok' | 'error') => void;
}) {
  const types = useMemo(() => MEMBER_TYPES.filter((t) => viewer.assignableRoles.includes(t.role)), [viewer.assignableRoles]);
  const preset = types.find((t) => t.id === presetType) || null;
  const [step, setStep] = useState<1 | 2 | 3>(preset ? 2 : 1);
  const [type, setType] = useState<MemberType | null>(preset);
  const [form, setForm] = useState<Form>({ ...EMPTY, title: preset?.defaultTitle || '' });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isStaffType = Boolean(type?.category);
  const isManager = type?.role === 'AGENCY_MANAGER';

  const choose = (t: MemberType) => {
    setType(t);
    setForm((f) => ({ ...f, title: f.title && type?.defaultTitle !== f.title ? f.title : t.defaultTitle }));
    setError('');
    setStep(2);
  };

  const detailsError = (): string => {
    if (form.name.trim().length < 3) return 'اكتب الاسم الكامل (3 أحرف على الأقل).';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'البريد الإلكتروني غير صحيح.';
    if (isManager && !form.email.trim()) return 'البريد الإلكتروني مطلوب لحساب المشرف.';
    if (!isStaffType && !form.email.trim() && !form.username.trim()) return 'اكتب البريد الإلكتروني أو اسم مستخدم.';
    return '';
  };

  const next = () => {
    const problem = detailsError();
    if (problem) return setError(problem);
    setError('');
    setStep(3);
  };

  const pickPhoto = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    const r = await uploadPhoto(file);
    setUploading(false);
    if (!r.ok) return onToast(r.error, 'error');
    setForm((f) => ({ ...f, image: r.data.url }));
  };

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    setError('');
    try {
      if (type.category) {
        const r = await createStaff({
          name: form.name.trim(),
          phone: form.phone.trim(),
          roleName: form.title.trim() || type.defaultTitle,
          specialization: form.specialization.trim(),
          experience_years: form.experience_years ? Number(form.experience_years) : 1,
          languages: form.languages.length ? form.languages : ['العربية'],
          category: type.category,
          status: 'متاح',
          email: form.email.trim(),
          username: form.username.trim(),
          ...(form.image ? { image: form.image } : {}),
        });
        if (!r.ok) return setError(r.error);
        onCreated({
          title: 'تمت إضافة العضو',
          name: form.name.trim(),
          username: r.data.credentials?.username,
          password: r.data.credentials?.password,
        });
        return;
      }
      const r = await createAccount({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        role: type.role,
      });
      if (!r.ok) return setError(r.error);
      onCreated({
        title: isManager ? 'تم إنشاء حساب المشرف' : 'تم إنشاء الحساب',
        name: form.name.trim(),
        username: r.data.credentials?.username || r.data.user?.username,
        password: r.data.credentials?.password,
        inviteUrl: r.data.invite?.url,
        inviteMinutes: r.data.invite?.expiresInMinutes,
      });
    } finally {
      setBusy(false);
    }
  };

  const Icon = type ? TYPE_ICON[type.id] || UserPlus : UserPlus;

  return (
    <div className="tm-modal-backdrop" role="dialog" aria-modal="true" aria-label="إضافة عضو">
      <div className="tm-modal tm-wizard">
        <header className="tm-modal-head">
          <span className="tm-modal-icon"><Icon className="w-5 h-5" /></span>
          <div>
            <h3>{type ? `إضافة ${type.label}` : 'إضافة عضو جديد'}</h3>
            <p>الخطوة {step} من 3 · {step === 1 ? 'نوع العضو' : step === 2 ? 'البيانات' : 'المراجعة'}</p>
          </div>
          <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="إغلاق"><X className="w-4 h-4" /></button>
        </header>
        <div className="tm-steps" aria-hidden>
          {[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'is-done' : ''} />)}
        </div>

        <div className="tm-wizard-body">
          {step === 1 ? (
            <div className="tm-type-grid">
              {types.map((t) => {
                const TIcon = TYPE_ICON[t.id] || UserRound;
                return (
                  <button key={t.id} type="button" className={`tm-type${type?.id === t.id ? ' is-on' : ''}`} onClick={() => choose(t)}>
                    <span className="tm-type-icon"><TIcon className="w-5 h-5" /></span>
                    <strong>{t.label}</strong>
                    <em>{t.hint}</em>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 2 && type ? (
            <form
              className="tm-form"
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              {isStaffType ? (
                <div className="tm-photo-pick">
                  <button type="button" className="tm-photo-drop" onClick={() => fileRef.current?.click()}>
                    {form.image ? <img src={form.image} alt="" /> : uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  </button>
                  <div>
                    <strong>الصورة الشخصية</strong>
                    <p>اختيارية · PNG أو JPG أو WebP</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </div>
              ) : null}
              <div className="tm-form-grid">
                <label className="tm-input is-wide">
                  <span>الاسم الكامل *</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} autoFocus />
                </label>
                <label className="tm-input">
                  <span>الهاتف</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" inputMode="tel" maxLength={40} placeholder="0555 00 00 00" />
                </label>
                <label className="tm-input">
                  <span>البريد الإلكتروني{isManager ? ' *' : ''}</span>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" type="email" maxLength={160} placeholder="name@example.com" />
                </label>
                {!isManager ? (
                  <label className="tm-input">
                    <span>اسم المستخدم (اختياري)</span>
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, '') })} dir="ltr" maxLength={60} />
                  </label>
                ) : null}
                {isStaffType ? (
                  <>
                    <label className="tm-input">
                      <span>المسمى الوظيفي</span>
                      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />
                    </label>
                    <label className="tm-input">
                      <span>سنوات الخبرة</span>
                      <input value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value.replace(/[^\d]/g, '') })} dir="ltr" inputMode="numeric" maxLength={2} />
                    </label>
                    <label className="tm-input is-wide">
                      <span>التخصص / المهام</span>
                      <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} maxLength={160} placeholder="مثال: تأطير مناسك العمرة للعائلات" />
                    </label>
                    <div className="tm-input is-wide">
                      <span>اللغات</span>
                      <div className="tm-chips is-pickable">
                        {LANGUAGE_OPTIONS.map((o) => {
                          const on = form.languages.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              className={`tm-chip${on ? ' is-on' : ''}`}
                              aria-pressed={on}
                              onClick={() => setForm((cur) => ({ ...cur, languages: cur.languages.includes(o.value) ? cur.languages.filter((x) => x !== o.value) : [...cur.languages, o.value] }))}
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
              <button type="submit" hidden />
            </form>
          ) : null}

          {step === 3 && type ? (
            <div className="tm-review">
              <dl className="tm-fields">
                <div className="tm-field"><dt>النوع</dt><dd>{type.label}</dd></div>
                <div className="tm-field"><dt>الاسم</dt><dd>{form.name}</dd></div>
                <div className="tm-field"><dt>الهاتف</dt><dd dir="ltr">{form.phone || '—'}</dd></div>
                <div className="tm-field"><dt>البريد</dt><dd dir="ltr">{form.email || '—'}</dd></div>
                {isStaffType ? <div className="tm-field"><dt>المسمى</dt><dd>{form.title || type.defaultTitle}</dd></div> : null}
                {isStaffType && form.languages.length ? <div className="tm-field"><dt>اللغات</dt><dd>{form.languages.join('، ')}</dd></div> : null}
              </dl>
              <div className="tm-method">
                <ShieldCheck className="w-5 h-5" />
                <div>
                  <strong>{isManager ? 'دخول بمفتاح أمان' : 'بيانات الدخول'}</strong>
                  <p>
                    {isManager
                      ? 'لا تُنشأ كلمة مرور: يصلك رابط تفعيل يرسله للمشرف ليسجّل مفتاح الأمان (Windows Hello أو USB). قد يُطلب منك لمس مفتاحك للتأكيد.'
                      : 'يُصدر النظام اسم مستخدم وكلمة مرور تظهر لك مرة واحدة بعد الإنشاء.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="tm-error" role="alert">{error}</p> : null}
        </div>

        <footer className="tm-modal-foot">
          {step > 1 ? (
            <button type="button" className="tm-btn" onClick={() => { setError(''); setStep((s) => (s === 3 ? 2 : 1)); }} disabled={busy}>
              <ArrowRight className="w-4 h-4" /> رجوع
            </button>
          ) : (
            <button type="button" className="tm-btn" onClick={onClose}>إلغاء</button>
          )}
          {step === 2 ? (
            <button type="button" className="tm-btn is-primary" onClick={next}>
              متابعة <ArrowLeft className="w-4 h-4" />
            </button>
          ) : null}
          {step === 3 ? (
            <button type="button" className="tm-btn is-primary" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} إنشاء
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
