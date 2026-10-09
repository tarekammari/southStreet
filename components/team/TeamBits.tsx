'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, ShieldAlert, X } from 'lucide-react';
import { initials, memberState, STATE_LABEL, type Member } from './teamModel';

const DEFAULT_PHOTO = '/images/persona.webp';

export function MemberAvatar({ member, size = 40 }: { member: Pick<Member, 'name' | 'photo' | 'isOnline'>; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = member.photo && member.photo !== DEFAULT_PHOTO && !failed ? member.photo : '';
  return (
    <span className="tm-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {src ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span>{initials(member.name)}</span>}
      {member.isOnline ? <i className="tm-avatar-dot" aria-label="متصل الآن" /> : null}
    </span>
  );
}

export function StateBadge({ member }: { member: Member }) {
  const state = memberState(member);
  return <span className={`tm-state is-${state}`}>{STATE_LABEL[state]}</span>;
}

export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="tm-copy">
      <span className="tm-copy-label">{label}</span>
      <code className={mono ? 'is-mono' : ''} dir="ltr">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          });
        }}
        aria-label={`نسخ ${label}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export type Secret = {
  title: string;
  name?: string;
  username?: string;
  password?: string;
  qrImage?: string;
  inviteUrl?: string;
  inviteMinutes?: number;
};

/** One-time display of new credentials: they are never shown again after closing. */
export function SecretSheet({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tm-modal-backdrop" role="dialog" aria-modal="true" aria-label={secret.title}>
      <div className="tm-modal tm-secret">
        <header className="tm-modal-head">
          <span className="tm-modal-icon is-gold"><KeyRound className="w-5 h-5" /></span>
          <div>
            <h3>{secret.title}</h3>
            {secret.name ? <p>{secret.name}</p> : null}
          </div>
          <button type="button" className="tm-icon-btn" onClick={onClose} aria-label="إغلاق"><X className="w-4 h-4" /></button>
        </header>
        <div className="tm-secret-body">
          {secret.username ? <CopyField label="اسم المستخدم" value={secret.username} /> : null}
          {secret.password ? <CopyField label="كلمة المرور" value={secret.password} /> : null}
          {secret.inviteUrl ? <CopyField label="رابط التفعيل" value={secret.inviteUrl} /> : null}
          {secret.qrImage ? (
            <div className="tm-qr">
              <img src={secret.qrImage} alt="رمز QR للدخول" />
              <span>رمز QR للدخول السريع</span>
            </div>
          ) : null}
          <p className="tm-secret-warn">
            <ShieldAlert className="w-4 h-4" />
            {secret.inviteUrl
              ? `أرسل الرابط للشخص المعني فقط. صالح لمدة ${Math.round((secret.inviteMinutes || 1440) / 60)} ساعة، ويُسجّل به مفتاح الأمان الخاص به.`
              : 'تظهر هذه البيانات مرة واحدة فقط. انسخها وسلّمها لصاحبها الآن.'}
          </p>
        </div>
        <footer className="tm-modal-foot">
          <button type="button" className="tm-btn is-primary" onClick={onClose}>تم، نسختها</button>
        </footer>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="tm-modal-backdrop" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="tm-modal tm-confirm">
        <h3>{title}</h3>
        <p>{body}</p>
        <footer className="tm-modal-foot">
          <button type="button" className="tm-btn" onClick={onCancel}>إلغاء</button>
          <button type="button" className={`tm-btn ${danger ? 'is-danger' : 'is-primary'}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
