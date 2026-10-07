'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileCheck, X, Upload, AlertTriangle, Clock, Eye, EyeOff } from 'lucide-react';
import GoogleContinueButton from '@/components/GoogleContinueButton';
import { markWelcomePending } from '@/components/WelcomeBanner';
import { enterSessionAndReload } from '@/lib/client-session';
import Image from 'next/image';
import SecurityKeyPrompt from '@/components/auth/SecurityKeyPrompt';

interface LoginModalProps {
  onClose: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

type Mode = 'password' | 'qr';
type Screen = 'login' | 'register';

export default function LoginModal({ onClose, onSelectRole }: LoginModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>('password');
  const [screen, setScreen] = useState<Screen>('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrHint, setQrHint] = useState('وجّه الكاميرا نحو رمز QR الخاص بالحساب');
  const [waiting, setWaiting] = useState(false);
  const [moreOptions, setMoreOptions] = useState(false);
  const [keyFlow, setKeyFlow] = useState<{ flowToken: string; options: any; name?: string } | null>(null);
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const finishLogin = useCallback((data: any) => {
    const next = data.waitingBooking || data.user?.redirect === '/book'
      ? '/book'
      : data.appointment
        ? '/portal?tab=program'
        : (data.user.redirect || (data.user.role === 'SUPER_ADMIN' || data.user.role === 'AGENCY_MANAGER' ? '/admin' : '/portal'));
    enterSessionAndReload(data.token, data.user, next);
  }, []);

  const handlePending = useCallback(() => {
    setWaiting(true);
    setError('');
    setInfo('');
    setScreen('login');
  }, []);

  const processLogin = useCallback(async (payload: {
    username?: string;
    password?: string;
    fileKey?: string;
    qrPayload?: string;
  }) => {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok && data.status !== 'REQUIRES_FILE_KEY' && data.status !== 'PENDING_APPROVAL') {
        setError(data.error || 'بيانات الدخول غير صحيحة');
        return;
      }

      if (data.status === 'REQUIRES_SECURITY_KEY') {
        setKeyFlow({ flowToken: data.flowToken, options: data.options, name: data.name });
        return;
      }

      if (data.status === 'ENROLLMENT_REQUIRED' && data.enrollUrl) {
        window.location.href = data.enrollUrl;
        return;
      }

      if (data.status === 'REQUIRES_FILE_KEY') {
        setStep(2);
        setMode('password');
        setInfo(data.message || 'ارفع ملف المفتاح الحالي لتفعيل مفتاح الأمان.');
        return;
      }

      if (data.status === 'PENDING_APPROVAL') {
        handlePending();
        return;
      }

      if (data.status === 'SUCCESS') finishLogin(data);
    } catch {
      setError('تعذر الاتصال بخادم الأمان. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  }, [finishLogin, handlePending]);

  const processGoogle = async (idToken: string) => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (data.status === 'PENDING_APPROVAL') {
        handlePending();
        return;
      }
      if (!res.ok) {
        setError(data.error || 'تعذر الدخول عبر جوجل');
        return;
      }
      if (data.status === 'SUCCESS') finishLogin(data);
    } catch {
      setError('تعذر الاتصال بخادم جوجل.');
    } finally {
      setLoading(false);
    }
  };

  const processRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          username: (regUsername || regEmail.split('@')[0] || regName).trim(),
          password: regPassword,
          email: regEmail,
          phone: regPhone,
          website_hp: '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر إنشاء الحساب');
        return;
      }
      if (data.status === 'PENDING_APPROVAL') {
        handlePending();
        return;
      }
      if (data.status === 'SUCCESS' && data.token) {
        markWelcomePending();
        finishLogin(data);
        return;
      }
      handlePending();
      if (data.username) setIdentifier(data.username);
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopCamera(), []);

  const googleBlock = () => (
    <div className="space-y-4">
      <GoogleContinueButton disabled={loading} onToken={processGoogle} />
      <div className="login-or">أو</div>
    </div>
  );

  useEffect(() => {
    if (mode !== 'qr' || screen !== 'login') {
      stopCamera();
      return;
    }

    let cancelled = false;
    const Detector = (window as any).BarcodeDetector;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!Detector) {
          setQrHint('المتصفح لا يدعم المسح المباشر — الصق محتوى الرمز أو ارفع صورة');
          return;
        }
        const detector = new Detector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes?.[0]?.rawValue;
            if (raw) {
              stopCamera();
              await processLogin({ qrPayload: raw });
              return;
            }
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setQrHint('تعذر فتح الكاميرا — الصق محتوى الرمز أو ارفع ملف QR');
      }
    };

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, screen, processLogin]);

  const handleFileRead = async (file: File) => {
    if (!file) return;
    const text = await file.text();
    setFileKey(text);
    setFileName(file.name);
    setError('');
    setInfo('تم قبول الملف. جاري الدخول...');
    await processLogin({ username: identifier, password, fileKey: text });
  };

  const handleQrFile = async (file: File) => {
    if (file.type.startsWith('text') || file.name.endsWith('.ssqr') || file.name.endsWith('.txt')) {
      const text = await file.text();
      processLogin({ qrPayload: text.trim() });
      return;
    }
    setError('ارفع ملف النص الصادر مع الرمز، أو امسح الرمز بالكاميرا.');
  };

  return (
    <div className="modal-overlay animate-fade-in flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md z-50 fixed inset-0 font-cairo" dir="rtl" onClick={onClose}>
      <div className="login-simple" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-simple-close" onClick={onClose} aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>

        <Image src="/images/south_street_logo_trans.png" alt="South Street" width={180} height={72} className="login-simple-logo" />
        <h3>{waiting ? 'طلبك قيد المراجعة' : keyFlow ? 'دخول الإدارة' : screen === 'register' ? 'إنشاء حساب' : 'تسجيل الدخول'}</h3>

        {keyFlow ? (
          <SecurityKeyPrompt
            flowToken={keyFlow.flowToken}
            options={keyFlow.options}
            name={keyFlow.name}
            onSuccess={(data) => finishLogin(data)}
            onCancel={() => {
              setKeyFlow(null);
              setPassword('');
            }}
          />
        ) : waiting ? (
          <div className="login-wait">
            <Clock className="w-10 h-10" />
            <p>فريق الوكالة يؤكد الطلب. سنخبرك عند الجاهزية.</p>
            <button type="button" className="login-simple-submit" onClick={onClose}>حسناً</button>
          </div>
        ) : (
          <>
            {error ? (
              <p className="login-simple-error" role="alert"><AlertTriangle className="w-4 h-4" /> {error}</p>
            ) : null}
            {info ? <p className="login-simple-info">{info}</p> : null}

            {screen === 'register' ? (
              <form onSubmit={processRegister} className="login-simple-form">
                {googleBlock()}
                <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" />
                <label>الاسم<input required value={regName} onChange={(e) => setRegName(e.target.value)} /></label>
                <label>الهاتف<input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} dir="ltr" /></label>
                <label>البريد<input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} dir="ltr" /></label>
                <label>كلمة المرور<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" dir="ltr" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} /></label>
                <button type="submit" disabled={loading} className="login-simple-submit">{loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button>
                <button type="button" className="login-simple-switch" onClick={() => { setScreen('login'); setError(''); }}>لديك حساب؟ دخول</button>
              </form>
            ) : mode === 'qr' ? (
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video relative">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                </div>
                <p className="text-[12px] text-slate-500 text-center">{qrHint}</p>
                <button type="button" className="login-simple-switch" onClick={() => setMode('password')}>العودة للدخول</button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  processLogin({ username: identifier, password, fileKey });
                }}
                className="login-simple-form"
              >
                {googleBlock()}
                <label>
                  البريد أو اسم المستخدم
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    dir="ltr"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={120}
                  />
                </label>
                <label>
                  كلمة المرور
                  <span className="login-simple-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      dir="ltr"
                      autoComplete="current-password"
                      maxLength={128}
                    />
                    <button
                      type="button"
                      className="login-simple-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </span>
                </label>
                {step === 2 ? (
                  <label className="login-key-drop">
                    ملف المفتاح
                    <input type="file" accept=".key,.pem,.txt" onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
                    {fileName ? <span><FileCheck className="w-4 h-4" /> {fileName}</span> : <span><Upload className="w-4 h-4" /> اختر الملف</span>}
                  </label>
                ) : null}
                <button type="submit" disabled={loading} className="login-simple-submit">
                  {loading ? 'جاري الدخول...' : 'دخول'}
                </button>
                <button type="button" className="login-simple-switch" onClick={() => { setScreen('register'); setMode('password'); setError(''); }}>
                  إنشاء حساب
                </button>
                <button type="button" className="login-simple-more" onClick={() => { setMoreOptions((v) => !v); setMode(moreOptions ? 'password' : 'qr'); }}>
                  {moreOptions ? 'إخفاء الخيارات' : 'خيارات أخرى'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
