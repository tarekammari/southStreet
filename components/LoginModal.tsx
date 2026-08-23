'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, FileCheck, X, Upload, AlertTriangle, QrCode, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  onClose: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

type Mode = 'password' | 'qr';
type Screen = 'login' | 'register';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46c-.28 1.5-1.12 2.77-2.39 3.63v3.02h3.87c2.26-2.08 3.55-5.14 3.55-8.68z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3.02c-1.08.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.27v3.12C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.55.38-2.26V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l3.98-3.12z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l3.98 3.12C6.2 6.87 8.86 4.75 12 4.75z" />
    </svg>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

export default function LoginModal({ onClose, onSelectRole }: LoginModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
  const [googleClientId, setGoogleClientId] = useState('');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const finishLogin = (data: any) => {
    localStorage.setItem('south_street_token', data.token);
    localStorage.setItem('south_street_user', JSON.stringify(data.user));
    if (onSelectRole) onSelectRole(data.user.role, data.user.name);
    router.push(data.user.redirect || (data.user.role === 'SUPER_ADMIN' || data.user.role === 'AGENCY_MANAGER' ? '/admin' : '/portal'));
    onClose();
  };

  const handlePending = (message?: string) => {
    setInfo(message || 'تم استلام طلبك. انتظر موافقة الإدارة وتحديد صلاحيتك ثم سجّل الدخول.');
    setError('');
    setScreen('login');
  };

  const processLogin = async (payload: {
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

      if (data.status === 'REQUIRES_FILE_KEY') {
        setStep(2);
        setMode('password');
        return;
      }

      if (data.status === 'PENDING_APPROVAL') {
        handlePending(data.message);
        return;
      }

      if (data.status === 'SUCCESS') finishLogin(data);
    } catch {
      setError('تعذر الاتصال بخادم الأمان. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

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
        handlePending(data.message);
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
          username: regUsername,
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
      handlePending(data.message);
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

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => setGoogleClientId(d.googleClientId || ''))
      .catch(() => setGoogleClientId(''));
  }, []);

  useEffect(() => {
    if (!googleClientId) return;

    const paint = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return false;
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) processGoogle(resp.credential);
        },
        ux_mode: 'popup',
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 336,
        text: 'continue_with',
        locale: 'ar',
      });
      return true;
    };

    let tries = 0;
    const waitForHost = () => {
      if (paint()) return;
      if (tries++ > 25) return;
      window.setTimeout(waitForHost, 80);
    };

    if (window.google?.accounts?.id) {
      waitForHost();
      return;
    }
    if (document.getElementById('google-gis')) {
      const t = window.setInterval(() => {
        if (window.google?.accounts?.id) {
          window.clearInterval(t);
          waitForHost();
        }
      }, 200);
      return () => window.clearInterval(t);
    }
    const script = document.createElement('script');
    script.id = 'google-gis';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = waitForHost;
    document.head.appendChild(script);
  }, [googleClientId, screen, mode]);

  const startGoogle = () => {
    setError('');
    setInfo('');
    if (!googleClientId) {
      setError('الدخول بجوجل غير مفعّل بعد. من لوحة الإدارة ← الحسابات الصق معرف عميل جوجل ثم أعد فتح نافذة الدخول.');
      return;
    }
    if (!window.google?.accounts?.id) {
      setError('جاري تحميل جوجل… انتظر ثانية ثم أعد المحاولة.');
      return;
    }
    const nativeBtn = googleBtnRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
    if (nativeBtn) {
      nativeBtn.click();
      return;
    }
    window.google.accounts.id.prompt();
  };

  const googleBlock = (label: string) => (
    <div className="space-y-3">
      {googleClientId ? (
        <div className="flex justify-center min-h-[44px]" ref={googleBtnRef} />
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={startGoogle}
          className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 text-xs shadow-sm transition"
        >
          <GoogleMark />
          {label}
        </button>
      )}
      <p className="text-[11px] text-slate-500 text-center leading-relaxed">
        حساب جوجل يكون من هذا الزر فقط — كتابة البريد في النموذج ليست دخولاً بجوجل.
      </p>
      <div className="relative text-center text-[11px] text-slate-400 font-bold">
        <span className="bg-white px-2 relative z-10">أو بالاسم وكلمة المرور</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
      </div>
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
  }, [mode, screen]);

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
    <div className="modal-overlay animate-fade-in flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md z-50 fixed inset-0 font-cairo" dir="rtl" onClick={onClose}>
      <div
        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
        className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 w-full max-w-3xl shadow-2xl text-right text-slate-900 relative transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ backgroundColor: '#f1f5f9' }}
          className="absolute top-5 left-5 text-slate-500 hover:text-slate-900 p-2 rounded-2xl border border-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-l border-slate-200">
            <img
              src="/images/south_street_logo_trans.png"
              alt="South Street Agency"
              className="h-24 sm:h-28 w-auto object-contain mb-4 transition-transform hover:scale-105"
            />
            <h3 className="text-2xl font-black text-slate-900">بوابة ساوث ستريت</h3>
            <p className="text-xs text-slate-500 mt-2 font-bold leading-relaxed">
              طريقتان: إنشاء حساب باسم مستخدم وكلمة مرور، أو المتابعة بحساب جوجل. بعد موافقة الإدارة وتحديد الصلاحية يمكنك الدخول.
            </p>
            <div
              style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>AES-256 + موافقة الإدارة</span>
            </div>
          </div>

          <div className="md:col-span-7 space-y-5">
            {error && (
              <div
                style={{ backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }}
                className="text-xs p-3.5 rounded-2xl border flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div
                style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                className="text-xs p-3.5 rounded-2xl border font-bold"
              >
                {info}
              </div>
            )}

            <div className="flex rounded-2xl border border-slate-200 p-1 bg-slate-50 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setScreen('login'); setError(''); }}
                className={`flex-1 py-2 rounded-xl ${screen === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                دخول
              </button>
              <button
                type="button"
                onClick={() => { setScreen('register'); setMode('password'); setError(''); }}
                className={`flex-1 py-2 rounded-xl ${screen === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                إنشاء حساب
              </button>
            </div>

            {screen === 'register' ? (
              <form onSubmit={processRegister} className="space-y-3">
                {googleBlock('إنشاء بحساب Google')}
                <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" className="hidden" />
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">الاسم الكامل</label>
                  <input required value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50" placeholder="عبد القادر الوهراني" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">اسم المستخدم</label>
                  <input required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} dir="ltr" className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50" placeholder="abdelkader" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">البريد الإلكتروني (اختياري)</label>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} dir="ltr" className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50" placeholder="you@email.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">كلمة المرور (8 أحرف على الأقل)</label>
                  <input type="password" required minLength={8} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">الهاتف (اختياري)</label>
                  <input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} dir="ltr" className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50" placeholder="05xxxxxxxx" />
                </div>
                <button type="submit" disabled={loading} style={{ backgroundColor: '#059669' }} className="w-full hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-xs">
                  {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب وانتظار الموافقة'}
                </button>
                <p className="text-[11px] text-slate-400 text-center">لن تتمكن من الدخول حتى يوافق المدير ويحدد صلاحيتك وخيارات البوابة.</p>
              </form>
            ) : (
              <>
                <div className="flex rounded-2xl border border-slate-200 p-1 bg-slate-50 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMode('password')}
                    className={`flex-1 py-2 rounded-xl ${mode === 'password' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    اسم المستخدم
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('qr')}
                    className={`flex-1 py-2 rounded-xl ${mode === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    رمز QR
                  </button>
                </div>

                {mode === 'qr' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video relative">
                      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-6 border-2 border-emerald-400/70 rounded-xl pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-slate-500 text-center">{qrHint}</p>
                    <input
                      type="text"
                      placeholder="أو الصق محتوى رمز QR هنا"
                      dir="ltr"
                      className="w-full rounded-2xl px-4 py-3 text-xs border border-slate-200 bg-slate-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') processLogin({ qrPayload: (e.target as HTMLInputElement).value });
                      }}
                    />
                    <label className="block text-center text-[11px] text-emerald-700 font-bold cursor-pointer">
                      رفع ملف الرمز
                      <input type="file" accept=".ssqr,.txt,.key,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleQrFile(e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      processLogin({ username: identifier, password, fileKey });
                    }}
                    className="space-y-4"
                  >
                    {googleBlock('الدخول بحساب Google')}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">اسم المستخدم أو البريد</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="اسم المستخدم الذي أنشأته"
                          dir="ltr"
                          style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
                          className="w-full rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm border"
                        />
                        <UserRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">كلمة المرور</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
                          className="w-full rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm border"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    {step === 2 && (
                      <div className="animate-fade-in space-y-2">
                        <label className="block text-xs font-bold text-emerald-800">
                          أرفق ملف المفتاح (.key) لتأكيد دخول الإدارة:
                        </label>
                        <div
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) handleFileRead(file);
                          }}
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                          style={{
                            backgroundColor: isDragging ? '#ecfdf5' : fileName ? '#f0fdf4' : '#f8fafc',
                            borderColor: isDragging || fileName ? '#10b981' : '#cbd5e1'
                          }}
                          className="border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer relative"
                        >
                          <input
                            type="file"
                            accept=".key,.pem,.txt"
                            onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                            <Upload className={`w-8 h-8 ${fileName ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {fileName ? (
                              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 justify-center">
                                <FileCheck className="w-4 h-4 text-emerald-600" /> {fileName}
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-slate-800">أسقط ملف southstreet_admin.key هنا</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      style={{ backgroundColor: '#059669' }}
                      className="w-full hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      {loading ? 'جاري التحقق والدخول...' : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          {step === 2 ? 'تم رفع الملف — جاري الدخول تلقائياً' : 'تسجيل الدخول'}
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                      <QrCode className="w-3.5 h-3.5" /> يمكن لكل دور الدخول برمز QR بعد الموافقة
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
