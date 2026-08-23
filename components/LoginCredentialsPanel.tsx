'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, QrCode, RefreshCw, Copy, Check, Download } from 'lucide-react';
import { LOGIN_ROLE_OPTIONS, LOGIN_ROLE_LABELS, LoginRole } from '@/lib/roles';

interface AccountInfo {
  userId: string;
  staffId?: string;
  name: string;
  username: string;
  email: string;
  role: LoginRole;
  roleName: string;
  loginEnabled: boolean;
  hasPassword: boolean;
  hasQr: boolean;
}

export default function LoginCredentialsPanel({
  tableName,
  recordId,
  personName,
}: {
  tableName: string;
  recordId: string;
  personName?: string;
}) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [password, setPassword] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  const query = tableName === 'morshids' ? `staffId=${encodeURIComponent(recordId)}` : `userId=${encodeURIComponent(recordId)}`;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/credentials?${query}`);
      const data = await res.json();
      if (!res.ok) {
        setAccount(null);
        setError(data.error || '');
      } else {
        setAccount(data.account || null);
      }
    } catch {
      setError('تعذر تحميل بيانات الدخول');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setPassword('');
    setQrPayload('');
    setQrImage('');
  }, [recordId, tableName]);

  const post = async (action: string, extra?: Record<string, string>) => {
    setBusy(action);
    setError('');
    try {
      const body: Record<string, string> = {
        action,
        ...(tableName === 'morshids' ? { staffId: recordId } : { userId: recordId }),
        ...extra,
      };
      if (personName) body.name = personName;
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل التحديث');
        return;
      }
      setAccount(data.account);
      if (data.password) setPassword(data.password);
      if (data.qrPayload) setQrPayload(data.qrPayload);
      if (data.qrImage) setQrImage(data.qrImage);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy('');
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {}
  };

  const downloadQr = () => {
    if (!qrPayload) return;
    const blob = new Blob([qrPayload], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${account?.username || 'southstreet'}.ssqr`;
    a.click();
  };

  return (
    <section className="record-big-more mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          حساب الدخول حسب الدور
        </h4>
        {account && (
          <span className="text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 rounded-full px-2 py-0.5">
            {LOGIN_ROLE_LABELS[account.role] || account.roleName}
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-slate-500">جاري تحميل بيانات الدخول المشفّرة...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {!loading && !account && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            تُنشأ بيانات الدخول مرة واحدة. تظهر كلمة المرور وQR هنا مرة واحدة، ثم يغيّرهما صاحب الحساب من ملفه.
          </p>
          <button
            type="button"
            onClick={() => post('issue')}
            disabled={busy === 'issue'}
            className="btn-pro-primary text-[13px] py-1.5 px-3 disabled:opacity-50"
          >
            إنشاء اسم مستخدم وكلمة مرور وQR
          </button>
        </div>
      )}

      {account && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="block space-y-1">
            <span className="font-bold text-slate-600">اسم المستخدم</span>
            <div className="flex gap-1">
              <input
                dir="ltr"
                className="luxury-form-input flex-1"
                defaultValue={account.username}
                key={account.username}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== account.username) post('set-username', { username: v });
                }}
              />
              <button type="button" className="btn-pro-outline px-2" onClick={() => copy('user', account.username)}>
                {copied === 'user' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="font-bold text-slate-600">الدور وصلاحيات البوابة</span>
            <select
              className="luxury-form-input record-big-select"
              value={account.role}
              onChange={(e) => post('set-role', { role: e.target.value })}
            >
              {LOGIN_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <span className="font-bold text-slate-600">كلمة المرور</span>
            <p className="text-slate-500">لا تُحفظ بالنص — تُعرض مرة واحدة عند الإصدار.</p>
            {password && (
              <div className="flex gap-1">
                <input dir="ltr" readOnly className="luxury-form-input flex-1 font-mono" value={password} />
                <button type="button" className="btn-pro-outline px-2" onClick={() => copy('pw', password)}>
                  {copied === 'pw' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={busy === 'rotate-password'}
              onClick={() => post('rotate-password')}
              className="btn-pro-outline text-[12px] py-1.5 px-3 inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> إصدار كلمة مرور جديدة
            </button>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-slate-600 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> رمز QR للدخول</span>
            {qrImage ? (
              <img src={qrImage} alt="QR" className="w-36 h-36 rounded-xl border border-white shadow-sm bg-white" />
            ) : (
              <p className="text-slate-500">{account.hasQr ? 'الرمز صادر. أعد الإصدار لعرضه هنا.' : 'لم يُصدر بعد.'}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy === 'rotate-qr'}
                onClick={() => post('rotate-qr')}
                className="btn-pro-outline text-[12px] py-1.5 px-3 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> إصدار / عرض QR
              </button>
              {qrPayload && (
                <button type="button" onClick={downloadQr} className="btn-pro-outline text-[12px] py-1.5 px-3 inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> تنزيل .ssqr
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
