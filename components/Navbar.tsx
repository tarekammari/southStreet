'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ShieldCheck, LogOut, User as UserIcon, Settings, ChevronDown } from 'lucide-react';
import { User } from '@/types';
import LoginModal from './LoginModal';

interface NavbarProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

const NAV_LINKS = [
  { label: 'الرئيسية', href: '/' },
  { label: 'عن الوكالة', href: '#about-section' },
  { label: 'البرامج', href: '#programs-section' },
  { label: 'دليل العمرة', href: '/portal?tab=rituals' }
];

export default function Navbar({ currentUser, onLogout, onSelectRole }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', listener, { passive: true });

    const handleOpenLogin = () => setIsLoginOpen(true);
    window.addEventListener('southstreet:open-login', handleOpenLogin);

    return () => {
      window.removeEventListener('scroll', listener);
      window.removeEventListener('southstreet:open-login', handleOpenLogin);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeMenu = () => setMobileOpen(false);

  const isAdmin = currentUser && (
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'AGENCY_MANAGER' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    currentUser.name?.includes('المدير') ||
    (currentUser as any).email?.includes('admin') ||
    (currentUser as any).email?.includes('manager')
  );

  return (
    <>
      <header
        className={`top-header-clean ${scrolled ? 'shadow-2xl' : ''}`}
        style={scrolled ? { background: 'rgba(4,6,18,0.94)', borderBottomColor: 'rgba(255,255,255,0.12)' } : {}}
      >
        <Link href="/" className="flex items-center shrink-0" aria-label="South Street Home">
          <img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="nav-logo-img" />
        </Link>
        
        {/* Center Navigation Links with Dashboard link in the middle for Admins */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
          {NAV_LINKS.map(link => link.href.startsWith('#') ? (
            <a key={link.href} href={link.href} className="relative text-white/75 hover:text-white font-medium text-sm px-4 py-2 transition-colors duration-200">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className="relative text-white/75 hover:text-white font-medium text-sm px-4 py-2 transition-colors duration-200">
              {link.label}
            </Link>
          ))}

          {/* Admin Dashboard link directly in the center navigation links */}
          {isAdmin && (
            <Link
              href="/admin"
              className="relative text-emerald-400 hover:text-emerald-300 font-bold text-sm px-4 py-2 transition-colors duration-200 flex items-center gap-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 ml-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>لوحة التحكم</span>
            </Link>
          )}
        </nav>

        {/* Right Actions: Profile Dropdown or Login Button */}
        <div className="flex items-center gap-2.5 shrink-0 relative" ref={dropdownRef}>
          {currentUser ? (
            <div className="relative">
              {/* Professional Profile Avatar Button */}
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition cursor-pointer"
                title={currentUser.name}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950 text-sm shadow-md ring-2 ring-amber-400/40">
                  {currentUser.name?.[0]?.toUpperCase()}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ml-1 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Sliding Professional Profile Dropdown Menu */}
              {profileOpen && (
                <div
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)' }}
                  className="absolute left-0 mt-3 w-64 border rounded-3xl p-4.5 z-[9999] text-right text-white font-cairo animate-fade-in space-y-3"
                >
                  
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950 text-base shadow-md">
                      {currentUser.name?.[0]?.toUpperCase()}
                    </span>
                    <div className="overflow-hidden text-right">
                      <p className="font-bold text-white text-xs truncate">{currentUser.name}</p>
                      <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40 mt-0.5">
                        {currentUser.role || 'مستخدم معتمد'}
                      </span>
                    </div>
                  </div>

                  {/* Options Menu */}
                  <div className="space-y-1 text-xs font-bold">
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-900/40 text-emerald-300 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>لوحة التحكم الرقمية</span>
                      </Link>
                    )}

                    <Link
                      href="/portal?tab=profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 transition"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>الملف الشخصي والحساب</span>
                    </Link>

                    <Link
                      href="/portal?tab=security"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 transition"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>الإعدادات والأمان</span>
                    </Link>
                  </div>

                  {/* Logout Divider & Action */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition text-xs font-bold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400 cursor-pointer"
            >
              بوابة الوكالة
            </button>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-white md:hidden" aria-label="فتح القائمة">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <nav className="fixed top-[68px] inset-x-0 z-[199] border-b border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-xl md:hidden space-y-2">
          {NAV_LINKS.map(link => link.href.startsWith('#') ? (
            <a key={link.href} href={link.href} onClick={closeMenu} className="block border-b border-white/10 py-3 text-sm text-white/85">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} onClick={closeMenu} className="block border-b border-white/10 py-3 text-sm text-white/85">
              {link.label}
            </Link>
          ))}
          {currentUser && isAdmin && (
            <Link href="/admin" onClick={closeMenu} className="flex items-center gap-2 py-3 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" /> لوحة التحكم الرقمية (/admin)
            </Link>
          )}
        </nav>
      )}

      {isLoginOpen && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
          onSelectRole={(code, name) => {
            setIsLoginOpen(false);
            onSelectRole?.(code, name);
          }}
        />
      )}
    </>
  );
}
