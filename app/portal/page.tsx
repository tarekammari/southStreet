'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import ChatModule from '@/components/ChatModule';
import UmrahCounter from '@/components/UmrahCounter';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/components/dashboards/ManagerDashboard';
import MurshidDashboard from '@/components/dashboards/MurshidDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';
import PilgrimDashboard from '@/components/dashboards/PilgrimDashboard';
import { User, Campaign } from '@/types';
import { MessageSquare, Compass, LayoutDashboard, Crown, Briefcase, UserCheck, CreditCard, ArrowRight } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function PortalContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'rituals'>(
    (initialTab as any) || 'dashboard'
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pilgrims, setPilgrims] = useState<User[]>([]);

  useEffect(() => {
    const sessionStr = localStorage.getItem('south_street_user');
    if (sessionStr) {
      try {
        setCurrentUser(JSON.parse(sessionStr));
      } catch {}
    } else {
      const defaultUser: User = {
        id: 'USR-005',
        code: 'PILGRIM-101',
        name: 'محمد عبد الله الشمري',
        role: 'pilgrim',
        roleName: 'معتمر',
        phone: '+966597770011',
        avatar: 'م',
        room: '1402 - سويس أوتيل مكة',
        status: 'نشط'
      };
      setCurrentUser(defaultUser);
      localStorage.setItem('south_street_user', JSON.stringify(defaultUser));
    }

    fetchUsersAndCampaigns();
  }, []);

  const fetchUsersAndCampaigns = async () => {
    try {
      const uRes = await fetch('/api/users');
      if (uRes.ok) {
        const users: User[] = await uRes.json();
        setPilgrims(users.filter((u) => u.role === 'pilgrim'));
      }
    } catch {}

    setCampaigns([
      {
        id: 'CMP-2026-01',
        title: 'حملة سوث ستريت الكبرى - أوت 2026 / شعبان 1447هـ',
        startDate: '2026-08-10',
        endDate: '2026-08-25',
        makkahHotel: 'سويس أوتيل المقام - برج الساعة (5 نجوم)',
        madinahHotel: 'فندق أوبروي المدينة المنورة (أمام الروضة)',
        flightNumber: 'الخطوط السعودية SV-382 (مباشرة)',
        busNumber: 'حافلة VIP فاخرة رقم 12',
        pilgrimsCount: 45,
        guideName: 'الشيخ أحمد بن علي',
        managerName: 'الأستاذ طارق السعيد',
        status: 'قيد التنفيذ'
      }
    ]);
  };

  const handleLogout = () => {
    localStorage.removeItem('south_street_user');
    localStorage.removeItem('south_street_token');
    setCurrentUser(null);
  };

  const handleQuickSwitchRole = async (code: string, name: string) => {
    try {
      const res = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      }
    } catch {}
  };

  const handleBroadcast = () => {
    const alertText = prompt('أدخل نص التنبيه العاجل لإرساله إلى محادثة حملة مكة الجماعية:');
    if (alertText && alertText.trim()) {
      setActiveTab('chat');
    }
  };

  const handleSOS = () => {
    const confirmSOS = confirm('هل تريد إرسال نداء استغاثة SOS عاجل بموقعك الحالي إلى المرشد والمدير العام؟');
    if (confirmSOS) {
      setActiveTab('chat');
      alert('تم إرسال نداء الاستغاثة بنجاح إلى الشيخ المرشد وإدارة وكالة سوث ستريت!');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-app">
      <Navbar currentUser={currentUser} onLogout={handleLogout} onSelectRole={handleQuickSwitchRole} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Top Header & Role Switcher Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <Link href="/" className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg" title="العودة للرئيسية">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 font-cairo">{currentUser.name}</span>
                <span className="text-[11px] font-bold bg-gold-soft text-gold-dark px-2.5 py-0.5 rounded-full border border-gold-main/40">
                  {currentUser.roleName}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">كود الوصول: {currentUser.code}</span>
            </div>
          </div>

          {/* Quick Role Switch Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 justify-center">
            <span className="text-xs text-slate-500 font-bold ml-1">تجربة دور:</span>
            <button
              onClick={() => handleQuickSwitchRole('ADMIN-2026', 'د. عبد الرحمن العتيبي')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'admin' ? 'bg-gold-main text-slate-950 border-gold-dark font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Crown className="w-3 h-3" /> مدير
            </button>
            <button
              onClick={() => handleQuickSwitchRole('MANAGER-99', 'الأستاذ طارق السعيد')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'manager' ? 'bg-emerald-main text-white border-emerald-dark font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <Briefcase className="w-3 h-3" /> مسير
            </button>
            <button
              onClick={() => handleQuickSwitchRole('GUIDE-777', 'الشيخ أحمد بن علي')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'murshid' ? 'bg-amber-600 text-white border-amber-700 font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <UserCheck className="w-3 h-3" /> مرشد
            </button>
            <button
              onClick={() => handleQuickSwitchRole('ACC-404', 'الأستاذ ياسين الفاسي')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'accountant' ? 'bg-sky-600 text-white border-sky-700 font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <CreditCard className="w-3 h-3" /> محاسب
            </button>
            <button
              onClick={() => handleQuickSwitchRole('PILGRIM-101', 'محمد عبد الله الشمري')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'pilgrim' ? 'bg-emerald-deep text-gold-main border-gold-main font-black' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <KaabaIcon className="w-3 h-3" /> معتمر
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-emerald-main to-emerald-dark text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            لوحة الدور المخصص ({currentUser.roleName})
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-emerald-main to-emerald-dark text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-gold-main" />
            المحادثات المشفرة (WhatsApp)
          </button>

          <button
            onClick={() => setActiveTab('rituals')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'rituals'
                ? 'bg-gradient-to-r from-emerald-main to-emerald-dark text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-4 h-4 text-gold-main" />
            عدّاد مناسك العمرة
          </button>
        </div>

        {/* Dynamic Tab Content */}
        <div className="pt-2">
          {activeTab === 'chat' && <ChatModule currentUser={currentUser} />}
          {activeTab === 'rituals' && <UmrahCounter />}
          {activeTab === 'dashboard' && (
            <>
              {currentUser.role === 'admin' && <AdminDashboard currentUser={currentUser} />}
              {currentUser.role === 'manager' && (
                <ManagerDashboard currentUser={currentUser} campaigns={campaigns} pilgrims={pilgrims} />
              )}
              {currentUser.role === 'murshid' && (
                <MurshidDashboard currentUser={currentUser} pilgrims={pilgrims} onBroadcast={handleBroadcast} />
              )}
              {currentUser.role === 'accountant' && <AccountantDashboard currentUser={currentUser} />}
              {currentUser.role === 'pilgrim' && (
                <PilgrimDashboard currentUser={currentUser} onTriggerSOS={handleSOS} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-app flex items-center justify-center text-slate-400 font-tajawal text-sm">جاري تحميل البوابة...</div>}>
      <PortalContent />
    </Suspense>
  );
}
