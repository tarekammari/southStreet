'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin, ArrowUpLeft } from 'lucide-react';

const FOOTER_LINKS = [
  { label: 'عن الوكالة', href: '/#about-section' },
  { label: 'برامج السفر', href: '/#programs-section' },
  { label: 'الباقات', href: '/packages' },
  { label: 'الفنادق', href: '/hotels' },
  { label: 'دليل العمرة', href: '/portal?tab=rituals' },
  { label: 'بوابة الوكالة', href: '/portal' },
];

export default function Footer() {
  return (
    <footer id="contact" className="relative bg-slate-950 text-white pt-16 pb-8 border-t border-slate-800/80 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(4,120,87,0.12),_transparent_60%)] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-800">
          <div className="md:col-span-5 space-y-4">
            <img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="h-11 w-auto object-contain" />
            <p className="text-sm text-slate-400 leading-relaxed font-amiri max-w-sm">
              وكالة ساوث ستريت لتنظيم رحلات العمرة والحج. نرافق ضيوف الرحمن بخدمة منظمة، إقامة مدروسة، ودعم حاضر طوال الرحلة.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-full border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              فريقنا جاهز لمساعدتك
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h4 className="font-bold text-gold-main text-sm font-cairo">روابط سريعة</h4>
            <nav className="flex flex-col gap-2">
              {FOOTER_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 group"
                >
                  <ArrowUpLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="md:col-span-4 space-y-4">
            <h4 className="font-bold text-gold-main text-sm font-cairo">التواصل</h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>info@south-street.com</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span dir="ltr">+213 21 55 44 33</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>شارع 01 نوفمبر 1954، الجزائر العاصمة</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-slate-500">
          <span>© 2026 South Street Agency. جميع الحقوق محفوظة.</span>
          <span className="text-slate-600">صُمم بعناية لخدمة ضيوف الرحمن</span>
        </div>
      </div>
    </footer>
  );
}
