'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ShieldCheck, LogOut, User as UserIcon, Settings, ChevronDown, Sparkles } from 'lucide-react';
import { User } from '@/types';
import LoginModal from './LoginModal';
import DemandBag from '@/components/booking/DemandBag';
import { motion } from 'framer-motion';
import { toPortalRole } from '@/lib/roles';

interface NavbarProps {
  currentUser?: User | null;
  onLogout?: () => void;
  onSelectRole?: (code: string, name: string) => void;
  variant?: 'light' | 'dark' | 'apple';
  showPromo?: boolean;
  promoLine?: string;
}

const BASE_NAV_LINKS = [
  { label: 'الرئيسية', href: '/' },
  { label: 'عن الوكالة', href: '/#about-section' },
  { label: 'البرامج', href: '/#programs-section' },
  { label: 'الباقات', href: '/packages' },
  { label: 'الفنادق', href: '/hotels' },
];

function isPilgrimClient(user?: User | null): boolean {
  if (!user) return false;
  return toPortalRole(user.role, { email: user.email, roleName: user.roleName }) === 'pilgrim';
}

function navLinksFor(user?: User | null) {
  if (isPilgrimClient(user)) {
    return [...BASE_NAV_LINKS, { label: 'برنامجي', href: '/portal?tab=program' }];
  }
  return [...BASE_NAV_LINKS, { label: 'دليل العمرة', href: '/portal?tab=rituals' }];
}

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('south_street_user');
    return raw ? JSON.parse(raw) as User : null;
  } catch {
    return null;
  }
}

const PROMO_LINE =
  'خدمتكم شرف نعتز به وكالة ساوث ستريت — رفيقكم الموثوق لأداء العمرة والحج بأعلى درجات الرفاهية والاطمئنان.';

export default function Navbar({ currentUser, onLogout, onSelectRole, variant = 'light', showPromo = false, promoLine }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(currentUser ?? null);
  const [portalTab, setPortalTab] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setSessionUser(currentUser ?? readStoredUser());
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPortalTab(new URLSearchParams(window.location.search).get('tab') || '');
  }, [pathname]);

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
  const navUser = currentUser ?? sessionUser;
  const pilgrim = isPilgrimClient(navUser);
  const links = navLinksFor(navUser);

  const isAdmin = navUser && (
    navUser.role === 'SUPER_ADMIN' ||
    navUser.role === 'AGENCY_MANAGER' ||
    navUser.role === 'admin' ||
    navUser.role === 'manager'
  );

  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    if (path === '/') return pathname === '/';
    if (href.startsWith('/#')) return false;
    if (path === '/portal') {
      if (pathname !== '/portal') return false;
      const want = new URLSearchParams(query || '').get('tab');
      if (!want) return true;
      const have = portalTab || (pilgrim ? 'program' : '');
      return have === want;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isApple = variant === 'apple';
  const isLight = variant === 'light';
  const headerClass = isApple ? 'top-header-apple' : isLight ? 'top-header-light' : 'top-header-clean';
  const linkClass = isApple ? 'nav-link-apple' : isLight ? 'nav-link-light' : 'nav-link-pro';
  const logoSrc = isLight ? '/images/south_street_logo.png' : '/images/south_street_logo_white_white.png';

  const renderLink = (link: { label: string; href: string }, mobile = false) => {
    const active = isActive(link.href);
    const cls = mobile
      ? `block py-3 text-sm border-b ${isLight ? 'border-slate-200' : 'border-white/10'} ${active ? 'text-emerald-main font-bold' : isLight ? 'text-slate-700' : 'text-white/85'}`
      : `${linkClass} ${active ? 'active' : ''}`;

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
      <motion.div
        className={showPromo || isApple ? 'nav-chrome nav-chrome-promo' : undefined}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
      <header className={`${headerClass} ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="flex items-center shrink-0" aria-label="South Street Home">
          <img
            src={logoSrc}
            alt="SOUTH STREET"
            className={`nav-logo-img ${isApple ? 'nav-logo-apple' : ''}`}
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/south_street_logo_white_white.png'; }}
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary navigation">
          {links.map(link => renderLink(link))}
          {isAdmin && (
            <Link href="/admin" className={`${linkClass} text-emerald-main flex items-center gap-1.5 mr-1`}>
              <ShieldCheck className="w-4 h-4" />
              <span>لوحة التحكم</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0 relative" ref={dropdownRef}>
          <DemandBag user={navUser} isLight={isLight} />
          {navUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center gap-1.5 p-1 rounded-full transition cursor-pointer ${isLight ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200' : 'bg-white/8 hover:bg-white/15 border border-white/15'}`}
                title={navUser.name}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950 text-sm shadow-md">
                  {navUser.name?.[0]?.toUpperCase()}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ml-1 ${isLight ? 'text-slate-500' : 'text-slate-300'} ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className={`absolute left-0 mt-3 w-64 border rounded-2xl p-4 z-[9999] text-right font-cairo animate-fade-in space-y-3 shadow-2xl ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'}`}>
                  <div className={`flex items-center gap-3 pb-3 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 font-black text-slate-950">
                      {navUser.name?.[0]?.toUpperCase()}
                    </span>
                    <div className="overflow-hidden">
                      <p className={`font-bold text-xs truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{navUser.name}</p>
                      <span className="text-[10px] font-bold text-emerald-main bg-emerald-soft px-2 py-0.5 rounded-full border border-emerald-main/20 mt-0.5 inline-block">
                        {navUser.roleName || navUser.role || 'مستخدم معتمد'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs font-bold">
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition ${isLight ? 'hover:bg-emerald-soft text-emerald-main' : 'hover:bg-emerald-900/40 text-emerald-300'}`}>
                        <ShieldCheck className="w-4 h-4" />
                        <span>لوحة التحكم</span>
                      </Link>
                    )}
                    <Link href={pilgrim ? '/portal?tab=program' : '/portal'} onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-800 text-slate-200'}`}>
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>{pilgrim ? 'برنامجي' : 'بوابة الوكالة'}</span>
                    </Link>
                    <Link href="/portal?tab=security" onClick={() => setProfileOpen(false)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-800 text-slate-200'}`}>
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>أمان الحساب</span>
                    </Link>
                  </div>
                  <div className={`pt-2 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                    <button onClick={() => { setProfileOpen(false); onLogout?.(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 text-xs font-bold cursor-pointer">
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
              className={isApple ? 'nav-apple-cta' : 'btn-pro-primary text-sm py-2.5 px-4'}
            >
              {!isApple && <Sparkles className="w-4 h-4" />}
              بوابة الوكالة
            </button>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className={`p-2 lg:hidden ${isLight ? 'text-slate-700' : 'text-white'}`} aria-label="فتح القائمة">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {showPromo && (
        <div className="nav-promo-banner" role="note">
          <p className="nav-promo-line">{promoLine || PROMO_LINE}</p>
        </div>
      )}
      </motion.div>

      {mobileOpen && (
        <nav className={`nav-mobile-panel fixed inset-x-0 z-[199] border-b px-6 py-4 backdrop-blur-xl lg:hidden space-y-1 ${isLight ? 'border-slate-200 bg-white/98' : 'border-white/10 bg-slate-950/98'}`}>
          {pilgrim && navUser ? (
            <div className="py-3 border-b border-slate-200/80 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">طلباتي</span>
              <DemandBag user={navUser} isLight={isLight} />
            </div>
          ) : null}
          {links.map(link => renderLink(link, true))}
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
