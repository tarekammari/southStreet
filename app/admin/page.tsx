'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, RefreshCw, LogOut } from 'lucide-react';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'AGENCY_MANAGER' | 'AGENCY_AGENT' | 'PILGRIM_USER';
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED';
  pcFingerprint?: string;
}

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ip: string;
  pcPrint: string;
  userAgent: string;
  loginTime: string;
  lastActive: string;
}

interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  ip: string;
  pcPrint: string;
  userAgent: string;
  requestTime: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:    'مدير النظام',
  AGENCY_MANAGER: 'مدير البرامج',
  AGENCY_AGENT:   'موظف خدمة',
  PILGRIM_USER:   'معتمر',
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED:         'مفعّل',
  PENDING_APPROVAL: 'بانتظار الموافقة',
  REJECTED:         'مرفوض',
  SUSPENDED:        'موقوف',
};

type Tab = 'overview' | 'sessions' | 'key' | 'users' | 'ai';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'sessions', label: 'الجلسات' },
  { id: 'key',      label: 'مفتاح الأمان' },
  { id: 'users',    label: 'الحسابات' },
  { id: 'ai',       label: 'صخر AI' },
];

function Section({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-section">
      <button className="admin-section-header" onClick={() => setOpen(o => !o)}>
        <span className="admin-section-title">{title}</span>
        {open
          ? <ChevronDown className="admin-chevron" />
          : <ChevronRight className="admin-chevron" />
        }
      </button>
      {open && <div className="admin-section-body">{children}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [loginStep, setLoginStep]     = useState<1 | 2>(1);

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [loginError, setLoginError]     = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');

  const [users, setUsers]               = useState<UserAccount[]>([]);
  const [sessions, setSessions]         = useState<ActiveSession[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [securityKey, setSecurityKey]   = useState('');
  const [activeTab, setActiveTab]       = useState<Tab>('overview');

  const [newName, setNewName]       = useState('');
  const [newEmail, setNewEmail]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole]       = useState<UserAccount['role']>('PILGRIM_USER');
  const [newStatus, setNewStatus]   = useState<'APPROVED' | 'PENDING_APPROVAL'>('APPROVED');
  const [accountMsg, setAccountMsg] = useState('');

  useEffect(() => {
    const savedUser  = localStorage.getItem('south_street_user');
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
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setSessions(data.sessions || []);
        setAccessRequests(data.accessRequests || []);
        setSecurityKey(data.securityKey || '');
      }
    } catch {}
  };

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(''); setLoginSuccessMsg('');
    try {
      const res  = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        fetchDashboardData();
        return;
      }
      setLoginError(data.error || 'بيانات الدخول غير صحيحة');
    } catch {
      setLoginError('خطأ في الاتصال بالخادم');
    }
  };

  const handleLoginStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res  = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fileKey: fileKeyInput })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        fetchDashboardData();
      } else {
        setLoginError(data.error || 'مفتاح الأمان غير صحيح');
      }
    } catch {
      setLoginError('خطأ في التحقق من المفتاح');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setFileKeyInput(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleRegenerateKey = async () => {
    try {
      const res = await fetch('/api/admin/security-key', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSecurityKey(data.securityKey);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([data.fileContent], { type: 'text/plain' }));
        a.download = data.fileName || 'southstreet_admin.key';
        a.click();
      }
    } catch {}
  };

  const handleUpdateUserStatus = async (userId: string, newStat: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStat })
      });
      if (res.ok) fetchDashboardData();
    } catch {}
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg('');
    try {
      const res  = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) { setAccountMsg(data.error || 'خطأ في الإنشاء'); return; }
      setAccountMsg(`تم إنشاء حساب ${data.user?.name} بنجاح`);
      setNewName(''); setNewEmail(''); setNewPassword('');
      fetchDashboardData();
    } catch {
      setAccountMsg('خطأ في الاتصال');
    }
  };

  const pendingCount = accessRequests.filter(r => r.status === 'PENDING_APPROVAL').length;

  /* ═══════════════ LOGIN SCREEN ══════════════════════════════ */
  if (!isLoggedIn) {
    return (
      <div className="admin-login-bg" dir="rtl">
        <div className="admin-login-card">
          <img src="/images/south_street_logo_trans.png" alt="South Street" className="admin-login-logo" />
          <h1 className="admin-login-title">لوحة التحكم</h1>
          <p className="admin-login-sub">ساوث ستريت — تشفير AES-256</p>
          {loginError && <div className="admin-alert admin-alert-error">{loginError}</div>}
          {loginSuccessMsg && <div className="admin-alert admin-alert-success">{loginSuccessMsg}</div>}
          {loginStep === 1 ? (
            <form onSubmit={handleLoginStep1} className="admin-login-form">
              <div>
                <label className="admin-label">البريد الإلكتروني</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@southstreet.dz" className="admin-input" />
              </div>
              <div>
                <label className="admin-label">كلمة المرور</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className="admin-input" />
              </div>
              <button type="submit" className="admin-btn-primary">دخول</button>
            </form>
          ) : (
            <form onSubmit={handleLoginStep2} className="admin-login-form">
              <div className="admin-key-box">
                <p className="admin-key-box-label">ارفع ملف مفتاح الأمان (.key)</p>
                <input type="file" accept=".key,.txt,.pem" onChange={handleFileUpload} className="admin-file-input" />
                <input type="text" value={fileKeyInput} onChange={e => setFileKeyInput(e.target.value)}
                  placeholder="أو الصق محتوى الملف هنا..." className="admin-input admin-mono mt-2" />
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

  /* ═══════════════ DASHBOARD ═════════════════════════════════ */
  return (
    <div className="admin-root" dir="rtl">

      <header className="admin-header">
        <div className="admin-header-start">
          <Link href="/">
            <img src="/images/south_street_logo_trans.png" alt="South Street" className="admin-header-logo" />
          </Link>
          <span className="admin-header-title">لوحة التحكم</span>
        </div>
        <div className="admin-header-end">
          <div className="admin-user-chip">
            <span className="admin-user-name">{currentUser?.name}</span>
            <span className="admin-user-role">{ROLE_LABEL[currentUser?.role] ?? currentUser?.role}</span>
          </div>
          <button
            title="تسجيل الخروج"
            onClick={() => {
              localStorage.removeItem('south_street_token');
              localStorage.removeItem('south_street_user');
              setIsLoggedIn(false); setCurrentUser(null);
            }}
            className="admin-logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="admin-main">

        <div className="admin-tabbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`admin-tab ${activeTab === tab.id ? 'admin-tab-active' : ''}`}>
              {tab.label}
              {tab.id === 'sessions' && pendingCount > 0 && (
                <span className="admin-badge-dot">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="admin-stat-grid">
              {[
                { label: 'جلسات نشطة',     value: sessions.length,    color: '#34c759' },
                { label: 'طلبات معلقة',      value: pendingCount,       color: '#ff9f0a' },
                { label: 'إجمالي الحسابات', value: users.length,       color: '#0a84ff' },
                { label: 'حسابات مفعّلة',   value: users.filter(u => u.status === 'APPROVED').length, color: '#af52de' },
              ].map((s, i) => (
                <div key={i} className="admin-stat-card">
                  <span className="admin-stat-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="admin-stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            <Section title="حالة الحماية">
              <div className="admin-security-row">
                <div>
                  <p className="admin-security-main">النظام محمي بالكامل</p>
                  <p className="admin-security-sub">تشفير AES-256 · SHA-256 مع Salt · مصادقة ثنائية بالملف الرقمي</p>
                </div>
                <button onClick={() => setActiveTab('key')} className="admin-btn-secondary whitespace-nowrap">
                  إدارة المفتاح
                </button>
              </div>
            </Section>

            {pendingCount > 0 && (
              <Section title={`${pendingCount} طلب دخول ينتظر الموافقة`}>
                <div className="space-y-2">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').slice(0, 5).map(req => (
                    <div key={req.id} className="admin-request-row">
                      <div>
                        <p className="admin-request-name">{req.userName}</p>
                        <p className="admin-request-meta">{req.userEmail} · {req.ip}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'APPROVED')} className="admin-btn-accept">قبول</button>
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'REJECTED')} className="admin-btn-reject">رفض</button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-5">
            <Section title="طلبات الدخول المعلقة">
              {pendingCount === 0 ? (
                <p className="admin-empty">لا توجد طلبات معلقة</p>
              ) : (
                <div className="space-y-2">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').map(req => (
                    <div key={req.id} className="admin-request-row">
                      <div>
                        <p className="admin-request-name">{req.userName}</p>
                        <p className="admin-request-meta">{req.userEmail}</p>
                        <p className="admin-request-meta admin-mono">{req.ip} · {req.pcPrint}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'APPROVED')} className="admin-btn-accept">قبول</button>
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'REJECTED')} className="admin-btn-reject">حظر</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section title="الجلسات النشطة الآن" defaultOpen={false}>
              {sessions.length === 0 ? (
                <p className="admin-empty">لا توجد جلسات نشطة</p>
              ) : (
                <div className="admin-list">
                  {sessions.map(sess => (
                    <div key={sess.id} className="admin-list-row">
                      <div>
                        <p className="admin-request-name">{sess.userName}</p>
                        <p className="admin-request-meta">{sess.userEmail}</p>
                      </div>
                      <div>
                        <p className="admin-request-meta admin-mono">{sess.ip}</p>
                        <p className="admin-request-meta">{new Date(sess.loginTime).toLocaleTimeString('ar-DZ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Security Key */}
        {activeTab === 'key' && (
          <div className="space-y-5">
            <Section title="مفتاح الأمان الرقمي">
              <p className="admin-body-text mb-4">
                يُستخدم كمرحلة ثانية للمصادقة (2FA) عند دخول المدراء. احتفظ بالملف في مكان آمن.
              </p>
              <code className="admin-code-block">
                {securityKey || 'SOUTHSTREET-KEY-v1-████████████████'}
              </code>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button onClick={handleRegenerateKey} className="admin-btn-primary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  توليد مفتاح جديد
                </button>
                <p className="admin-warning-text">تحذير: المفتاح القديم لن يعمل بعد التوليد.</p>
              </div>
            </Section>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            <Section title="إنشاء حساب جديد" defaultOpen={false}>
              {accountMsg && (
                <div className={`admin-alert mb-4 ${accountMsg.includes('خطأ') ? 'admin-alert-error' : 'admin-alert-success'}`}>
                  {accountMsg}
                </div>
              )}
              <form onSubmit={handleCreateUser} className="admin-form-grid">
                {[
                  { label: 'الاسم الكامل',     value: newName,     setter: setNewName,     placeholder: 'عبد القادر الوهراني', type: 'text' },
                  { label: 'البريد الإلكتروني', value: newEmail,    setter: setNewEmail,    placeholder: 'staff@southstreet.dz', type: 'email' },
                  { label: 'كلمة المرور',        value: newPassword, setter: setNewPassword, placeholder: '••••••••',             type: 'password' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="admin-label">{f.label}</label>
                    <input type={f.type} required value={f.value} onChange={e => f.setter(e.target.value)}
                      placeholder={f.placeholder} className="admin-input" />
                  </div>
                ))}
                <div>
                  <label className="admin-label">الصلاحية</label>
                  <select value={newRole} onChange={(e: any) => setNewRole(e.target.value)} className="admin-input">
                    <option value="SUPER_ADMIN">مدير النظام العام</option>
                    <option value="AGENCY_MANAGER">مدير البرامج</option>
                    <option value="AGENCY_AGENT">موظف خدمة العملاء</option>
                    <option value="PILGRIM_USER">معتمر / زائر</option>
                  </select>
                </div>
                <div>
                  <label className="admin-label">حالة الحساب</label>
                  <select value={newStatus} onChange={(e: any) => setNewStatus(e.target.value)} className="admin-input">
                    <option value="APPROVED">مفعّل فوراً</option>
                    <option value="PENDING_APPROVAL">يحتاج موافقة لاحقاً</option>
                  </select>
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-1">
                  <button type="submit" className="admin-btn-primary w-full">إنشاء الحساب</button>
                </div>
              </form>
            </Section>

            <Section title={`الحسابات المسجلة (${users.length})`}>
              {users.length === 0 ? (
                <p className="admin-empty">لا توجد حسابات مسجلة</p>
              ) : (
                <div className="admin-list">
                  {users.map(u => (
                    <div key={u.id} className="admin-user-row">
                      <div className="admin-user-info">
                        <p className="admin-request-name">{u.name}</p>
                        <p className="admin-request-meta">{u.email}</p>
                      </div>
                      <div className="admin-user-meta">
                        <span className="admin-role-tag">{ROLE_LABEL[u.role] ?? u.role}</span>
                        <span className={`admin-status-tag admin-status-${u.status}`}>
                          {STATUS_LABEL[u.status] ?? u.status}
                        </span>
                      </div>
                      <div className="admin-user-action">
                        {u.status === 'PENDING_APPROVAL' ? (
                          <button onClick={() => handleUpdateUserStatus(u.id, 'APPROVED')} className="admin-btn-accept">قبول</button>
                        ) : (
                          <button
                            onClick={() => handleUpdateUserStatus(u.id, u.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED')}
                            className={u.status === 'APPROVED' ? 'admin-btn-reject' : 'admin-btn-accept'}
                          >
                            {u.status === 'APPROVED' ? 'تجميد' : 'تفعيل'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* AI */}
        {activeTab === 'ai' && (
          <div className="admin-card">
            <AiKnowledgeManager
              userRole="SUPER_ADMIN"
              userName={currentUser?.name || 'المدير العام'}
              userEmail={currentUser?.email || 'admin@southstreet.dz'}
              title="قاعدة معرفة صخر AI"
              subtitle="أضف الأسئلة والأجوبة التي سيستخدمها صخر تلقائياً عند إجابة المعتمرين"
            />
          </div>
        )}

      </main>
    </div>
  );
}
