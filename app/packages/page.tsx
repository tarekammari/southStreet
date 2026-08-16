'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import { Package } from '@/types';
import { Sparkles, MapPin, Calendar, CheckCircle, Plane, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [maxBudget, setMaxBudget] = useState<number>(1000000);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(() => {
        // Load initial packages dynamically from local db or fallback
        const mockPkgs: Package[] = [
          {
            package_id: 'pkg_august_economy_2026',
            name: 'باقة أوت الاقتصادية المميزة (طيران مباشر)',
            type: 'ECONOMY',
            season_id: 'season_august_2026',
            season_name: 'موسم عمرة أوت 2026',
            description: 'رحلة عمرة مباشرة اقتصادية مريحة تشمل طيران مباشر، فندق منارات غزة 350م من صحن الحرم المكي، وتنقلات VIP.',
            start_date: '2026-08-15',
            end_date: '2026-08-29',
            duration_days: 15,
            departure_city: 'الجزائر العاصمة / وهران / عنابة',
            departure_airport: 'مطار هواري بومدين (ALG)',
            arrival_airport: 'مطار الأمير محمد بن عبد العزيز (MED)',
            airline: 'الخطوط الجوية الجزائرية والخطوط السعودية',
            makkah_hotel_id: 'htl_manarat_gaza',
            makkah_hotel_name: 'فندق منارات غزة مكة',
            makkah_hotel_dist: '350م فقط عن صحن الحرم المكي',
            madinah_hotel_id: 'htl_pullman_madinah',
            madinah_hotel_name: 'فندق بولمان زمزم المدينة',
            madinah_hotel_dist: 'خطوات عن المسجد النبوي',
            hotel_category: '4 نجوم / 5 نجوم',
            prices: [
              { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 215000 },
              { room_type: 'DOUBLE', traveler_type: 'ADULT', currency: 'DZD', amount: 265000 }
            ],
            included_services: ['تأشيرة النسك', 'طيران مباشر', 'فنادق 350م', 'حافلات VIP', 'مرافقة دينية'],
            excluded_services: ['المشتريات الشخصية'],
            booking_conditions: ['دفع 30% عربون'],
            cancellation_policy: 'إلغاء مجاني حتى 20 يوماً قبل السفر',
            capacity: 45,
            reserved: 28,
            available: 17,
            status: 'PUBLISHED',
            published: true,
            image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'
          },
          {
            package_id: 'pkg_mawlid_vip_2026',
            name: 'باقة المولد النبوي VIP (سويس أوتيل برج الساعة)',
            type: 'VIP',
            season_id: 'season_ramadan_2026',
            season_name: 'موسم عمرة المولد VIP',
            description: 'إقامة VIP مطلة ومباشرة على صحن الحرم المكي بفندق سويس أوتيل برج الساعة (50م فقط)، مع إعاشة بوفيه فاخر.',
            start_date: '2026-09-12',
            end_date: '2026-09-27',
            duration_days: 15,
            departure_city: 'الجزائر العاصمة',
            departure_airport: 'مطار هواري بومدين (ALG)',
            arrival_airport: 'مطار الملك عبد العزيز (JED)',
            airline: 'الخطوط السعودية (Saudia VIP)',
            makkah_hotel_id: 'htl_swissotel_makkah',
            makkah_hotel_name: 'فندق سويس أوتيل مكة برج الساعة',
            makkah_hotel_dist: '50م فقط عن صحن الحرم',
            madinah_hotel_id: 'htl_pullman_madinah',
            madinah_hotel_name: 'فندق بولمان زمزم المدينة',
            madinah_hotel_dist: 'خطوات عن المسجد النبوي',
            hotel_category: '5 نجوم VIP',
            prices: [
              { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 295000 },
              { room_type: 'DOUBLE', traveler_type: 'ADULT', currency: 'DZD', amount: 375000 }
            ],
            included_services: ['تأشيرة سريعة', 'طيران VIP', 'بوفيه فاخر', 'تصريح الروضة'],
            excluded_services: [],
            booking_conditions: ['دفع 40% عند الحجز'],
            cancellation_policy: 'استرجاع كامل المبلغ عند الإلغاء الرسمي',
            capacity: 30,
            reserved: 21,
            available: 9,
            status: 'PUBLISHED',
            published: true,
            image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop'
          },
          {
            package_id: 'pkg_hajj_direct_1447',
            name: 'برنامج الحج المباشر والتكفل التام 1447هـ',
            type: 'GROUP',
            season_id: 'season_hajj_1447',
            season_name: 'موسم الحج 1447هـ',
            description: 'حملة الحج المعتمدة رسمياً بالتكفل الشامل بجميع المشاعر المقدسة (منى، عرفات، ومزدلفة).',
            start_date: '2026-05-18',
            end_date: '2026-06-22',
            duration_days: 35,
            departure_city: 'جميع المطارات الوطنية',
            departure_airport: 'مطار هواري بومدين (ALG)',
            arrival_airport: 'مطار الملك عبد العزيز (JED)',
            airline: 'الخطوط الجوية الجزائرية والخطوط السعودية',
            makkah_hotel_id: 'htl_swissotel_makkah',
            makkah_hotel_name: 'فنادق أبراج مكة المركزية',
            makkah_hotel_dist: 'المنطقة المركزية مكة',
            madinah_hotel_id: 'htl_pullman_madinah',
            madinah_hotel_name: 'فنادق المنطقة المركزية',
            madinah_hotel_dist: 'خطوات عن الحرم النبوي',
            hotel_category: '5 نجوم VIP',
            prices: [
              { room_type: 'QUAD', traveler_type: 'ADULT', currency: 'DZD', amount: 890000 }
            ],
            included_services: ['تأشيرة الحج الرسمية', 'مخيمات منى وعرفات', 'بوفيه 3 وجبات'],
            excluded_services: ['الهدي الشخصي'],
            booking_conditions: ['التسجيل بشرط القرعة الرسمية'],
            cancellation_policy: 'قوانين الديوان الوطني للحج والعمرة',
            capacity: 100,
            reserved: 65,
            available: 35,
            status: 'PUBLISHED',
            published: true,
            image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop'
          }
        ];
        setPackages(mockPkgs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredPackages = packages.filter((pkg) => {
    if (selectedSeason !== 'ALL' && !pkg.season_id.includes(selectedSeason.toLowerCase())) return false;
    if (selectedType !== 'ALL' && pkg.type !== selectedType) return false;
    const minPrice = Math.min(...pkg.prices.map((p) => p.amount));
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
            <Sparkles className="w-4 h-4 text-amber-400" /> البرامج والباقات المعتمدة
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-white">
            كتالوج باقات العمرة والحج المباشرة 2026
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            تصفح جميع عروض وكالة ساوث ستريت المعتمدة رسميًا مع تحديد الأسعار المؤكدة والمقاعد المتاحة بالوقت الحقيقي.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => {
            const minPrice = Math.min(...pkg.prices.map((p) => p.amount));
            return (
              <div
                key={pkg.package_id}
                className="rounded-3xl bg-slate-900 border border-white/10 overflow-hidden hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-xl"
              >
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
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
      </main>

      <SakhrAgent />
    </div>
  );
}
