'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, User as UserIcon, Key, X, Crown, Briefcase, UserCheck, CreditCard } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  onClose: () => void;
  onSelectRole: (code: string, name: string) => void;
}

export default function LoginModal({ onClose, onSelectRole }: LoginModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code) {
      setError('يرجى إدخال رمز الأمان الخصوصي');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'رمز الوصول غير صحيح أو منتهي الصلاحية.');
      } else {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        onSelectRole(code, name || data.user.name);
        router.push('/portal');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRole = (roleCode: string, roleName: string) => {
    setCode(roleCode);
    setName(roleName);
    onSelectRole(roleCode, roleName);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="bg-slate-900 border-2 border-gold-main rounded-2xl p-6 w-full max-w-md shadow-2xl text-right text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-dark border border-gold-main text-gold-main flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
            🕋
          </div>
          <h3 className="text-xl font-black text-gold-main font-ruqaa">إقران الوصول والرمز الخاص</h3>
          <p className="text-xs text-slate-400 mt-1">سوث ستريت • نظام الاتصال المشفر AES-256</p>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs p-3 rounded-lg mb-4 text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">الاسم الكامل أو المعرف (اختياري)</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد عبد الله أو USR-005"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-gold-main transition-colors text-right"
              />
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">كود الوصول الخصوصي (Access Code)</label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="مثال: PILGRIM-101 أو ADMIN-2026"
                className="w-full bg-slate-800 border border-gold-main/60 rounded-lg px-3.5 py-2.5 text-sm text-gold-main font-mono font-bold tracking-wider focus:outline-none focus:border-gold-main transition-colors text-right uppercase"
              />
              <Key className="w-4 h-4 text-gold-main absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-gold-dark via-gold-main to-gold-dark text-slate-950 font-black py-2.5 rounded-lg hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'جاري التحقق والتوصيل...' : '🔐 إقران الجهاز والاتصال بالمستكشف'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400 mb-2.5 font-bold">تجربة الأكواد الخمسة الجاهزة فوراً:</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            <button
              onClick={() => handleQuickRole('ADMIN-2026', 'د. عبد الرحمن العتيبي')}
              className="bg-slate-800 hover:bg-slate-700 text-gold-main text-[11px] font-bold px-2.5 py-1.5 rounded border border-gold-main/30 flex items-center gap-1"
            >
              <Crown className="w-3 h-3 text-gold-main" /> مدير ADMIN
            </button>
            <button
              onClick={() => handleQuickRole('MANAGER-99', 'الأستاذ طارق السعيد')}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold px-2.5 py-1.5 rounded border border-emerald-500/30 flex items-center gap-1"
            >
              <Briefcase className="w-3 h-3 text-emerald-400" /> مسير MANAGER
            </button>
            <button
              onClick={() => handleQuickRole('GUIDE-777', 'الشيخ أحمد بن علي')}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold px-2.5 py-1.5 rounded border border-amber-500/30 flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3 text-amber-400" /> مرشد GUIDE
            </button>
            <button
              onClick={() => handleQuickRole('ACC-404', 'الأستاذ ياسين الفاسي')}
              className="bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold px-2.5 py-1.5 rounded border border-sky-500/30 flex items-center gap-1"
            >
              <CreditCard className="w-3 h-3 text-sky-400" /> محاسب ACC
            </button>
            <button
              onClick={() => handleQuickRole('PILGRIM-101', 'محمد عبد الله الشمري')}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold px-2.5 py-1.5 rounded border border-emerald-400/30 flex items-center gap-1"
            >
              <KaabaIcon className="w-3 h-3 text-emerald-300" /> معتمر PILGRIM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
