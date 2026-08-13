'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, FileCheck, X, Upload, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginModalProps {
  onClose: () => void;
  onSelectRole?: (code: string, name: string) => void;
}

export default function LoginModal({ onClose, onSelectRole }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const processAutoLogin = async (currentEmail: string, currentPassword: string, keyContent: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail, password: currentPassword, fileKey: keyContent })
      });

      const data = await res.json();

      if (!res.ok && data.status !== 'REQUIRES_FILE_KEY' && data.status !== 'PENDING_APPROVAL') {
        setError(data.error || 'بيانات الدخول غير صحيحة');
        setLoading(false);
        return;
      }

      if (data.status === 'REQUIRES_FILE_KEY') {
        setStep(2);
        setLoading(false);
        return;
      }

      if (data.status === 'PENDING_APPROVAL') {
        setError(`حسابك في انتظار موافقة مدير الوكالة.`);
        setLoading(false);
        return;
      }

      if (data.status === 'SUCCESS') {
        localStorage.setItem('south_street_token', data.token);
        localStorage.setItem('south_street_user', JSON.stringify(data.user));
        if (onSelectRole) onSelectRole(data.user.role, data.user.name);

        if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'AGENCY_MANAGER') {
          router.push('/admin');
        } else {
          router.push('/portal');
        }
        onClose();
      }
    } catch (err) {
      setError('تعذر الاتصال بخادم الأمان. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileRead = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setFileKey(text);
      setFileName(file.name);
      // AUTOMATIC INSTANT LOGIN!
      processAutoLogin(email, password, text);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileRead(file);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processAutoLogin(email, password, fileKey);
  };

  return (
    <div className="modal-overlay animate-fade-in flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md z-50 fixed inset-0 font-cairo" dir="rtl" onClick={onClose}>
      <div
        style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
        className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 w-full max-w-3xl shadow-2xl text-right text-slate-900 relative transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ backgroundColor: '#f1f5f9' }}
          className="absolute top-5 left-5 text-slate-500 hover:text-slate-900 p-2 rounded-2xl border border-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Wide Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Big Transparent Logo & Welcome Banner */}
          <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-l border-slate-200">
            <img
              src="/images/south_street_logo_trans.png"
              alt="South Street Agency"
              className="h-24 sm:h-28 w-auto object-contain mb-4 transition-transform hover:scale-105"
            />
            <h3 className="text-2xl font-black text-slate-900">بوابة ساوث ستريت</h3>
            <p className="text-xs text-slate-500 mt-2 font-bold leading-relaxed">
              منصة ساوث ستريت الموحدة لإدارة وخدمات ضيوف الرحمن
            </p>
            <div
              style={{ backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>اتصال آمن ومحمّي</span>
            </div>
          </div>

          {/* Right Column: Clean Form & Automatic Key Attachment */}
          <div className="md:col-span-7 space-y-5">
            {error && (
              <div
                style={{ backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }}
                className="text-xs p-3.5 rounded-2xl border flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@southstreet.dz"
                    style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
                    className="w-full rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm border"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
                    className="w-full rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white transition shadow-sm border"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {step === 2 && (
                <div className="animate-fade-in space-y-2">
                  <label className="block text-xs font-bold text-emerald-800">
                    أرفق أو أسقط ملف المفتاح (.key) لتأكيد دخول المدير:
                  </label>

                  {/* Clean Drag & Drop Zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    style={{
                      backgroundColor: isDragging ? '#ecfdf5' : fileName ? '#f0fdf4' : '#f8fafc',
                      borderColor: isDragging || fileName ? '#10b981' : '#cbd5e1'
                    }}
                    className="border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer relative"
                  >
                    <input
                      type="file"
                      accept=".key,.pem,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />

                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <Upload className={`w-8 h-8 ${fileName ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {fileName ? (
                        <div>
                          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 justify-center">
                            <FileCheck className="w-4 h-4 text-emerald-600" /> {fileName}
                          </p>
                          <p className="text-[11px] text-emerald-600 font-bold mt-1 animate-pulse">
                            جاري التحقق والولوج تلقائياً...
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-slate-800">أسقط ملف southstreet_admin.key هنا</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">أو انقر لاختيار الملف من الجهاز</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: '#059669' }}
                className="w-full hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition text-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    جاري التحقق والدخول...
                  </span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {step === 2 ? 'تأكيد ودخول البوابة' : 'تسجيل الدخول'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


