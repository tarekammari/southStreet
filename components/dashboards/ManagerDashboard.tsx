'use client';

import React from 'react';
import { User, Campaign } from '@/types';
import Link from 'next/link';

interface ManagerDashboardProps {
  currentUser: User;
  campaigns: Campaign[];
  pilgrims: User[];
}

export default function ManagerDashboard({ currentUser, campaigns, pilgrims }: ManagerDashboardProps) {
  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-black/5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight">
            إدارة الأفواج والرحلات
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] mt-0.5">
            متابعة الحملات النشطة، وتوزيع الفنادق، والحافلات، وقوائم المعتمرين
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-black/5">
            {campaigns.length} حملة نشطة
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] border border-black/5">
            {pilgrims.length} معتمر
          </span>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#1d1d1f]">الحملات والبرامج الميدانية</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-5 sm:p-6 border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all"
            >
              {/* Campaign Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/5">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#0071e3] bg-[#0071e3]/10 px-2.5 py-1 rounded-md">
                    {c.id}
                  </span>
                  <h4 className="text-lg font-bold text-[#1d1d1f] mt-1.5">{c.title}</h4>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20">
                  {c.status}
                </span>
              </div>

              {/* Campaign Key Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#f5f5f7] p-3.5 rounded-xl">
                  <span className="text-[#6e6e73] font-medium block mb-1">فندق مكة</span>
                  <strong className="text-[#1d1d1f] font-bold text-sm block">{c.makkahHotel}</strong>
                </div>
                <div className="bg-[#f5f5f7] p-3.5 rounded-xl">
                  <span className="text-[#6e6e73] font-medium block mb-1">فندق المدينة</span>
                  <strong className="text-[#1d1d1f] font-bold text-sm block">{c.madinahHotel}</strong>
                </div>
                <div className="bg-[#f5f5f7] p-3.5 rounded-xl">
                  <span className="text-[#6e6e73] font-medium block mb-1">بيانات الرحلة والطيران</span>
                  <strong className="text-[#1d1d1f] font-bold text-sm block">{c.flightNumber}</strong>
                </div>
                <div className="bg-[#f5f5f7] p-3.5 rounded-xl">
                  <span className="text-[#6e6e73] font-medium block mb-1">الحافلة المخصصة</span>
                  <strong className="text-[#1d1d1f] font-bold text-sm block">{c.busNumber}</strong>
                </div>
              </div>

              {/* Campaign Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6e6e73]">
                <div>
                  المعتمرون: <strong className="text-[#1d1d1f] font-bold">{c.pilgrimsCount} معتمر</strong> · المرشد المسؤول: <strong className="text-[#1d1d1f] font-bold">{c.guideName}</strong>
                </div>
                <Link
                  href="/portal?tab=chat"
                  className="px-4 py-2 rounded-xl bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-bold transition-all text-xs"
                >
                  قناة التواصل الخاصة
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pilgrims List */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1d1d1f]">سجل المعتمرين وتوزيع الغرف</h3>
          <span className="text-xs text-[#6e6e73]">{pilgrims.length} مسجل</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-black/5 text-[#6e6e73]">
                <th className="py-3 px-3 font-semibold">اسم المعتمر</th>
                <th className="py-3 px-3 font-semibold">كود الوصول</th>
                <th className="py-3 px-3 font-semibold">الغرفة والإقامة</th>
                <th className="py-3 px-3 font-semibold">رقم الهاتف</th>
                <th className="py-3 px-3 font-semibold">حالة الاتصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 text-[#1d1d1f]">
              {pilgrims.map((p) => (
                <tr key={p.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                  <td className="py-3 px-3 font-bold">{p.name}</td>
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-[11px] bg-[#f5f5f7] px-2 py-1 rounded text-[#1d1d1f] border border-black/5">
                      {p.code}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#6e6e73] font-medium">{p.room || 'سويس أوتيل مكة - غرفة 1402'}</td>
                  <td dir="ltr" className="py-3 px-3 text-right font-mono text-[#6e6e73]">{p.phone}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] font-bold text-[#34c759]">
                      مربوط عبر التطبيق
                    </span>
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
