'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ShieldCheck, LogOut, User as UserIcon, Settings, ChevronDown, Sparkles } from 'lucide-react';
import { User } from '@/types';
import LoginModal from './LoginModal';

interface NavbarProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

const NAV_LINKS = [
  { label: 'الرئيسية', href: '/' },
  { label: 'عن الوكالة', href: '/#about-section' },
  { label: 'البرامج', href: '/#programs-section' },
  { label: 'الباقات', href: '/packages' },
  { label: 'الفنادق', href: '/hotels' },
  { label: 'دليل العمرة', href: '/portal?tab=rituals' },
];

export default function Navbar({ currentUser, onLogout, onSelectRole }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderLink = (link: { label: string; href: string }, mobile = false) => {
    const active = isActive(link.href);
    const cls = mobile
      ? `block py-3 text-sm border-b border-white/10 ${active ? 'text-emerald-400 font-bold' : 'text-white/85'}`
      : `nav-link-pro ${active ? 'active' : ''}`;

    if (link.href.includes('#')) {
      return (
        <a key={link.href} href={link.href} onClick={mobile ? closeMenu : undefined} className={cls}>
          {link.label}
        </a>
      );
    }
    return (
      <Link key={link.href} href={link.href} onClick={mobile ? closeMenu : undefined} className={cls}>
        {link.label}
      </Link>
    );
  };

  return (
    <>
      <header className={`top-header-clean ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="flex items-center shrink-0" aria-label="South Street Home">
          <img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="nav-logo-img" />
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary navigation">
          {NAV_LINKS.map(link => renderLink(link))}
          {isAdmin && (
            <Link href="/admin" className="nav-link-pro text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 mr-1">
              <ShieldCheck className="w-4 h-4" />
              <span>لوحة التحكم</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0 relative" ref={dropdownRef}>
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full bg-white/8 hover:bg-white/15 border border-white/15 transition cursor-pointer"
                title={currentUser.name}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950 text-sm shadow-md">
                  {currentUser.name?.[0]?.toUpperCase()}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ml-1 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute left-0 mt-3 w-64 bg-slate-950 border border-slate-700 rounded-2xl p-4 z-[9999] text-right text-white font-cairo animate-fade-in space-y-3 shadow-2xl">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950">
                      {currentUser.name?.[0]?.toUpperCase()}
                    </span>
                    <div className="overflow-hidden">
                      <p className="font-bold text-white text-xs truncate">{currentUser.name}</p>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/40 mt-0.5 inline-block">
                        {currentUser.role || 'مستخدم معتمد'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs font-bold">
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-900/40 text-emerald-300 transition">
                        <ShieldCheck className="w-4 h-4" />
                        <span>لوحة التحكم</span>
                      </Link>
                    )}
                    <Link href="/portal?tab=profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 transition">
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>الملف الشخصي</span>
                    </Link>
                    <Link href="/portal?tab=security" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 transition">
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>الإعدادات</span>
                    </Link>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <button onClick={() => { setProfileOpen(false); onLogout?.(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 text-xs font-bold cursor-pointer">
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="btn-pro-primary text-sm py-2.5 px-4 shadow-emerald-950/30"
            >
              <Sparkles className="w-4 h-4" />
              بوابة الوكالة
            </button>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-white lg:hidden" aria-label="فتح القائمة">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="fixed top-[72px] inset-x-0 z-[199] border-b border-white/10 bg-slate-950/98 px-6 py-4 backdrop-blur-xl lg:hidden space-y-1">
          {NAV_LINKS.map(link => renderLink(link, true))}
          {isAdmin && (
            <Link href="/admin" onClick={closeMenu} className="flex items-center gap-2 py-3 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" /> لوحة التحكم
            </Link>
          )}
        </nav>
      )}

      {isLoginOpen && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
          onSelectRole={(code, name) => { setIsLoginOpen(false); onSelectRole?.(code, name); }}
        />
      )}
    </>
  );
}
