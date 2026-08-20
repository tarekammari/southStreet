'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import AgencySection from '@/components/AgencySection';
import PromoBillboard from '@/components/PromoBillboard';
import AboutSection from '@/components/AboutSection';
import TravelProgramsSection from '@/components/TravelProgramsSection';
import SakhrAgent from '@/components/SakhrAgent';
import Footer from '@/components/Footer';
import { User } from '@/types';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('south_street_user');
    if (session) {
      try { setCurrentUser(JSON.parse(session)); }
      catch { localStorage.removeItem('south_street_user'); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('south_street_user');
    localStorage.removeItem('south_street_token');
    setCurrentUser(null);
  };

  const restoreUser = () => {
    const session = localStorage.getItem('south_street_user');
    if (session) setCurrentUser(JSON.parse(session));
  };

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar currentUser={currentUser} onLogout={handleLogout} onSelectRole={restoreUser} />
      <main className="page-main relative overflow-hidden pb-6">
        <section id="hero-section" className="relative z-10 w-full px-3 sm:px-6 pt-4">
          <HeroSection />
        </section>
        <section id="agency-section" className="relative z-10 w-full px-3 py-8 sm:px-6 sm:py-12">
          <AgencySection />
        </section>
        <section id="promo-section">
          <PromoBillboard />
        </section>
        <AboutSection />
        <TravelProgramsSection />
        <SakhrAgent />
      </main>
      <Footer />
    </div>
  );
}
