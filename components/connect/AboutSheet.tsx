'use client';

import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Download, EyeOff, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { relayOnly, saveRelayOnly } from '@/lib/connect/device-prefs';
import { jsonAuthHeaders } from '@/lib/api-client';
import { versionLabel } from '@/lib/connect/version';
import RingtonePicker from './RingtonePicker';
import { checkAppUpdate, downloadNewApp, nativePlatform, nativeVersion, onUpdateProgress, type UpdateCheck } from '@/lib/connect/native-bridge';

const APP_VERSION = process.env.APP_VERSION || '';

const UPDATE_NOTE: Record<UpdateCheck['state'], string> = {
  latest: 'لديك أحدث إصدار ✓',
  ready: 'تحديث جديد جاهز — وافق على «تحديث الآن» ثم «تثبيت»',
  busy: 'جارٍ البحث عن تحديث…',
  error: 'تعذّر التحقق الآن — تأكد من الاتصال وحاول مرة أخرى',
  'old-app': 'هذا الإصدار لا يتحدّث وحده — نزّل الإصدار الجديد مرة واحدة',
  'web-ready': 'نسخة جديدة متوفرة — جارٍ التحديث…',
};

type Check = { label: string; ok: boolean; hint?: string };

/** "حول التطبيق": versions, check for updates, the ringtone, what works on this device, and a ringing test. */
export default function AboutSheet({
  onClose,
  busy,
  relay,
  live,
  serverPush,
  pushState,
  onEnablePush,
  onApplyWebUpdate,
}: {
  onClose: () => void;
  /** A call is ringing or in progress (no ringtone previews over it). */
  busy: boolean;
  /** The call relay (TURN) is set up on the server. */
  relay: boolean;
  live: boolean;
  serverPush: boolean;
  pushState: 'unknown' | 'on' | 'off' | 'unsupported';
  onEnablePush: () => Promise<void>;
  /** Reload onto the newer web build (never during a call). */
  onApplyWebUpdate: () => void;
}) {
  const [testing, setTesting] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateCheck | null>(null);
  const [hideIp, setHideIp] = useState(false);
  useEffect(() => setHideIp(relayOnly()), []);
  // Windows: the new version downloading in the background (%).
  const [progress, setProgress] = useState<{ version: string; pct: number } | null>(null);
  useEffect(() => onUpdateProgress((p) => setProgress(p.pct >= 100 ? null : p)), []);
  const platform = nativePlatform();
  const shell = nativeVersion();
  const appLabel = platform ? `${platform === 'android' ? 'أندرويد' : 'ويندوز'} ${shell || 'قديم'}` : 'تطبيق الويب';

  const checkUpdates = async () => {
    setChecking(true);
    setUpdate(null);
    const r = await checkAppUpdate(APP_VERSION);
    setUpdate(r);
    setChecking(false);
    if (r.state === 'web-ready') window.setTimeout(onApplyWebUpdate, 900);
  };

  const checks: Check[] = [
    { label: 'الاتصال المباشر', ok: live, hint: 'الرسائل والمكالمات تصل فورًا. إن لم يعمل يُستعمل التحديث الدوري.' },
    { label: 'الرنين على الخادم', ok: serverPush, hint: 'مفاتيح الإشعارات (VAPID) غير مضافة على الخادم.' },
    { label: 'خادم وصل المكالمات', ok: relay, hint: 'بدونه قد لا تتصل المكالمات بين شبكتي هاتف (4G).' },
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

        <dl className="cn-versions">
          <div><dt>التطبيق</dt><dd><bdi dir="ltr">{appLabel}</bdi></dd></div>
          <div><dt>الخدمة</dt><dd><bdi dir="ltr">{versionLabel()}</bdi></dd></div>
        </dl>

        <button type="button" className="cn-sheet-btn" disabled={checking} onClick={() => void checkUpdates()}>
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />} التحقق من التحديثات
        </button>
        {progress ? (
          <div className="cn-update-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct} aria-label="تنزيل التحديث">
            <span>جارٍ تنزيل الإصدار <bdi dir="ltr">{progress.version}</bdi>… <bdi dir="ltr">{progress.pct}%</bdi></span>
            <i style={{ width: `${progress.pct}%` }} />
          </div>
        ) : null}
        {update ? (
          <p className={`cn-sheet-note${update.state === 'error' || update.state === 'old-app' ? ' is-error' : ''}`}>
            {UPDATE_NOTE[update.state]}
            {update.version && update.state !== 'latest' ? <> · <bdi dir="ltr">{update.version}</bdi></> : null}
          </p>
        ) : null}
        {update?.state === 'old-app' ? (
          <button type="button" className="cn-sheet-btn is-main" onClick={() => void downloadNewApp()}>
            <Download className="w-5 h-5" /> تنزيل الإصدار الجديد
          </button>
        ) : null}

        <RingtonePicker busy={busy} />

        {relay ? (
          <label className="cn-switch">
            <EyeOff className="w-5 h-5" />
            <span>
              <b>إخفاء عنواني في المكالمات</b>
              <small>تمرّ المكالمات عبر خادم الوصل فقط، فلا يرى الطرف الآخر عنوان IP جهازك. الصوت يبقى مشفّرًا بين الهاتفين.</small>
            </span>
            <input
              type="checkbox"
              checked={hideIp}
              onChange={(e) => {
                setHideIp(e.target.checked);
                saveRelayOnly(e.target.checked);
              }}
            />
          </label>
        ) : null}

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
