'use client';

import { Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import BookingWizard from '@/components/booking/BookingWizard';
import { User } from '@/types';

function BookPageInner() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('south_street_user');
    if (session) {
      try { setCurrentUser(JSON.parse(session)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('south_street_user');
    localStorage.removeItem('south_street_token');
    setCurrentUser(null);
  };

  return (
    <div className="page-shell min-h-screen bg-slate-app">
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onSelectRole={() => {
          const session = localStorage.getItem('south_street_user');
          if (session) setCurrentUser(JSON.parse(session));
        }}
        variant="light"
      />
      <main className="page-main book-page-main pb-8 max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <h1 className="sr-only">طلب العمرة</h1>
        <BookingWizard />
      </main>
      <Footer />
      <SakhrAgent />
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen page-shell flex items-center justify-center text-slate-500">جاري التحميل...</div>}>
      <BookPageInner />
    </Suspense>
  );
}
