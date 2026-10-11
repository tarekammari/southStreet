'use client';

import { useState } from 'react';
import { BellRing, CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { jsonAuthHeaders } from '@/lib/api-client';
import { versionLabel } from '@/lib/connect/version';

type Check = { label: string; ok: boolean; hint?: string };

/** "حول التطبيق": version, what works on this phone, and a ringing test. */
export default function AboutSheet({
  onClose,
  live,
  serverPush,
  pushState,
  onEnablePush,
}: {
  onClose: () => void;
  live: boolean;
  serverPush: boolean;
  pushState: 'unknown' | 'on' | 'off' | 'unsupported';
  onEnablePush: () => Promise<void>;
}) {
  const [testing, setTesting] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');

  const checks: Check[] = [
    { label: 'الاتصال المباشر', ok: live, hint: 'الرسائل والمكالمات تصل فورًا. إن لم يعمل يُستعمل التحديث الدوري.' },
    { label: 'الرنين على الخادم', ok: serverPush, hint: 'مفاتيح الإشعارات (VAPID) غير مضافة على الخادم.' },
    {
      label: 'الإشعارات على هذا الجهاز',
      ok: pushState === 'on',
      hint: pushState === 'unsupported' ? 'هذا المتصفح لا يدعم الإشعارات. على iPhone: ثبّت التطبيق على الشاشة الرئيسية أولًا.' : 'اسمح بالإشعارات ليرنّ الهاتف والتطبيق مغلق.',
    },
  ];

  const test = async () => {
    setError('');
    setTesting('busy');
    try {
      const res = await fetch('/api/connect/push', { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify({ action: 'test' }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر الاختبار');
      setTesting('sent');
    } catch (e) {
      setError((e as Error).message);
      setTesting('idle');
    }
  };

  return (
    <div className="cn-sheet" role="dialog" aria-modal="true" aria-label="حول التطبيق" onClick={onClose}>
      <div className="cn-sheet-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <img src="/icons/connect-192.png" alt="" />
          <div>
            <h2>South Street Connect</h2>
            <small>الإصدار <bdi dir="ltr">{versionLabel()}</bdi></small>
          </div>
          <button type="button" className="cn-icon" onClick={onClose} aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </header>

        <ul className="cn-checks">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? 'is-ok' : 'is-bad'}>
              {c.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <span>
                <b>{c.label}</b>
                {!c.ok && c.hint ? <small>{c.hint}</small> : null}
              </span>
            </li>
          ))}
        </ul>

        {pushState === 'off' && serverPush ? (
          <button type="button" className="cn-sheet-btn" onClick={() => void onEnablePush()}>
            <BellRing className="w-5 h-5" /> السماح بالإشعارات
          </button>
        ) : null}

        <button type="button" className="cn-sheet-btn is-main" disabled={testing === 'busy' || pushState !== 'on' || !serverPush} onClick={() => void test()}>
          {testing === 'busy' ? <Loader2 className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />} اختبار الرنين والتطبيق مغلق
        </button>
        {testing === 'sent' ? <p className="cn-sheet-note">أغلق التطبيق الآن. بعد 5 ثوانٍ سيرنّ هاتفك كمكالمة واردة.</p> : null}
        {error ? <p className="cn-sheet-note is-error">{error}</p> : null}
      </div>
    </div>
  );
}
