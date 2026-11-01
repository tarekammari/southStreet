'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import './owner-setup.css';

/** Super Admin / Admin: the devices signed in to your account, and "sign out everywhere else". */

type Row = { id: string; device: string; mobile: boolean; ip: string; loginTime: string | null; lastActive: string | null; current: boolean };

function ago(value: string | null): string {
  const t = value ? Date.parse(value) : NaN;
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 2) return 'نشط الآن';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  return `قبل ${hours} ساعة`;
}

export default function DevicesPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/account/sessions', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر تحميل الأجهزة');
      setRows(data.sessions || []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOutOthers = async () => {
    setBusy(true);
    setError('');
    setFlash('');
    try {
      const res = await adminFetch('/api/account/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signout-others' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر تسجيل الخروج');
      setFlash('سُجّل الخروج من كل الأجهزة الأخرى. هذا الجهاز بقي متصلاً.');
      await load();
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const others = (rows || []).filter((r) => !r.current).length;

  return (
    <section className="odev" dir="rtl" aria-labelledby="odev-title">
      <header className="odev-head">
        <span className="odev-icon"><ShieldCheck className="w-5 h-5" /></span>
        <div>
          <h2 id="odev-title">الأجهزة المتصلة بحسابك</h2>
          <p>كل دخول جديد يصلك تنبيهاً على هاتفك. إن رأيت جهازاً لا تعرفه فسجّل الخروج منه فوراً.</p>
        </div>
        <button type="button" className="odev-refresh" onClick={() => void load()} aria-label="تحديث"><RefreshCw className="w-4 h-4" /></button>
      </header>

      {error ? <p className="odev-error" role="alert">{error}</p> : null}
      {flash ? <p className="odev-flash" role="status">{flash}</p> : null}

      {rows === null ? (
        <p className="odev-muted"><Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل…</p>
      ) : (
        <ul className="odev-list">
          {rows.map((r) => (
            <li key={r.id} className={r.current ? 'is-current' : ''}>
              <span className="odev-device">{r.mobile ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}</span>
              <span className="odev-copy">
                <strong>{r.device}{r.current ? <em>هذا الجهاز</em> : null}</strong>
                <span dir="ltr">{r.ip}</span>
                <span>{ago(r.lastActive)}</span>
              </span>
            </li>
          ))}
          {!rows.length ? <li className="odev-muted">لا توجد أجهزة نشطة.</li> : null}
        </ul>
      )}

      <button type="button" className="odev-signout" onClick={() => void signOutOthers()} disabled={busy || !rows}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        تسجيل الخروج من كل الأجهزة الأخرى{others ? ` (${others})` : ''}
      </button>
      <p className="odev-muted">يشمل الموقع وتطبيق Connect. يُطلب منك لمس البصمة للتأكيد.</p>
    </section>
  );
}
