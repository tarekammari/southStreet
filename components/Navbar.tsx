'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User, UserRole } from '@/types';
import { User as UserIcon, Globe, LogOut, Shield, Compass, Sparkles } from 'lucide-react';
import LoginModal from './LoginModal';

interface NavbarProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

export default function Navbar({ currentUser, onLogout, onSelectRole }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [lang, setLang] = useState<'ar' | 'fr'>('ar');

  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'fr' : 'ar';
    setLang(nextLang);
    document.documentElement.lang = nextLang;
    document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <>
      <header className="top-header-clean">
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          <img
            src="/images/south_street_logo.png"
            alt="SOUTH STREET Logo"
            className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <ul className="hidden md:flex items-center gap-1 list-none">
          <li>
            <Link href="/" className="text-slate-900 font-bold px-3.5 py-1.5 rounded-md hover:bg-slate-100 hover:text-emerald-main transition-all text-sm flex items-center gap-1.5">
              الرئيسية
            </Link>
          </li>
          <li>
            <a href="#offers-section" className="text-slate-900 font-bold px-3.5 py-1.5 rounded-md hover:bg-slate-100 hover:text-emerald-main transition-all text-sm flex items-center gap-1.5">
              عروض العمرة
            </a>
          </li>
          <li>
            <Link href="/portal?tab=rituals" className="text-slate-900 font-bold px-3.5 py-1.5 rounded-md hover:bg-slate-100 hover:text-emerald-main transition-all text-sm flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-gold-main" />
              دليل العمرة
            </Link>
          </li>
          <li>
            <Link href="/portal" className="text-slate-900 font-bold px-3.5 py-1.5 rounded-md hover:bg-slate-100 hover:text-emerald-main transition-all text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-main" />
              البوابة التفاعلية
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link href="/portal" className="flex items-center gap-2.5 bg-emerald-deep text-white px-3.5 py-1.5 rounded-lg border border-gold-main text-xs font-bold shadow-sm hover:scale-102 transition-transform">
                <div className="w-7 h-7 rounded-full bg-gold-main text-slate-900 flex items-center justify-center font-bold text-sm">
                  {currentUser.avatar || currentUser.name[0]}
                </div>
                <div className="flex flex-col text-right">
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] text-gold-light font-semibold">{currentUser.roleName}</span>
                </div>
              </Link>
              <button
                onClick={onLogout}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="تسجيل خروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="bg-gradient-to-r from-emerald-main to-emerald-dark text-white font-extrabold text-xs md:text-sm px-4 py-2 rounded-md hover:bg-emerald-light transition-all flex items-center gap-2 shadow-sm"
            >
              <UserIcon className="w-4 h-4" />
              بوابة الوكالة والأكواد
            </button>
          )}

          <button
            onClick={toggleLanguage}
            className="bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1 hover:bg-slate-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ar' ? 'FR' : 'AR'}
          </button>
        </div>
      </header>

      {isLoginOpen && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
          onSelectRole={(code, name) => {
            setIsLoginOpen(false);
            if (onSelectRole) onSelectRole(code, name);
          }}
        />
      )}
    </>
  );
}
