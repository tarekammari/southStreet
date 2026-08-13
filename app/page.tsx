'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import AgencySection from '@/components/AgencySection';
import PromoBillboard from '@/components/PromoBillboard';
import AboutSection from '@/components/AboutSection';
import TravelProgramsSection from '@/components/TravelProgramsSection';
import SakhrAgent from '@/components/SakhrAgent';
import Link from 'next/link';
import { User } from '@/types';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => { const session = localStorage.getItem('south_street_user'); if (session) { try { setCurrentUser(JSON.parse(session)); } catch { localStorage.removeItem('south_street_user'); } } }, []);
  const handleLogout = () => { localStorage.removeItem('south_street_user'); localStorage.removeItem('south_street_token'); setCurrentUser(null); };
  const restoreUser = () => { const session = localStorage.getItem('south_street_user'); if (session) setCurrentUser(JSON.parse(session)); };

  return <div className="min-h-screen bg-slate-app">
    <Navbar currentUser={currentUser} onLogout={handleLogout} onSelectRole={restoreUser} />
    <main className="relative overflow-hidden">
      <section className="relative z-10 w-full px-3 sm:px-6"><HeroSection /></section>
      <section id="agency-section" className="relative z-10 w-full px-3 py-8 sm:px-6 sm:py-12"><AgencySection /></section>
      <PromoBillboard />
      <AboutSection />
      <TravelProgramsSection />
      <SakhrAgent />
    </main>
    <footer id="contact" className="bg-slate-950 text-white pt-12 pb-6 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
        <div className="space-y-3"><img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="h-12 w-auto object-contain" /><p className="text-xs text-slate-400 leading-relaxed font-amiri">وكالة ساوث ستريت لتنظيم رحلات العمرة والحج. نرافق ضيوف الرحمن بخدمة منظمة، خيارات إقامة مدروسة، ودعم حاضر طوال الرحلة.</p></div>
        <div className="space-y-2 text-xs text-slate-400"><h4 className="font-bold text-gold-main text-sm mb-2 font-cairo">روابط سريعة</h4><div><a href="#about-section" className="hover:text-white">عن الوكالة</a></div><div><a href="#programs-section" className="hover:text-white">برامج السفر</a></div><div><Link href="/portal?tab=rituals" className="hover:text-white">دليل العمرة</Link></div></div>
        <div className="space-y-2 text-xs text-slate-400"><h4 className="font-bold text-gold-main text-sm mb-2 font-cairo">التواصل</h4><div>البريد: info@south-street.com</div><div>الهاتف: +966 50 123 4567</div><div className="text-emerald-400 font-bold mt-2">● فريقنا جاهز لمساعدتك</div></div>
      </div>
      <div className="text-center text-xs text-slate-500 pt-6">© 2026 South Street Agency. جميع الحقوق محفوظة.</div>
    </footer>
  </div>;
}
