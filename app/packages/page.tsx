'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import Footer from '@/components/Footer';
import { Package } from '@/types';
import { Sparkles, MapPin, Calendar, CheckCircle, Plane, Filter, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [maxBudget, setMaxBudget] = useState<number>(1200000);

  useEffect(() => {
    fetch('/api/admin/packages')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredPackages = packages.filter((pkg) => {
    if (selectedSeason !== 'ALL' && !pkg.season_id?.toLowerCase().includes(selectedSeason.toLowerCase())) return false;
    if (selectedType !== 'ALL' && pkg.type !== selectedType) return false;
    const minPrice = pkg.prices?.length ? Math.min(...pkg.prices.map(p => p.amount)) : 0;
    if (minPrice > maxBudget) return false;
    return true;
  });

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar />

      <main className="page-main pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-4 mb-10 pt-6">
          <span className="badge-pro">
            <Sparkles className="w-4 h-4" /> البرامج والباقات المعتمدة
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-slate-900">
            كتالوج باقات العمرة والحج 2026
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            تصفح جميع عروض وكالة ساوث ستريت المعتمدة — أسعار شفافة، فنادق قريبة من الحرم، ومقاعد محدودة.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-600" /> نوع الرحلة
            </label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500">
              <option value="ALL">جميع الأنواع</option>
              <option value="ECONOMY">اقتصادية</option>
              <option value="VIP">فخمة VIP</option>
              <option value="GROUP">حملات الحج</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">الموسم</label>
            <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500">
              <option value="ALL">جميع المواسم</option>
              <option value="AUGUST">موسم أوت 2026</option>
              <option value="RAMADAN">رمضان والمولد</option>
              <option value="HAJJ">الحج 1447هـ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              الحد الأقصى: <span className="text-emerald-700 font-black">{maxBudget.toLocaleString()} دج</span>
            </label>
            <input type="range" min="200000" max="1200000" step="50000" value={maxBudget} onChange={(e) => setMaxBudget(Number(e.target.value))} className="w-full accent-emerald-600 cursor-pointer mt-2" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">جاري تحميل الباقات...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-20 text-slate-500">لا توجد باقات مطابقة للفلاتر المحددة.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPackages.map((pkg) => {
              const minPrice = pkg.prices?.length ? Math.min(...pkg.prices.map(p => p.amount)) : 0;
              return (
                <article key={pkg.package_id} className="group rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-xl transition-all flex flex-col shadow-sm">
                  <div className="relative h-48 overflow-hidden">
                    <img src={pkg.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/95 text-emerald-800 text-xs font-bold shadow">{pkg.type}</span>
                    <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-slate-900/85 text-emerald-300 text-xs font-bold">
                      {pkg.available} مقعد متبقٍ
                    </span>
                  </div>
                  <div className="p-5 space-y-3 flex-1">
                    <h3 className="font-black text-lg font-cairo text-slate-900 group-hover:text-emerald-700 transition-colors">{pkg.name}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{pkg.description}</p>
                    <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-2 border border-slate-100">
                      <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span>{pkg.makkah_hotel_name} ({pkg.makkah_hotel_dist})</span></div>
                      <div className="flex items-center gap-1.5"><Plane className="w-3.5 h-3.5 text-indigo-500 shrink-0" /><span>{pkg.airline}</span></div>
                      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" /><span>{pkg.duration_days} يوماً</span></div>
                    </div>
                  </div>
                  <div className="p-5 pt-0 flex items-center justify-between border-t border-slate-100 mt-auto">
                    <div>
                      <span className="text-[10px] text-slate-400 block">تبدأ من</span>
                      <span className="text-xl font-black text-emerald-700 font-cairo">{minPrice.toLocaleString()} <span className="text-xs">دج</span></span>
                    </div>
                    <Link href="/portal" className="btn-pro-primary text-xs py-2.5 px-4">
                      حجز <CheckCircle className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </main>

      <Footer />
      <SakhrAgent />
    </div>
  );
}
