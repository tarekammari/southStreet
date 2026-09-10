'use client';

import React, { useEffect, useState } from 'react';
import UserAccessDashboard from '@/components/admin/UserAccessDashboard';
import { logoutAndReload } from '@/lib/client-session';
import '@/app/admin-dashboard.css';

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');

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
    localStorage.setItem('south_street_token', data.token);
    localStorage.setItem('south_street_user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    setIsLoggedIn(true);
  };

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccessMsg('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (data.status === 'REQUIRES_FILE_KEY') {
        setLoginStep(2);
        setLoginSuccessMsg('تم التحقق. يرجى رفع ملف المفتاح الأمني (.key)');
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
      if (data.status === 'SUCCESS') {
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
      <div className="admin-login-bg" dir="rtl">
        <div className="admin-login-card">
          <img src="/images/south_street_logo_trans.png" alt="South Street" className="admin-login-logo" />
          <h1 className="admin-login-title">لوحة إدارة الحسابات</h1>
          <p className="admin-login-sub">ساوث ستريت — التحكم بتفعيل المستخدمين والصلاحيات</p>
          {loginError ? <div className="admin-alert admin-alert-error">{loginError}</div> : null}
          {loginSuccessMsg ? <div className="admin-alert admin-alert-success">{loginSuccessMsg}</div> : null}
          {loginStep === 1 ? (
            <form onSubmit={handleLoginStep1} className="admin-login-form">
              <div>
                <label className="admin-label">البريد الإلكتروني أو اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin أو admin@southstreet.dz"
                  className="admin-input"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="admin-label">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-input"
                  dir="ltr"
                />
              </div>
              <button type="submit" className="admin-btn-primary w-full">دخول</button>
            </form>
          ) : (
            <form onSubmit={handleLoginStep2} className="admin-login-form">
              <div>
                <label className="admin-label">ملف المفتاح الأمني (.key)</label>
                <input type="file" accept=".key,.txt,.pem" onChange={handleFileUpload} className="admin-file-input" />
                <input
                  type="text"
                  value={fileKeyInput}
                  onChange={(e) => setFileKeyInput(e.target.value)}
                  placeholder="أو الصق محتوى الملف هنا..."
                  className="admin-input admin-mono mt-2"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setLoginStep(1)} className="admin-btn-secondary flex-1">رجوع</button>
                <button type="submit" className="admin-btn-primary flex-1">تأكيد</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <UserAccessDashboard currentUser={currentUser} onLogout={handleLogout} />;
}
