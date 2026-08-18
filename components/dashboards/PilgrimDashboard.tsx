'use client';

import React from 'react';
import { User } from '@/types';
import Link from 'next/link';

interface PilgrimDashboardProps {
  currentUser: User;
  onTriggerSOS: () => void;
}

export default function PilgrimDashboard({ currentUser, onTriggerSOS }: PilgrimDashboardProps) {
  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Welcome Header */}
      <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-3 py-1 rounded-full inline-block mb-2">
            عمرة مقبولة وذنب مغفور
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight">
            مرحباً بك، {currentUser.name}
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] mt-1">
            كود المعتمر المسجل: <span className="font-mono font-bold text-[#1d1d1f]">{currentUser.code}</span>
          </p>
        </div>

        <button
          onClick={onTriggerSOS}
          className="px-4 py-2.5 rounded-xl bg-[#ff3b30] hover:bg-[#d70015] text-white text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
        >
          طلب مساعدة عاجلة (SOS)
        </button>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/portal?tab=rituals"
          className="bg-white border border-black/5 rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all space-y-2 block"
        >
          <span className="text-xs font-bold text-[#0071e3] uppercase tracking-wide">المناسك</span>
          <h3 className="text-base font-bold text-[#1d1d1f]">عداد الطواف والسعي</h3>
          <p className="text-xs text-[#6e6e73] leading-relaxed">
            متابعة الأشواط السبعة وقراءة الأدعية المأثورة لكل شوط أثناء أداء العمرة
          </p>
        </Link>

        <Link
          href="/portal?tab=chat"
          className="bg-white border border-black/5 rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all space-y-2 block"
        >
          <span className="text-xs font-bold text-[#34c759] uppercase tracking-wide">التواصل</span>
          <h3 className="text-base font-bold text-[#1d1d1f]">قناة المرشد وأفراد الفوج</h3>
          <p className="text-xs text-[#6e6e73] leading-relaxed">
            مراسلة مباشرة مع المرشد الديني واستقبال التنبيهات الميدانية ومواعيد التجمع
          </p>
        </Link>
      </div>

      {/* Itinerary & Booking Details */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#1d1d1f]">تفاصيل الحجوزات والإقامة</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Hotel Makkah */}
          <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] block mb-1">الإقامة الأولى</span>
              <h4 className="text-sm font-bold text-[#1d1d1f]">مكة المكرمة</h4>
              <p className="text-[#6e6e73] text-xs mt-0.5">سويس أوتيل المقام</p>
            </div>
            <div className="pt-3 border-t border-black/5 space-y-2 text-[#6e6e73]">
              <div>رقم الغرفة: <strong className="text-[#1d1d1f] font-bold">{currentUser.room || '1402 - الدور 14'}</strong></div>
              <div>الموقع: أبراج البيت مقابل الحرم المكي</div>
              <div className="text-[#34c759] font-bold text-[11px]">خدمة الغرف والإنترنت متوفرة</div>
            </div>
          </div>

          {/* Hotel Madinah */}
          <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] block mb-1">الإقامة الثانية</span>
              <h4 className="text-sm font-bold text-[#1d1d1f]">المدينة المنورة</h4>
              <p className="text-[#6e6e73] text-xs mt-0.5">فندق أوبروي المدينة</p>
            </div>
            <div className="pt-3 border-t border-black/5 space-y-2 text-[#6e6e73]">
              <div>رقم الغرفة: <strong className="text-[#1d1d1f] font-bold">608 - مطل على الروضة</strong></div>
              <div>الموقع: المنطقة المركزية الشمالية</div>
              <div className="text-[#0071e3] font-bold text-[11px]">الانتقال حسب جدول الفوج</div>
            </div>
          </div>

          {/* Flight Ticket */}
          <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-[#6e6e73] block mb-1">الطيران</span>
              <h4 className="text-sm font-bold text-[#1d1d1f]">تذكرة الذهاب والعودة</h4>
              <p className="text-[#6e6e73] text-xs mt-0.5">الخطوط الجوية السعودية</p>
            </div>
            <div className="pt-3 border-t border-black/5 space-y-2 text-[#6e6e73]">
              <div>رقم الرحلة: <strong className="text-[#1d1d1f] font-mono font-bold">SV-382</strong></div>
              <div>المسار: <strong className="text-[#1d1d1f]">الجزائر ➔ جدة</strong></div>
              <div>المقعد: <strong className="text-[#1d1d1f]">18B - الدرجة الاقتصادية</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
