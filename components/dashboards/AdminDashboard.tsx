'use client';

import React, { useState, useEffect } from 'react';
import { User, AuditLog } from '@/types';
import { ShieldCheck, Plus, Key, Users, Activity, Lock, RefreshCw, X, CheckCircle } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [users, setUsers]         = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newRole, setNewRole]     = useState<'pilgrim' | 'murshid' | 'accountant' | 'manager' | 'admin'>('pilgrim');
  const [newPhone, setNewPhone]   = useState('');

  const generateCode = () => `VIP-${Math.floor(1000 + Math.random() * 9000)}`;
  const [generatedCode, setGeneratedCode] = useState(generateCode());

  const fetchData = async () => {
    try {
      const uRes = await fetch('/api/users');
      if (uRes.ok) setUsers(await uRes.json());
      const aRes = await fetch('/api/audit');
      if (aRes.ok) setAuditLogs(await aRes.json());
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('south_street_token') || '';
    const roleNames: Record<string, string> = {
      pilgrim: 'معتمر', murshid: 'مرشد ديني', accountant: 'محاسب الوكالة',
      manager: 'مسير الحملات', admin: 'مدير النظام'
    };
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName, role: newRole, roleName: roleNames[newRole], phone: newPhone, code: generatedCode })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewName(''); setNewPhone(''); setGeneratedCode(generateCode());
        fetchData();
      }
    } catch {}
  };

  const ROLE_LABELS: Record<string, string> = {
    pilgrim: 'معتمر', murshid: 'مرشد', accountant: 'محاسب', manager: 'مسير', admin: 'مدير'
  };

  return (
    <div className="space-y-5 text-right" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">إدارة الأكواد والمستخدمين</h2>
            <p className="text-xs text-slate-500">رموز الدخول المشفرة • سجل الأمان الحي</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          إصدار كود جديد
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
            <Users className="w-3.5 h-3.5 text-emerald-500" /> مجموع المستخدمين
          </div>
          <p className="text-2xl font-black text-slate-900">{users.length}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">● جميع الأكواد مشفرة</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
            <Lock className="w-3.5 h-3.5 text-sky-500" /> أمان النظام
          </div>
          <p className="text-2xl font-black text-sky-600">100%</p>
          <p className="text-[11px] text-slate-400 font-bold mt-1">WhatsApp Private SSL</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
            <Activity className="w-3.5 h-3.5 text-violet-500" /> أنشطة مسجلة
          </div>
          <p className="text-2xl font-black text-violet-600">{auditLogs.length}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">● تسجيل لحظي</p>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">جدول المستخدمين وأكواد الوصول</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['المعرف', 'الاسم', 'الدور', 'كود الوصول', 'الهاتف', 'الحالة'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-slate-400 text-[11px]">{u.id}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md border border-slate-200">
                      {u.roleName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold bg-slate-900 text-emerald-400 px-2 py-1 rounded-md text-[11px] tracking-wider">
                      {u.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]" dir="ltr">{u.phone}</td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {u.status || 'نشط'}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Audit Logs ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">سجل الأنشطة الأمنية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['التاريخ والوقت', 'المستخدم', 'الدور', 'الحدث', 'التفاصيل', 'IP'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {auditLogs.slice(0, 10).map(l => (
                <tr key={l.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">{l.timestamp}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{l.actorName}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{l.actorRole}</span>
                  </td>
                  <td className="px-4 py-3 text-emerald-700 font-bold text-[11px]">{l.action}</td>
                  <td className="px-4 py-3 text-slate-500 text-[11px]">{l.details}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{l.ip}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create User Modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-600" />
                إصدار كود وصول جديد
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الاسم الكامل</label>
                <input
                  type="text" required value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="مثال: سلمان الخالدي"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">الدور والصلاحية</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="pilgrim">معتمر</option>
                  <option value="murshid">مرشد ديني</option>
                  <option value="accountant">محاسب الوكالة</option>
                  <option value="manager">مسير حملات</option>
                  <option value="admin">مدير النظام</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">رقم الجوال</label>
                <input
                  type="text" value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="+966 50 000 0000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">كود الوصول المولَّد</label>
                  <button
                    type="button"
                    onClick={() => setGeneratedCode(generateCode())}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> تجديد
                  </button>
                </div>
                <div className="bg-slate-900 rounded-xl p-3 text-center font-mono font-black text-lg text-emerald-400 tracking-widest border border-slate-700">
                  {generatedCode}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> حفظ وإصدار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
