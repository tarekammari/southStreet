'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import MurshidDashboard from '@/components/dashboards/MurshidDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';
import UmrahCounter from '@/components/UmrahCounter';
import ChatModule from '@/components/ChatModule';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';
import { User, Reservation, CustomerDocument, Receipt } from '@/types';
import {
  FileText, CheckCircle, Clock, ShieldCheck, Upload, CreditCard,
  UserCheck, AlertCircle, Sparkles, Download, MessageCircle, Compass,
  Layers, ArrowLeft, RefreshCw
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CustomerPortalContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'reservations';

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
    // Load session user if available
    const session = localStorage.getItem('south_street_user');
    if (session) {
      try {
        const u = JSON.parse(session);
        // Normalize role
        let role = u.role || 'pilgrim';
        if (role === 'SUPER_ADMIN' || role === 'AGENCY_MANAGER') role = 'admin';
        if (u.email?.includes('guide') || role === 'GUIDE_MURSHID' || role === 'murshid') role = 'murshid';
        if (u.email?.includes('accountant') || role === 'ACCOUNTANT' || role === 'accountant') role = 'accountant';

        setCurrentUser({
          id: u.id || 'usr_user',
          code: u.code || 'CODE-2026',
          name: u.name || 'مستخدم الوكالة',
          role: role as any,
          roleName: u.roleName || (role === 'murshid' ? 'مرشد ديني' : role === 'accountant' ? 'محاسب الوكالة' : role === 'admin' ? 'مدير النظام' : 'معتمر معتمد'),
          email: u.email || 'user@southstreet.dz',
          phone: u.phone || '+213 550 00 00 00',
          avatar: u.name ? u.name.charAt(0) : 'م'
        });
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
  const switchDemoRole = (role: 'pilgrim' | 'murshid' | 'accountant' | 'admin') => {
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
    <div className="min-h-screen bg-slate-950 text-white font-tajawal">
      <Navbar currentUser={currentUser} />

      <main className="pt-28 pb-16 max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Role Demo Quick Switcher Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black">تجربة الأدوار:</span>
            <span className="text-slate-300">التبديل الفوري بين لوحات التحكم والتدريب الذكي:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => switchDemoRole('admin')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentUser.role === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              🛡️ المدير (Admin)
            </button>
            <button
              onClick={() => switchDemoRole('murshid')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentUser.role === 'murshid' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              👳 المرشد (Guide)
            </button>
            <button
              onClick={() => switchDemoRole('accountant')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentUser.role === 'accountant' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              💳 المحاسب (Finance)
            </button>
            <button
              onClick={() => switchDemoRole('pilgrim')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                currentUser.role === 'pilgrim' ? 'bg-slate-700 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              👤 المعتمر (User)
            </button>
          </div>
        </div>

        {/* User Header */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black text-2xl font-cairo">
              {currentUser.avatar || currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl font-cairo text-white">{currentUser.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  {currentUser.roleName || currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentUser.email} | {currentUser.phone}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUser.role === 'murshid' ? (
              <>
                <button
                  onClick={() => setActiveTab('murshid')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'murshid' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  لوحة المرشد وتدريب صخر
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chat' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" /> المحادثة
                </button>
                <button
                  onClick={() => setActiveTab('rituals')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'rituals' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Compass className="w-4 h-4" /> عداد المناسك
                </button>
              </>
            ) : currentUser.role === 'accountant' ? (
              <>
                <button
                  onClick={() => setActiveTab('accountant')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'accountant' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  لوحة المحاسب وتدريب صخر
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chat' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" /> غرفة المراسلة
                </button>
              </>
            ) : currentUser.role === 'admin' ? (
              <>
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> فتح لوحة الإدارة الكاملة (Admin)
                </Link>
                <button
                  onClick={() => setActiveTab('admin_ai')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'admin_ai' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4" /> تدريب صخر الذكي
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('reservations')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'reservations' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  حجوزاتي ({reservations.length})
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'documents' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  وثائقي ({documents.length})
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'payments' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  وصل الدفع ({receipts.length})
                </button>
                <button
                  onClick={() => setActiveTab('rituals')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'rituals' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Compass className="w-4 h-4" /> عداد المناسك
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chat' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" /> المحادثة
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Views by Role and Tab */}

        {/* 1. Murshid View */}
        {(currentUser.role === 'murshid' || activeTab === 'murshid') && (
          <MurshidDashboard
            currentUser={currentUser}
            pilgrims={pilgrimsList}
            onBroadcast={() => alert('تم بث تنبيه عاجل لجميع معتمري الفوج عبر القناة المشفرة 📢')}
          />
        )}

        {/* 2. Accountant View */}
        {(currentUser.role === 'accountant' || activeTab === 'accountant') && (
          <AccountantDashboard currentUser={currentUser} />
        )}

        {/* 3. Admin AI Teaching View */}
        {activeTab === 'admin_ai' && (
          <AiKnowledgeManager
            userRole="SUPER_ADMIN"
            userName={currentUser.name}
            title="مركز تدريب وتغذية صخر AI (الإدارة العامة)"
            subtitle="التحكم الكامل في جميع تصنيفات المعرفة والأسئلة الخاصة بالباقات، الأسعار، المناسك، والفنادق وقراءة صفحات الويب."
          />
        )}

        {/* 4. Rituals Counter Tab */}
        {activeTab === 'rituals' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black font-cairo text-amber-300">عداد ودليل مناسك العمرة التفاعلي</h2>
            <UmrahCounter />
          </div>
        )}

        {/* 5. Chat Module Tab */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black font-cairo text-amber-300">غرفة المحادثة والتواصل الميداني</h2>
            <ChatModule currentUser={currentUser} />
          </div>
        )}

        {/* 6. Pilgrim Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black font-cairo text-amber-300">قائمة الحجوزات النشطة</h2>
            {reservations.map((res) => (
              <div key={res.reservation_id} className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-500/30">
                      رقم الحجز: {res.reservation_number}
                    </span>
                    <h3 className="font-black text-lg font-cairo text-white mt-2">{res.package_name}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {res.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/80 text-xs text-slate-300">
                  <div>نوع الغرفة: **{res.room_type}**</div>
                  <div>عدد المعتمرين: **{res.travelers_count}**</div>
                  <div>المبلغ الإجمالي: **{res.total_amount.toLocaleString()} دج**</div>
                  <div>حالة الدفع: **{res.payment_status}**</div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
                  <span>تاريخ الطلب: {new Date(res.created_at).toLocaleDateString('ar-DZ')}</span>
                  <span className="text-emerald-400 font-bold">● تم تأكيد المقعد واستخراج التأشيرة</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 7. Pilgrim Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black font-cairo text-amber-300">ملف الوثائق البيومترية</h2>

              <label className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" /> {isUploading ? 'جاري التحميل...' : 'رفع جواز سفر جديد'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocumentUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.document_id} className="p-5 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white">{doc.file_name}</p>
                      <p className="text-[10px] text-slate-400">{doc.document_type} | مرفوع بتاريخ {new Date(doc.uploaded_at).toLocaleDateString('ar-DZ')}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      doc.status === 'VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {doc.status === 'VERIFIED' ? 'مؤكد ومفحوص' : 'قيد المراجعة'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. Payments & Receipts Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black font-cairo text-amber-300">وصولات وخصومات التحويل CCP</h2>
            {receipts.map((rcp) => (
              <div key={rcp.id} className="p-5 rounded-2xl bg-slate-900 border border-white/10 flex justify-between items-center">
                <div>
                  <span className="text-xs font-mono font-bold text-indigo-400">{rcp.id}</span>
                  <h4 className="font-bold text-sm text-white mt-1">{rcp.packageName}</h4>
                  <p className="text-xs text-slate-400">طريقة الدفع: {rcp.paymentMethod} | المحاسب: {rcp.accountantName}</p>
                </div>
                <div className="text-left">
                  <span className="text-lg font-black text-amber-300 font-cairo block">{rcp.totalAmount.toLocaleString()} دج</span>
                  <span className="text-[10px] text-emerald-400 font-bold">{rcp.status}</span>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <CustomerPortalContent />
    </Suspense>
  );
}
