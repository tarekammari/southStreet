'use client';

import React from 'react';
import { User } from '@/types';
import { UserCheck, Megaphone, Compass, MapPin, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface MurshidDashboardProps {
  currentUser: User;
  pilgrims: User[];
  onBroadcast: () => void;
}

export default function MurshidDashboard({ currentUser, pilgrims, onBroadcast }: MurshidDashboardProps) {
  return (
    <div className="space-y-6 animate-fade-in text-right">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gold-main font-ruqaa flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-gold-main" />
            لوحة المرشد الديني والمرافقة (GUIDE)
          </h2>
          <p className="text-xs text-slate-500 mt-1">إرسال التنبيهات الجماعية المباشرة، متابعة طواف الفوج ورعاية المعتمرين</p>
        </div>
        <button
          onClick={onBroadcast}
          className="bg-gradient-to-r from-gold-dark to-gold-main text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg hover:scale-102 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Megaphone className="w-4 h-4" />
          بث تنبيه عاجل للفوج
        </button>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-gold-main rounded-2xl p-6 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-soft text-emerald-main flex items-center justify-center text-2xl mx-auto border border-emerald-light">
            🕋
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-cairo">عداد الطواف والسعي الجماعي</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">التحكم بالعداد وتلاوة الأدوية أثناء مرافقة الفوج في المسعى والحرم المكي</p>
          <Link
            href="/portal?tab=rituals"
            className="inline-flex bg-emerald-main hover:bg-emerald-dark text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md items-center gap-2"
          >
            <Compass className="w-4 h-4 text-gold-main" />
            فتح عداد المناسك التفاعلي
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-gold-soft text-gold-dark flex items-center justify-center text-2xl mx-auto border border-gold-main/40">
            📍
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-cairo">بث موقع التجمع الحالي</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">إرسال إحداثيات ومكان تجمع الحافلة في قنوات التواصل الخاصة للمعتمرين</p>
          <Link
            href="/portal?tab=chat"
            className="inline-flex bg-slate-900 hover:bg-slate-800 text-gold-main font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md items-center gap-2"
          >
            <MapPin className="w-4 h-4 text-gold-main" />
            إرسال الموقع للفوج الآن
          </Link>
        </div>
      </div>

      {/* Attendance Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 font-cairo">تفقد وجاهزية معتمري الفوج (قائمة التحضير)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المعتمر</th>
                <th>رقم الجوال</th>
                <th>الفندق والرقم</th>
                <th>حالة التواجد</th>
                <th>إجراء سريع</th>
              </tr>
            </thead>
            <tbody>
              {pilgrims.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold text-slate-900">{p.name}</td>
                  <td dir="ltr" className="text-right text-xs font-semibold">{p.phone}</td>
                  <td className="text-sky-600 font-semibold">{p.room || 'سويس أوتيل مكة'}</td>
                  <td><span className="text-emerald-600 font-bold text-xs">جاهز في اللوبي</span></td>
                  <td>
                    <Link
                      href="/portal?tab=chat"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-md inline-flex items-center gap-1"
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
  );
}
