'use client';

import { Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import BookingWizard from '@/components/booking/BookingWizard';
import { User } from '@/types';
import { Sparkles } from 'lucide-react';

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
      <main className="page-main pb-16 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-8 pt-4">
          <span className="badge-pro">
            <Sparkles className="w-4 h-4" /> حجز العمرة خطوة بخطوة
          </span>
          <h1 className="text-2xl sm:text-3xl font-black font-cairo text-slate-900">أكّد طلب عمرتك أو أدر برنامجك</h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            أربع خطوات للحجز الجديد. إذا كان لديك طلب قائم، يمكنك تعديله أو إلغاؤه ثم الحجز من جديد — دون فتح طلب مزدوج.
          </p>
        </div>
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
