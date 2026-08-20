'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import Footer from '@/components/Footer';
import { Hotel } from '@/types';
import { MapPin, Sparkles, ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/hotels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHotels(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar />

      <main className="page-main pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-4 mb-10 pt-6">
          <span className="badge-pro">
            <Sparkles className="w-4 h-4" /> فنادق الحرمين الشريفين
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-slate-900">
            فنادقنا المعتمدة بالقرب من الحرمين
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            مواقع استراتيجية قريبة من صحن الحرم المكي الشريف والمسجد النبوي — مختارة بعناية لراحة ضيوف الرحمن.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">جاري تحميل الفنادق...</div>
        ) : hotels.length === 0 ? (
          <div className="text-center py-20 text-slate-500">لا توجد فنادق مسجلة حالياً.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((htl) => (
              <article key={htl.hotel_id} className="group rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-300 hover:shadow-xl transition-all">
                <div className="relative h-48 overflow-hidden">
                  <img src={htl.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'} alt={htl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/95 text-slate-800 text-xs font-bold shadow">
                    {htl.city === 'MAKKAH' ? '🕋 مكة' : '🕌 المدينة'}
                  </span>
                  {htl.category && (
                    <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-0.5">
                      <Star className="w-3 h-3" /> {htl.category}
                    </span>
                  )}
                </div>
                <div className="p-5 space-y-3">
                  <h3 className="font-black text-base font-cairo text-slate-900 group-hover:text-emerald-700 transition-colors">{htl.name}</h3>
                  <p className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {htl.distance_from_haram}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">{htl.description}</p>
                  {htl.services?.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-bold mb-1.5">الخدمات:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {htl.services.map((s, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
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
