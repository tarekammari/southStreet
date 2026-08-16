'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import { Hotel } from '@/types';
import { MapPin, Star, CheckCircle, Video, Image as ImageIcon } from 'lucide-react';

export default function HotelsPage() {
  const HOTELS: Hotel[] = [
    {
      hotel_id: 'htl_swissotel_makkah',
      name: 'فندق سويس أوتيل مكة (Swissôtel Makkah)',
      city: 'MAKKAH',
      category: 'VIP',
      address: 'مجمع أبراج البيت، صحن الحرم المكي الشريف',
      latitude: 21.4187,
      longitude: 39.8256,
      distance_from_haram: '50م فقط (دخول مباشر لصحن الحرم عبر مجمع الأبراج)',
      description: 'فندق فاخر خماسي النجوم يطل مباشرة على الكعبة المشرفة وصحن الحرم المكي.',
      services: ['بوفيه مفتوح', 'واي فاي سريع', 'خدمة الغرف 24/7', 'دخول مباشر للمصلى'],
      images: [
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop'
      ],
      videos: [],
      status: 'ACTIVE'
    },
    {
      hotel_id: 'htl_manarat_gaza',
      name: 'فندق منارات غزة مكة المكرمة',
      city: 'MAKKAH',
      category: '4_STAR',
      address: 'منطقة غزة، مكة المكرمة',
      latitude: 21.4245,
      longitude: 39.8312,
      distance_from_haram: '350م فقط عن صحن الحرم المكي',
      description: 'فندق حديث مميز بالقرب السريع من صحن الحرم وغرف واسعة للعائلات والأفراد.',
      services: ['تكييف مركزي', 'شاشات مسطحة', 'خدمة حافلات عند الحاجة', 'مطعم إعاشة'],
      images: [
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop'
      ],
      videos: [],
      status: 'ACTIVE'
    },
    {
      hotel_id: 'htl_pullman_madinah',
      name: 'فندق بولمان زمزم المدينة المنورة',
      city: 'MADINAH',
      category: '5_STAR',
      address: 'المنطقة المركزية الشمالية، المدينة المنورة',
      latitude: 24.4672,
      longitude: 39.6111,
      distance_from_haram: 'خطوات معدودة عن المسجد النبوي الشريف وباب النساء',
      description: 'إقامة راقية ومباشرة بالمنطقة المركزية بالقرب من الروضة الشريفة.',
      services: ['بوفيه مفتوح', 'إرشاد خاص', 'خدمات كبار السن', 'مركز رجال الأعمال'],
      images: [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop'
      ],
      videos: [],
      status: 'ACTIVE'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-tajawal">
      <Navbar />

      <main className="pt-28 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/40">
            🏨 فنادق مكة المكرمة والمدينة المنورة
          </span>
          <h1 className="text-3xl sm:text-4xl font-black font-cairo text-white">
            فنادقنا المعتمدة بالقرب من الحرمين الشريفين
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            تختار ساوث ستريت الفنادق ذات المواقع الاستراتيجية القريبة جداً من صحن الحرم المكي الشريف والمسجد النبوي.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOTELS.map((htl) => (
            <div key={htl.hotel_id} className="rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-xl space-y-4">
              <div className="relative h-48 w-full">
                <img src={htl.images[0]} alt={htl.name} className="w-full h-full object-cover" />
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
      </main>

      <SakhrAgent />
    </div>
  );
}
