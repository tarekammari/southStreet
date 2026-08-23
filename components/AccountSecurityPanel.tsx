'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, QrCode, ShieldCheck, Copy, Check, Eye, EyeOff } from 'lucide-react';

interface AccountInfo {
  username: string;
  email: string;
  roleName: string;
  hasPassword: boolean;
  hasQr: boolean;
}

export default function AccountSecurityPanel() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [qrPassword, setQrPassword] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [qrPayload, setQrPayload] = useState('');

  const headers = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') || '' : '';
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account/security', { headers: headers() });
      const data = await res.json();
      if (!res.ok) {
        setAccount(null);
        setError(data.error || 'سجل الدخول لإدارة أمان حسابك');
        return;
      }
      setAccount(data.account);
    } catch {
      setError('تعذر تحميل بيانات الأمان');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (nextPassword !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق');
      return;
    }
    setBusy('password');
    try {
      const res = await fetch('/api/account/security', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action: 'change-password',
          currentPassword,
          nextPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر تغيير كلمة المرور');
        return;
      }
      setMessage(data.message);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy('');
    }
  };

  const rotateQr = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy('qr');
    try {
      const res = await fetch('/api/account/security', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          action: 'rotate-qr',
          currentPassword: qrPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر استبدال رمز QR');
        return;
      }
      setMessage(data.message);
      setQrImage(data.qrImage || '');
      setQrPayload(data.qrPayload || '');
      setQrPassword('');
      setAccount(data.account);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">جاري تحميل أمان الحساب...</p>;
  }

  if (!account) {
    return (
      <div className="luxury-card p-6 space-y-2">
        <h2 className="text-lg font-bold font-cairo">أمان الحساب</h2>
        <p className="text-sm text-slate-600">{error || 'سجّل الدخول باسم المستخدم وكلمة المرور لإدارة حسابك.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="luxury-card p-6 space-y-3">
        <h2 className="text-lg font-bold font-cairo text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-main" />
          أمان الحساب
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          اسم المستخدم ثابت. غيّر كلمة المرور متى شئت، واستبدل رمز QR إذا فقدته — الرمز القديم يتوقف فوراً مثل تطبيقات البنوك.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-emerald-700">{message}</p>}

        <label className="block space-y-1 max-w-sm">
          <span className="text-xs font-bold text-slate-600">اسم المستخدم</span>
          <div className="flex gap-1">
            <input dir="ltr" readOnly className="luxury-form-input flex-1" value={account.username} />
            <button type="button" className="btn-pro-outline px-2" onClick={() => copy(account.username)}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </label>
      </div>

      <form onSubmit={changePassword} className="luxury-card p-6 space-y-3 max-w-lg">
        <h3 className="font-bold font-cairo text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> تغيير كلمة المرور
        </h3>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">كلمة المرور الحالية</span>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              dir="ltr"
              className="luxury-form-input w-full pl-10"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">كلمة المرور الجديدة (8 أحرف على الأقل)</span>
          <input
            type={showPw ? 'text' : 'password'}
            required
            minLength={8}
            dir="ltr"
            className="luxury-form-input w-full"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">تأكيد كلمة المرور الجديدة</span>
          <input
            type={showPw ? 'text' : 'password'}
            required
            dir="ltr"
            className="luxury-form-input w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy === 'password'} className="btn-pro-primary text-sm py-2.5 px-4 disabled:opacity-50">
          حفظ كلمة المرور
        </button>
      </form>

      <form onSubmit={rotateQr} className="luxury-card p-6 space-y-3 max-w-lg">
        <h3 className="font-bold font-cairo text-slate-900 flex items-center gap-2">
          <QrCode className="w-4 h-4" /> رمز QR للدخول
        </h3>
        <p className="text-xs text-slate-500">
          {account.hasQr
            ? 'الرمز الحالي يعمل للدخول السريع. استبداله يلغي الرمز القديم فوراً.'
            : 'لا يوجد رمز بعد. أدخل كلمة مرورك لإصدار رمز جديد.'}
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">أكد بكلمة المرور الحالية</span>
          <input
            type="password"
            required
            dir="ltr"
            className="luxury-form-input w-full"
            value={qrPassword}
            onChange={(e) => setQrPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy === 'qr'} className="btn-pro-outline text-sm py-2.5 px-4 disabled:opacity-50">
          {account.hasQr ? 'استبدال رمز QR' : 'إصدار رمز QR'}
        </button>
        {qrImage && (
          <div className="space-y-2">
            <img src={qrImage} alt="QR" className="w-40 h-40 rounded-xl border border-slate-200 bg-white" />
            <p className="text-[11px] text-amber-700">يُعرض مرة واحدة. احفظه في مكان آمن.</p>
            {qrPayload && (
              <button type="button" className="btn-pro-outline text-[12px] py-1.5 px-3" onClick={() => copy(qrPayload)}>
                نسخ حمولة الرمز
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
