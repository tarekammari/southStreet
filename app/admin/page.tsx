'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, RefreshCw, LogOut, Plus, Trash2, Edit, Save, Globe, Building, Users, Moon, Settings, Package, Image as ImageIcon, Bot } from 'lucide-react';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';
import ReviewsModerator from '@/components/ReviewsModerator';
import ImageUploadField from '@/components/ImageUploadField';
import { LOGIN_ROLE_OPTIONS, PORTAL_TABS, toPortalRole } from '@/lib/roles';
import { PAGE_CONTENT_LABELS, PAGE_CONTENT_SECTIONS } from '@/lib/page-content';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED';
  pcFingerprint?: string;
  googleLinked?: boolean;
  options?: string[];
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
  AGENCY_MANAGER: 'مدير الوكالة',
  ACCOUNTANT:     'محاسب الوكالة',
  GUIDE_MURSHID:  'مرشد ديني',
  AGENCY_AGENT:   'موظف خدمة',
  PILGRIM_USER:   'معتمر',
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED:         'مفعّل',
  PENDING_APPROVAL: 'بانتظار الموافقة',
  REJECTED:         'مرفوض',
  SUSPENDED:        'موقوف',
};

type Tab = 'overview' | 'packages' | 'hotels' | 'morshids' | 'seasons' | 'agency' | 'content' | 'users' | 'reviews' | 'ai' | 'key';

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
  { id: 'reviews',  label: '⭐ التقييمات' },
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
  const [newRole, setNewRole]       = useState('PILGRIM_USER');
  const [newStatus, setNewStatus]   = useState<'APPROVED' | 'PENDING_APPROVAL'>('APPROVED');
  const [accountMsg, setAccountMsg] = useState('');
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});

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
  const [editingContent, setEditingContent] = useState<any>(null);

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

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContent) return;
    const key = String(editingContent.key || '').trim();
    if (!key) {
      setCmsMsg('مفتاح المحتوى مطلوب');
      return;
    }
    try {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingContent)
      });
      if (res.ok) {
        setEditingContent(null);
        fetchAllCmsData();
        setCmsMsg('تم حفظ محتوى الموقع بنجاح!');
      }
    } catch {}
  };

  const handleDeleteContent = async (key: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المحتوى؟')) return;
    try {
      const res = await fetch(`/api/admin/content?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
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
        body: JSON.stringify({ username: email, password })
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
        body: JSON.stringify({ username: email, password, fileKey: fileKeyInput })
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
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = String(ev.target?.result || '');
      setFileKeyInput(text);
      setLoginError('');
      setLoginSuccessMsg('تم قبول الملف. جاري الدخول...');
      try {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password, fileKey: text })
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
    reader.readAsText(file);
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

  const handleUpdateUserStatus = async (userId: string, newStat: string, role?: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStat, role: role || pendingRole[userId] })
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
      setAccountMsg(
        data.credentials
          ? `تم إنشاء حساب ${data.user?.name} — المستخدم: ${data.credentials.username}`
          : `تم إنشاء حساب ${data.user?.name} بنجاح`
      );
      setNewName(''); setNewEmail(''); setNewPassword('');
      fetchDashboardData();
    } catch {
      setAccountMsg('خطأ في الاتصال');
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING_APPROVAL' || (u.status as string) === 'PENDING');
  const pendingCount = pendingUsers.length;

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
                <input type="text" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin أو admin@southstreet.dz" className="admin-input" dir="ltr" />
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
                { label: 'محتوى الصفحات', value: contentData.length, color: '#ff375f' },
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
                <div className="md:col-span-2">
                  <label className="admin-label">معرف عميل جوجل (اختياري — لإنشاء الحساب بجوجل)</label>
                  <input type="text" dir="ltr" value={agencyData.google_client_id || ''}
                    onChange={e => setAgencyData({ ...agencyData, google_client_id: e.target.value })}
                    placeholder="xxxxx.apps.googleusercontent.com" className="admin-input" />
                </div>
              </div>
              <button type="submit" className="admin-btn-primary">حفظ الإعدادات في SQLite</button>
            </form>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold">📝 محتوى الموقع (النصوص الظاهرة للزوّار)</h2>
                <p className="text-xs text-slate-500 mt-1">العناوين والنصوص العربية تُعرض مباشرة في الصفحة الرئيسية. الفرنسية والإنجليزية تُحفظ لصخر والبحث.</p>
              </div>
              <button
                onClick={() => setEditingContent({
                  key: `block_${Date.now()}`,
                  section: 'homepage',
                  title_ar: '',
                  title_fr: '',
                  title_en: '',
                  content_ar: '',
                  content_fr: '',
                  content_en: '',
                  image_url: '',
                  _isNew: true,
                })}
                className="admin-btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> إضافة محتوى
              </button>
            </div>

            {editingContent && (
              <form onSubmit={handleSaveContent} className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-emerald-600">
                  {editingContent._isNew ? 'محتوى جديد' : `تعديل: ${PAGE_CONTENT_LABELS[editingContent.key] || editingContent.key}`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="admin-label">المفتاح (لاتيني بدون مسافات)</label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      disabled={!editingContent._isNew}
                      value={editingContent.key || ''}
                      onChange={e => setEditingContent({ ...editingContent, key: e.target.value })}
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <label className="admin-label">القسم</label>
                    <select
                      value={editingContent.section || 'homepage'}
                      onChange={e => setEditingContent({ ...editingContent, section: e.target.value })}
                      className="admin-input"
                    >
                      {PAGE_CONTENT_SECTIONS.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">العنوان بالعربية</label>
                    <input type="text" required value={editingContent.title_ar || ''}
                      onChange={e => setEditingContent({ ...editingContent, title_ar: e.target.value })} className="admin-input" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="admin-label">النص بالعربية</label>
                    <textarea rows={4} value={editingContent.content_ar || ''}
                      onChange={e => setEditingContent({ ...editingContent, content_ar: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">العنوان بالفرنسية</label>
                    <input type="text" dir="ltr" value={editingContent.title_fr || ''}
                      onChange={e => setEditingContent({ ...editingContent, title_fr: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">العنوان بالإنجليزية</label>
                    <input type="text" dir="ltr" value={editingContent.title_en || ''}
                      onChange={e => setEditingContent({ ...editingContent, title_en: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">النص بالفرنسية</label>
                    <textarea rows={3} dir="ltr" value={editingContent.content_fr || ''}
                      onChange={e => setEditingContent({ ...editingContent, content_fr: e.target.value })} className="admin-input" />
                  </div>
                  <div>
                    <label className="admin-label">النص بالإنجليزية</label>
                    <textarea rows={3} dir="ltr" value={editingContent.content_en || ''}
                      onChange={e => setEditingContent({ ...editingContent, content_en: e.target.value })} className="admin-input" />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUploadField
                      label="صورة القسم (اختياري)"
                      value={editingContent.image_url || ''}
                      onChange={(url) => setEditingContent({ ...editingContent, image_url: url })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="admin-btn-primary">حفظ المحتوى</button>
                  <button type="button" onClick={() => setEditingContent(null)} className="admin-btn-secondary">إلغاء</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contentData.length === 0 ? (
                <p className="text-sm text-slate-500">لا يوجد محتوى محفوظ بعد.</p>
              ) : contentData.map((block: any) => (
                <div key={block.key} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold text-emerald-700">
                        {PAGE_CONTENT_LABELS[block.key] || PAGE_CONTENT_SECTIONS.find(s => s.id === block.section)?.label || block.section}
                      </p>
                      <h3 className="font-bold text-lg leading-snug">{block.title_ar || block.key}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0" dir="ltr">{block.key}</span>
                  </div>
                  {block.content_ar ? (
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{block.content_ar}</p>
                  ) : null}
                  {block.image_url ? (
                    <img src={block.image_url} alt="" className="w-full h-28 object-cover rounded-lg border border-slate-100" />
                  ) : null}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingContent({ ...block, _isNew: false })} className="admin-btn-secondary text-xs flex items-center gap-1">
                      <Edit className="w-3 h-3" /> تعديل
                    </button>
                    <button onClick={() => handleDeleteContent(block.key)} className="admin-btn-reject text-xs flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
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

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <Section title="مراجعة تقييمات المعتمرين قبل النشر">
              <p className="text-xs text-slate-500 mb-4">
                المعتمر يرسل النجوم والنص. الإدارة توافق أو تخفي أو ترد — ثم يُحسب متوسط النجوم للعضو وللوكالة.
              </p>
              <ReviewsModerator />
            </Section>
          </div>
        )}

        {/* 7. USERS */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            <Section title="تفعيل إنشاء الحساب بجوجل" defaultOpen>
              {accountMsg && accountMsg.includes('جوجل') && (
                <div className={`admin-alert mb-4 ${accountMsg.includes('خطأ') ? 'admin-alert-error' : 'admin-alert-success'}`}>
                  {accountMsg}
                </div>
              )}
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                أنشئ Client ID مرة واحدة. أضف كل العناوين التي يفتح منها الموقع. عند تغيير الدومين لاحقاً أضف الدومين الجديد فقط — لا تنشئ عميل جوجل جديد.
              </p>
              <ol className="text-[11px] text-slate-600 mb-4 space-y-1 list-decimal pr-5 leading-relaxed">
                <li>افتح <a className="text-emerald-700 font-bold" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud credentials</a></li>
                <li>OAuth consent screen → External → اسم التطبيق: South Street</li>
                <li>Create credentials → OAuth client ID → Application type: <b>Web application</b></li>
                <li>
                  Authorized JavaScript origins — أضف الكل الآن:
                  <div className="mt-1 font-mono text-[11px] leading-6" dir="ltr">
                    http://localhost:3000<br />
                    http://127.0.0.1:3000<br />
                    https://south-street-wine.vercel.app
                  </div>
                </li>
                <li>Authorized redirect URIs (إن طلبها جوجل): <span dir="ltr">https://south-street-wine.vercel.app</span> و <span dir="ltr">http://localhost:3000</span></li>
                <li>انسخ Client ID والصقه بالأسفل، ثم في Vercel → Settings → Environment Variables أضف نفس القيمة في <span dir="ltr">GOOGLE_CLIENT_ID</span> و <span dir="ltr">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> ثم أعد النشر</li>
                <li>لاحقاً إذا اشترت دومين خاص: عدّل نفس عميل جوجل وأضف <span dir="ltr">https://your-domain.com</span> ثم احفظ. لا تغيّر Client ID</li>
              </ol>
              <div className="admin-form-grid">
                <div className="sm:col-span-2">
                  <label className="admin-label">معرف عميل جوجل (Client ID)</label>
                  <input
                    dir="ltr"
                    className="admin-input"
                    placeholder="xxxxx.apps.googleusercontent.com"
                    value={agencyData.google_client_id || ''}
                    onChange={(e) => setAgencyData({ ...agencyData, google_client_id: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="admin-btn-primary w-full"
                    onClick={async () => {
                      setAccountMsg('');
                      try {
                        const res = await fetch('/api/admin/agency', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ google_client_id: agencyData.google_client_id || '' }),
                        });
                        const data = await res.json();
                        setAccountMsg(res.ok ? (data.message || 'تم حفظ معرف جوجل') : (data.error || 'خطأ في الحفظ'));
                      } catch {
                        setAccountMsg('خطأ في الاتصال أثناء حفظ جوجل');
                      }
                    }}
                  >
                    حفظ تفعيل جوجل
                  </button>
                </div>
              </div>
            </Section>

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
                    <option value="AGENCY_MANAGER">مدير الوكالة</option>
                    <option value="ACCOUNTANT">محاسب الوكالة</option>
                    <option value="GUIDE_MURSHID">مرشد ديني</option>
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

            <Section title={`طلبات الانضمام (${pendingCount})`} defaultOpen>
              <p className="text-xs text-slate-500 mb-4">
                العضو ينشئ اسم المستخدم وكلمة المرور أو يدخل بجوجل، ثم تنتظر الإدارة لتعيين الدور وخيارات البوابة قبل السماح بالدخول.
              </p>
              {pendingUsers.length === 0 ? (
                <p className="admin-empty">لا توجد طلبات بانتظار الموافقة</p>
              ) : (
                <div className="admin-list">
                  {pendingUsers.map((u) => {
                    const chosenRole = pendingRole[u.id] || u.role || 'PILGRIM_USER';
                    const optionLabels = PORTAL_TABS[toPortalRole(chosenRole)].map((t) => t.label).join(' · ');
                    return (
                      <div key={u.id} className="admin-user-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div className="admin-user-info">
                          <p className="admin-request-name">{u.name}</p>
                          <p className="admin-request-meta">
                            {u.username ? `@${u.username}` : u.email}
                            {u.googleLinked ? ' · Google' : ''}
                          </p>
                        </div>
                        <div className="admin-user-meta" style={{ minWidth: '220px', flex: 1 }}>
                          <label className="admin-label">تعيين الصلاحية</label>
                          <select
                            className="admin-input"
                            value={chosenRole}
                            onChange={(e) => setPendingRole((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          >
                            {LOGIN_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-500 mt-1">خيارات البوابة: {optionLabels}</p>
                        </div>
                        <div className="admin-user-action" style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleUpdateUserStatus(u.id, 'APPROVED', chosenRole)} className="admin-btn-accept">قبول</button>
                          <button onClick={() => handleUpdateUserStatus(u.id, 'REJECTED')} className="admin-btn-reject">رفض</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title={`الحسابات المسجلة (${users.length})`}>
              {users.length === 0 ? (
                <p className="admin-empty">لا توجد حسابات مسجلة</p>
              ) : (
                <div className="admin-list">
                  {users.filter((u) => u.status !== 'PENDING_APPROVAL' && (u.status as string) !== 'PENDING').map(u => (
                    <div key={u.id} className="admin-user-row">
                      <div className="admin-user-info">
                        <p className="admin-request-name">{u.name}</p>
                        <p className="admin-request-meta">{u.username ? `@${u.username} · ` : ''}{u.email}{u.googleLinked ? ' · Google' : ''}</p>
                        {u.options?.length ? (
                          <p className="text-[11px] text-slate-400 mt-1">{u.options.join(' · ')}</p>
                        ) : null}
                      </div>
                      <div className="admin-user-meta">
                        <span className="admin-role-tag">{ROLE_LABEL[u.role] ?? u.role}</span>
                        <span className={`admin-status-tag admin-status-${u.status}`}>
                          {STATUS_LABEL[u.status] ?? u.status}
                        </span>
                      </div>
                      <div className="admin-user-action">
                        <button
                          onClick={() => handleUpdateUserStatus(u.id, u.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED')}
                          className={u.status === 'APPROVED' ? 'admin-btn-reject' : 'admin-btn-accept'}
                        >
                          {u.status === 'APPROVED' ? 'تجميد' : 'تفعيل'}
                        </button>
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
