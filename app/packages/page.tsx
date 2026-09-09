'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import Footer from '@/components/Footer';
import { Package } from '@/types';
import { MapPin, Calendar, Plane, ChevronDown, Tag, Sparkles } from 'lucide-react';
import Link from 'next/link';
import KaabaIcon from '@/components/icons/KaabaIcon';
import { isPackageExpired } from '@/lib/booking-catalog';

const UMRAH_IMAGES = [
  '/images/kaaba_sharifa_home_page.png',
  '/images/kaaba_sharifa_home_page0.jpg',
  '/images/maka01.png',
  '/images/maka06.png',
  '/images/maka05.png',
];

const TYPE_LABEL: Record<string, string> = {
  ECONOMY: 'اقتصادية',
  STANDARD: 'عادية',
  PREMIUM: 'مميزة',
  VIP: 'فاخرة',
  FAMILY: 'عائلية',
  GROUP: 'حملة',
  CUSTOM: 'خاصة',
};

function isStockHotelPhoto(src?: string): boolean {
  const s = String(src || '');
  return /unsplash\.com|photo-1566073771259|photo-1582719478250|photo-1542314831|photo-1571896349842/.test(s);
}

function packageImage(pkg: Package, index: number): string {
  if (pkg.image_url && !isStockHotelPhoto(pkg.image_url)) return pkg.image_url;
  return UMRAH_IMAGES[index % UMRAH_IMAGES.length];
}

function formatTripDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [maxBudget, setMaxBudget] = useState<number>(1200000);

  useEffect(() => {
    fetch('/api/admin/packages')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPackages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredPackages = packages
    .filter((pkg) => {
      if (selectedSeason !== 'ALL' && !pkg.season_id?.toLowerCase().includes(selectedSeason.toLowerCase())) return false;
      if (selectedType !== 'ALL' && pkg.type !== selectedType) return false;
      const minPrice = pkg.prices?.length ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
      if (minPrice > maxBudget) return false;
      return true;
    })
    .sort((a, b) => Number(isPackageExpired(a)) - Number(isPackageExpired(b)));

  const emptySlots =
    filteredPackages.length === 0 ? 0 : (3 - (filteredPackages.length % 3)) % 3;

  return (
    <div className="page-shell catalog-page min-h-screen">
      <Navbar variant="light" />

      <main className="page-main pb-20 max-w-7xl mx-auto px-4 sm:px-6">
        <header className="catalog-head">
          <h1>العمرة والحج 2026</h1>
          <p>فنادق قرب الحرم — أسعار واضحة — مقاعد محدودة</p>
        </header>

        <div className="catalog-filters">
          <div className="catalog-field">
            <span><Tag /> النوع</span>
            <div className="catalog-select">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="ALL">كل الأنواع</option>
                <option value="ECONOMY">اقتصادية</option>
                <option value="VIP">فاخرة</option>
                <option value="GROUP">حملات الحج</option>
              </select>
              <ChevronDown className="catalog-select-chev" />
            </div>
          </div>
          <div className="catalog-field">
            <span><Calendar /> الموسم</span>
            <div className="catalog-select">
              <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
                <option value="ALL">كل المواسم</option>
                <option value="AUGUST">أوت 2026</option>
                <option value="RAMADAN">رمضان والمولد</option>
                <option value="HAJJ">الحج</option>
              </select>
              <ChevronDown className="catalog-select-chev" />
            </div>
          </div>
          <div className="catalog-field catalog-field-price">
            <div className="catalog-price-head">
              <span>الحد الأقصى</span>
              <b>حتى {maxBudget.toLocaleString('ar-DZ')} دج</b>
            </div>
            <div
              className="catalog-range-wrap"
              style={{ ['--pct' as string]: `${((maxBudget - 200000) / 1000000) * 100}%` }}
            >
              <div className="catalog-range-rail" aria-hidden>
                <i className="catalog-range-fill" />
              </div>
              <input
                type="range"
                min="200000"
                max="1200000"
                step="50000"
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
                className="catalog-range"
                aria-label="الحد الأقصى للسعر"
              />
              <div className="catalog-range-scale">
                <em>200 ألف</em>
                <em>600 ألف</em>
                <em>1.2 مليون</em>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="catalog-status">جاري التحميل...</p>
        ) : filteredPackages.length === 0 ? (
          <p className="catalog-status">لا توجد باقات مطابقة.</p>
        ) : (
          <div className="catalog-grid">
            {filteredPackages.map((pkg, index) => {
              const minPrice = pkg.prices?.length ? Math.min(...pkg.prices.map((p) => p.amount)) : 0;
              const img = packageImage(pkg, index);
              const expired = isPackageExpired(pkg);
              return (
                <article
                  key={pkg.package_id}
                  id={pkg.package_id}
                  className={`catalog-card pkg-anchor${expired ? ' is-expired' : ''}`}
                >
                  <div className="catalog-card-media">
                    <img
                      src={img}
                      alt={pkg.name}
                      onError={(e) => {
                        const el = e.currentTarget;
                        const next = UMRAH_IMAGES[(index + 1) % UMRAH_IMAGES.length];
                        if (el.src.includes(next)) return;
                        el.src = next;
                      }}
                    />
                    <span className="catalog-card-type">{TYPE_LABEL[pkg.type] || pkg.type}</span>
                    {expired ? (
                      <span className="catalog-card-expired">منتهية</span>
                    ) : (
                      <span className="catalog-card-seats">{pkg.available} مقعد</span>
                    )}
                  </div>
                  <div className="catalog-card-body">
                    <h2>{pkg.name}</h2>
                    <ul>
                      <li><MapPin className="w-3.5 h-3.5" /> {pkg.makkah_hotel_name}</li>
                      <li><Plane className="w-3.5 h-3.5" /> {pkg.airline}</li>
                      <li><Calendar className="w-3.5 h-3.5" /> {pkg.duration_days} يوماً</li>
                    </ul>
                    {expired ? (
                      <p className="catalog-expired-note">
                        انتهى هذا البرنامج في {formatTripDate(pkg.end_date || pkg.start_date)} ولا يمكن حجزه
                      </p>
                    ) : null}
                  </div>
                  <div className="catalog-card-foot">
                    <strong>{minPrice.toLocaleString('ar-DZ')} <small>دج</small></strong>
                    {expired ? (
                      <span className="catalog-card-closed">غير متاح</span>
                    ) : (
                      <Link href={`/book?package=${encodeURIComponent(pkg.package_id)}`}>حجز</Link>
                    )}
                  </div>
                </article>
              );
            })}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="catalog-card is-empty">
                <div className="catalog-empty-media">
                  <span className="catalog-empty-badge">قريباً</span>
                  <div className="catalog-empty-icon">
                    <KaabaIcon className="w-12 h-12" />
                    <Sparkles className="catalog-empty-spark" />
                  </div>
                </div>
                <div className="catalog-empty-body">
                  <strong>باقة جديدة</strong>
                  <span>مقعد شاغر في الكتالوج — سيُضاف برنامج هنا قريباً</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="catalog-back">
          <Link href="/">الرئيسية</Link>
        </p>
      </main>

      <Footer />
      <SakhrAgent />
    </div>
  );
}
