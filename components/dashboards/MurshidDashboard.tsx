'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { UserCheck, Megaphone, Compass, MapPin, MessageCircle, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';

interface MurshidDashboardProps {
  currentUser: User;
  pilgrims: User[];
  onBroadcast: () => void;
}

export default function MurshidDashboard({ currentUser, pilgrims, onBroadcast }: MurshidDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'ai_teach'>('overview');

  return (
    <div className="space-y-6 animate-fade-in text-right">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-amber-400 font-ruqaa flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-amber-400" />
            لوحة المرشد الديني والمرافقة الميدانية (GUIDE)
          </h2>
          <p className="text-xs text-slate-400 mt-1">إرسال التنبيهات الجماعية، متابعة طواف الفوج وتدريب صخر على أحكام وفتاوى المناسك</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-white/10 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'overview' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              متابعة الفوج
            </button>
            <button
              onClick={() => setActiveTab('ai_teach')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ai_teach' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              تعليم صخر (المناسك)
            </button>
          </div>

          <button
            onClick={onBroadcast}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
            بث تنبيه عاجل للفوج
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-2xl mx-auto border border-emerald-500/30">
                🕋
              </div>
              <h3 className="text-lg font-bold text-white font-cairo">عداد الطواف والسعي الجماعي</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">التحكم بالعداد وتلاوة الأدعية أثناء مرافقة الفوج في المسعى والحرم المكي</p>
              <Link
                href="/portal?tab=rituals"
                className="inline-flex bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md items-center gap-2"
              >
                <Compass className="w-4 h-4 text-amber-300" />
                فتح عداد المناسك التفاعلي
              </Link>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-sm text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-2xl mx-auto border border-amber-500/30">
                📍
              </div>
              <h3 className="text-lg font-bold text-white font-cairo">بث موقع التجمع الحالي</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">إرسال إحداثيات ومكان تجمع الحافلة في قنوات التواصل الخاصة للمعتمرين</p>
              <Link
                href="/portal?tab=chat"
                className="inline-flex bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md items-center gap-2 border border-white/5"
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                إرسال الموقع للفوج الآن
              </Link>
            </div>
          </div>

          {/* Attendance Checklist */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
            <h3 className="text-base font-bold text-white font-cairo">تفقد وجاهزية معتمري الفوج (قائمة التحضير)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">اسم المعتمر</th>
                    <th className="py-2.5 px-3">رقم الجوال</th>
                    <th className="py-2.5 px-3">الفندق والرقم</th>
                    <th className="py-2.5 px-3">حالة التواجد</th>
                    <th className="py-2.5 px-3">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {pilgrims.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-bold text-white">{p.name}</td>
                      <td dir="ltr" className="py-3 px-3 text-right text-xs font-mono text-slate-300">{p.phone}</td>
                      <td className="py-3 px-3 text-sky-400 font-semibold">{p.room || 'سويس أوتيل مكة'}</td>
                      <td className="py-3 px-3"><span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 text-[10px]">جاهز في اللوبي</span></td>
                      <td className="py-3 px-3">
                        <Link
                          href="/portal?tab=chat"
                          className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 border border-white/5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> مراسلة
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai_teach' && (
        <AiKnowledgeManager
          userRole="murshid"
          userName={currentUser.name || 'المرشد الديني'}
          allowedCategories={['rituals', 'requirements', 'faq']}
          title="تعليم صخر AI (المناسك والإرشاد الميداني)"
          subtitle="بصفتك المرشد الديني، يمكنك تدريب صخر على أحكام الإحرام، أوقات الطواف، التجمع، وفتاوى المناسك الميدانية ليرد بها فورياً على المعتمرين."
        />
      )}
    </div>
  );
}
