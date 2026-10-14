'use client';

import { BellRing, Loader2, PhoneIncoming, Settings } from 'lucide-react';
import { useState } from 'react';

/**
 * Full-screen step shown until call notifications work on this device: without
 * them a closed (or minimised) app cannot ring. "Later" hides it for this
 * launch only; it comes back next time the app opens.
 */
export default function NotifyGate({
  denied,
  failed,
  onEnable,
  onLater,
}: {
  denied: boolean;
  failed: boolean;
  onEnable: () => Promise<void>;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const windows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);

  return (
    <div className="cn-gate" role="dialog" aria-modal="true" aria-labelledby="cn-gate-title" dir="rtl">
      <div className="cn-gate-card">
        <span className="cn-gate-icon" aria-hidden>
          <PhoneIncoming className="w-8 h-8" />
          <i />
        </span>
        <h2 id="cn-gate-title">فعّل رنين المكالمات</h2>
        <p>
          ليرنّ {windows ? 'الحاسوب' : 'الهاتف'} عند اتصال فريق الوكالة أو مرشدك — حتى والتطبيق مغلق — اسمح لـ Connect بإرسال الإشعارات.
        </p>

        {denied ? (
          <div className="cn-gate-steps">
            <b><Settings className="w-4 h-4" aria-hidden /> الإشعارات محظورة لهذا التطبيق</b>
            {windows ? (
              <ol>
                <li>اضغط على رمز ⋮ أو 🔒 في أعلى نافذة التطبيق.</li>
                <li>اختر «الأذونات» أو «إعدادات الموقع» ثم اجعل «الإشعارات» على «سماح».</li>
                <li>في إعدادات ويندوز ← النظام ← الإشعارات: تأكد أن Chrome / Edge مسموح له.</li>
              </ol>
            ) : (
              <ol>
                <li>اضغط مطولاً على أيقونة Connect ← «معلومات التطبيق».</li>
                <li>اختر «الإشعارات» وفعّلها، وفعّل «الصوت» و«الظهور على الشاشة».</li>
                <li>عد إلى التطبيق واضغط «تحقق مرة أخرى».</li>
              </ol>
            )}
          </div>
        ) : null}

        {failed && !denied ? <p className="cn-gate-error">تعذّر التسجيل لدى الخادم. تأكد من الاتصال ثم أعد المحاولة.</p> : null}

        <button
          type="button"
          className="cn-gate-main"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onEnable();
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />}
          {denied ? 'تحقق مرة أخرى' : 'السماح بالإشعارات'}
        </button>
        <button type="button" className="cn-gate-later" onClick={onLater}>لاحقاً</button>
      </div>
    </div>
  );
}
