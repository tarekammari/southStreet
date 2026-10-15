'use client';

/**
 * Android app, first start: ONE card, ONE button. "موافق" walks through every
 * system prompt by itself — notifications + microphone, background, full-screen
 * call screen — and closes with a check mark when the phone is ready to ring.
 * A step the user refused shows a small "open settings" button instead.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BatteryCharging, Bell, Check, Loader2, Mic, PhoneIncoming, Settings, Smartphone } from 'lucide-react';
import { androidSetupStatus, androidSetupStep, onAndroidSetupChange, type AndroidSetup as Status, type AndroidSetupStep } from '@/lib/connect/native-bridge';

const ROWS: { key: keyof Status; icon: typeof Bell; title: string; text: string; step: AndroidSetupStep; fix: AndroidSetupStep }[] = [
  { key: 'notifications', icon: Bell, title: 'الإشعارات', text: 'لتصلك الرسائل والمكالمات', step: 'permissions', fix: 'app' },
  { key: 'mic', icon: Mic, title: 'الميكروفون', text: 'للمكالمات والرسائل الصوتية', step: 'permissions', fix: 'app' },
  { key: 'battery', icon: BatteryCharging, title: 'العمل في الخلفية', text: 'ليرنّ الهاتف والتطبيق مغلق', step: 'battery', fix: 'battery' },
  { key: 'fullScreen', icon: Smartphone, title: 'شاشة المكالمة', text: 'تظهر المكالمة فوق قفل الشاشة', step: 'fullscreen', fix: 'fullscreen' },
];

const allOk = (s: Status | null) => Boolean(s && s.notifications && s.mic && s.battery && s.fullScreen);

/** Shown once per launch while something is missing; null in browsers and older apps. */
export default function AndroidSetup({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<Status | null>(() => androidSetupStatus());
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const tried = useRef(new Set<AndroidSetupStep>());

  /** Next missing step not tried yet in this run; none left → the run is over. */
  const next = useCallback(() => {
    const s = androidSetupStatus();
    setStatus(s);
    if (allOk(s)) {
      setRunning(false);
      setFinished(true);
      window.setTimeout(onDone, 1100);
      return;
    }
    const row = ROWS.find((r) => s && !s[r.key] && !tried.current.has(r.step));
    if (!row) return setRunning(false);
    tried.current.add(row.step);
    androidSetupStep(row.step);
  }, [onDone]);

  useEffect(
    () =>
      onAndroidSetupChange(() => {
        // Let Android settle (the activity resumes before the new state is visible).
        window.setTimeout(() => (running ? next() : setStatus(androidSetupStatus())), 350);
      }),
    [running, next]
  );

  if (!status || (allOk(status) && !finished)) return null;

  const start = () => {
    tried.current = new Set();
    setRunning(true);
    next();
  };
  const refused = ROWS.filter((r) => !status[r.key] && tried.current.has(r.step));

  return (
    <div className="cn-gate" role="dialog" aria-modal="true" aria-labelledby="cn-setup-title" dir="rtl">
      <div className="cn-gate-card">
        <span className="cn-gate-icon" aria-hidden>
          {finished ? <Check className="w-8 h-8" /> : <PhoneIncoming className="w-8 h-8" />}
          {finished ? null : <i />}
        </span>
        <h2 id="cn-setup-title">{finished ? 'كل شيء جاهز' : 'جهّز هاتفك للمكالمات'}</h2>
        <p>{finished ? 'سيرنّ هاتفك عند كل مكالمة، حتى والتطبيق مغلق.' : 'اضغط «موافق» ثم «سماح» في كل نافذة تظهر — مرة واحدة فقط.'}</p>

        <ul className="cn-setup">
          {ROWS.map((r) => {
            const ok = status[r.key];
            const Icon = r.icon;
            return (
              <li key={r.key} className={ok ? 'is-ok' : ''}>
                <span className="cn-setup-icon">{ok ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}</span>
                <span className="cn-setup-text"><b>{r.title}</b><small>{r.text}</small></span>
                {!ok && refused.includes(r) && !running ? (
                  <button type="button" className="cn-chip" onClick={() => androidSetupStep(r.fix)}><Settings className="w-4 h-4" /> فتح</button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {finished ? null : (
          <>
            <button type="button" className="cn-gate-main" disabled={running} onClick={start}>
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {running ? 'جارٍ الإعداد…' : refused.length ? 'إعادة المحاولة' : 'موافق — أكمل الإعداد'}
            </button>
            <button type="button" className="cn-gate-later" onClick={onDone}>لاحقاً</button>
          </>
        )}
      </div>
    </div>
  );
}
