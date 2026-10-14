'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SESSION_MARKER } from '@/lib/session-token';
import UserAccessDashboard from '@/components/admin/UserAccessDashboard';
import { logoutAndReload } from '@/lib/client-session';
import '@/app/admin-dashboard.css';
import '@/app/admin-login.css';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Users } from 'lucide-react';
import SecurityKeyPrompt from '@/components/auth/SecurityKeyPrompt';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyFlow, setKeyFlow] = useState<{ flowToken: string; options: any; name?: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('south_street_user');
    const savedToken = localStorage.getItem('south_street_token');
    if (savedUser && savedToken) {
      try {
        const obj = JSON.parse(savedUser);
        if (obj?.role === 'SUPER_ADMIN' || obj?.role === 'AGENCY_MANAGER') {
          setCurrentUser(obj);
          setIsLoggedIn(true);
        }
      } catch {}
    }
  }, []);

  const finishLogin = (data: { token: string; user: any }) => {
    // The session itself is the httpOnly cookie the server just set.
    localStorage.setItem('south_street_token', SESSION_MARKER);
    localStorage.setItem('south_street_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    setIsLoggedIn(true);
  };

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (data.status === 'REQUIRES_SECURITY_KEY') {
        setKeyFlow({ flowToken: data.flowToken, options: data.options, name: data.name });
        return;
      }
      if (data.status === 'ENROLLMENT_REQUIRED' && data.enrollUrl) {
        window.location.href = data.enrollUrl;
        return;
      }
      if (data.status === 'REQUIRES_FILE_KEY') {
        setLoginStep(2);
        setLoginSuccessMsg(data.message || 'ارفع ملف المفتاح الحالي لتفعيل مفتاح الأمان لأول مرة.');
        return;
      }
      if (data.status === 'PENDING_APPROVAL') {
        setLoginError(`حسابك في انتظار موافقة المدير — IP: ${data.ip}`);
        return;
      }
      if (data.status === 'SUCCESS') {
        finishLogin(data);
        return;
      }
      setLoginError(data.error || 'بيانات الدخول غير صحيحة');
    } catch {
      setLoginError('خطأ في الاتصال بالخادم');
    } finally {
      setSubmitting(false);
    }
  };

  const submitFileKey = async (fileKey: string) => {
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password, fileKey }),
      });
      const data = await res.json();
      if (data.status === 'ENROLLMENT_REQUIRED' && data.enrollUrl) {
        window.location.href = data.enrollUrl;
      } else if (data.status === 'SUCCESS') {
        finishLogin(data);
      } else {
        setLoginError(data.error || 'مفتاح الأمان غير صحيح');
      }
    } catch {
      setLoginError('خطأ في التحقق من المفتاح');
    }
  };

  const handleLoginStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFileKey(fileKeyInput);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = String(ev.target?.result || '');
      setFileKeyInput(text);
      setLoginSuccessMsg('تم قبول الملف. جاري الدخول...');
      await submitFileKey(text);
    };
    reader.readAsText(file);
  };

  const handleLogout = () => {
    void logoutAndReload('/admin');
  };

  if (!isLoggedIn) {
    return (
      <div className="al-page" dir="rtl">
        <aside className="al-hero" aria-hidden="true">
          <img src="/images/south_street_logo_trans.png" alt="" className="al-hero-logo" />
          <div>
            <h2>إدارة ساوث ستريت في مكان واحد</h2>
            <p>الحجوزات، البرامج، الفريق، المدفوعات وتواصل المعتمرين — بأمان كامل وصلاحيات دقيقة.</p>
          </div>
          <div className="al-hero-points">
            <span><ShieldCheck size={15} /> مفتاح أمان</span>
            <span><Lock size={15} /> اتصال مشفّر</span>
            <span><Users size={15} /> صلاحيات الفريق</span>
          </div>
        </aside>

        <main className="al-main">
          <div className="al-card">
            <img src="/images/south_street_logo_trans.png" alt="South Street" className="al-card-logo" />
            <span className="al-badge"><ShieldCheck size={14} /> دخول الإدارة</span>
            <h1 className="al-title">مرحباً بعودتك</h1>
            <p className="al-sub">سجّل الدخول للوصول إلى لوحة التحكم</p>

            {loginError ? <div className="al-alert is-error" role="alert">{loginError}</div> : null}
            {loginSuccessMsg ? <div className="al-alert is-ok">{loginSuccessMsg}</div> : null}

            {keyFlow ? (
              <SecurityKeyPrompt
                tone="light"
                flowToken={keyFlow.flowToken}
                options={keyFlow.options}
                name={keyFlow.name}
                onSuccess={(data) => finishLogin(data)}
                onCancel={() => {
                  setKeyFlow(null);
                  setPassword('');
                }}
              />
            ) : loginStep === 1 ? (
              <form onSubmit={handleLoginStep1} className="al-form">
                <div>
                  <label className="al-label" htmlFor="al-user">البريد الإلكتروني أو اسم المستخدم</label>
                  <div className="al-field">
                    <Mail />
                    <input
                      id="al-user"
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="al-input"
                      dir="ltr"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={120}
                    />
                  </div>
                </div>
                <div>
                  <label className="al-label" htmlFor="al-pass">كلمة المرور</label>
                  <div className="al-field">
                    <Lock />
                    <input
                      id="al-pass"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="al-input"
                      dir="ltr"
                      autoComplete="current-password"
                      maxLength={128}
                    />
                    <button
                      type="button"
                      className="al-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="al-btn al-btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                  دخول
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginStep2} className="al-form">
                <div>
                  <label className="al-label">ملف المفتاح الأمني (.key)</label>
                  <input type="file" accept=".key,.txt,.pem" onChange={handleFileUpload} className="al-file" />
                  <input
                    type="text"
                    value={fileKeyInput}
                    onChange={(e) => setFileKeyInput(e.target.value)}
                    placeholder="أو الصق محتوى الملف هنا..."
                    className="al-input is-mono"
                    style={{ marginTop: '0.6rem' }}
                  />
                </div>
                <div className="al-row">
                  <button type="button" onClick={() => setLoginStep(1)} className="al-btn al-btn-ghost">رجوع</button>
                  <button type="submit" className="al-btn al-btn-primary">تأكيد</button>
                </div>
              </form>
            )}

            <div className="al-foot">
              <Lock size={13} /> اتصال آمن ·
              <Link href="/">العودة إلى الموقع</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <UserAccessDashboard currentUser={currentUser} onLogout={handleLogout} />
      <SakhrAgent />
    </>
  );
}
