'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { User } from '@/types';
import LoginModal from './LoginModal';

interface NavbarProps { currentUser?: User | null; onLogout?: () => void; onSelectRole?: (code: string, name: string) => void; }
const NAV_LINKS = [{ label: 'الرئيسية', href: '/' }, { label: 'عن الوكالة', href: '#about-section' }, { label: 'البرامج', href: '#programs-section' }, { label: 'دليل العمرة', href: '/portal?tab=rituals' }];

export default function Navbar({ currentUser, onLogout, onSelectRole }: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const listener = () => setScrolled(window.scrollY > 12); window.addEventListener('scroll', listener, { passive: true }); return () => window.removeEventListener('scroll', listener); }, []);
  const closeMenu = () => setMobileOpen(false);
  return <>
    <header className={`top-header-clean ${scrolled ? 'shadow-2xl' : ''}`} style={scrolled ? { background: 'rgba(4,6,18,0.94)', borderBottomColor: 'rgba(255,255,255,0.12)' } : {}}>
      <Link href="/" className="flex items-center shrink-0" aria-label="South Street Home"><img src="/images/south_street_logo_white_white.png" alt="SOUTH STREET" className="nav-logo-img" /></Link>
      <nav className="hidden md:flex items-center" aria-label="Primary navigation">{NAV_LINKS.map(link => link.href.startsWith('#') ? <a key={link.href} href={link.href} className="relative text-white/75 hover:text-white font-medium text-sm px-4 py-2 transition-colors duration-200">{link.label}</a> : <Link key={link.href} href={link.href} className="relative text-white/75 hover:text-white font-medium text-sm px-4 py-2 transition-colors duration-200">{link.label}</Link>)}</nav>
      <div className="flex items-center gap-3 shrink-0">
        {currentUser ? <><Link href="/portal" className="hidden sm:flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">{currentUser.name?.[0]}</span>{currentUser.name}</Link><button onClick={onLogout} className="text-xs text-white/70 hover:text-white">خروج</button></> : <button onClick={() => setIsLoginOpen(true)} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400">بوابة الوكالة</button>}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-white md:hidden" aria-label="فتح القائمة">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
    </header>
    {mobileOpen && <nav className="fixed top-[68px] inset-x-0 z-[199] border-b border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-xl md:hidden">{NAV_LINKS.map(link => link.href.startsWith('#') ? <a key={link.href} href={link.href} onClick={closeMenu} className="block border-b border-white/10 py-3 text-sm text-white/85 last:border-0">{link.label}</a> : <Link key={link.href} href={link.href} onClick={closeMenu} className="block border-b border-white/10 py-3 text-sm text-white/85 last:border-0">{link.label}</Link>)}</nav>}
    {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} onSelectRole={(code, name) => { setIsLoginOpen(false); onSelectRole?.(code, name); }} />}
  </>;
}
