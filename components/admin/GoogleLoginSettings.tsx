'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save } from 'lucide-react';

function token(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('south_street_token') || '';
}

export default function GoogleLoginSettings() {
  const [clientId, setClientId] = useState('');
  const [savedId, setSavedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/google-auth', {
        headers: { Authorization: `Bearer ${token()}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذّر قراءة إعداد جوجل');
        return;
      }
      setClientId(data.googleClientId || '');
      setSavedId(data.googleClientId || '');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/google-auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ google_client_id: clientId.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'تعذّر الحفظ');
        return;
      }
      setSavedId(data.googleClientId || '');
      setMessage(data.message || 'تم الحفظ');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gset-wrap" dir="rtl">
      <section className="gset-card">
        <header className="gset-head">
          <span className="gset-icon">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h2>دخول حساب جوجل</h2>
            <p>الصق معرف عميل الويب (Web Client ID) من Google Cloud. هذا هو المفتاح الذي يفعّل زر «المتابعة بجوجل» في نافذة الدخول.</p>
          </div>
        </header>

        {savedId ? (
          <p className="gset-status is-on">
            <CheckCircle2 className="w-4 h-4" />
            الدخول بجوجل مفعّل
          </p>
        ) : (
          <p className="gset-status">غير مفعّل — الصق المعرف ثم احفظ</p>
        )}

        {error ? <p className="gset-error">{error}</p> : null}
        {message ? <p className="gset-ok">{message}</p> : null}

        <form className="gset-form" onSubmit={save}>
          <label htmlFor="google-client-id">معرف عميل جوجل (Client ID)</label>
          <input
            id="google-client-id"
            dir="ltr"
            type="text"
            value={clientId}
            disabled={loading || saving}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456789-xxxx.apps.googleusercontent.com"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="gset-hint">
            من Google Cloud Console → APIs &amp; Services → Credentials → OAuth 2.0 Client ID (Web application).
            أضف إلى Authorized JavaScript origins: موقعك على Vercel و <span dir="ltr">http://localhost:3000</span>.
          </p>
          <button type="submit" className="gset-save" disabled={loading || saving}>
            <Save className="w-4 h-4" />
            {saving ? 'جاري الحفظ…' : 'حفظ المفتاح'}
          </button>
        </form>
      </section>
    </div>
  );
}
