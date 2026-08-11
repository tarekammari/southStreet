'use client';

import React from 'react';
import { User, Campaign } from '@/types';
import { Briefcase, Hotel, Plane, Bus, Users, Key, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface ManagerDashboardProps {
  currentUser: User;
  campaigns: Campaign[];
  pilgrims: User[];
}

export default function ManagerDashboard({ currentUser, campaigns, pilgrims }: ManagerDashboardProps) {
  return (
    <div className="space-y-6 animate-fade-in text-right">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gold-main font-ruqaa flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-gold-main" />
            لوحة مسير الحملات والرحلات (MANAGER)
          </h2>
          <p className="text-xs text-slate-500 mt-1">إدارة الأفواج والرحلات وتوزيع الغرف والحافلات وتوليد أكواد المعتمرين</p>
        </div>
      </div>

      {/* Active Campaigns */}
      <div className="space-y-4">
        {campaigns.map((c) => (
          <div key={c.id} className="bg-white border-2 border-gold-main rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-mono bg-emerald-deep text-gold-main px-2.5 py-1 rounded border border-gold-main font-bold">
                  رقم الحملة: {c.id}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2 font-cairo">{c.title}</h3>
              </div>
              <span className="bg-emerald-main text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                {c.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">🏨 فندق مكة المكرمة:</span>
                <strong className="text-gold-dark font-extrabold text-sm block">{c.makkahHotel}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">🕌 فندق المدينة المنورة:</span>
                <strong className="text-sky-600 font-extrabold text-sm block">{c.madinahHotel}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">✈️ الطيران والرحلة:</span>
                <strong className="text-slate-900 font-extrabold text-sm block">{c.flightNumber}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block mb-1">🚌 الحافلة المخصصة:</span>
                <strong className="text-emerald-600 font-extrabold text-sm block">{c.busNumber}</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div>
                عدد المعتمرين المسجلين: <strong className="text-slate-900">{c.pilgrimsCount} معتمر</strong> | المرشد: <strong className="text-slate-900">{c.guideName}</strong>
              </div>
              <Link
                href="/portal?tab=chat"
                className="bg-slate-900 hover:bg-slate-800 text-gold-main font-bold px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-gold-main" />
                المجمّع والتواصل الخاص
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pilgrims List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 font-cairo">قائمة المعتمرين المسجلين والغرف والأكواد المسلمة</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المعتمر</th>
                <th>كود الوصول الخاص</th>
                <th>الغرفة والفندق</th>
                <th>رقم الهاتف</th>
                <th>حالة الإقران</th>
              </tr>
            </thead>
            <tbody>
              {pilgrims.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold text-slate-900">{p.name}</td>
                  <td>
                    <span className="font-mono font-bold bg-emerald-deep text-gold-main px-2.5 py-1 rounded border border-gold-main text-xs">
                      {p.code}
                    </span>
                  </td>
                  <td className="text-sky-600 font-semibold">{p.room || 'غرفة 1402 - سويس أوتيل'}</td>
                  <td dir="ltr" className="text-right text-xs font-semibold">{p.phone}</td>
                  <td><span className="text-emerald-600 font-bold text-xs">مُقترن عبر WhatsApp App</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
