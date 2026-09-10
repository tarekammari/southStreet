'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import UmrahCounter from '@/components/UmrahCounter';
import { User, Reservation, CustomerDocument, Receipt } from '@/types';
import { toPortalRole, PORTAL_TABS, resolvePortalTab, pilgrimHomeSection } from '@/lib/roles';
import { isActiveReservation } from '@/lib/booking-catalog';
import AgencyPendingBookings from '@/components/booking/AgencyPendingBookings';
import ReviewComposer from '@/components/ReviewComposer';
import AccountSecurityPanel from '@/components/AccountSecurityPanel';
import SessionHeartbeat from '@/components/SessionHeartbeat';
import LoginModal from '@/components/LoginModal';
import PilgrimProgram from '@/components/dashboards/PilgrimProgram';
import { logoutAndReload, syncSessionProfile } from '@/lib/client-session';
import { isImageSource } from '@/lib/user-access-view';

const TabFallback = () => (
  <div className="luxury-card p-10 flex items-center justify-center text-xs text-slate-400 gap-2">
    <RefreshCw className="w-4 h-4 animate-spin" /> جاري التحميل...
  </div>
);

// Tab-gated panels are code-split so switching a tab loads only what it needs
const MurshidDashboard = dynamic(() => import('@/components/dashboards/MurshidDashboard'), {
  ssr: false,
  loading: TabFallback,
});
const AccountantDashboard = dynamic(() => import('@/components/dashboards/AccountantDashboard'), {
  ssr: false,
  loading: TabFallback,
});
const ManagerDashboard = dynamic(() => import('@/components/dashboards/ManagerDashboard'), {
  ssr: false,
  loading: TabFallback,
});
const ChatModule = dynamic(() => import('@/components/ChatModule'), {
  ssr: false,
  loading: TabFallback,
});
const AiKnowledgeManager = dynamic(() => import('@/components/AiKnowledgeManager'), {
  ssr: false,
  loading: TabFallback,
});
import {
  ShieldCheck, RefreshCw
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function mapClientUser(u: any): User {
  const role = toPortalRole(u.role, { email: u.email, roleName: u.roleName });
  return {
    id: u.id || 'usr_user',
    code: u.code || u.username || 'CODE-2026',
    name: u.name || 'مستخدم الوكالة',
    role: role as any,
    roleName: u.roleName || u.role,
    email: u.email || '',
    username: u.username,
    phone: u.phone || '',
    status: u.status,
    avatar: u.avatar,
    ...(u.photoUrl ? { photoUrl: u.photoUrl } as any : {}),
  };
}

function CustomerPortalContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || '';
  const demoMode = searchParams.get('demo') === '1';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pilgrimsList, setPilgrimsList] = useState<User[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const loadBookings = () => {
    const token = localStorage.getItem('south_street_token');
    if (!token) {
      setReservations([]);
      setReceipts([]);
      return;
    }
    fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.reservations)) setReservations(data.reservations);
        if (Array.isArray(data.receipts)) setReceipts(data.receipts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const applyUser = (u: any) => {
      const mapped = mapClientUser(u);
      const portalRole = toPortalRole(mapped.role, { email: mapped.email, roleName: mapped.roleName });
      setCurrentUser(mapped);
      setActiveTab(resolvePortalTab(portalRole, initialTab));
      return portalRole;
    };

    const session = localStorage.getItem('south_street_user');
    if (session) {
      try {
        applyUser(JSON.parse(session));
      } catch {
        localStorage.removeItem('south_street_user');
      }
    } else if (demoMode) {
      applyUser({
        id: 'usr_pilgrim_user',
        code: 'PILGRIM-101',
        name: 'عمر بن علي',
        role: 'PILGRIM_USER',
        roleName: 'معتمر معتمد',
        email: 'user@southstreet.dz',
        phone: '+213 559 88 77 66',
      });
    }

    void syncSessionProfile().then((user) => {
      if (user) applyUser(user);
    });

    if (demoMode) {
      setReservations([
        {
          reservation_id: 'res_1001',
          reservation_number: 'RES-2026-8801',
          customer_id: 'usr_pilgrim_user',
          customer_name: 'عمر بن علي',
          customer_email: 'user@southstreet.dz',
          customer_phone: '+213 559 88 77 66',
          package_id: 'pkg_august_economy_2026',
          package_name: 'باقة أوت الاقتصادية المميزة (طيران مباشر من الجزائر)',
          room_type: 'QUAD',
          travelers_count: 1,
          travelers: [
            {
              first_name: 'عمر',
              last_name: 'بن علي',
              passport_number: 'A99887766',
              passport_expiry: '2030-05-10',
              birth_date: '1985-04-12',
              gender: 'MALE',
              traveler_type: 'ADULT'
            }
          ],
          total_amount: 215000,
          paid_amount: 215000,
          currency: 'DZD',
          status: 'CONFIRMED',
          payment_status: 'PAID',
          created_at: '2026-08-11T14:30:00Z',
          updated_at: '2026-08-11T16:00:00Z',
          program: {
            package_id: 'pkg_august_economy_2026',
            package_name: 'باقة أوت الاقتصادية المميزة (طيران مباشر من الجزائر)',
            start_date: '2026-08-15',
            end_date: '2026-08-29',
            duration_days: 15,
            airline: 'الخطوط الجوية الجزائرية والخطوط السعودية',
            departure_city: 'الجزائر العاصمة',
            departure_airport: 'مطار هواري بومدين (ALG)',
            arrival_airport: 'مطار الأمير محمد بن عبد العزيز (MED)',
            makkah_hotel_name: 'فندق منارات غزة مكة',
            makkah_hotel_dist: '350م فقط عن صحن الحرم المكي',
            madinah_hotel_name: 'فندق بولمان زمزم المدينة',
            madinah_hotel_dist: 'خطوات عن المسجد النبوي',
            hotel_category: '4 نجوم / 5 نجوم',
            morshid_name: 'الشيخ د. عبد الرحمن النوي',
            morshid_phone: '+213 550 12 34 56',
            included_services: [],
            room_type: 'QUAD',
            room_label: 'غرفة رباعية',
          },
          appointments: [
            { id: 'gather', title: 'تجمّع المطار', when: '15 أغسطس 2026 — قبل الإقلاع بـ 4 ساعات', place: 'مطار هواري بومدين' },
            { id: 'depart', title: 'إقلاع الرحلة', when: '15 أغسطس 2026', place: 'الجزائر ➜ المدينة' },
          ],
        }
      ]);
      setDocuments([
        {
          document_id: 'doc_101',
          customer_id: 'usr_pilgrim_user',
          document_type: 'PASSPORT',
          file_name: 'Passport_Omar_Bin_Ali.pdf',
          file_url: '/documents/passport_omar.pdf',
          status: 'VERIFIED',
          uploaded_at: '2026-08-10T10:00:00Z'
        }
      ]);
      setReceipts([
        {
          id: 'RCP-8801',
          pilgrimName: 'عمر بن علي',
          pilgrimCode: 'PILGRIM-101',
          packageName: 'باقة أوت الاقتصادية المميزة',
          totalAmount: 215000,
          paidAmount: 215000,
          remainingAmount: 0,
          paymentMethod: 'تحويل بريدي موب (BaridiMob)',
          date: '2026-08-11',
          accountantName: 'الأستاذ ياسين الفاسي',
          status: 'مكتمل'
        }
      ]);
    } else {
      loadBookings();
    }

    setPilgrimsList([
      { id: 'USR-005', code: 'PILGRIM-101', name: 'عمر بن علي', role: 'pilgrim', roleName: 'معتمر', phone: '+213 559 88 77 66', room: '1402 - سويس أوتيل مكة' },
      { id: 'USR-006', code: 'PILGRIM-102', name: 'فاطمة الزهراء بن دحمان', role: 'pilgrim', roleName: 'معتمرة', phone: '+213 558 11 22 33', room: '1405 - سويس أوتيل مكة' },
      { id: 'USR-007', code: 'PILGRIM-103', name: 'سليم بلحاج', role: 'pilgrim', roleName: 'معتمر', phone: '+213 555 44 99 00', room: '1408 - سويس أوتيل مكة' }
    ]);
    setAuthReady(true);
  }, []);

  // Quick switch role helper for testing
  const switchDemoRole = (role: 'pilgrim' | 'murshid' | 'accountant' | 'admin' | 'agent' | 'manager') => {
    if (role === 'murshid') {
      setCurrentUser({
        id: 'USR-003',
        code: 'GUIDE-777',
        name: 'الشيخ أحمد بن علي',
        role: 'murshid',
        roleName: 'مرشد ديني معتمد',
        email: 'guide@southstreet.dz',
        phone: '+213 550 12 34 56',
        avatar: 'أ'
      });
      setActiveTab('murshid');
    } else if (role === 'accountant') {
      setCurrentUser({
        id: 'USR-004',
        code: 'ACC-404',
        name: 'الأستاذ ياسين الفاسي',
        role: 'accountant',
        roleName: 'محاسب الوكالة',
        email: 'accountant@southstreet.dz',
        phone: '+213 552 33 44 55',
        avatar: 'ي'
      });
      setActiveTab('accountant');
    } else if (role === 'admin') {
      setCurrentUser({
        id: 'usr_super_admin',
        code: 'ADMIN-2026',
        name: 'طارق العماري (المدير العام)',
        role: 'admin',
        roleName: 'المدير العام للوكالة',
        email: 'admin@southstreet.dz',
        phone: '+213 550 11 22 33',
        avatar: 'ط'
      });
      setActiveTab('admin');
    } else if (role === 'manager') {
      setCurrentUser({
        id: 'usr_manager',
        code: 'MANAGER-99',
        name: 'أحمد محمود',
        role: 'manager',
        roleName: 'مسير الحملات',
        email: 'manager@southstreet.dz',
        phone: '+213 559 87 65 43',
        avatar: 'أ'
      });
      setActiveTab('manager');
    } else if (role === 'agent') {
      setCurrentUser({
        id: 'usr_agent',
        code: 'AGENT-101',
        name: 'سارة خالد',
        role: 'agent',
        roleName: 'خدمة العملاء',
        email: 'agent@southstreet.dz',
        phone: '+213 557 00 11 22',
        avatar: 'س'
      });
      setActiveTab('agent');
    } else {
      setCurrentUser({
        id: 'usr_pilgrim_user',
        code: 'PILGRIM-101',
        name: 'عمر بن علي',
        role: 'pilgrim',
        roleName: 'معتمر معتمد',
        email: 'user@southstreet.dz',
        phone: '+213 559 88 77 66',
        avatar: 'ع'
      });
      setActiveTab('program');
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    setTimeout(() => {
      const newDoc: CustomerDocument = {
        document_id: `doc_${Date.now()}`,
        customer_id: currentUser?.id || '',
        document_type: 'PASSPORT',
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        status: 'UNDER_REVIEW',
        uploaded_at: new Date().toISOString()
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setIsUploading(false);
    }, 1000);
  };

  const handleLogout = () => {
    void logoutAndReload('/portal');
  };

  const adoptSession = () => {
    const session = localStorage.getItem('south_street_user');
    const token = localStorage.getItem('south_street_token');
    if (!session) return;
    try {
      const mapped = mapClientUser(JSON.parse(session));
      const portalRole = toPortalRole(mapped.role, { email: mapped.email, roleName: mapped.roleName });
      setCurrentUser(mapped);
      setActiveTab(resolvePortalTab(portalRole, initialTab));
    } catch { /* ignore */ }
    if (token) {
      loadBookings();
    }
  };

  if (!authReady) {
    return <div className="min-h-screen portal-shell flex items-center justify-center text-slate-500">جاري التحميل...</div>;
  }

  const activeReservation = reservations.find((row) => isActiveReservation(row.status)) || null;
  const pendingLogin = currentUser?.status === 'PENDING_APPROVAL' || currentUser?.status === 'PENDING';
  const showPendingBanner = currentUser?.role === 'pilgrim' && pendingLogin && !activeReservation;

  if (!currentUser) {
    return (
      <div className="portal-shell font-tajawal min-h-screen">
        <Navbar variant="light" />
        <main className="pt-28 pb-16 max-w-md mx-auto px-4">
          <div className="pilgrim-empty">
            <h2>بوابة المعتمر</h2>
            <button type="button" className="btn-pro-primary pilgrim-cta" onClick={() => setLoginOpen(true)}>
              دخول
            </button>
            <Link href="/book" className="pilgrim-cta-ghost no-underline">حجز</Link>
          </div>
        </main>
        {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} onSelectRole={adoptSession} /> : null}
        <SakhrAgent />
      </div>
    );
  }

  const portalRole = toPortalRole(currentUser.role, { email: currentUser.email, roleName: currentUser.roleName });
  const isPilgrim = portalRole === 'pilgrim';
  const viewTab = resolvePortalTab(portalRole, activeTab);
  const displayName = String(currentUser.name || '').replace(/\s*\(.*\)\s*$/, '').trim();

  return (
    <div className={`portal-shell font-tajawal${isPilgrim ? ' pilgrim-app' : ''}`}>
      <SessionHeartbeat />
      <Navbar currentUser={currentUser} variant="light" onLogout={handleLogout} />

        <main className={`pt-28 pb-16 mx-auto px-4 sm:px-6 space-y-6 ${isPilgrim ? 'max-w-3xl pilgrim-main' : 'max-w-6xl'}`}>
        {demoMode && (
        <div className="luxury-card-static p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-main text-white font-bold text-[11px]">تجربة الأدوار</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['admin', 'manager', 'murshid', 'accountant', 'agent', 'pilgrim'] as const).map((role) => (
              <button
                key={role}
                onClick={() => switchDemoRole(role as any)}
                className={`portal-tab ${currentUser.role === role ? 'portal-tab-active' : 'portal-tab-inactive'}`}
              >
                {role === 'admin' ? 'مدير' : role === 'manager' ? 'مسير' : role === 'murshid' ? 'مرشد' : role === 'accountant' ? 'محاسب' : role === 'agent' ? 'موظف' : 'معتمر'}
              </button>
            ))}
          </div>
        </div>
        )}

        {isPilgrim ? (
          <div className="pilgrim-bar animate-fade-up">
            <strong className="pilgrim-id-name">{displayName}</strong>
            <nav className="pilgrim-tabs" aria-label="بوابة المعتمر">
              {PORTAL_TABS.pilgrim.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => setActiveTab(item.tab)}
                  className={viewTab === item.tab ? 'is-on' : ''}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        ) : (
        <div className="luxury-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-emerald-soft border border-emerald-main/20 text-emerald-main flex items-center justify-center font-bold text-2xl font-cairo">
              {isImageSource(currentUser.avatar) ? (
                <img src={String(currentUser.avatar)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-xl font-cairo text-slate-900">{currentUser.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-soft text-emerald-main text-[10px] font-bold border border-emerald-main/20">
                  {currentUser.roleName || currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{currentUser.email} · {currentUser.phone}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PORTAL_TABS[portalRole].map((item) => (
              item.tab === 'admin' ? (
                <Link
                  key={item.tab}
                  href="/admin"
                  className="portal-tab portal-tab-active flex items-center gap-1.5 no-underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> {item.label}
                </Link>
              ) : (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`portal-tab flex items-center gap-1.5 ${viewTab === item.tab ? 'portal-tab-active' : 'portal-tab-inactive'}`}
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
        </div>
        )}

        {showPendingBanner ? (
          <p className="pilgrim-wait" role="status">حسابك قيد التفعيل</p>
        ) : null}

        {/* Dynamic Views by Role and Tab */}

        {currentUser.role === 'murshid' && activeTab === 'murshid' && (
          <MurshidDashboard
            currentUser={currentUser}
            pilgrims={pilgrimsList}
            onBroadcast={() => alert('تم بث تنبيه عاجل لجميع معتمري الفوج عبر القناة المشفرة 📢')}
          />
        )}

        {currentUser.role === 'accountant' && activeTab === 'accountant' && (
          <div className="space-y-4 animate-fade-up">
            <AgencyPendingBookings />
            <AccountantDashboard currentUser={currentUser} />
          </div>
        )}

        {(currentUser.role === 'manager' || currentUser.role === 'admin') && activeTab === 'manager' && (
          <div className="space-y-4 animate-fade-up">
            <AgencyPendingBookings />
            <ManagerDashboard currentUser={currentUser} campaigns={[]} pilgrims={pilgrimsList} />
          </div>
        )}

        {currentUser.role === 'agent' && activeTab === 'agent' && (
          <div className="space-y-4 animate-fade-up">
            <AgencyPendingBookings />
            <div className="luxury-card p-6 space-y-3">
              <h2 className="text-lg font-bold font-cairo text-slate-900">لوحة موظف الوكالة</h2>
              <p className="text-sm text-slate-600">
                يمكنك متابعة استفسارات المعتمرين عبر المحادثة، والتنسيق مع المرشدين والمحاسبة حسب صلاحية دورك.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <button onClick={() => setActiveTab('chat')} className="portal-tab portal-tab-active">فتح المحادثة الداخلية</button>
                <Link href="/packages" className="portal-tab portal-tab-inactive no-underline text-center">عرض الباقات</Link>
              </div>
            </div>
          </div>
        )}

        {/* Admin tab in demo mode — real admins use /admin */}
        {currentUser.role === 'admin' && activeTab === 'admin' && (
          <div className="space-y-4 animate-fade-up">
            <AgencyPendingBookings />
          </div>
        )}

        {/* 3. Admin AI Teaching View */}
        {activeTab === 'admin_ai' && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <AiKnowledgeManager
            userRole="SUPER_ADMIN"
            userName={currentUser.name}
            title="مركز تدريب وتغذية صخر AI (الإدارة العامة)"
            subtitle="التحكم الكامل في جميع تصنيفات المعرفة والأسئلة الخاصة بالباقات، الأسعار، المناسك، والفنادق وقراءة صفحات الويب."
          />
        )}

        {viewTab === 'rituals' && !isPilgrim && (
          <div className="luxury-card-static p-6 space-y-4 animate-fade-up">
            <UmrahCounter />
          </div>
        )}

        {viewTab === 'chat' && (
          <div className="animate-fade-up">
            <ChatModule currentUser={currentUser} compact={isPilgrim} />
          </div>
        )}

        {viewTab === 'program' && isPilgrim && (
          <PilgrimProgram
            currentUser={currentUser}
            reservation={activeReservation}
            reservations={reservations}
            documents={documents}
            receipts={receipts}
            initialSection={pilgrimHomeSection(initialTab || activeTab)}
            onChanged={loadBookings}
            onUploadDocument={handleDocumentUpload}
            uploading={isUploading}
          />
        )}

        {viewTab === 'account' && isPilgrim && (
          <div className="pilgrim-account animate-fade-up">
            <AccountSecurityPanel compact />
            <ReviewComposer defaultName={displayName} compact />
          </div>
        )}

        {viewTab === 'security' && !isPilgrim && (
          <AccountSecurityPanel />
        )}
      </main>

      {!isPilgrim ? <SakhrAgent /> : null}
    </div>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen portal-shell flex items-center justify-center text-slate-500">جاري التحميل...</div>}>
      <CustomerPortalContent />
    </Suspense>
  );
}
