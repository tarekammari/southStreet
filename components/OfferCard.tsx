'use client';

import React from 'react';
import { Offer } from '@/types';
import { Eye, MapPin, Plane, Hotel, CheckCircle } from 'lucide-react';

interface OfferCardProps {
  offer: Offer;
  onSelect: (offer: Offer) => void;
}

export default function OfferCard({ offer, onSelect }: OfferCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1">
      <div className="relative h-52 bg-slate-300 overflow-hidden">
        <img
          src={offer.img}
          alt={offer.title_ar}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 bg-slate-950/80 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md">
          <Eye className="w-3.5 h-3.5 text-gold-main" />
          <span>{offer.views}</span>
        </div>
        <div className="absolute bottom-3 right-3 bg-emerald-main text-white font-extrabold text-xs px-3.5 py-1 rounded-full shadow-md">
          {offer.duration}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 text-right">
        <h3 className="text-lg font-bold text-slate-900 mb-3 font-cairo line-clamp-1">{offer.title_ar}</h3>

        <ul className="space-y-2 text-xs text-slate-600 mb-4 flex-1">
          <li className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-main shrink-0" />
            <span>الولاية: <strong className="text-slate-900">{offer.wilaya}</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-emerald-main shrink-0" />
            <span>مسار الرحلة: <strong className="text-slate-900">{offer.flight_type}</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <Hotel className="w-4 h-4 text-emerald-main shrink-0" />
            <span className="line-clamp-1">{offer.makkah_hotel} ({offer.makkah_dist})</span>
          </li>
        </ul>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div>
            <div className="text-xs text-slate-500 font-medium">سعر السرير Quint</div>
            <div className="text-lg font-black text-emerald-main">{offer.price_quin}</div>
          </div>
          <button
            onClick={() => onSelect(offer)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            التفاصيل والحجز
          </button>
        </div>
      </div>
    </div>
  );
}
