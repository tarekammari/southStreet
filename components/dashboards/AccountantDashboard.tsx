'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Sparkles,
  Truck,
  Users,
  X,
  BookMarked,
  Scale,
  History,
  CalendarRange,
  ChevronDown,
  Percent,
} from 'lucide-react';
import { User } from '@/types';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';
import RecapPanel from '@/components/accountant/RecapPanel';
import TreasuryPanel from '@/components/accountant/TreasuryPanel';
import AssetsPanel from '@/components/accountant/AssetsPanel';
import LedgerPanel from '@/components/accountant/LedgerPanel';
import SuppliersPanel from '@/components/accountant/SuppliersPanel';
import PayrollPanel from '@/components/accountant/PayrollPanel';
import ReportsPanel from '@/components/accountant/ReportsPanel';
import ScfChartPanel from '@/components/accountant/ScfChartPanel';
import ScfPrinciplesPanel from '@/components/accountant/ScfPrinciplesPanel';
import FinanceAuditPanel from '@/components/accountant/FinanceAuditPanel';
import FiscalPeriodsPanel from '@/components/accountant/FiscalPeriodsPanel';
import ReceiptsPanel from '@/components/accountant/ReceiptsPanel';
import SakhrFinancePanel from '@/components/accountant/SakhrFinancePanel';
import TaxesPanel from '@/components/accountant/TaxesPanel';
import AgencyPendingBookings from '@/components/booking/AgencyPendingBookings';
import { ACCOUNTANT_NAV, type AccountantSectionId } from '@/lib/accountant-sections';
import { SUPPLIER_LANES } from '@/lib/finance-categories';

interface AccountantDashboardProps {
  currentUser: User;
}

export type AccountantSection = AccountantSectionId;

type SectionConfig = {
  id: AccountantSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'workspace' | 'finance' | 'operations' | 'insights' | 'scf';
};

const SECTIONS: SectionConfig[] = [
  { id: 'overview', label: ACCOUNTANT_NAV.overview.label, description: ACCOUNTANT_NAV.overview.description, icon: LayoutDashboard, group: 'workspace' },
  { id: 'treasury', label: ACCOUNTANT_NAV.treasury.label, description: ACCOUNTANT_NAV.treasury.description, icon: Landmark, group: 'finance' },
  { id: 'ledger', label: ACCOUNTANT_NAV.ledger.label, description: ACCOUNTANT_NAV.ledger.description, icon: BookOpen, group: 'finance' },
  { id: 'receipts', label: ACCOUNTANT_NAV.receipts.label, description: ACCOUNTANT_NAV.receipts.description, icon: ReceiptText, group: 'finance' },
  { id: 'suppliers', label: ACCOUNTANT_NAV.suppliers.label, description: ACCOUNTANT_NAV.suppliers.description, icon: Truck, group: 'operations' },
  { id: 'payroll', label: ACCOUNTANT_NAV.payroll.label, description: ACCOUNTANT_NAV.payroll.description, icon: Users, group: 'operations' },
  { id: 'assets', label: ACCOUNTANT_NAV.assets.label, description: ACCOUNTANT_NAV.assets.description, icon: Boxes, group: 'operations' },
  { id: 'bookings', label: ACCOUNTANT_NAV.bookings.label, description: ACCOUNTANT_NAV.bookings.description, icon: ClipboardList, group: 'operations' },
  { id: 'reports', label: ACCOUNTANT_NAV.reports.label, description: ACCOUNTANT_NAV.reports.description, icon: BarChart3, group: 'insights' },
  { id: 'chart', label: ACCOUNTANT_NAV.chart.label, description: ACCOUNTANT_NAV.chart.description, icon: BookMarked, group: 'scf' },
  { id: 'principles', label: ACCOUNTANT_NAV.principles.label, description: ACCOUNTANT_NAV.principles.description, icon: Scale, group: 'scf' },
  { id: 'periods', label: ACCOUNTANT_NAV.periods.label, description: ACCOUNTANT_NAV.periods.description, icon: CalendarRange, group: 'scf' },
  { id: 'audit', label: ACCOUNTANT_NAV.audit.label, description: ACCOUNTANT_NAV.audit.description, icon: History, group: 'scf' },
  { id: 'sakhr', label: ACCOUNTANT_NAV.sakhr.label, description: ACCOUNTANT_NAV.sakhr.description, icon: Sparkles, group: 'insights' },
  { id: 'taxes', label: ACCOUNTANT_NAV.taxes.label, description: ACCOUNTANT_NAV.taxes.description, icon: Percent, group: 'finance' },
];

const RAIL_KEY = 'southstreet.acct.rail';

/** Numbered expert rail. Children stay under الموردون and SCF. */
const RAIL: {
  id: AccountantSection;
  index: string;
  label?: string;
  kind?: 'suppliers' | 'scf';
}[] = [
  { id: 'overview', index: '01' },
  { id: 'suppliers', index: '02', kind: 'suppliers' },
  { id: 'payroll', index: '03' },
  { id: 'taxes', index: '04' },
  { id: 'treasury', index: '05' },
  { id: 'ledger', index: '06' },
  { id: 'reports', index: '07' },
  { id: 'sakhr', index: '08' },
  { id: 'chart', index: '09', label: 'SCF', kind: 'scf' },
  { id: 'receipts', index: '10' },
  { id: 'assets', index: '11' },
];

const SCF_CHILDREN: { id: AccountantSection; label: string }[] = [
  { id: 'chart', label: 'دليل الحسابات' },
  { id: 'principles', label: 'المبادئ' },
  { id: 'periods', label: 'الفترات' },
  { id: 'audit', label: 'سجل التدقيق' },
];

const SCF_IDS = new Set<AccountantSection>(SCF_CHILDREN.map((c) => c.id));

function normalizeSection(raw?: string | null, focus?: string | null): AccountantSection {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'services') return 'suppliers';
  if (v === 'payroll' && String(focus || '').trim().toLowerCase() === 'services') return 'suppliers';
  if (v === 'ai_teach' || v === 'sakhr') return 'sakhr';
  if (SECTIONS.some((s) => s.id === v)) return v as AccountantSection;
  return 'overview';
}

export default function AccountantDashboard({ currentUser }: AccountantDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<AccountantSection>(() =>
    normalizeSection(searchParams.get('section'), searchParams.get('focus'))
  );
  const [railOpen, setRailOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sakhrMode, setSakhrMode] = useState<'ask' | 'teach'>('ask');
  const [openBranch, setOpenBranch] = useState<'suppliers' | 'scf' | null>(() => {
    const initial = normalizeSection(searchParams.get('section'), searchParams.get('focus'));
    if (initial === 'suppliers') return 'suppliers';
    if (SCF_IDS.has(initial)) return 'scf';
    return null;
  });
  const activeLane = searchParams.get('lane')?.trim() || '';

  useEffect(() => {
    try {
      if (localStorage.getItem(RAIL_KEY) === '0') setRailOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const rawSection = searchParams.get('section');
    setSection(normalizeSection(rawSection, searchParams.get('focus')));
    if (String(rawSection || '').trim().toLowerCase() === 'services') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('section', 'suppliers');
      router.replace(`/portal?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (section === 'suppliers') setOpenBranch('suppliers');
    else if (SCF_IDS.has(section)) setOpenBranch('scf');
    else setOpenBranch(null);
  }, [section]);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, railOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [railOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.classList.add('acct-page');
    return () => document.body.classList.remove('acct-page');
  }, []);

  const goSection = (id: AccountantSection, opts?: { supplier?: string; focus?: string; lane?: string }) => {
    setSection(id);
    setDrawerOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'accountant');
    params.set('section', id);
    if (opts?.supplier) params.set('supplier', opts.supplier);
    else params.delete('supplier');
    if (opts?.focus) params.set('focus', opts.focus);
    else params.delete('focus');
    if (opts?.lane) params.set('lane', opts.lane);
    else params.delete('lane');
    router.replace(`/portal?${params.toString()}`, { scroll: false });
  };

  const activeSection = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  const laneMeta = section === 'suppliers' ? SUPPLIER_LANES.find((l) => l.id === activeLane) : undefined;

  const menuList = (collapsed: boolean) => (
    <nav className={`acct-nav ${collapsed ? 'is-collapsed' : ''}`} aria-label="أقسام مكتب المحاسبة">
      {RAIL.map((item) => {
        const cfg = SECTIONS.find((s) => s.id === item.id) || SECTIONS[0];
        const Icon = cfg.icon;
        const label = item.label || cfg.label;
        const opened = !collapsed && item.kind != null && openBranch === item.kind;
        const branch =
          (item.kind === 'suppliers' && section === 'suppliers') ||
          (item.kind === 'scf' && SCF_IDS.has(section));
        const on = item.kind !== 'scf' && section === item.id && !laneMeta;
        return (
          <React.Fragment key={item.id + (item.kind || '')}>
            <button
              type="button"
              onClick={() => {
                if (item.kind === 'suppliers') {
                  setOpenBranch('suppliers');
                  goSection('suppliers');
                  return;
                }
                if (!item.kind) {
                  setOpenBranch(null);
                  goSection(item.id);
                  return;
                }
                const opening = openBranch !== item.kind;
                setOpenBranch(opening ? item.kind : null);
                if (!opening) return;
                if (!SCF_IDS.has(section)) goSection('chart');
              }}
              aria-expanded={item.kind ? opened : undefined}
              aria-current={on ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={`acct-side-item acct-nav-enter ${on ? 'is-on' : ''} ${branch && !on ? 'is-branch' : ''} ${collapsed ? 'is-collapsed' : ''}`}
            >
              <span className="acct-side-icon"><Icon className="w-5 h-5" /></span>
              {!collapsed && <span className="block truncate">{label}</span>}
              {!collapsed && item.kind ? (
                <span
                  className="acct-nav-chevron-hit"
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenBranch((cur) => (cur === item.kind ? null : item.kind!));
                  }}
                >
                  <ChevronDown className={`acct-nav-chevron ${opened ? 'is-open' : ''}`} aria-hidden />
                </span>
              ) : null}
            </button>
            {!collapsed && item.kind === 'suppliers' ? (
              <div className={`acct-nav-sub ${opened ? 'is-open' : ''}`}>
                <div className="acct-nav-sub-clip">
                  {SUPPLIER_LANES.map((lane) => {
                    const laneOn = section === 'suppliers' && activeLane === lane.id;
                    return (
                      <button
                        key={lane.id}
                        type="button"
                        aria-current={laneOn ? 'page' : undefined}
                        className={`acct-side-item ${laneOn ? 'is-on' : ''}`}
                        onClick={() => goSection('suppliers', { lane: lane.id })}
                      >
                        <span className="truncate">{lane.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {!collapsed && item.kind === 'scf' ? (
              <div className={`acct-nav-sub ${opened ? 'is-open' : ''}`}>
                <div className="acct-nav-sub-clip">
                  {SCF_CHILDREN.map((child) => {
                    const childOn = section === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        aria-current={childOn ? 'page' : undefined}
                        className={`acct-side-item ${childOn ? 'is-on' : ''}`}
                        onClick={() => goSection(child.id)}
                      >
                        <span className="truncate">{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      <div className="acct-nav-divider" />
      {(() => {
        const bookings = SECTIONS.find((s) => s.id === 'bookings');
        if (!bookings) return null;
        const Icon = bookings.icon;
        const on = section === 'bookings';
        return (
          <button
            type="button"
            onClick={() => goSection('bookings')}
            aria-current={on ? 'page' : undefined}
            title={collapsed ? bookings.label : undefined}
            className={`acct-side-item ${on ? 'is-on' : ''} ${collapsed ? 'is-collapsed' : ''}`}
          >
            <span className="acct-side-icon"><Icon className="w-5 h-5" /></span>
            {!collapsed && <span className="block truncate">{bookings.label}</span>}
          </button>
        );
      })()}
    </nav>
  );

  const sectionBody = (
    <>
      {section === 'overview' && <RecapPanel />}
      {section === 'treasury' && <TreasuryPanel />}
      {section === 'assets' && <AssetsPanel />}
      {section === 'bookings' && (
        <div className="acct-card p-4 sm:p-5 acct-rise">
          <AgencyPendingBookings compact />
        </div>
      )}
      {section === 'receipts' && <ReceiptsPanel currentUser={currentUser} />}
      {section === 'ledger' && <LedgerPanel />}
      {section === 'suppliers' && <SuppliersPanel />}
      {section === 'payroll' && <PayrollPanel />}
      {section === 'taxes' && <TaxesPanel />}
      {section === 'reports' && <ReportsPanel />}
      {section === 'chart' && <ScfChartPanel />}
      {section === 'principles' && <ScfPrinciplesPanel />}
      {section === 'audit' && <FinanceAuditPanel />}
      {section === 'periods' && <FiscalPeriodsPanel />}
      {section === 'sakhr' && (
        <div className="space-y-4 acct-rise">
          <div className="acct-segmented max-w-md">
            <button
              type="button"
              role="tab"
              aria-selected={sakhrMode === 'ask'}
              className={sakhrMode === 'ask' ? 'is-on' : ''}
              onClick={() => setSakhrMode('ask')}
            >
              اسأل
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sakhrMode === 'teach'}
              className={sakhrMode === 'teach' ? 'is-on' : ''}
              onClick={() => setSakhrMode('teach')}
            >
              علّم
            </button>
          </div>

          {sakhrMode === 'ask' ? (
            <SakhrFinancePanel onGo={goSection} />
          ) : (
            <AiKnowledgeManager
              userRole="accountant"
              userName={currentUser.name || 'محاسب الوكالة'}
              allowedCategories={['pricing', 'packages', 'faq']}
              title="علم صخر (للمحاسب)"
              subtitle="علّم صخر أسعار وباقات وخدمات الوكالة"
            />
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="acct-root acct-theme-light" dir="rtl">
      <div className="acct-layout">
        <aside className={`acct-rail ${railOpen ? 'is-expanded' : ''}`}>
          <div className="acct-rail-brand">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/25 shrink-0">
                <Landmark className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 tracking-tight leading-tight truncate">مكتب المحاسبة</div>
                <div className="text-[10px] text-emerald-600 font-semibold truncate">SCF · النظام المالي</div>
              </div>
            </div>
          </div>
          {menuList(!railOpen)}
        </aside>

        <div className="acct-content">
          <header className="acct-topbar" role="banner">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  if (window.matchMedia('(max-width: 1023px)').matches) setDrawerOpen(true);
                  else setRailOpen((v) => !v);
                }}
                className="acct-iconbtn shrink-0"
                aria-label={railOpen ? 'طي القائمة' : 'فتح القائمة'}
              >
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="acct-top-title font-bold text-slate-900 tracking-tight">{laneMeta?.label || activeSection.label}</h1>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    النظام المحاسبي SCF
                  </span>
                </div>
                <p className="acct-top-subtitle hidden sm:block text-xs text-slate-500 mt-0.5">{laneMeta?.hint || activeSection.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200/60">
                <CalendarRange className="w-3.5 h-3.5 text-slate-500" />
                <span>السنة المالية 2026</span>
              </div>
            </div>
          </header>

          <div className="acct-workspace">
            <main className="acct-main acct-section" key={section}>
              {sectionBody}
            </main>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[70] acct-drawer-backdrop backdrop-blur-sm bg-slate-900/40"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="acct-side-drawer absolute inset-y-0 right-0 p-5 overflow-y-auto bg-white shadow-2xl w-80 max-w-[85vw]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-sm shadow-emerald-600/25">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">مكتب المحاسبة</p>
                  <p className="text-xs text-slate-400">اختر القسم المحاسبي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {menuList(false)}
          </div>
        </div>
      )}
    </div>
  );
}
