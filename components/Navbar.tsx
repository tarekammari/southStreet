'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { User } from '@/types';
import LoginModal from './LoginModal';

interface NavbarProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

const NAV_LINKS = [
  { label: 'الرئيسية',       href: '/' },
  { label: 'عروض العمرة',    href: '#offers-section', scroll: true },
  { label: 'دليل العمرة',    href: '/portal?tab=rituals' },
  { label: 'البوابة',        href: '/portal' },
];

export default function Navbar({ currentUser, onLogout, onSelectRole }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleScrollLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  return (
    <>
      <header
        className="top-header-clean"
        style={scrolled ? { background: 'rgba(4,6,18,0.92)', borderBottomColor: 'rgba(255,255,255,0.1)' } : {}}
      >
        {/* ── Logo ── */}
        <Link href="/" className="flex items-center shrink-0" aria-label="South Street Home">
          <img
            src="/images/south_street_logo_white_white.png"
            alt="SOUTH STREET"
            className="nav-logo-img"
          />
        </Link>

        {/* ── Desktop Nav Links — centred ── */}
        <nav className="hidden md:flex items-center gap-0" aria-label="Primary navigation">
          {NAV_LINKS.map(({ label, href, scroll }) => (
            <a
              key={href}
              href={href}
              onClick={scroll ? (e) => handleScrollLink(e as any, href) : undefined}
              className="relative text-white/75 hover:text-white font-medium text-sm px-4 py-2 transition-colors duration-200 group font-tajawal tracking-wide"
            >
              {label}
              {/* Underline indicator on hover */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-4/5 h-px bg-white/50 transition-all duration-300 rounded-full" />
            </a>
          ))}
        </nav>

        {/* ── Right Actions ── */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <>
              {/* Avatar chip */}
              <Link
                href="/portal"
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/8 transition-all duration-200"
              >
                <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-black text-sm font-cairo shrink-0">
                  {currentUser.name?.[0]}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-white font-semibold text-xs leading-none font-tajawal">{currentUser.name}</p>
                  <p className="text-white/50 text-[10px] leading-none mt-0.5 font-tajawal">{currentUser.roleName}</p>
                </div>
              </Link>
              <button
                onClick={onLogout}
                className="text-white/50 hover:text-red-400 text-xs font-tajawal transition-colors duration-200 cursor-pointer px-2"
                title="تسجيل خروج"
              >
                خروج
              </button>
            </>
          ) : (
            /* Primary CTA — Portal button */
            <button
              onClick={() => setIsLoginOpen(true)}
              className="relative overflow-hidden font-tajawal font-bold text-sm text-white px-5 py-2.5 cursor-pointer transition-all duration-200 hover:brightness-110 hover:scale-[1.03] group"
              style={{
                background: '#2563eb',
                borderRadius: '12px',
                boxShadow: '0 2px 16px rgba(37,99,235,0.35)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(37,99,235,0.55)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 16px rgba(37,99,235,0.35)')}
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
              بوابة الوكالة
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex flex-col gap-1 p-2 cursor-pointer"
            aria-label="Toggle menu"
          >
            <span className={`w-5 h-px bg-white/80 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
            <span className={`w-5 h-px bg-white/80 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-px bg-white/80 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
          </button>
        </div>
      </header>

      {/* ── Mobile Dropdown ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed top-[68px] inset-x-0 z-[199] py-4 px-6 flex flex-col gap-1 animate-fade-in"
          style={{ background: 'rgba(4,6,18,0.96)', backdropFilter: 'blur(28px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {NAV_LINKS.map(({ label, href, scroll }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => { handleScrollLink(e as any, href); setMobileOpen(false); }}
              className="text-white/80 hover:text-white font-tajawal font-medium text-base py-2.5 border-b border-white/5 last:border-0 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      )}

      {/* ── Login Modal ── */}
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
