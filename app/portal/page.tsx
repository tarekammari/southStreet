'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import SakhrAgent from '@/components/SakhrAgent';
import { Reservation, CustomerDocument, Receipt } from '@/types';
import {
  FileText, CheckCircle, Clock, ShieldCheck, Upload, CreditCard,
  UserCheck, AlertCircle, Sparkles, Download
} from 'lucide-react';

export default function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState<'reservations' | 'documents' | 'payments'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
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
        package_name: 'باقة أوت الاقتصادية المميزة (طيران مباشر)',
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
        paymentMethod: 'تحويل بنكي (CCP)',
        date: '2026-08-11',
        accountantName: 'الأستاذ ياسين الفاسي',
        status: 'مكتمل'
      }
    ]);
  }, []);

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
      <Navbar />

      <main className="pt-28 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        {/* User Header */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-black text-2xl font-cairo">
              ع
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl font-cairo text-white">عمر بن علي</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                  معتمر معتمد
                </span>
              </div>
              <p className="text-xs text-slate-400">user@southstreet.dz | +213 559 88 77 66</p>
            </div>
          </div>

          <div className="flex gap-2">
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
          </div>
        </div>

        {/* Reservations Tab */}
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

        {/* Documents Tab */}
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

        {/* Payments Tab */}
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
