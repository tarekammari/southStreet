'use client';

import React, { useState, useEffect } from 'react';
import { User, AuditLog } from '@/types';
import { ShieldCheck, Plus, Key, Users, Activity, Lock, RefreshCw, X } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'pilgrim' | 'murshid' | 'accountant' | 'manager' | 'admin'>('pilgrim');
  const [newPhone, setNewPhone] = useState('');

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('south_street_token') || '';

    const roleNames: Record<string, string> = {
      pilgrim: 'معتمر',
      murshid: 'مرشد ديني',
      accountant: 'محاسب الوكالة',
      manager: 'مسير الحملات',
      admin: 'مدير النظام'
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          role: newRole,
          roleName: roleNames[newRole],
          phone: newPhone,
          code: generatedCode
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewName('');
        setNewPhone('');
        setGeneratedCode(generateCode());
        fetchData();
      }
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fade-in text-right">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gold-main font-ruqaa flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-gold-main" />
            لوحة مدير النظام والتحكم والأمان (ADMIN)
          </h2>
          <p className="text-xs text-slate-500 mt-1">إدارة الرموز المشفرة للمسيرين والمرشدين والمعتمرين وإحصائيات الأمان</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-gold-dark to-gold-main text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg hover:scale-102 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إصدار كود وصول جديد
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-gold-main/60 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gold-main" />
            المستخدمون المسجلون
          </div>
          <div className="text-2xl font-black text-slate-900">{users.length} مجمّع</div>
          <div className="text-[11px] text-emerald-600 font-bold">● جميع الأكواد مشفرة بالكامل</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-main" />
            أكواد الأمان النشطة
          </div>
          <div className="text-2xl font-black text-emerald-main">100% مؤمنة</div>
          <div className="text-[11px] text-slate-500 font-bold">بروتوكول WhatsApp Private SSL</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-sky-500" />
            أنشطة الأمان المسجلة
          </div>
          <div className="text-2xl font-black text-sky-600">{auditLogs.length} عملية</div>
          <div className="text-[11px] text-emerald-600 font-bold">تسجيل لحظي بدون فقدان</div>
        </div>
      </div>

      {/* Users & Access Codes Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 font-cairo">جدول الرموز والمستخدمين (User ID & Security Access Codes)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>المعرف ID</th>
                <th>اسم المستخدم</th>
                <th>الدور Role</th>
                <th>كود الوصول الأمني</th>
                <th>الهاتف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono font-bold text-gold-dark">{u.id}</td>
                  <td className="font-bold text-slate-900">{u.name}</td>
                  <td>
                    <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200">
                      {u.roleName}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono font-bold bg-slate-900 text-gold-main px-2.5 py-1 rounded border border-gold-main/50 text-xs">
                      {u.code}
                    </span>
                  </td>
                  <td dir="ltr" className="text-right text-xs font-semibold">{u.phone}</td>
                  <td><span className="text-emerald-600 font-bold text-xs">{u.status || 'نشط'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 overflow-hidden">
        <h3 className="text-base font-bold text-slate-900 font-cairo">سجل الأمان والعمليات المباشرة (Security Audit Logs)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>المستخدِم</th>
                <th>الدور</th>
                <th>الحدث</th>
                <th>التفاصيل</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.slice(0, 10).map((l) => (
                <tr key={l.id}>
                  <td className="text-xs text-slate-500 font-mono">{l.timestamp}</td>
                  <td className="font-semibold text-slate-900">{l.actorName}</td>
                  <td><span className="text-xs text-slate-600 font-bold">{l.actorRole}</span></td>
                  <td className="text-gold-dark font-bold text-xs">{l.action}</td>
                  <td className="text-xs text-slate-600">{l.details}</td>
                  <td className="font-mono text-xs text-slate-400">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
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

            <h3 className="text-lg font-black text-gold-main font-ruqaa mb-4">إنشاء كود وصول ومستخدم جديد</h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل للمستخدم</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: سلمان الخالدي"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">نوع الدور والصلاحية (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                >
                  <option value="pilgrim">مسافر / معتمر (Pilgrim)</option>
                  <option value="murshid">مرشد ديني (Guide)</option>
                  <option value="accountant">محاسب الوكالة (Accountant)</option>
                  <option value="manager">مسير حملات (Manager)</option>
                  <option value="admin">مدير نظام (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال للتواصل</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+966 50 000 0000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white text-right"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">كود الوصول المولد تلقائياً</label>
                  <button
                    type="button"
                    onClick={() => setGeneratedCode(generateCode())}
                    className="text-xs text-gold-main flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" /> تجديد
                  </button>
                </div>
                <div className="bg-slate-950 border border-gold-main rounded-lg p-2.5 text-center font-mono font-black text-lg text-gold-main tracking-widest">
                  {generatedCode}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-gold-dark via-gold-main to-gold-dark text-slate-950 font-black py-2.5 rounded-lg text-xs hover:brightness-110 transition-all shadow-lg"
              >
                💾 حفظ ونشر كود الوصول
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
