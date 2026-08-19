'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, RefreshCw, LogOut, Plus, Trash2, Edit, Save, Globe, Building, Users, Moon, Settings, Package, Image as ImageIcon, Bot } from 'lucide-react';
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

type Tab = 'overview' | 'packages' | 'hotels' | 'morshids' | 'seasons' | 'agency' | 'content' | 'users' | 'ai' | 'key';

const TABS: { id: Tab; label: string; icon?: any }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'packages', label: '📦 الباقات والأسعار' },
  { id: 'hotels',   label: '🏨 الفنادق' },
  { id: 'morshids', label: '👥 المرشدين والفريق' },
  { id: 'seasons',  label: '🌙 المواسم' },
  { id: 'agency',   label: '⚙️ إعدادات الوكالة' },
  { id: 'content',  label: '📝 محتوى الموقع' },
  { id: 'ai',       label: '🤖 صخر AI' },
  { id: 'users',    label: '👤 الحسابات' },
  { id: 'key',      label: '🔑 مفتاح الأمان' },
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

  // CMS Data States
  const [agencyData, setAgencyData] = useState<any>({});
  const [packagesData, setPackagesData] = useState<any[]>([]);
  const [hotelsData, setHotelsData] = useState<any[]>([]);
  const [morshidsData, setMorshidsData] = useState<any[]>([]);
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [contentData, setContentData] = useState<any[]>([]);

  // CMS Form States
  const [cmsMsg, setCmsMsg] = useState('');
  const [editingPkg, setEditingPkg] = useState<any>(null);
  const [editingHotel, setEditingHotel] = useState<any>(null);
  const [editingMorshid, setEditingMorshid] = useState<any>(null);

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
    fetchAllCmsData();
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

  const fetchAllCmsData = async () => {
    try {
      const [agencyRes, pkgRes, htlRes, mshRes, ssnRes, cntRes] = await Promise.all([
        fetch('/api/admin/agency'),
        fetch('/api/admin/packages'),
        fetch('/api/admin/hotels'),
        fetch('/api/admin/morshids'),
        fetch('/api/admin/seasons'),
        fetch('/api/admin/content')
      ]);

      if (agencyRes.ok) setAgencyData(await agencyRes.json());
      if (pkgRes.ok) setPackagesData(await pkgRes.json());
      if (htlRes.ok) setHotelsData(await htlRes.json());
      if (mshRes.ok) setMorshidsData(await mshRes.json());
      if (ssnRes.ok) setSeasonsData(await ssnRes.json());
      if (cntRes.ok) setContentData(await cntRes.json());
    } catch {}
  };

  const handleSaveAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setCmsMsg('');
    try {
      const res = await fetch('/api/admin/agency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agencyData)
      });
      const data = await res.json();
      if (res.ok) setCmsMsg('تم حفظ إعدادات الوكالة بنجاح في قاعدة البيانات!');
    } catch {
      setCmsMsg('حدث خطأ أثناء الحفظ');
    }
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPkg) return;
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPkg)
      });
      if (res.ok) {
        setEditingPkg(null);
        fetchAllCmsData();
        setCmsMsg('تم حفظ الباقة والأسعار بنجاح!');
      }
    } catch {}
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('هل أنت تأكد من حذف هذه الباقة؟')) return;
    try {
      const res = await fetch(`/api/admin/packages?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchAllCmsData();
    } catch {}
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;
    try {
      const res = await fetch('/api/admin/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingHotel)
      });
      if (res.ok) {
        setEditingHotel(null);
        fetchAllCmsData();
        setCmsMsg('تم حفظ الفندق بنجاح!');
      }
    } catch {}
  };

  const handleDeleteHotel = async (id: string) => {
    if (!confirm('هل أنت تأكد من حذف هذا الفندق؟')) return;
    try {
      const res = await fetch(`/api/admin/hotels?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchAllCmsData();
    } catch {}
  };

  const handleSaveMorshid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMorshid) return;
    try {
      const res = await fetch('/api/admin/morshids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMorshid)
      });
      if (res.ok) {
        setEditingMorshid(null);
        fetchAllCmsData();
        setCmsMsg('تم حفظ بيانات العضو / المرشد بنجاح!');
      }
    } catch {}
  };

  const handleDeleteMorshid = async (id: string) => {
    if (!confirm('هل أنت تأكد من حذف هذا العضو؟')) return;
    try {
      const res = await fetch(`/api/admin/morshids?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchAllCmsData();
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
          <h1 className="admin-login-title">لوحة التحكم CMS الإدارية</h1>
          <p className="admin-login-sub">ساوث ستريت — نظام التشفير والإدارة الشاملة</p>
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
          <span className="admin-header-title">لوحة CMS وإدارة النظام SQLite</span>
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

        {cmsMsg && (
          <div className="admin-alert admin-alert-success mb-4 flex items-center justify-between">
            <span>{cmsMsg}</span>
            <button onClick={() => setCmsMsg('')} className="text-sm underline">إغلاق</button>
          </div>
        )}

        <div className="admin-tabbar flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCmsMsg(''); }}
              className={`admin-tab ${activeTab === tab.id ? 'admin-tab-active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="admin-stat-grid">
              {[
                { label: 'الباقات المسجلة', value: packagesData.length, color: '#34c759' },
                { label: 'الفنادق المعتمدة', value: hotelsData.length, color: '#0a84ff' },
                { label: 'طاقم العمل والعلماء', value: morshidsData.length, color: '#ff9f0a' },
                { label: 'المواسم والرحلات', value: seasonsData.length, color: '#af52de' },
              ].map((s, i) => (
                <div key={i} className="admin-stat-card">
                  <span className="admin-stat-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="admin-stat-label">{s.label}</span>
                </div>
              ))}
            </div>

            <Section title="بيانات قاعدة البيانات الحية (SQLite Live)">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                <p className="font-semibold text-lg mb-1">✅ تم التعديل إلى SQLite بالكامل بدون n8n وبدون Ollama!</p>
                <p className="text-sm">كافة التغييرات التي تقوم بها هنا في لوحة الإدارة تُحفظ فوراً في ملف <code>south_street.db</code> ويقرأها المساعد الذكي صخر والصفحات مباشرة.</p>
              </div>
            </Section>
          </div>
        )}

        {/* 2. PACKAGES CMS */}
        {activeTab === 'packages' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">📦 إدارة الباقات وأسعار الغرف (SQLite)</h2>
              <button
                onClick={() => setEditingPkg({
                  package_id: `pkg_${Date.now()}`,
                  name: 'باقة عمرة جديدة 2026',
                  type: 'ECONOMY',
                  description: 'وصف الباقة الجديدة...',
                  duration_days: 15,
                  makkah_hotel_name: 'فندق مكة',
                  makkah_hotel_dist: '400م عن الحرم',
                  airline: 'الخطوط الجزائرية',
                  capacity: 40,
                  available: 40,
                  prices: [
                    { room_type: 'QUAD', amount: 215000, currency: 'DZD' },
                    { room_type: 'TRIPLE', amount: 235000, currency: 'DZD' },
                    { room_type: 'DOUBLE', amount: 265000, currency: 'DZD' }
                  ]
                })}
                className="admin-btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> إضافة باقة جديدة
              </button>
            </div>

            {editingPkg && (
              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-emerald-600">تعديل الباقة: {editingPkg.name}</h3>
                <form onSubmit={handleSavePackage} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">اسم الباقة</label>
                    <input type="text" required value={editingPkg.name || ''}
                      onChange={e => setEditingPkg({ ...editingPkg, name: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">النوع</label>
                    <select value={editingPkg.type || 'ECONOMY'}
                      onChange={e => setEditingPkg({ ...editingPkg, type: e.target.value })} className="admin-input">
                      <option value="ECONOMY">عمرة اقتصادية</option>
                      <option value="VIP">عمرة VIP</option>
                      <option value="GROUP">حج مباشر</option>
                    </select>
                  </div>
                  <div>
                    <label className="admin-label">فندق مكة المكرمة</label>
                    <input type="text" value={editingPkg.makkah_hotel_name || ''}
                      onChange={e => setEditingPkg({ ...editingPkg, makkah_hotel_name: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">المسافة عن الحرم المكي</label>
                    <input type="text" value={editingPkg.makkah_hotel_dist || ''}
                      onChange={e => setEditingPkg({ ...editingPkg, makkah_hotel_dist: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">شركة الطيران</label>
                    <input type="text" value={editingPkg.airline || ''}
                      onChange={e => setEditingPkg({ ...editingPkg, airline: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">المقاعد المتاحة</label>
                    <input type="number" value={editingPkg.available ?? 40}
                      onChange={e => setEditingPkg({ ...editingPkg, available: parseInt(e.target.value) || 0 })} className="admin-input" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">الوصف الكامل</label>
                    <textarea rows={3} value={editingPkg.description || ''}
                      onChange={e => setEditingPkg({ ...editingPkg, description: e.target.value })} className="admin-input" />
                  </div>

                  <div className="md:col-span-2">
                    <h4 className="font-bold text-sm mb-2">أسعار الغرف (دج)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {['QUAD', 'TRIPLE', 'DOUBLE'].map(rt => {
                        const priceObj = editingPkg.prices?.find((p: any) => p.room_type === rt) || { amount: 0 };
                        return (
                          <div key={rt}>
                            <label className="text-xs text-gray-500">غرفة {rt === 'QUAD' ? 'رباعية' : rt === 'TRIPLE' ? 'ثلاثية' : 'ثنائية'}</label>
                            <input
                              type="number"
                              value={priceObj.amount || 0}
                              onChange={e => {
                                const newAmount = parseFloat(e.target.value) || 0;
                                const existingPrices = editingPkg.prices || [];
                                const updated = existingPrices.filter((p: any) => p.room_type !== rt);
                                updated.push({ room_type: rt, amount: newAmount, currency: 'DZD' });
                                setEditingPkg({ ...editingPkg, prices: updated });
                              }}
                              className="admin-input"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="admin-btn-primary flex-1">حفظ الباقة في SQLite</button>
                    <button type="button" onClick={() => setEditingPkg(null)} className="admin-btn-secondary">إلغاء</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packagesData.map(pkg => (
                <div key={pkg.package_id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{pkg.name}</h3>
                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg font-bold">
                      {pkg.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{pkg.description}</p>
                  <div className="text-xs space-y-1 text-slate-500">
                    <p>🏨 {pkg.makkah_hotel_name} ({pkg.makkah_hotel_dist})</p>
                    <p>✈️ {pkg.airline} · {pkg.available} مقعد متبقي</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      💰 الأسعار: {pkg.prices?.map((p: any) => `${p.room_type}: ${p.amount.toLocaleString()} دج`).join(' | ')}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingPkg(pkg)} className="admin-btn-secondary text-xs flex items-center gap-1">
                      <Edit className="w-3 h-3" /> تعديل
                    </button>
                    <button onClick={() => handleDeletePackage(pkg.package_id)} className="admin-btn-reject text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. HOTELS CMS */}
        {activeTab === 'hotels' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">🏨 إدارة الفنادق والمسافات (SQLite)</h2>
              <button
                onClick={() => setEditingHotel({
                  hotel_id: `htl_${Date.now()}`,
                  name: 'فندق جديد بمكة',
                  city: 'MAKKAH',
                  category: '4_STAR',
                  distance_from_haram: '250م عن الحرم',
                  description: 'فندق مميز قبالة صحن الحرم',
                  services: ['تكييف', 'واي فاي', 'إفطار']
                })}
                className="admin-btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> إضافة فندق
              </button>
            </div>

            {editingHotel && (
              <form onSubmit={handleSaveHotel} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-500 space-y-3">
                <h3 className="font-bold text-blue-600">تعديل الفندق</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="اسم الفندق" required value={editingHotel.name || ''}
                    onChange={e => setEditingHotel({ ...editingHotel, name: e.target.value })} className="admin-input" />
                  <select value={editingHotel.city || 'MAKKAH'}
                    onChange={e => setEditingHotel({ ...editingHotel, city: e.target.value })} className="admin-input">
                    <option value="MAKKAH">مكة المكرمة</option>
                    <option value="MADINAH">المدينة المنورة</option>
                  </select>
                  <input type="text" placeholder="المسافة عن الحرم" value={editingHotel.distance_from_haram || ''}
                    onChange={e => setEditingHotel({ ...editingHotel, distance_from_haram: e.target.value })} className="admin-input" />
                  <input type="text" placeholder="التصنيف (5 نجوم / VIP)" value={editingHotel.category || ''}
                    onChange={e => setEditingHotel({ ...editingHotel, category: e.target.value })} className="admin-input" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="admin-btn-primary">حفظ الفندق</button>
                  <button type="button" onClick={() => setEditingHotel(null)} className="admin-btn-secondary">إلغاء</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hotelsData.map(h => (
                <div key={h.hotel_id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="font-bold text-lg">{h.name}</h3>
                  <p className="text-sm text-gray-500">📍 {h.city === 'MAKKAH' ? 'مكة المكرمة' : 'المدينة المنورة'} · 🚶 {h.distance_from_haram}</p>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingHotel(h)} className="admin-btn-secondary text-xs flex items-center gap-1">
                      <Edit className="w-3 h-3" /> تعديل
                    </button>
                    <button onClick={() => handleDeleteHotel(h.hotel_id)} className="admin-btn-reject text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. MORSHIDS CMS */}
        {activeTab === 'morshids' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">👥 إدارة طاقم العمل والعلماء (About Us SQLite)</h2>
              <button
                onClick={() => setEditingMorshid({
                  morshid_id: `msh_${Date.now()}`,
                  name: 'مرشد ديني جديد',
                  roleName: 'مرشد ديني ومرافق',
                  specialization: 'متخصص في المناسك والفقه',
                  phone: '+213 550 00 00 00',
                  category: 'religious_guide'
                })}
                className="admin-btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> إضافة مرشد / عضو
              </button>
            </div>

            {editingMorshid && (
              <form onSubmit={handleSaveMorshid} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-purple-500 space-y-3">
                <h3 className="font-bold text-purple-600">تعديل بيانات العضو</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="الاسم الكامل" required value={editingMorshid.name || ''}
                    onChange={e => setEditingMorshid({ ...editingMorshid, name: e.target.value })} className="admin-input" />
                  <input type="text" placeholder="المسمى الوظيفي" value={editingMorshid.roleName || ''}
                    onChange={e => setEditingMorshid({ ...editingMorshid, roleName: e.target.value })} className="admin-input" />
                  <input type="text" placeholder="رقم الهاتف" value={editingMorshid.phone || ''}
                    onChange={e => setEditingMorshid({ ...editingMorshid, phone: e.target.value })} className="admin-input" />
                  <select value={editingMorshid.category || 'religious_guide'}
                    onChange={e => setEditingMorshid({ ...editingMorshid, category: e.target.value })} className="admin-input">
                    <option value="religious_guide">مرشد ديني (رجال)</option>
                    <option value="women_guide">مرشدة نسائية (أخوات)</option>
                    <option value="field_guide">مرشد ميداني</option>
                    <option value="staff">إدارة وطاقم</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="admin-btn-primary">حفظ العضو</button>
                  <button type="button" onClick={() => setEditingMorshid(null)} className="admin-btn-secondary">إلغاء</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {morshidsData.map(m => (
                <div key={m.morshid_id} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      {m.avatar || m.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{m.name}</h3>
                      <p className="text-xs text-gray-500">{m.roleName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{m.specialization}</p>
                  <p className="text-xs font-bold text-emerald-600">📞 {m.phone}</p>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingMorshid(m)} className="admin-btn-secondary text-xs flex items-center gap-1">
                      <Edit className="w-3 h-3" /> تعديل
                    </button>
                    <button onClick={() => handleDeleteMorshid(m.morshid_id)} className="admin-btn-reject text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. AGENCY SETTINGS */}
        {activeTab === 'agency' && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">⚙️ إعدادات الوكالة الرسمية (Master Data in SQLite)</h2>
            <form onSubmit={handleSaveAgency} className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">اسم الوكالة التجاري</label>
                  <input type="text" value={agencyData.agency_name || ''}
                    onChange={e => setAgencyData({ ...agencyData, agency_name: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">رقم الهاتف الرئيسي</label>
                  <input type="text" value={agencyData.phone || ''}
                    onChange={e => setAgencyData({ ...agencyData, phone: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">واتساب الوكالة</label>
                  <input type="text" value={agencyData.whatsapp || ''}
                    onChange={e => setAgencyData({ ...agencyData, whatsapp: e.target.value })} className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">البريد الإلكتروني</label>
                  <input type="email" value={agencyData.email || ''}
                    onChange={e => setAgencyData({ ...agencyData, email: e.target.value })} className="admin-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="admin-label">العنوان والمقر الرسمي</label>
                  <input type="text" value={agencyData.address || ''}
                    onChange={e => setAgencyData({ ...agencyData, address: e.target.value })} className="admin-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="admin-label">أوقات العمل الرسمية</label>
                  <input type="text" value={agencyData.opening_hours || ''}
                    onChange={e => setAgencyData({ ...agencyData, opening_hours: e.target.value })} className="admin-input" />
                </div>
              </div>
              <button type="submit" className="admin-btn-primary">حفظ الإعدادات في SQLite</button>
            </form>
          </div>
        )}

        {/* 6. AI SAKHR */}
        {activeTab === 'ai' && (
          <div className="admin-card">
            <AiKnowledgeManager
              userRole="SUPER_ADMIN"
              userName={currentUser?.name || 'المدير العام'}
              userEmail={currentUser?.email || 'admin@southstreet.dz'}
              title="تدريب وتوجيه صخر AI (قواعد المعرفة في SQLite)"
              subtitle="أضف أو عدل الإجابات الرسمية التي يسترجعها صخر فوراً للمعتمرين"
            />
          </div>
        )}

        {/* 7. USERS */}
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

      </main>
    </div>
  );
}
