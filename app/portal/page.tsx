'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/lazy/LazySakhrAgent';
import UmrahCounter from '@/components/UmrahCounter';
import { User, Reservation, CustomerDocument, Receipt } from '@/types';
import { toPortalRole, PORTAL_TABS, defaultPortalTab } from '@/lib/roles';
import ReviewComposer from '@/components/ReviewComposer';
import AccountSecurityPanel from '@/components/AccountSecurityPanel';
import SessionHeartbeat from '@/components/SessionHeartbeat';

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
  FileText, CheckCircle, Clock, ShieldCheck, Upload, CreditCard,
  UserCheck, AlertCircle, Sparkles, Download, MessageCircle, Compass,
  Layers, ArrowLeft, RefreshCw
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CustomerPortalContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || '';
  const demoMode = searchParams.get('demo') === '1';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr_pilgrim_user',
    code: 'PILGRIM-101',
    name: 'عمر بن علي',
    role: 'pilgrim',
    roleName: 'معتمر معتمد',
    email: 'user@southstreet.dz',
    phone: '+213 559 88 77 66',
    avatar: 'ع',
    status: 'نشط'
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pilgrimsList, setPilgrimsList] = useState<User[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('south_street_user');
    if (session) {
      try {
        const u = JSON.parse(session);
        const role = toPortalRole(u.role, { email: u.email, roleName: u.roleName });
        setCurrentUser({
          id: u.id || 'usr_user',
          code: u.code || u.username || 'CODE-2026',
          name: u.name || 'مستخدم الوكالة',
          role: role as any,
          roleName: u.roleName || u.role,
          email: u.email || '',
          username: u.username,
          phone: u.phone || '',
          avatar: u.name ? u.name.charAt(0) : 'م'
        });
        const allowed = PORTAL_TABS[role].map((t) => t.tab);
        if (!initialTab || !allowed.includes(initialTab)) {
          setActiveTab(defaultPortalTab(role));
        }
      } catch {}
    }

    // Load pre-seeded data
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
        updated_at: '2026-08-11T16:00:00Z'
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

    setPilgrimsList([
      { id: 'USR-005', code: 'PILGRIM-101', name: 'عمر بن علي', role: 'pilgrim', roleName: 'معتمر', phone: '+213 559 88 77 66', room: '1402 - سويس أوتيل مكة' },
      { id: 'USR-006', code: 'PILGRIM-102', name: 'فاطمة الزهراء بن دحمان', role: 'pilgrim', roleName: 'معتمرة', phone: '+213 558 11 22 33', room: '1405 - سويس أوتيل مكة' },
      { id: 'USR-007', code: 'PILGRIM-103', name: 'سليم بلحاج', role: 'pilgrim', roleName: 'معتمر', phone: '+213 555 44 99 00', room: '1408 - سويس أوتيل مكة' }
    ]);
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
      setActiveTab('reservations');
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    setTimeout(() => {
      const newDoc: CustomerDocument = {
        document_id: `doc_${Date.now()}`,
        customer_id: 'usr_pilgrim_user',
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

  return (
    <div className="portal-shell font-tajawal">
      <SessionHeartbeat />
      <Navbar currentUser={currentUser} variant="light" />

      <main className="pt-28 pb-16 max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {demoMode && (
        <div className="luxury-card-static p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-main text-white font-bold text-[11px]">تجربة الأدوار</span>
            <span className="text-slate-500">التبديل بين لوحات التحكم حسب الدور</span>
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

        {/* User header */}
        <div className="luxury-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-soft border border-emerald-main/20 text-emerald-main flex items-center justify-center font-bold text-2xl font-cairo">
              {currentUser.avatar || currentUser.name.charAt(0)}
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
            {PORTAL_TABS[toPortalRole(currentUser.role, { email: currentUser.email, roleName: currentUser.roleName })].map((item) => (
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
                  className={`portal-tab flex items-center gap-1.5 ${activeTab === item.tab ? 'portal-tab-active' : 'portal-tab-inactive'}`}
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
        </div>

        {/* Dynamic Views by Role and Tab */}

        {currentUser.role === 'murshid' && activeTab === 'murshid' && (
          <MurshidDashboard
            currentUser={currentUser}
            pilgrims={pilgrimsList}
            onBroadcast={() => alert('تم بث تنبيه عاجل لجميع معتمري الفوج عبر القناة المشفرة 📢')}
          />
        )}

        {currentUser.role === 'accountant' && activeTab === 'accountant' && (
          <AccountantDashboard currentUser={currentUser} />
        )}

        {(currentUser.role === 'manager' || currentUser.role === 'admin') && activeTab === 'manager' && (
          <ManagerDashboard currentUser={currentUser} campaigns={[]} pilgrims={pilgrimsList} />
        )}

        {currentUser.role === 'agent' && activeTab === 'agent' && (
          <div className="luxury-card p-6 space-y-3 animate-fade-up">
            <h2 className="text-lg font-bold font-cairo text-slate-900">لوحة موظف الوكالة</h2>
            <p className="text-sm text-slate-600">
              يمكنك متابعة استفسارات المعتمرين عبر المحادثة، والتنسيق مع المرشدين والمحاسبة حسب صلاحية دورك.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <button onClick={() => setActiveTab('chat')} className="portal-tab portal-tab-active">فتح المحادثة الداخلية</button>
              <Link href="/packages" className="portal-tab portal-tab-inactive no-underline text-center">عرض الباقات</Link>
            </div>
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

        {activeTab === 'rituals' && (
          <div className="luxury-card-static p-6 space-y-4 animate-fade-up">
            <h2 className="text-lg font-bold font-cairo text-slate-900">عداد ودليل مناسك العمرة</h2>
            <UmrahCounter />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="animate-fade-up">
            <ChatModule currentUser={currentUser} />
          </div>
        )}

        {activeTab === 'reservations' && currentUser.role === 'pilgrim' && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-lg font-bold font-cairo text-slate-900">قائمة الحجوزات</h2>
            {reservations.map((res) => (
              <div key={res.reservation_id} className="luxury-card p-6 space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-main bg-emerald-soft px-3 py-1 rounded-lg border border-emerald-main/20">
                      {res.reservation_number}
                    </span>
                    <h3 className="font-bold text-lg font-cairo text-slate-900 mt-2">{res.package_name}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-soft text-emerald-main text-xs font-bold border border-emerald-main/20 flex items-center gap-1 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5" /> {res.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 text-xs text-slate-600 border border-slate-100">
                  <div>الغرفة: <strong>{res.room_type}</strong></div>
                  <div>المعتمرون: <strong>{res.travelers_count}</strong></div>
                  <div>المبلغ: <strong>{res.total_amount.toLocaleString()} دج</strong></div>
                  <div>الدفع: <strong>{res.payment_status}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documents' && currentUser.role === 'pilgrim' && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <h2 className="text-lg font-bold font-cairo text-slate-900">ملف الوثائق</h2>
              <label className="btn-pro-primary text-xs py-2.5 px-4 cursor-pointer">
                <Upload className="w-4 h-4" /> {isUploading ? 'جاري التحميل...' : 'رفع جواز سفر'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocumentUpload} className="hidden" />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.document_id} className="luxury-card p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-soft text-emerald-main flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-800 truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-slate-500">{doc.document_type}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                    doc.status === 'VERIFIED'
                      ? 'bg-emerald-soft text-emerald-main border-emerald-main/20'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {doc.status === 'VERIFIED' ? 'مؤكد' : 'قيد المراجعة'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <AccountSecurityPanel />
        )}

        {activeTab === 'reviews' && currentUser.role === 'pilgrim' && (
          <div className="luxury-card p-6 space-y-4 animate-fade-up">
            <h2 className="text-lg font-bold font-cairo text-slate-900">قيّم رحلتك مع الوكالة</h2>
            <p className="text-xs text-slate-500">
              تقييمك يذهب أولاً إلى الإدارة. بعد الموافقة يظهر للزوار كنجوم وشهادة — مثل تطبيقات التقييم الكبيرة.
            </p>
            <ReviewComposer defaultName={currentUser.name} />
          </div>
        )}

        {activeTab === 'payments' && currentUser.role === 'pilgrim' && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-lg font-bold font-cairo text-slate-900">وصولات الدفع</h2>
            {receipts.map((rcp) => (
              <div key={rcp.id} className="luxury-card p-5 flex justify-between items-center gap-4">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-main">{rcp.id}</span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1">{rcp.packageName}</h4>
                  <p className="text-xs text-slate-500">{rcp.paymentMethod}</p>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-lg font-bold text-emerald-main font-cairo block">{rcp.totalAmount.toLocaleString()} دج</span>
                  <span className="text-[10px] text-slate-500 font-medium">{rcp.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <SakhrAgent />
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
