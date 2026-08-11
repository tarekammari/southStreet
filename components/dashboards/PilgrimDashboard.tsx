'use client';

import React from 'react';
import { User } from '@/types';
import { Compass, MessageCircle, AlertTriangle, Hotel, Plane, ShieldCheck, HeartHandshake } from 'lucide-react';
import Link from 'next/link';

interface PilgrimDashboardProps {
  currentUser: User;
  onTriggerSOS: () => void;
}

export default function PilgrimDashboard({ currentUser, onTriggerSOS }: PilgrimDashboardProps) {
  return (
    <div className="space-y-6 animate-fade-in text-right">
      {/* Welcome Header Banner */}
      <div className="bg-gradient-to-r from-emerald-deep via-emerald-dark to-slate-950 border-2 border-gold-main rounded-2xl p-6 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="bg-gold-main text-slate-950 font-black text-xs px-3 py-1 rounded-md inline-block mb-2">
            عمرة مقبولة وذنب مغفور
          </span>
          <h2 className="text-2xl font-black font-ruqaa">مرحباً بك، {currentUser.name}</h2>
          <p className="text-xs text-slate-300 mt-1">
            كود الوصول المسجل الخاص بك: <strong className="text-gold-main font-mono text-sm">{currentUser.code}</strong>
          </p>
        </div>
        <button
          onClick={onTriggerSOS}
          className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 border border-red-400 shrink-0 cursor-pointer animate-bounce"
        >
          <AlertTriangle className="w-4 h-4 fill-white" />
          🚨 زر الاستغاثة والطوارئ (SOS)
        </button>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/portal?tab=rituals"
          className="bg-white border border-slate-200 hover:border-gold-main rounded-2xl p-5 shadow-sm transition-all hover:-translate-y-1 text-center space-y-2 group"
        >
          <div className="w-12 h-12 rounded-full bg-gold-soft text-gold-dark flex items-center justify-center text-2xl mx-auto group-hover:scale-110 transition-transform">
            📿
          </div>
          <h3 className="text-base font-bold text-gold-dark font-cairo">دليل عداد طواف وسعي العمرة</h3>
          <p className="text-xs text-slate-500">تسجيل الأشواط السبعة وقراءة الأدعية المأثورة لكل شوط مباشرة</p>
        </Link>

        <Link
          href="/portal?tab=chat"
          className="bg-white border border-slate-200 hover:border-emerald-main rounded-2xl p-5 shadow-sm transition-all hover:-translate-y-1 text-center space-y-2 group"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-soft text-emerald-main flex items-center justify-center text-2xl mx-auto group-hover:scale-110 transition-transform">
            💬
          </div>
          <h3 className="text-base font-bold text-emerald-main font-cairo">تواصل WhatsApp الخاص مع المرشد</h3>
          <p className="text-xs text-slate-500">تواصل مباشر مع الشيخ المرشد وأفراد الفوج</p>
        </Link>
      </div>

      {/* Itinerary & Booking Cards Grid */}
      <h3 className="text-lg font-bold text-slate-900 font-cairo pt-2">تفاصيل حجوزات ورحلة سوث ستريت</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hotel Makkah */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center text-xl shrink-0">
              🕋
            </div>
            <div>
              <h4 className="text-sm font-bold text-gold-dark">إقامة مكة المكرمة</h4>
              <p className="text-[11px] text-slate-500">سويس أوتيل المقام - مكة المكرمة</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-700">
            <div>🏢 رقم الغرفة: <strong className="text-slate-900">{currentUser.room || '1402 - الدور 14'}</strong></div>
            <div>📍 الموقع: ألمجمع السكني مقابل أبواب الملك عبد العزيز رقم 1</div>
            <div className="text-emerald-600 font-bold text-[11px] pt-1">● متاح واي فاي مجاني بالفندق</div>
          </div>
        </div>

        {/* Hotel Madinah */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl shrink-0">
              🕌
            </div>
            <div>
              <h4 className="text-sm font-bold text-sky-600">إقامة المدينة المنورة</h4>
              <p className="text-[11px] text-slate-500">فندق أوبروي المدينة المنورة</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-700">
            <div>🏢 رقم الغرفة: <strong className="text-slate-900">608 - المطل على الروضة</strong></div>
            <div>📍 الموقع: المنطقة المركزية الشمالية</div>
            <div className="text-emerald-600 font-bold text-[11px] pt-1">● الانطلاق بعد 4 أيام</div>
          </div>
        </div>

        {/* Flight Ticket */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-soft text-emerald-main flex items-center justify-center text-xl shrink-0">
              ✈️
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">تذكرة الطيران المؤكدة</h4>
              <p className="text-[11px] text-slate-500">الخطوط الجوية العربية السعودية</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5 text-slate-700">
            <div>رقم الرحلة: <strong className="text-gold-dark font-mono font-bold">SV-382</strong></div>
            <div>مسار الرحلة: <strong className="text-slate-900">الجزائر ➔ مطار الملك عبد العزيز بجدة</strong></div>
            <div>رقم المقعد: <strong className="text-sky-600">18B - الدرجة السياحية الفاخرة</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
