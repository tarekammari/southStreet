'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import { Package } from '@/types';
import { Sparkles, MapPin, Calendar, CheckCircle, Plane, Filter } from 'lucide-react';
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
        if (Array.isArray(data)) {
          setPackages(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredPackages = packages.filter((pkg) => {
    if (selectedSeason !== 'ALL' && !pkg.season_id?.toLowerCase().includes(selectedSeason.toLowerCase())) return false;
    if (selectedType !== 'ALL' && pkg.type !== selectedType) return false;
    const minPrice = pkg.prices && pkg.prices.length > 0 ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
    if (minPrice > maxBudget) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-tajawal">
      <Navbar />

      <main className="pt-28 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Page Title */}
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40">
            <Sparkles className="w-4 h-4 text-amber-400" /> البرامج والباقات المعتمدة (مباشرة من قاعدة البيانات)
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-white">
            كتالوج باقات العمرة والحج المباشرة 2026
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            تصفح جميع عروض وكالة ساوث ستريت المعتمدة رسميًا والمخزنة بقاعدة بيانات SQLite الحية.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" /> نوع الرحلة
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="ALL">جميع الأنواع (اقتصادية، VIP، حج)</option>
              <option value="ECONOMY">اقتصادية (ECONOMY)</option>
              <option value="VIP">فخمة VIP</option>
              <option value="GROUP">حملات الحج المعتمدة</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">الموسم</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="ALL">جميع المواسم</option>
              <option value="AUGUST">موسم أوت 2026</option>
              <option value="RAMADAN">موسم رمضان والمولد</option>
              <option value="HAJJ">موسم الحج 1447هـ</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              الحد الأقصى للميزانية: <span className="text-amber-400 font-black">{maxBudget.toLocaleString()} دج</span>
            </label>
            <input
              type="range"
              min="200000"
              max="1200000"
              step="50000"
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">جاري تحميل الباقات من قاعدة البيانات...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPackages.map((pkg) => {
              const minPrice = pkg.prices && pkg.prices.length > 0 ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
              return (
                <div
                  key={pkg.package_id}
                  className="rounded-3xl bg-slate-900 border border-white/10 overflow-hidden hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="relative h-48 w-full overflow-hidden">
                      <img src={pkg.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'} alt={pkg.name} className="w-full h-full object-cover" />
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/80 text-amber-300 text-xs font-bold border border-amber-500/40">
                        {pkg.type}
                      </span>
                      <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                        المقاعد المتبقية: {pkg.available}
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <h3 className="font-black text-lg font-cairo text-amber-300">{pkg.name}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{pkg.description}</p>

                      <div className="p-3 rounded-xl bg-slate-950/60 text-xs text-slate-300 space-y-1.5 border border-white/5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>مكة المكرمة: {pkg.makkah_hotel_name} ({pkg.makkah_hotel_dist})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Plane className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>الطيران: {pkg.airline}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>مدة الرحلة: {pkg.duration_days} يومًا</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0 flex items-center justify-between border-t border-white/5 mt-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block">تبدأ من سعر</span>
                      <span className="text-lg font-black text-amber-300 font-cairo">
                        {minPrice.toLocaleString()} <span className="text-xs">دج</span>
                      </span>
                    </div>

                    <Link
                      href="/portal"
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      حجز الآن <CheckCircle className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SakhrAgent />
    </div>
  );
}
