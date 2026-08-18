'use client';

import React, { useState, useEffect } from 'react';
import { User, Receipt } from '@/types';
import AiKnowledgeManager from '@/components/AiKnowledgeManager';

interface AccountantDashboardProps {
  currentUser: User;
}

export default function AccountantDashboard({ currentUser }: AccountantDashboardProps) {
  const [activeTab, setActiveTab] = useState<'receipts' | 'ai_teach'>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [pilgrimName, setPilgrimName] = useState('');
  const [packageName, setPackageName] = useState('باقة أوت الاقتصادية المميزة (طيران مباشر)');
  const [totalAmount, setTotalAmount] = useState(215000);
  const [paidAmount, setPaidAmount] = useState(215000);
  const [paymentMethod, setPaymentMethod] = useState('تحويل بريدي موب (BaridiMob)');

  const fetchReceipts = async () => {
    try {
      const res = await fetch('/api/receipts');
      if (res.ok) setReceipts(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const totalRevenue = receipts.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
  const totalPending = receipts.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const newReceipt: Receipt = {
      id: `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      pilgrimName,
      pilgrimCode: 'PILGRIM-CUSTOM',
      packageName,
      totalAmount,
      paidAmount,
      remainingAmount: Math.max(0, totalAmount - paidAmount),
      paymentMethod,
      date: new Date().toISOString().split('T')[0],
      accountantName: currentUser.name,
      status: totalAmount - paidAmount <= 0 ? 'خالص الدفع' : 'عربون متبقي'
    };

    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReceipt),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setPilgrimName('');
        fetchReceipts();
        setSelectedReceipt(newReceipt);
      }
    } catch {}
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1d1d1f] tracking-tight">
            الشؤون المالية والسندات
          </h2>
          <p className="text-xs sm:text-sm text-[#6e6e73] mt-0.5">
            إدارة السندات الرقمية، التحويلات، وتدريب صخر على الأسعار
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#f5f5f7] p-1 rounded-xl flex gap-1 border border-black/5">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'receipts' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              السندات المالية
            </button>
            <button
              onClick={() => setActiveTab('ai_teach')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai_teach' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              تعليم صخر (الأسعار)
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            إصدار سند جديد
          </button>
        </div>
      </div>

      {activeTab === 'receipts' && (
        <div className="space-y-6">
          {/* Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs text-[#6e6e73] font-medium">إجمالي المبالغ المحصلة</span>
              <div className="text-2xl sm:text-3xl font-black text-[#34c759] tracking-tight">{totalRevenue.toLocaleString()} دج</div>
              <span className="text-[11px] text-[#6e6e73]">محدث فورياً من السجلات</span>
            </div>

            <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs text-[#6e6e73] font-medium">المبالغ قيد التحصيل</span>
              <div className="text-2xl sm:text-3xl font-black text-[#ff9500] tracking-tight">{totalPending.toLocaleString()} دج</div>
              <span className="text-[11px] text-[#6e6e73]">دفعات متبقية</span>
            </div>

            <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs text-[#6e6e73] font-medium">إجمالي السندات الصادرة</span>
              <div className="text-2xl sm:text-3xl font-black text-[#1d1d1f] tracking-tight">{receipts.length} سند</div>
              <span className="text-[11px] text-[#6e6e73]">سندات رقمية معتمدة</span>
            </div>
          </div>

          {/* Receipts List */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1d1d1f]">سجل سندات القبض</h3>
              <span className="text-xs text-[#6e6e73]">{receipts.length} عملية</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[#6e6e73]">
                    <th className="py-3 px-3 font-semibold">رقم السند</th>
                    <th className="py-3 px-3 font-semibold">اسم المعتمر</th>
                    <th className="py-3 px-3 font-semibold">الخدمة</th>
                    <th className="py-3 px-3 font-semibold">المبلغ الإجمالي</th>
                    <th className="py-3 px-3 font-semibold">المسدد</th>
                    <th className="py-3 px-3 font-semibold">المتبقي</th>
                    <th className="py-3 px-3 font-semibold">التاريخ</th>
                    <th className="py-3 px-3 font-semibold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-[#1d1d1f]">
                  {receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f5f5f7]/60 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#0071e3]">{r.id}</td>
                      <td className="py-3 px-3 font-bold">{r.pilgrimName}</td>
                      <td className="py-3 px-3 text-[#6e6e73] max-w-[200px] truncate">{r.packageName}</td>
                      <td className="py-3 px-3 font-bold">{r.totalAmount.toLocaleString()} دج</td>
                      <td className="py-3 px-3 text-[#34c759] font-bold">{r.paidAmount.toLocaleString()} دج</td>
                      <td className="py-3 px-3 text-[#ff9500] font-bold">{r.remainingAmount.toLocaleString()} دج</td>
                      <td className="py-3 px-3 text-[#6e6e73]">{r.date}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setSelectedReceipt(r)}
                          className="px-3 py-1 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-bold text-xs transition-colors cursor-pointer"
                        >
                          معاينة وطباعة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai_teach' && (
        <AiKnowledgeManager
          userRole="accountant"
          userName={currentUser.name || 'المحاسب المالي'}
          allowedCategories={['pricing', 'packages', 'faq']}
          title="تعليم صخر (الأسعار وطرق الدفع)"
          subtitle="تدريب صخر على حسابات الوكالة، التحويلات، شروط التقسيط، وسياسات الاسترداد"
        />
      )}

      {/* Create Receipt Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-right relative border border-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/5">
              <h3 className="text-base font-bold text-[#1d1d1f]">إصدار سند قبض رقمي</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#6e6e73] hover:text-[#1d1d1f] text-lg font-light p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">اسم المعتمر</label>
                <input
                  type="text"
                  required
                  value={pilgrimName}
                  onChange={(e) => setPilgrimName(e.target.value)}
                  placeholder="الاسم الكامل للمعتمر"
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">البرنامج أو الخدمة</label>
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1d1d1f] mb-1">المبلغ الإجمالي (دج)</label>
                  <input
                    type="number"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1d1d1f] mb-1">المسدد الآن (دج)</label>
                  <input
                    type="number"
                    required
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1d1d1f] mb-1">طريقة السداد</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#f5f5f7] border border-black/5 rounded-xl px-3.5 py-2.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
                >
                  <option value="تحويل بريدي موب (BaridiMob)">تحويل بريدي موب (BaridiMob)</option>
                  <option value="تحويل حساب جاري CCP">تحويل حساب جاري CCP</option>
                  <option value="نقداً في شباك الوكالة">نقداً في شباك الوكالة</option>
                  <option value="بطاقة دفع بنكية CIB/Visa">بطاقة دفع بنكية CIB/Visa</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] font-bold text-xs hover:bg-[#e8e8ed] transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0071e3] text-white font-bold text-xs hover:bg-[#0077ed] transition-all shadow-sm cursor-pointer"
                >
                  اعتماد السند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Printable Receipt Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl p-6 border border-black/5 shadow-2xl text-right relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pb-4 border-b border-black/5 mb-4">
              <h3 className="text-lg font-bold text-[#1d1d1f]">سوث ستريت للسياحة والأسفار</h3>
              <p className="text-xs text-[#6e6e73]">SOUTH STREET Travel Agency</p>
              <div className="text-xs font-bold text-[#0071e3] mt-1">سند قبض مالي رقم: {selectedReceipt.id}</div>
            </div>

            <div className="space-y-2 text-xs text-[#1d1d1f] mb-4">
              <div className="flex justify-between py-1 border-b border-black/5">
                <span className="text-[#6e6e73]">المستلم منه:</span>
                <strong>{selectedReceipt.pilgrimName}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-black/5">
                <span className="text-[#6e6e73]">مقابل خدمة:</span>
                <strong>{selectedReceipt.packageName}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-black/5">
                <span className="text-[#6e6e73]">طريقة السداد:</span>
                <strong>{selectedReceipt.paymentMethod}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-black/5">
                <span className="text-[#6e6e73]">التاريخ:</span>
                <strong>{selectedReceipt.date}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-black/5">
                <span className="text-[#6e6e73]">المحاسب المسؤول:</span>
                <strong>{selectedReceipt.accountantName}</strong>
              </div>
            </div>

            <div className="bg-[#f5f5f7] p-3.5 rounded-xl space-y-1.5 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6e6e73]">المبلغ الإجمالي:</span>
                <strong>{selectedReceipt.totalAmount.toLocaleString()} دج</strong>
              </div>
              <div className="flex justify-between text-[#34c759]">
                <span>المسدد:</span>
                <strong>{selectedReceipt.paidAmount.toLocaleString()} دج</strong>
              </div>
              <div className="flex justify-between text-[#ff9500]">
                <span>المتبقي:</span>
                <strong>{selectedReceipt.remainingAmount.toLocaleString()} دج</strong>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#6e6e73] pt-2 border-t border-black/5">
              <span>الاعتماد الرقمي</span>
              <span className="font-mono font-bold text-[#1d1d1f]">VERIFIED-AES-{selectedReceipt.id}</span>
            </div>

            <div className="flex gap-2 mt-4 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-[#1d1d1f] hover:bg-[#2d2d2f] text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                طباعة السند
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
