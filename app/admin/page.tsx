'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Lock, Mail, Key, UserPlus, Users, Activity, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Cpu, Monitor, Globe, Plus, LogOut,
  Home, Sparkles, ChevronRight
} from 'lucide-react';
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

// ─── Role badge colours ───────────────────────────────────────
const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN:    'bg-violet-50 text-violet-700 border-violet-200',
  AGENCY_MANAGER: 'bg-sky-50    text-sky-700    border-sky-200',
  AGENCY_AGENT:   'bg-amber-50  text-amber-700  border-amber-200',
  PILGRIM_USER:   'bg-slate-100 text-slate-600  border-slate-200',
};

const STATUS_BADGE: Record<string, string> = {
  APPROVED:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING_APPROVAL: 'bg-amber-50   text-amber-700   border-amber-200',
  REJECTED:         'bg-red-50     text-red-700     border-red-200',
  SUSPENDED:        'bg-slate-100  text-slate-500   border-slate-200',
};

type Tab = 'overview' | 'sessions' | 'key' | 'users' | 'ai';

// ─── Tab definitions ──────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'نظرة عامة',       icon: Activity },
  { id: 'sessions', label: 'الجلسات والدخول', icon: Monitor },
  { id: 'key',      label: 'مفتاح الأمان',    icon: Key },
  { id: 'users',    label: 'الحسابات',         icon: Users },
  { id: 'ai',       label: 'ذكاء صخر AI',     icon: Sparkles },
];

export default function AdminDashboardPage() {
  // Auth
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [loginStep, setLoginStep]     = useState<1 | 2>(1);

  // Login form
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [loginError, setLoginError]     = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');

  // Dashboard data
  const [users, setUsers]               = useState<UserAccount[]>([]);
  const [sessions, setSessions]         = useState<ActiveSession[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [securityKey, setSecurityKey]   = useState('');
  const [activeTab, setActiveTab]       = useState<Tab>('overview');

  // Account creator
  const [newName, setNewName]           = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [newRole, setNewRole]           = useState<UserAccount['role']>('PILGRIM_USER');
  const [newStatus, setNewStatus]       = useState<'APPROVED' | 'PENDING_APPROVAL'>('APPROVED');
  const [accountMsg, setAccountMsg]     = useState('');

  // Web learn
  const [webUrlInput, setWebUrlInput]   = useState('');
  const [webCatInput, setWebCatInput]   = useState<'packages'|'requirements'|'rituals'|'hotels'|'flights'|'pricing'|'faq'>('faq');
  const [isWebLearning, setIsWebLearning] = useState(false);
  const [webLearnMsg, setWebLearnMsg]   = useState('');

  // ── Restore session ────────────────────────────────────────
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

  // ── Fetch ──────────────────────────────────────────────────
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

  // ── Web Learn ─────────────────────────────────────────────
  const handleWebLearnUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrlInput.trim()) return;
    setIsWebLearning(true);
    setWebLearnMsg('');
    try {
      const res = await fetch('/api/admin/sakhr-learn-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webUrlInput, category: webCatInput })
      });
      const data = await res.json();
      setIsWebLearning(false);
      setWebLearnMsg(res.ok ? data.message : (data.error || 'حدث خطأ'));
      if (res.ok) setWebUrlInput('');
    } catch {
      setIsWebLearning(false);
      setWebLearnMsg('خطأ في الاتصال');
    }
  };

  // ── Login Step 1 ──────────────────────────────────────────
  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccessMsg('');
    try {
      const res  = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.status === 'REQUIRES_FILE_KEY') {
        setLoginStep(2);
        setLoginSuccessMsg('تم التحقق! يرجى رفع ملف المفتاح الأمني (.key)');
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

  // ── Login Step 2 ──────────────────────────────────────────
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

  // ════════════════════════════════════════════
  // LOGIN SCREEN
  // ════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">

          <div className="flex flex-col items-center mb-8 gap-3">
            <img src="/images/south_street_logo_trans.png" alt="South Street" className="h-12 w-auto object-contain" />
            <div className="text-center">
              <h1 className="text-xl font-black text-slate-900">لوحة تحكم الإدارة</h1>
              <p className="text-xs text-slate-500 mt-1">وكالة ساوث ستريت — تشفير AES-256</p>
            </div>
          </div>

          {/* Error */}
          {loginError && (
            <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-4 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{loginError}</span>
            </div>
          )}

          {/* Success */}
          {loginSuccessMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl mb-4">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{loginSuccessMsg}</span>
            </div>
          )}

          {loginStep === 1 ? (
            <form onSubmit={handleLoginStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@southstreet.dz"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Lock className="w-4 h-4" /> تسجيل الدخول
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginStep2} className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> ارفع ملف مفتاح الأمان (.key)
                </p>
                <input
                  type="file" accept=".key,.txt,.pem"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:ml-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                />
                <input
                  type="text" value={fileKeyInput}
                  onChange={e => setFileKeyInput(e.target.value)}
                  placeholder="أو الصق محتوى الملف هنا..."
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-800 font-mono focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLoginStep(1)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  رجوع
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" /> تأكيد والدخول
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 font-cairo" dir="rtl">

      {/* ── Top Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-0 flex items-center justify-between h-14 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition">
            <img src="/images/south_street_logo_trans.png" alt="South Street" className="h-8 w-auto object-contain" />
          </Link>
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          <div className="hidden sm:block">
            <span className="text-sm font-black text-slate-900">لوحة التحكم</span>
            <span className="inline-flex items-center gap-1 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-600 font-bold">AES-256</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200 transition"
          >
            <Home className="w-3.5 h-3.5" /> الموقع
          </Link>

          <div className="hidden sm:flex flex-col text-left px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-xs font-bold text-slate-900 leading-tight">{currentUser?.name}</span>
            <span className="text-[10px] text-emerald-600 font-mono leading-tight">{currentUser?.role}</span>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('south_street_token');
              localStorage.removeItem('south_street_user');
              setIsLoggedIn(false); setCurrentUser(null);
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-white border border-slate-200 text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                {tab.label}
                {tab.id === 'sessions' && pendingCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ════ Tab 1: Overview ════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'جلسات أونلاين',    value: sessions.length,          sub: 'متصلون الآن',     color: 'text-emerald-600', icon: Activity },
                { label: 'طلبات معلقة',       value: pendingCount,             sub: 'تنتظر موافقة',    color: 'text-amber-600',   icon: AlertTriangle },
                { label: 'إجمالي الحسابات',   value: users.length,             sub: 'مسجلون بالنظام', color: 'text-sky-600',     icon: Users },
                { label: 'حسابات مفعلة',      value: users.filter(u => u.status === 'APPROVED').length, sub: 'APPROVED', color: 'text-violet-600', icon: CheckCircle },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500">{m.label}</span>
                      <Icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <p className={`text-3xl font-black ${m.color}`}>{m.value}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{m.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Security Status */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">حالة الحماية</h3>
                    <p className="text-xs text-slate-500 mt-0.5">تشفير AES-256 • كلمات مرور SHA-256 مع Salt • مصادقة ثنائية بالملف الرقمي</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('key')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap shadow-sm"
                >
                  <Key className="w-3.5 h-3.5" /> إدارة المفتاح
                </button>
              </div>
            </div>

            {/* Pending Requests Quick View */}
            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    {pendingCount} طلب دخول يحتاج موافقة
                  </h3>
                  <button
                    onClick={() => setActiveTab('sessions')}
                    className="text-xs text-amber-700 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    عرض الكل <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').slice(0, 3).map(req => (
                    <div key={req.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{req.userName}</span>
                        <span className="text-[10px] text-slate-500 mr-2 font-mono">{req.ip}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleUpdateUserStatus(req.userId, 'APPROVED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          قبول
                        </button>
                        <button
                          onClick={() => handleUpdateUserStatus(req.userId, 'REJECTED')}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg border border-red-200 transition cursor-pointer"
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ Tab 2: Sessions ════════════════════════════ */}
        {activeTab === 'sessions' && (
          <div className="space-y-5">

            {/* Pending */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                طلبات الدخول المعلقة
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">{pendingCount}</span>
                )}
              </h3>

              {pendingCount === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">لا توجد طلبات معلقة</p>
              ) : (
                <div className="space-y-2.5">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').map(req => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{req.userName}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ROLE_BADGE[req.userRole] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{req.userRole}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">{req.userEmail}</p>
                        <div className="flex gap-3 text-[11px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{req.ip}</span>
                          <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />{req.pcPrint}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'APPROVED')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> قبول
                        </button>
                        <button onClick={() => handleUpdateUserStatus(req.userId, 'REJECTED')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> حظر
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Sessions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-emerald-600" />
                الجلسات النشطة الآن
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['المستخدم', 'الصلاحية', 'IP', 'بصمة الجهاز', 'وقت الدخول'].map(h => (
                        <th key={h} className="pb-3 text-[11px] font-bold text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sessions.map(sess => (
                      <tr key={sess.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 font-bold text-slate-900">
                          {sess.userName}
                          <span className="block text-[10px] font-normal text-slate-400 font-mono">{sess.userEmail}</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ROLE_BADGE[sess.userRole] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{sess.userRole}</span>
                        </td>
                        <td className="py-3 font-mono text-slate-600">{sess.ip}</td>
                        <td className="py-3 font-mono text-slate-600 text-[10px]">{sess.pcPrint}</td>
                        <td className="py-3 text-slate-500">{new Date(sess.loginTime).toLocaleTimeString('ar-DZ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sessions.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">لا توجد جلسات نشطة</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ Tab 3: Security Key ════════════════════════ */}
        {activeTab === 'key' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">مفتاح الأمان الرقمي</h3>
                <p className="text-xs text-slate-500 mt-0.5">يُستخدم كمرحلة ثانية للمصادقة (2FA) عند دخول المدراء. احتفظ بالملف في مكان آمن.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">المفتاح الحالي</p>
              <code className="block font-mono text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl break-all">
                {securityKey || 'SOUTHSTREET-KEY-v1-████████████████'}
              </code>
            </div>

            <button
              onClick={handleRegenerateKey}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              توليد مفتاح جديد وتنزيل الملف
            </button>
            <p className="text-xs text-slate-400">تحذير: توليد مفتاح جديد يعني أن الملف القديم لن يعمل بعد الآن.</p>
          </div>
        )}

        {/* ════ Tab 4: Accounts ═══════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-5">

            {/* Create Form */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                إنشاء حساب جديد
              </h3>

              {accountMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold mb-4 ${accountMsg.includes('خطأ') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {accountMsg}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'الاسم الكامل', value: newName, setter: setNewName, placeholder: 'عبد القادر الوهراني', type: 'text' },
                  { label: 'البريد الإلكتروني', value: newEmail, setter: setNewEmail, placeholder: 'staff@southstreet.dz', type: 'email' },
                  { label: 'كلمة المرور', value: newPassword, setter: setNewPassword, placeholder: '••••••••', type: 'password' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{f.label}</label>
                    <input
                      type={f.type} required value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الصلاحية</label>
                  <select
                    value={newRole}
                    onChange={(e: any) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="SUPER_ADMIN">مدير النظام العام</option>
                    <option value="AGENCY_MANAGER">مدير البرامج</option>
                    <option value="AGENCY_AGENT">موظف خدمة العملاء</option>
                    <option value="PILGRIM_USER">معتمر / زائر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة الحساب</label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="APPROVED">مفعّل فوراً</option>
                    <option value="PENDING_APPROVAL">يحتاج موافقة لاحقاً</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> إنشاء الحساب
                  </button>
                </div>
              </form>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-500" />
                الحسابات المسجلة
                <span className="text-xs text-slate-400 font-normal">({users.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['الاسم', 'البريد', 'الصلاحية', 'الحالة', 'بصمة الجهاز', 'إجراء'].map(h => (
                        <th key={h} className="pb-3 text-[11px] font-bold text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 font-bold text-slate-900">{u.name}</td>
                        <td className="py-3 text-slate-500 font-mono text-[11px]">{u.email}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{u.role}</span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATUS_BADGE[u.status] || STATUS_BADGE.SUSPENDED}`}>{u.status}</span>
                        </td>
                        <td className="py-3 font-mono text-[10px] text-slate-400">{u.pcFingerprint || '—'}</td>
                        <td className="py-3">
                          {u.status === 'PENDING_APPROVAL' ? (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, 'APPROVED')}
                              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs underline cursor-pointer"
                            >
                              قبول
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, u.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED')}
                              className="text-slate-500 hover:text-slate-800 font-bold text-xs underline cursor-pointer"
                            >
                              {u.status === 'APPROVED' ? 'تجميد' : 'تفعيل'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">لا توجد حسابات مسجلة</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════ Tab 5: AI Knowledge Base ════════════════════ */}
        {activeTab === 'ai' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
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
