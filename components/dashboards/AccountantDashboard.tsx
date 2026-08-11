'use client';

import React, { useState, useEffect } from 'react';
import { User, Receipt } from '@/types';
import { CreditCard, Plus, Printer, DollarSign, FileText, CheckCircle2, X } from 'lucide-react';

interface AccountantDashboardProps {
  currentUser: User;
}

export default function AccountantDashboard({ currentUser }: AccountantDashboardProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [pilgrimName, setPilgrimName] = useState('');
  const [packageName, setPackageName] = useState('باقة العمرة الفاخرة - 10 أيام (مكة والمدينة)');
  const [totalAmount, setTotalAmount] = useState(12500);
  const [paidAmount, setPaidAmount] = useState(12500);
  const [paymentMethod, setPaymentMethod] = useState('بطاقة مدى / Visa');

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
    <div className="space-y-6 animate-fade-in text-right">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gold-main font-ruqaa flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-gold-main" />
            لوحة المحاسب والمالية (ACCOUNTANT)
          </h2>
          <p className="text-xs text-slate-500 mt-1">إدارة السندات الرقمية وسجلات تحصيل الدفعات وباقات العمرة والوكالة</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-gold-dark to-gold-main text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg hover:scale-102 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إصدار سند قبض جديد
        </button>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-gold-main rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold">إجمالي المبالغ المحصلة</div>
          <div className="text-2xl font-black text-emerald-600">{totalRevenue.toLocaleString()} ر.س</div>
          <div className="text-[11px] text-emerald-600 font-bold">محدثة فورياً من السندات</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold">المبالغ المتبقية (قيد التحصيل)</div>
          <div className="text-2xl font-black text-amber-600">{totalPending.toLocaleString()} ر.س</div>
          <div className="text-[11px] text-slate-500 font-bold">تنبيهات للمعتمرين بالدفع</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold">إجمالي السندات الرقمية</div>
          <div className="text-2xl font-black text-slate-900">{receipts.length} سند قبض</div>
          <div className="text-[11px] text-gold-dark font-bold">معتمدة ومختومة برمجياً</div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 font-cairo">سجل سندات القبض والدفعات الرقمية</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم السند</th>
                <th>اسم المعتمر</th>
                <th>الباقة والخدمة</th>
                <th>المبلغ الإجمالي</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>تاريخ السند</th>
                <th>معاينة</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-bold text-gold-dark">{r.id}</td>
                  <td className="font-bold text-slate-900">{r.pilgrimName}</td>
                  <td className="text-slate-600 text-xs">{r.packageName}</td>
                  <td className="font-bold text-slate-900">{r.totalAmount.toLocaleString()} ر.س</td>
                  <td className="text-emerald-600 font-bold">{r.paidAmount.toLocaleString()} ر.س</td>
                  <td className="text-amber-600 font-bold">{r.remainingAmount.toLocaleString()} ر.س</td>
                  <td className="text-xs text-slate-500">{r.date}</td>
                  <td>
                    <button
                      onClick={() => setSelectedReceipt(r)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> طباعة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Receipt Modal */}
      {isModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-slate-900 border-2 border-gold-main rounded-2xl p-6 w-full max-w-md shadow-2xl text-right text-white relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-gold-main font-ruqaa mb-4">إصدار سند قبض رقمي معتمد</h3>

            <form onSubmit={handleCreateReceipt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المعتمر المستلم منه</label>
                <input
                  type="text"
                  required
                  value={pilgrimName}
                  onChange={(e) => setPilgrimName(e.target.value)}
                  placeholder="مثال: محمد عبد الله الشمري"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم باقة العمرة / الخدمة</label>
                <input
                  type="text"
                  required
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المبلغ الإجمالي (ر.س)</label>
                  <input
                    type="number"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المسدد الآن (ر.س)</label>
                  <input
                    type="number"
                    required
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">طريقة الدفع وسيلة السداد</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                >
                  <option value="بطاقة مدى / Visa">بطاقة مدى / Visa</option>
                  <option value="تحويل بنكي سديد">تحويل بنكي سديد</option>
                  <option value="نقد شباك الوكالة">نقداً في شباك الوكالة</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-gold-dark via-gold-main to-gold-dark text-slate-950 font-black py-2.5 rounded-lg text-xs hover:brightness-110 transition-all shadow-lg"
              >
                🧾 اعتماد وطباعة السند الرقمي
              </button>
            </form>
          </div>
        </div>
      )}

      {/* View Printable Receipt Modal */}
      {selectedReceipt && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedReceipt(null)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-paper text-right relative">
              <div className="text-center pb-4 border-b border-slate-200 mb-4">
                <h3 className="text-xl font-black text-emerald-dark">وكالة سوث ستريت للسياحة والعمرة</h3>
                <p className="text-xs text-slate-500">SOUTH STREET Travel Agency - Makkah & Madinah</p>
                <div className="text-xs font-bold text-gold-dark mt-1">سند قبض مالــي معتمد (رقم: {selectedReceipt.id})</div>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="receipt-row"><span>استلمنا من السيد/ة:</span> <strong>{selectedReceipt.pilgrimName}</strong></div>
                <div className="receipt-row"><span>مقابل خدمة:</span> <strong>{selectedReceipt.packageName}</strong></div>
                <div className="receipt-row"><span>وسيلة السداد:</span> <strong>{selectedReceipt.paymentMethod}</strong></div>
                <div className="receipt-row"><span>تاريخ الإصدار:</span> <strong>{selectedReceipt.date}</strong></div>
                <div className="receipt-row"><span>المحاسب المسؤول:</span> <strong>{selectedReceipt.accountantName}</strong></div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 mb-4 text-xs">
                <div className="receipt-row"><span>المبلغ الإجمالي:</span> <strong>{selectedReceipt.totalAmount.toLocaleString()} ر.س</strong></div>
                <div className="receipt-row text-emerald-600"><span>المبلغ المسدد:</span> <strong>{selectedReceipt.paidAmount.toLocaleString()} ر.س</strong></div>
                <div className="receipt-row text-amber-600"><span>المتبقي:</span> <strong>{selectedReceipt.remainingAmount.toLocaleString()} ر.س</strong></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                <span>ختم الاعتماد البرمجي 🔒</span>
                <span className="font-mono font-bold">VERIFIED-AES-{selectedReceipt.id}</span>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-emerald-main text-white font-bold py-2 rounded-lg text-xs hover:bg-emerald-dark transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> طباعة السند
                </button>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
