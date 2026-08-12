'use client';

import React from 'react';
import { Offer } from '@/types';
import { Eye, MapPin, Plane, Hotel, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface OfferCardProps {
  offer: Offer;
  index?: number;
  onSelect: (offer: Offer) => void;
}

export default function OfferCard({ offer, index = 0, onSelect }: OfferCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.12 }}
      whileHover={{ y: -7, transition: { duration: 0.25 } }}
      className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col group sheen-effect"
    >
      <div className="relative h-44 sm:h-52 bg-slate-900 overflow-hidden">
        <img
          src={offer.img}
          alt={offer.title_ar}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
        />
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-slate-950/80 text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-1.5 backdrop-blur-md border border-white/10">
          <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span>{offer.views} مشاهدة</span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 bg-emerald-600 text-white font-black text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full shadow-lg border border-emerald-400/50">
          {offer.duration}
        </div>
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1 text-right">
        <h3 className="text-base sm:text-lg font-black text-slate-900 mb-2 sm:mb-3 font-cairo line-clamp-1 group-hover:text-emerald-700 transition-colors">
          {offer.title_ar}
        </h3>

        <ul className="space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs text-slate-600 mb-3 sm:mb-4 flex-1 font-tajawal">
          <li className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>الانطلاق من: <strong className="text-slate-900">{offer.wilaya}</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>نوع الرحلة: <strong className="text-slate-900">{offer.flight_type}</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <Hotel className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span className="line-clamp-1">إقامة مكة: <strong className="text-slate-900">{offer.makkah_hotel}</strong> ({offer.makkah_dist})</span>
          </li>
        </ul>

        <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium font-tajawal">السعر للشخص (Quint)</div>
            <div className="text-base sm:text-lg font-black text-emerald-600 font-cairo">{offer.price_quin}</div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(offer)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] sm:text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1 sm:gap-1.5 border border-blue-400"
          >
            <span>التفاصيل والحجز</span>
            <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
