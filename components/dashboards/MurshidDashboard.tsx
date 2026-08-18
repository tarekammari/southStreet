'use client';

import React, { useState } from 'react';
import { User } from '@/types';
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
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight">
            المرافقة والإرشاد الميداني
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] mt-0.5">
            متابعة المعتمرين، التنبيهات الميدانية، وتدريب صخر على أحكام وفتاوى المناسك
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#f5f5f7] p-1 rounded-xl flex gap-1 border border-black/5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              متابعة الفوج
            </button>
            <button
              onClick={() => setActiveTab('ai_teach')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai_teach' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              تعليم صخر (المناسك)
            </button>
          </div>

          <button
            onClick={onBroadcast}
            className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            بث تنبيه للفوج
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
              <span className="text-xs font-bold text-[#0071e3] uppercase tracking-wide">الخدمات التفاعلية</span>
              <h3 className="text-lg font-bold text-[#1d1d1f]">عداد الطواف والسعي الميداني</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                التحكم بالعداد وتلاوة الأدعية المأثورة أثناء مرافقة الفوج في المسعى والحرم المكي
              </p>
              <div className="pt-2">
                <Link
                  href="/portal?tab=rituals"
                  className="inline-flex px-4 py-2 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-bold text-xs transition-all"
                >
                  فتح عداد المناسك
                </Link>
              </div>
            </div>

            <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
              <span className="text-xs font-bold text-[#34c759] uppercase tracking-wide">الموقع والتجمع</span>
              <h3 className="text-lg font-bold text-[#1d1d1f]">موقع التجمع ونقطة الالتقاء</h3>
              <p className="text-xs text-[#6e6e73] leading-relaxed">
                مشاركة إحداثيات ومكان تجمع الحافلة في قنوات التواصل المباشرة للمعتمرين
              </p>
              <div className="pt-2">
                <Link
                  href="/portal?tab=chat"
                  className="inline-flex px-4 py-2 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-bold text-xs transition-all border border-black/5"
                >
                  إرسال الموقع للمعتمرين
                </Link>
              </div>
            </div>
          </div>

          {/* Attendance Checklist */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1d1d1f]">تفقد وجاهزية معتمري الفوج</h3>
              <span className="text-xs text-[#6e6e73]">{pilgrims.length} معتمر</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[#6e6e73]">
                    <th className="py-3 px-3 font-semibold">اسم المعتمر</th>
                    <th className="py-3 px-3 font-semibold">رقم الهاتف</th>
                    <th className="py-3 px-3 font-semibold">الفندق والإقامة</th>
                    <th className="py-3 px-3 font-semibold">الحالة</th>
                    <th className="py-3 px-3 font-semibold">التواصل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-[#1d1d1f]">
                  {pilgrims.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-3 px-3 font-bold">{p.name}</td>
                      <td dir="ltr" className="py-3 px-3 text-right font-mono text-[#6e6e73]">{p.phone}</td>
                      <td className="py-3 px-3 text-[#6e6e73]">{p.room || 'سويس أوتيل مكة'}</td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#34c759]/10 text-[#34c759]">
                          جاهز في اللوبي
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href="/portal?tab=chat"
                          className="px-3 py-1 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-bold text-xs transition-colors inline-block"
                        >
                          مراسلة
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
          title="تعليم صخر (المناسك والإرشاد)"
          subtitle="تدريب صخر على أحكام الإحرام، أوقات الطواف، التجمع، وفتاوى المناسك الميدانية"
        />
      )}
    </div>
  );
}
