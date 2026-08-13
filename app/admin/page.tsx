'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Lock, Mail, Key, UserPlus, Users, Activity, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Cpu, Monitor, Globe, Plus, Trash2, Edit, LogOut, Home
} from 'lucide-react';

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

interface AiRule {
  id: string;
  category: 'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq';
  title_ar: string;
  keywords: string[];
  response_ar: string;
  is_active: boolean;
  updatedBy: string;
  updatedAt: string;
}

export default function AdminDashboardPage() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginStep, setLoginStep] = useState<1 | 2>(1);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fileKeyInput, setFileKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');

  // Dashboard Data State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [securityKey, setSecurityKey] = useState('');
  const [aiRules, setAiRules] = useState<AiRule[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'key' | 'users' | 'ai'>('overview');

  // Account Generator Form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'AGENCY_MANAGER' | 'AGENCY_AGENT' | 'PILGRIM_USER'>('PILGRIM_USER');
  const [newStatus, setNewStatus] = useState<'APPROVED' | 'PENDING_APPROVAL'>('APPROVED');
  const [accountGenSuccess, setAccountGenSuccess] = useState('');

  // AI Rule Form
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleCategory, setRuleCategory] = useState<'packages' | 'requirements' | 'rituals' | 'hotels' | 'flights' | 'pricing' | 'faq'>('packages');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleResponse, setRuleResponse] = useState('');

  // Filter state
  const [aiCategoryFilter, setAiCategoryFilter] = useState<string>('all');

  useEffect(() => {
    // Restore session from localStorage if already authenticated
    const savedUserStr = localStorage.getItem('south_street_user');
    const savedToken = localStorage.getItem('south_street_token');
    if (savedUserStr && savedToken) {
      try {
        const userObj = JSON.parse(savedUserStr);
        if (userObj && (userObj.role === 'SUPER_ADMIN' || userObj.role === 'AGENCY_MANAGER')) {
          setCurrentUser(userObj);
          setIsLoggedIn(true);
        }
      } catch (e) {}
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const resUsers = await fetch('/api/admin/users');
      if (resUsers.ok) {
        const data = await resUsers.json();
        setUsers(data.users || []);
        setSessions(data.sessions || []);
        setAccessRequests(data.accessRequests || []);
        setSecurityKey(data.securityKey || 'SOUTHSTREET-KEY-v1-9F8E7D6C5B4A3928');
      }

      const resAi = await fetch('/api/admin/sakhr-knowledge');
      if (resAi.ok) {
        const dataAi = await resAi.json();
        setAiRules(dataAi.rules || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccessMsg('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok && data.status !== 'REQUIRES_FILE_KEY' && data.status !== 'PENDING_APPROVAL') {
        setLoginError(data.error || 'بيانات الدخول غير صحيحة');
        return;
      }

      if (data.status === 'REQUIRES_FILE_KEY') {
        setLoginStep(2);
        setLoginSuccessMsg('تم التحقق من الحساب! يرجى رفع أو إدخال مفتاح الأمان (.key)');
        return;
      }

      if (data.status === 'PENDING_APPROVAL') {
        setLoginError(`🛑 حسابك في انتظار موافقة المدير!\nرقم IP: ${data.ip} | بصمة الجهاز: ${data.pcPrint}`);
        return;
      }

      if (data.status === 'SUCCESS') {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        fetchDashboardData();
      }
    } catch (e) {
      setLoginError('خطأ في الاتصال بالخادم');
    }
  };

  const handleLoginStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fileKey: fileKeyInput })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'مفتاح الأمان غير صحيح');
        return;
      }

      if (data.status === 'SUCCESS') {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsLoggedIn(true);
        fetchDashboardData();
      }
    } catch (e) {
      setLoginError('خطأ في التحقق من مفتاح الأمان');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFileKeyInput(text);
      };
      reader.readAsText(file);
    }
  };

  const handleRegenerateKey = async () => {
    try {
      const res = await fetch('/api/admin/security-key', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSecurityKey(data.securityKey);
        const element = document.createElement('a');
        const file = new Blob([data.fileContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = data.fileName || 'southstreet_admin.key';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        alert('تم توليد مفتاح الأمان الجديد وتنزيل الملف (southstreet_admin.key) بنجاح!');
      }
    } catch (e) {
      alert('خطأ في توليد مفتاح الأمان');
    }
  };

  const handleUpdateUserStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus })
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (e) {
      alert('خطأ في تحديث الحالة');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountGenSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          status: newStatus
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'خطأ في إنشاء الحساب');
        return;
      }
      setAccountGenSuccess(`✨ تم إنشاء حساب ${data.user.name} المشفر بنجاح!`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      fetchDashboardData();
    } catch (e) {
      alert('خطأ في الاتصال');
    }
  };

  const handleSaveAiRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: editingRuleId || undefined,
        category: ruleCategory,
        title_ar: ruleTitle,
        keywords: ruleKeywords.split(',').map(k => k.trim()).filter(Boolean),
        response_ar: ruleResponse,
        is_active: true,
        updatedBy: currentUser?.email || 'admin@southstreet.dz'
      };

      const method = editingRuleId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/sakhr-knowledge', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setRuleModalOpen(false);
        setEditingRuleId(null);
        setRuleTitle('');
        setRuleKeywords('');
        setRuleResponse('');
        fetchDashboardData();
      }
    } catch (e) {
      alert('خطأ في حفظ قاعدة المعرفة');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('هل أنت تأكد من حذف قاعدة المعرفة هذه؟')) return;
    try {
      const res = await fetch(`/api/admin/sakhr-knowledge?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchDashboardData();
    } catch (e) {}
  };

  const filteredAiRules = aiCategoryFilter === 'all' 
    ? aiRules 
    : aiRules.filter(r => r.category === aiCategoryFilter);

  // If not logged in, render Pristine Light Mode Login Card
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl">
          
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/images/south_street_logo_trans.png" alt="South Street Logo" className="h-16 w-auto object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">بوابة الأمان والتحكم بالمستخدمين</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-bold">وكالة ساوث ستريت • نظام التشفير الحصين AES-256 والمفتاح الرقمي</p>
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-2xl mb-4 flex items-center gap-2 whitespace-pre-line shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{loginError}</span>
            </div>
          )}

          {loginSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl mb-4 flex items-center gap-2 shadow-sm">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{loginSuccessMsg}</span>
            </div>
          )}

          {loginStep === 1 ? (
            <form onSubmit={handleLoginStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@southstreet.dz"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Lock className="w-4 h-4" /> تسجيل الدخول والتحقق الأمني
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginStep2} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                <p className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-600" /> أرفق ملف المفتاح الأمن (.key) لتأكيد الدخول:
                </p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="file"
                      accept=".key,.txt,.pem"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={fileKeyInput}
                      onChange={(e) => setFileKeyInput(e.target.value)}
                      placeholder="SOUTHSTREET-KEY-v1-9F8E7D6C5B4A3928"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLoginStep(1)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition"
                >
                  الرجوع
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs"
                >
                  <ShieldCheck className="w-4 h-4" /> تأكيد المفتاح والدخول
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-cairo" dir="rtl">
      
      {/* Top Header (Big Tech Style: Stripe / Google / Meta) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer" title="الرئيسية">
            <img src="/images/south_street_logo_trans.png" alt="South Street" className="h-10 w-auto object-contain" />
          </Link>
          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none flex items-center gap-2">
              ساوث ستريت <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">لوحة التحكم والأمان</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> تشفير محصّن بـ AES-256 • بصمة الجهاز مفعلة
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Back to Home Page Button */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 transition shadow-sm"
          >
            <Home className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">العودة للموقع الرئيسي</span>
          </Link>

          <div className="hidden sm:flex flex-col text-left text-xs bg-slate-100/80 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
            <span className="font-bold text-slate-900">{currentUser?.name}</span>
            <span className="text-[10px] text-emerald-700 font-mono font-bold">{currentUser?.role}</span>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('south_street_token');
              localStorage.removeItem('south_street_user');
              setIsLoggedIn(false);
              setCurrentUser(null);
            }}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 transition cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Navigation Tabs (Google / Meta Segmented Control Bar) */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" /> الإحصائيات الحية
          </button>
          
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition whitespace-nowrap cursor-pointer relative ${
              activeTab === 'sessions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Monitor className="w-4 h-4" /> تتبع الدخول وبصمة الجهاز
            {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('key')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'key'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Key className="w-4 h-4" /> إدارة مفتاح الأمان (.key)
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserPlus className="w-4 h-4" /> مولد الحسابات
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" /> قواعد ذكاء صخر AI
          </button>
        </div>

        {/* Tab 1: Overview (Metric Widgets) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">الجلسات الحية أونلاين</span>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">{sessions.length}</p>
                <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> متصلين الآن بالنظام
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">طلبات انتظار الدخول</span>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').length}
                </p>
                <p className="text-xs text-amber-600 font-bold mt-1">تتطلب موافقة الـ IP وبصمة الجهاز</p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">إجمالي الحسابات المشفرة</span>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">{users.length}</p>
                <p className="text-xs text-blue-600 font-bold mt-1">حسابات مفعلة ومحفوظة</p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">قواعد صخر AI المفعلة</span>
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">{aiRules.filter(r => r.is_active).length}</p>
                <p className="text-xs text-purple-600 font-bold mt-1">قواعد معرفة بالذكاء الاصطناعي</p>
              </div>
            </div>

            {/* Quick Security Status Card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" /> حالة التشفير والحماية الحصينة
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-bold">
                    قاعدة البيانات محصنة بتشفير AES-256، كلمات المرور مفترسة بـ SHA-256 مع Salt، والدخول ثنائي الخيار عبر ملف المفتاح الرقمي (.key).
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('key')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Key className="w-4 h-4" /> إدارة مفتاح الأمان
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sessions & Access Requests */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Pending Requests Section */}
            <div className="bg-white border border-amber-200/80 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-black text-amber-800 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" /> طلبات الدخول التي تنتظر موافقة المدير (IP & Device Authorization)
              </h3>

              {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-2xl text-center border border-slate-200/60 font-bold">
                  لا توجد طلبات أمان جديدة تنتظر الموافقة حالياً.
                </p>
              ) : (
                <div className="space-y-3">
                  {accessRequests.filter(r => r.status === 'PENDING_APPROVAL').map((req) => (
                    <div key={req.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{req.userName}</span>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-bold">{req.userRole}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-mono">{req.userEmail}</p>
                        
                        <div className="flex items-center gap-4 text-xs font-mono font-bold text-emerald-700 mt-2">
                          <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> IP: {req.ip}</span>
                          <span className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> بصمة الجهاز: {req.pcPrint}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateUserStatus(req.userId, 'APPROVED')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> منح صلاحية الدخول
                        </button>
                        <button
                          onClick={() => handleUpdateUserStatus(req.userId, 'REJECTED')}
                          className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> حظر
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Sessions Table */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-emerald-600" /> الجلسات المتصلة الآن (Active Live Sessions)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="pb-3">المستخدم</th>
                      <th className="pb-3">الرتبة</th>
                      <th className="pb-3">العنوان الحركي (IP)</th>
                      <th className="pb-3">بصمة جهاز الـ PC</th>
                      <th className="pb-3">وقت الدخول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 font-bold text-slate-900">
                          {sess.userName}
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">{sess.userEmail}</span>
                        </td>
                        <td className="py-3.5 font-mono text-emerald-700 font-bold">{sess.userRole}</td>
                        <td className="py-3.5 font-mono text-slate-700">{sess.ip}</td>
                        <td className="py-3.5 font-mono text-emerald-800 font-bold">{sess.pcPrint}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{new Date(sess.loginTime).toLocaleTimeString('ar-DZ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security Key Manager */}
        {activeTab === 'key' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Key className="w-6 h-6 text-emerald-600" /> إدارة وتوليد مفتاح أمان المدير (Admin Security File Key)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-bold">
                هذا المفتاح يُطلب كخطوة ثانية (2FA) عند دخول مدراء النظام لحماية القاعدة من الاختراق.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <span className="text-xs text-slate-500 font-bold block mb-1.5">المفتاح الأمني المشفر الحالي بالنظام:</span>
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-800 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200 inline-block shadow-sm">
                  {securityKey}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleRegenerateKey}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> توليد وتنزيل مفتاح جديد (southstreet_admin.key)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Account Generator */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Generator Form */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-emerald-600" /> مولد الحسابات الجديدة (Generate New Account)
              </h3>

              {accountGenSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl mb-4 font-bold shadow-sm">
                  {accountGenSuccess}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المستخدم / الموظف</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مثال: عبد القادر الوهراني"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@southstreet.dz"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور المشفرة</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الرتبة والصلاحية</label>
                  <select
                    value={newRole}
                    onChange={(e: any) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (مدير الوكالة العام)</option>
                    <option value="AGENCY_MANAGER">AGENCY_MANAGER (مدير البرامج والعروض)</option>
                    <option value="AGENCY_AGENT">AGENCY_AGENT (موظف خدمة العملاء)</option>
                    <option value="PILGRIM_USER">PILGRIM_USER (معتمر / زائر)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة الاعتماد الأولية</label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm"
                  >
                    <option value="APPROVED">APPROVED (مقبول ومفعل فوراً)</option>
                    <option value="PENDING_APPROVAL">PENDING_APPROVAL (يتطلب موافقة الـ IP لاحقاً)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> إنشاء الحساب وتشفيره
                  </button>
                </div>
              </form>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-emerald-600" /> قائمة الحسابات المسجلة بالنظام ({users.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                      <th className="pb-3">اسم المستخدم</th>
                      <th className="pb-3">البريد</th>
                      <th className="pb-3">الصلاحية</th>
                      <th className="pb-3">الحالة الأمنيّة</th>
                      <th className="pb-3">بصمة الجهاز</th>
                      <th className="pb-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 font-bold text-slate-900">{u.name}</td>
                        <td className="py-3.5 text-slate-600 font-mono">{u.email}</td>
                        <td className="py-3.5 font-mono text-emerald-700 font-bold">{u.role}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            u.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-emerald-800 text-[11px] font-bold">{u.pcFingerprint}</td>
                        <td className="py-3.5">
                          {u.status === 'PENDING_APPROVAL' ? (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, 'APPROVED')}
                              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs underline cursor-pointer"
                            >
                              موافقة
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, u.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED')}
                              className="text-amber-700 hover:text-amber-900 font-bold text-xs underline cursor-pointer"
                            >
                              {u.status === 'APPROVED' ? 'تجميد الحساب' : 'إعادة تفعيل'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Sakhr AI Knowledge Rules */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Cpu className="w-6 h-6 text-purple-600" /> إدارة قواعد وقاموس صخر AI للذكاء الاصطناعي
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-bold">
                  أضف وعدّل عروض الباقات، أسعار الإقامة، شروط الملف، ومناسك العمرة ليجيب عنها صخر فوراً وبدقة مؤكدة.
                </p>
              </div>

              <button
                onClick={() => { setEditingRuleId(null); setRuleTitle(''); setRuleKeywords(''); setRuleResponse(''); setRuleModalOpen(true); }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-md shadow-purple-600/20 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" /> إضافة قاعدة معرفة جديدة
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {['all', 'packages', 'requirements', 'rituals', 'hotels', 'flights', 'pricing', 'faq'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAiCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    aiCategoryFilter === cat
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'all' ? 'جميع القواعد' : cat}
                </button>
              ))}
            </div>

            {/* Rules Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredAiRules.map((rule) => (
                <div key={rule.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
                      {rule.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setRuleCategory(rule.category);
                          setRuleTitle(rule.title_ar);
                          setRuleKeywords(rule.keywords.join(', '));
                          setRuleResponse(rule.response_ar);
                          setRuleModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-emerald-600 p-1 cursor-pointer transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{rule.title_ar}</h4>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {rule.keywords.map((kw, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                        #{kw}
                      </span>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl text-xs text-slate-800 whitespace-pre-line leading-relaxed border border-slate-200/80 font-medium">
                    {rule.response_ar}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Modal for Adding / Editing AI Rules */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 text-right text-slate-900">
            <h3 className="text-lg font-black text-slate-900">
              {editingRuleId ? 'تعديل قاعدة معرفة صخر AI' : 'إضافة قاعدة معرفة جديدة'}
            </h3>

            <form onSubmit={handleSaveAiRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">فئة القاعدة</label>
                <select
                  value={ruleCategory}
                  onChange={(e: any) => setRuleCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900"
                >
                  <option value="packages">الباقات والعروض (packages)</option>
                  <option value="requirements">الشروط والوثائق (requirements)</option>
                  <option value="rituals">مناسك العمرة والحج (rituals)</option>
                  <option value="hotels">الفنادق والإقامة (hotels)</option>
                  <option value="flights">رحلات الطيران (flights)</option>
                  <option value="pricing">الأسعار والخصومات (pricing)</option>
                  <option value="faq">أسئلة عامة (faq)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">عنوان القاعدة (للتعريف)</label>
                <input
                  type="text"
                  required
                  value={ruleTitle}
                  onChange={(e) => setRuleTitle(e.target.value)}
                  placeholder="مثال: باقة رمضان المبارك 2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الكلمات المفتاحية (مفصولة بفاصلة ,)</label>
                <input
                  type="text"
                  required
                  value={ruleKeywords}
                  onChange={(e) => setRuleKeywords(e.target.value)}
                  placeholder="رمضان, باقة رمضان, 300000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">إجابة صخر AI التفصيلية (يدعم التنسيق **بالعريض**)</label>
                <textarea
                  rows={5}
                  required
                  value={ruleResponse}
                  onChange={(e) => setRuleResponse(e.target.value)}
                  placeholder="اكتب الإجابة المنظمة التي سيجيب بها صخر..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-xs shadow-md shadow-purple-600/20 transition"
                >
                  حفظ القاعدة فوراً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
