'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import { Hotel } from '@/types';
import { MapPin, Sparkles } from 'lucide-react';

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/hotels')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHotels(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-tajawal">
      <Navbar />

      <main className="pt-28 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/40">
            <Sparkles className="w-4 h-4 text-indigo-400" /> فنادق مكة المكرمة والمدينة المنورة (مباشرة من قاعدة البيانات)
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-white">
            فنادقنا المعتمدة بالقرب من الحرمين الشريفين
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            تختار ساوث ستريت الفنادق ذات المواقع الاستراتيجية القريبة جداً من صحن الحرم المكي الشريف والمسجد النبوي.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">جاري تحميل الفنادق من قاعدة البيانات...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hotels.map((htl) => (
              <div key={htl.hotel_id} className="rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-xl space-y-4">
                <div className="relative h-48 w-full">
                  <img src={htl.images[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'} alt={htl.name} className="w-full h-full object-cover" />
                  <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/80 text-amber-300 text-xs font-bold border border-amber-500/40">
                    {htl.city === 'MAKKAH' ? '🕋 مكة المكرمة' : '🕌 المدينة المنورة'}
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  <h3 className="font-black text-base font-cairo text-indigo-300">{htl.name}</h3>
                  <p className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {htl.distance_from_haram}
                  </p>
                  <p className="text-xs text-slate-300">{htl.description}</p>

                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">الخدمات المتوفرة:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {htl.services.map((s, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SakhrAgent />
    </div>
  );
}
