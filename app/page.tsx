'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import AgencySection from '@/components/AgencySection';
import PromoBillboard from '@/components/PromoBillboard';
import AboutSection from '@/components/AboutSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import TravelProgramsSection from '@/components/TravelProgramsSection';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import Footer from '@/components/Footer';
import { BackToTop, HomeCta, ScrollProgress } from '@/components/home/HomeEffects';
import SessionHeartbeat from '@/components/SessionHeartbeat';
import PendingRequestBanner from '@/components/booking/PendingRequestBanner';
import WelcomeBanner from '@/components/WelcomeBanner';
import { User } from '@/types';
import { fetchJsonList } from '@/lib/fetch-json';
import { PageContentRow, pickPageContent } from '@/lib/page-content';
import { logoutAndReload, syncSessionProfile } from '@/lib/client-session';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pageContent, setPageContent] = useState<PageContentRow[]>([]);

  useEffect(() => {
    const session = localStorage.getItem('south_street_user');
    if (session) {
      try { setCurrentUser(JSON.parse(session)); }
      catch { localStorage.removeItem('south_street_user'); }
    }
    void syncSessionProfile().then((user) => {
      if (user) setCurrentUser(user);
    });
    fetchJsonList<PageContentRow>('/api/admin/content').then(setPageContent);
  }, []);

  const handleLogout = () => {
    void logoutAndReload('/');
  };

  const restoreUser = () => {
    const session = localStorage.getItem('south_street_user');
    if (session) setCurrentUser(JSON.parse(session));
  };

  const navPromo = pickPageContent(pageContent, 'nav_promo', { title: '' });

  return (
    <div className="page-shell page-shell-home min-h-screen bg-slate-app">
      <Navbar currentUser={currentUser} onLogout={handleLogout} onSelectRole={restoreUser} variant="light" showPromo promoLine={navPromo.title || undefined} />
      <PendingRequestBanner user={currentUser} variant="home" />
      {currentUser ? <div className="max-w-5xl mx-auto px-4 pt-3"><WelcomeBanner /></div> : null}
      <main className="page-main relative overflow-x-clip pb-6">
        <HeroSection content={pageContent} />
        <TravelProgramsSection content={pageContent} />
        <section id="agency-section" className="relative z-10 w-full px-3 py-8 sm:px-6 sm:py-12">
          <AgencySection />
        </section>
        <section id="promo-section">
          <PromoBillboard content={pageContent} />
        </section>
        <AboutSection content={pageContent} />
        <TestimonialsSection />
        <HomeCta />
        <SakhrAgent />
      </main>
      <Footer content={pageContent} />
      <ScrollProgress />
      <BackToTop />
      {currentUser ? <SessionHeartbeat /> : null}
    </div>
  );
}
