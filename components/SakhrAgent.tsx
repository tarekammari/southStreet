'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, X, Sparkles, Bot, User as UserIcon, RefreshCw,
  MapPin, CheckCircle, ArrowRight, Eye, Layers, Calendar, DollarSign,
  PhoneCall, ShieldCheck, Play, Image as ImageIcon, CreditCard, Building, UserCheck,
  Table, Database, Plus, Search, HelpCircle, FileText, Check, PlusCircle, LayoutGrid
} from 'lucide-react';
import { Package, Hotel, MediaAsset, AiAction, AiCard } from '@/types';

interface SakhrMessage {
  role: 'user' | 'ai';
  text: string;
  cards?: AiCard[];
  media?: MediaAsset[];
  map?: { title: string; latitude: number; longitude: number };
  escalated?: boolean;
}

interface SakhrAgentProps {
  onSearchFilter?: (keyword: string) => void;
}

const TABLE_LABELS: Record<string, string> = {
  packages: '📦 باقات العمرة والحج',
  hotels: '🏨 الفنادق المعتمدة',
  morshids: '👨‍💼 المرشدين وطاقم العمل',
  users: '👤 المستخدمين والحسابات',
  ai_knowledge: '📖 قواعد معرفة صخر AI',
  seasons: '🗓️ المواسم والرحلات',
  messages: '💬 رسائل الدردشة',
  receipts: '🧾 سندات القبض الرقمية',
  audit_logs: '🛡️ سجل تدقيق الأمان',
  agency_settings: '⚙️ إعدادات الوكالة',
  page_content: '📄 محتوى الصفحات'
};

export default function SakhrAgent({ onSearchFilter }: SakhrAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<SakhrMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Admin session state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  // Modals & Data Viewer state
  const [selectedMap, setSelectedMap] = useState<{ title: string; latitude: number; longitude: number } | null>(null);
  const [comparisonPackages, setComparisonPackages] = useState<Package[] | null>(null);
  const [bookingPackage, setBookingPackage] = useState<Package | null>(null);

  // Table Data Viewer Modal State
  const [tableModalData, setTableModalData] = useState<{
    tableName: string;
    label: string;
    columns: any[];
    rows: any[];
  } | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Formula Training Modal State
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [formulaQuestion, setFormulaQuestion] = useState('');
  const [formulaPattern, setFormulaPattern] = useState('');
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaSuccessMsg, setFormulaSuccessMsg] = useState('');

  // Table Data Inserter Modal State
  const [insertModalData, setInsertModalData] = useState<{ tableName: string; label: string; columns: any[] } | null>(null);
  const [insertFormData, setInsertFormData] = useState<Record<string, string>>({});
  const [insertSaving, setInsertSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check if current logged in user is Admin
  const checkAdminSession = () => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('south_street_user') || localStorage.getItem('southstreet_user');
        if (stored) {
          const u = JSON.parse(stored);
          const role = (u.role || '').toUpperCase();
          const email = (u.email || '').toLowerCase();
          if (
            role === 'SUPER_ADMIN' ||
            role === 'AGENCY_MANAGER' ||
            role === 'ADMIN' ||
            role === 'MANAGER' ||
            email.includes('admin') ||
            email.includes('manager') ||
            u.name?.includes('المدير')
          ) {
            setIsAdmin(true);
            setAdminModeEnabled(true);
            return;
          }
        }
        setIsAdmin(false);
        setAdminModeEnabled(false);
      }
    } catch {}
  };

  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkAdminSession();
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery('');

    const userMsg: SakhrMessage = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    if (onSearchFilter) onSearchFilter(q);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: q,
          history: messages.slice(-8).map((m) => ({ role: m.role, text: m.text }))
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      setIsThinking(false);

      const aiMsg: SakhrMessage = {
        role: 'ai',
        text: data.text || 'أهلاً بك! صخر المساعد الذكي لوكالة ساوث ستريت في خدمتك 🕋',
        cards: data.cards,
        media: data.media,
        map: data.map,
        escalated: data.escalated
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Handle custom DB Table Viewer Card automatically
      if (data.cards) {
        const dbViewerCard = data.cards.find((c: AiCard) => c.type === 'db_table_viewer');
        if (dbViewerCard && dbViewerCard.data) {
          setTableModalData(dbViewerCard.data);
        }
      }

      // Trigger automatic UI actions if specified by backend
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act: AiAction) => {
          if (act.type === 'open_modal' && act.target === 'login') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('southstreet:open-login'));
            }
          } else if (act.type === 'navigate' && act.target !== undefined) {
            if (typeof window !== 'undefined') {
              const target = act.target;
              if (target.startsWith('#')) {
                const elem = document.querySelector(target);
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                else window.location.href = '/' + target;
              } else {
                window.location.href = '/' + target.replace(/^\//, '');
              }
            }
          } else if (act.type === 'open_table_viewer' && (act as any).targetTable) {
            fetchTableData((act as any).targetTable);
          }
        });
      }

      if (data.map) setSelectedMap(data.map);
      if (data.cards && data.cards.some((c: AiCard) => c.type === 'comparison')) {
        const compData = data.cards.find((c: AiCard) => c.type === 'comparison')?.data;
        if (compData) setComparisonPackages(compData);
      }
    } catch (err: any) {
      setIsThinking(false);
      const isTimeout = err?.name === 'AbortError';
      const fallbackMsg: SakhrMessage = {
        role: 'ai',
        text: isTimeout
          ? '⏱️ استغرق الرد وقتاً أطول من المتوقع. يرجى إعادة المحاولة.'
          : '⚠️ حدث خطأ في الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى.'
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    }
  };

  const fetchTableData = async (tableName: string) => {
    try {
      const res = await fetch(`/api/admin/db-tables?table=${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setTableModalData({
          tableName: data.tableName,
          label: data.label,
          columns: data.columns,
          rows: data.rows
        });
      }
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    }
  };

  const openInsertForm = async (tableName: string) => {
    try {
      const res = await fetch(`/api/admin/db-tables?table=${tableName}`);
      if (res.ok) {
        const data = await res.json();
        setInsertModalData({
          tableName: data.tableName,
          label: data.label,
          columns: data.columns
        });
        const initialForm: Record<string, string> = {};
        data.columns.forEach((c: any) => {
          initialForm[c.name] = '';
        });
        setInsertFormData(initialForm);
      }
    } catch (err) {
      console.error('Failed to prepare insert form:', err);
    }
  };

  const handleInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insertModalData) return;
    setInsertSaving(true);

    try {
      const res = await fetch('/api/admin/db-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insert_data',
          tableName: insertModalData.tableName,
          rowData: insertFormData
        })
      });

      const data = await res.json();
      setInsertSaving(false);

      if (res.ok && data.success) {
        alert(`✅ ${data.message}`);
        setInsertModalData(null);
        // Refresh table view if open
        if (tableModalData?.tableName === insertModalData.tableName) {
          fetchTableData(insertModalData.tableName);
        }
        // Send confirmation in chat
        sendMessage(`تم إضافة البيانات إلى جدول ${insertModalData.label}`);
      } else {
        alert(`⚠️ ${data.error || 'فشل إضافة السطر'}`);
      }
    } catch (err: any) {
      setInsertSaving(false);
      alert('⚠️ حدث خطأ أثناء إضافة البيانات إلى الجدول');
    }
  };

  const handleTrainFormulaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaQuestion.trim() || !formulaPattern.trim()) return;
    setFormulaSaving(true);
    setFormulaSuccessMsg('');

    try {
      const res = await fetch('/api/admin/db-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'train_formula',
          formula: {
            question: formulaQuestion.trim(),
            responsePattern: formulaPattern.trim()
          }
        })
      });

      const data = await res.json();
      setFormulaSaving(false);

      if (res.ok && data.success) {
        setFormulaSuccessMsg(data.message);
        setTimeout(() => {
          setFormulaModalOpen(false);
          setFormulaQuestion('');
          setFormulaPattern('');
          setFormulaSuccessMsg('');
        }, 1500);

        // Send confirmation in chat
        sendMessage(`درب صخر على إجابة: ${formulaQuestion}`);
      } else {
        alert(`⚠️ ${data.error || 'فشل حفظ الصيغة'}`);
      }
    } catch {
      setFormulaSaving(false);
      alert('⚠️ حدث خطأ أثناء حفظ النموذج');
    }
  };

  const clearChat = () => {
    setMessages([]);
    setIsThinking(false);
  };

  const renderFormattedMessage = (content: string) => {
    return content.split('\n').map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\./.test(line.trim());

      return (
        <p
          key={lIdx}
          className={`min-h-[1.4rem] my-1 text-sm sm:text-base leading-relaxed ${
            isBullet ? 'pr-2 font-medium text-slate-100' : ''
          }`}
        >
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <>
      {/* ════════════════════════════════
           SAKHR FLOATING ORB TRIGGER
      ════════════════════════════════ */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col items-center gap-1.5 select-none">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="مساعد صخر الذكي"
          className="relative w-[72px] h-[72px] sm:w-[92px] sm:h-[92px] rounded-full focus:outline-none group cursor-pointer"
        >
          <span
            className="absolute -inset-3 sm:-inset-5 rounded-full sakhr-breath opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)' }}
          />
          <span
            className="absolute -inset-2 sm:-inset-3 rounded-full sakhr-breath opacity-40 pointer-events-none"
            style={{ animationDelay: '0.5s', background: 'radial-gradient(circle, rgba(56,189,248,0.8), transparent 65%)' }}
          />
          <span
            className="absolute -inset-1 rounded-full sakhr-breath opacity-60 pointer-events-none"
            style={{ animationDelay: '1s', background: 'radial-gradient(circle, rgba(124,58,237,0.7), transparent 65%)' }}
          />

          <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/60 sakhr-orbit pointer-events-none" />

          <span className="absolute inset-0 rounded-full sakhr-orb shadow-[0_0_35px_rgba(99,102,241,0.7)] group-hover:shadow-[0_0_55px_rgba(99,102,241,0.9)] transition-shadow duration-500 flex flex-col items-center justify-center gap-0.5 border border-white/30">
            <span className="absolute top-2 left-1/3 w-4 h-1.5 sm:w-6 sm:h-2 rounded-full bg-white/30 rotate-12 blur-sm pointer-events-none" />
            <span className="text-white font-black leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] text-xl sm:text-3xl font-cairo">
              صخر
            </span>
            <span className="text-white/90 tracking-[0.15em] leading-none text-[8px] sm:text-[10px] font-tajawal font-bold">
              AI CHAT
            </span>
          </span>
        </button>

        <span className="hidden sm:flex text-[11px] font-bold text-white/90 font-tajawal bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-xl items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>المساعد الذكي صخر 2.0</span>
        </span>
      </div>

      {/* ════════════════════════════════
           HIGH-END ULTRA-MODERN SAKHR CHAT PANEL
      ════════════════════════════════ */}
      {isOpen && (
        <div
          className="fixed top-[72px] sm:top-[80px] bottom-4 sm:bottom-6 right-2 sm:right-8 z-[250] w-[calc(100vw-16px)] sm:w-[640px] md:w-[740px] lg:w-[850px] max-w-[96vw] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-white/15"
          style={{
            background: 'rgba(11, 13, 20, 0.97)',
            backdropFilter: 'blur(45px) saturate(180%)',
            boxShadow: '0 30px 100px rgba(0,0,0,0.95), 0 0 40px rgba(99,102,241,0.15)'
          }}
        >
          {/* Header — ChatGPT & Gemini style with Admin Controls */}
          <div className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-white/10 bg-slate-950/80">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full sakhr-orb flex items-center justify-center shrink-0 border border-white/25 shadow-lg">
                <span className="text-white font-black text-lg font-cairo leading-none">ص</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-base font-cairo">صخر الذكي</span>
                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-tajawal flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      وضع الأدمن
                    </span>
                  )}
                  {!isAdmin && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold font-tajawal">
                      Sakhr 2.0 AI
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-tajawal flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  مساعد ساوث ستريت (استعلام وإدارة بيانات SQLite)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="مسح محادثة صخر"
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold font-tajawal flex items-center gap-1.5 transition-all cursor-pointer border border-white/5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">محادثة جديدة</span>
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Admin Toolbar Bar inside Sakhr Chat */}
          {isAdmin && (
            <div className="px-4 py-2 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 border-b border-emerald-500/30 flex items-center justify-between text-xs font-tajawal text-slate-200">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                أدوات الإدارة والبيانات المباشرة:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchTableData('packages')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Table className="w-3 h-3" />
                  استعراض الجداول
                </button>
                <button
                  onClick={() => openInsertForm('packages')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  إضافة سطر
                </button>
                <button
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  تدريب صيغة إجابة
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 font-tajawal text-sm sm:text-base leading-relaxed" style={{ minHeight: 250 }}>

            {/* Empty State Welcome Screen */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-6 px-4 space-y-6 my-auto">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center">
                  <span
                    className="absolute -inset-4 rounded-full sakhr-breath opacity-40 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 70%)' }}
                  />
                  <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/60 sakhr-orbit pointer-events-none" />
                  <div className="w-full h-full rounded-full sakhr-orb shadow-[0_0_35px_rgba(99,102,241,0.8)] flex flex-col items-center justify-center border border-white/20">
                    <span className="text-white font-black text-3xl font-cairo drop-shadow-md">صخر</span>
                    <span className="text-white/90 text-[10px] font-tajawal font-bold tracking-widest">AI AGENT</span>
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <h3 className="font-black text-lg sm:text-xl text-white font-cairo leading-snug">
                    أهلاً بك! المساعد الذكي صخر في خدمتكم 🕋✨
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-tajawal">
                    {isAdmin
                      ? 'مرحباً بالمدير العام! يمكنك الاستعلام، تدريب صيغ الإجابات، وإضافة أو استعراض جداول SQLite مباشرة من الشات.'
                      : 'أنا مساعدك المباشر لوكالة ساوث ستريت. أستخرج لك البيانات الرسمية من قاعدة البيانات الحية فوراً.'}
                  </p>
                </div>

                {/* Quick Interactive Prompt Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl pt-2 text-right">
                  {[
                    { icon: UserCheck, label: '👔 من هو مدير الوكالة والمحاسب؟', query: 'من هو مدير الوكالة ومن هو المحاسب المالي؟' },
                    { icon: CreditCard, label: '💳 تسهيلات التقسيط (من 2 إلى 10 أشهر)', query: 'ما هي شروط وتسهيلات الدفع والتقسيط من 2 الى 10 أشهر؟' },
                    { icon: Building, label: '📍 أين موقع ومقر الإدارة العامة؟', query: 'أين موقع ومقر الإدارة العامة لوكالة ساوث ستريت؟' },
                    { icon: Sparkles, label: '🕋 استعراض عروض وباقات العمرة 2026', query: 'عرض باقات وأسعار العمرة 2026' },
                    ...(isAdmin
                      ? [
                          { icon: Table, label: '📊 أظهر لي جدول باقات العمرة', query: 'أظهر لي جدول الباقات' },
                          { icon: PlusCircle, label: '➕ أضف بيانات جديدة إلى جدول', query: 'أريد إضافة بيانات إلى الجدول' }
                        ]
                      : [])
                  ].map((chip, idx) => {
                    const IconComp = chip.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => sendMessage(chip.query)}
                        className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/40 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition-all text-right flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComp className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{chip.label}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0 rotate-180 mr-1" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message History Render */}
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-y-0`}>

                {/* Avatar Icon */}
                {m.role === 'ai' ? (
                  <div className="w-9 h-9 rounded-full sakhr-orb flex items-center justify-center shrink-0 border border-white/20 shadow-md mt-1">
                    <span className="text-white font-black text-sm font-cairo leading-none">ص</span>
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center shrink-0 text-slate-300 mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}

                <div className="flex flex-col space-y-2 max-w-[88%] sm:max-w-[85%]">
                  <div
                    className="px-5 py-4 rounded-3xl text-sm sm:text-base leading-relaxed shadow-xl font-tajawal"
                    style={
                      m.role === 'user'
                        ? {
                            background: 'rgba(255,255,255,0.12)',
                            color: '#f8fafc',
                            border: '1px solid rgba(255,255,255,0.18)',
                            borderRadius: '24px 24px 4px 24px'
                          }
                        : {
                            background: 'linear-gradient(135deg, #1e1b4b, #1e293b)',
                            color: '#ffffff',
                            border: '1px solid rgba(129,140,248,0.4)',
                            borderRadius: '24px 24px 24px 4px'
                          }
                    }
                  >
                    {renderFormattedMessage(m.text)}

                    {/* Escalation Alert Banner */}
                    {m.escalated && (
                      <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>تم تحويل التذكرة لمستشار الوكالة المباشر</span>
                        </div>
                        <a
                          href="tel:+21321554433"
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors"
                        >
                          اتصال الآن
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Admin Quick Answer Correction Button */}
                  {isAdmin && m.role === 'ai' && (
                    <div className="flex justify-start pt-1">
                      <button
                        onClick={() => {
                          let prevQ = '';
                          for (let idx = i - 1; idx >= 0; idx--) {
                            if (messages[idx].role === 'user') {
                              prevQ = messages[idx].text;
                              break;
                            }
                          }
                          setFormulaQuestion(prevQ || 'استفسار المعتمر');
                          setFormulaPattern(m.text);
                          setFormulaModalOpen(true);
                        }}
                        className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title="تصحيح أو تعديل هذه الإجابة واعتمادها رسمياً في قاعدة بيانات صخر AI"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>✏️ تصحيح الإجابة واعتمادها رسميًا</span>
                      </button>
                    </div>
                  )}

                  {/* Render Custom Cards */}
                  {m.cards && m.cards.length > 0 && (
                    <div className="w-full space-y-3.5 mt-2">
                      {m.cards.map((c, cIdx) => {
                        // 1. Table Viewer Launcher Card
                        if (c.type === 'db_table_viewer') {
                          const tableInfo = c.data;
                          return (
                            <div key={cIdx} className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-emerald-500/40 text-white space-y-3 shadow-2xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <Table className="w-5 h-5 text-emerald-400" />
                                  <h4 className="font-bold text-base font-cairo text-emerald-300">{tableInfo.label}</h4>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                                  {tableInfo.totalRows || tableInfo.rows?.length || 0} سطر
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm text-slate-300">
                                يمكنك فتح النافذة الاحترافية لعرض وتصفية حقول وأسطر جدول **[{tableInfo.label}]** مباشرة.
                              </p>

                              <div className="flex gap-2.5 pt-1">
                                <button
                                  onClick={() => setTableModalData(tableInfo)}
                                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                                >
                                  <Eye className="w-4 h-4" />
                                  فتح نافذة استعراض البيانات الاحترافية
                                </button>
                                <button
                                  onClick={() => openInsertForm(tableInfo.tableName)}
                                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                                >
                                  <Plus className="w-4 h-4" />
                                  إضافة سطر
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // 2. Table Selector Prompt Card (When target table is ambiguous)
                        if (c.type === 'table_selector_prompt') {
                          const options = c.data?.options || [];
                          return (
                            <div key={cIdx} className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 text-white space-y-3 shadow-xl">
                              <h4 className="font-bold text-xs sm:text-sm font-cairo text-indigo-300 flex items-center gap-2">
                                <Database className="w-4 h-4 text-amber-400" />
                                {c.data?.title || 'اختر الجدول المطلوب للإضافة:'}
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                                {options.map((opt: any, oIdx: number) => (
                                  <button
                                    key={oIdx}
                                    onClick={() => openInsertForm(opt.name)}
                                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-indigo-600/30 border border-white/10 hover:border-indigo-500/50 text-xs font-bold text-slate-200 hover:text-white transition-all text-right flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{opt.label}</span>
                                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // 3. Package Cards
                        if (c.type === 'package') {
                          const pkg: Package = c.data;
                          return (
                            <div
                              key={cIdx}
                              className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-white space-y-3 shadow-2xl"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    {pkg.type}
                                  </span>
                                  <h4 className="font-black text-base sm:text-lg font-cairo text-amber-300 mt-1">{pkg.name}</h4>
                                </div>
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/90 px-3 py-1 rounded-xl border border-emerald-500/40">
                                  متوفر {pkg.available} مقاعد
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{pkg.description}</p>

                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 bg-slate-950/70 p-3 rounded-xl border border-white/5">
                                <div>🏨 **فندق مكة:** {pkg.makkah_hotel_name} ({pkg.makkah_hotel_dist})</div>
                                <div>✈️ **الطيران:** {pkg.airline}</div>
                                <div>📅 **المدة:** {pkg.duration_days} يومًا</div>
                                <div>💰 **يبدأ من:** {pkg.prices[0]?.amount.toLocaleString()} {pkg.prices[0]?.currency}</div>
                              </div>

                              <div className="flex gap-2.5 pt-1">
                                <button
                                  onClick={() => setBookingPackage(pkg)}
                                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md"
                                >
                                  <CheckCircle className="w-4 h-4" /> حجز فوري
                                </button>
                                <button
                                  onClick={() => sendMessage(`قارنلي الباقة ${pkg.name}`)}
                                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                                >
                                  <Layers className="w-4 h-4" /> مقارنة
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // 4. Hotel Cards
                        if (c.type === 'hotel') {
                          const htl: Hotel = c.data;
                          return (
                            <div key={cIdx} className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 text-white space-y-2.5">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm font-cairo text-indigo-200">{htl.name}</h4>
                                <span className="text-xs text-amber-400 font-bold">{htl.category}</span>
                              </div>
                              <p className="text-xs text-slate-300">📍 {htl.distance_from_haram}</p>
                              <button
                                onClick={() => setSelectedMap({ title: htl.name, latitude: htl.latitude, longitude: htl.longitude })}
                                className="text-xs text-indigo-300 hover:text-indigo-200 font-bold flex items-center gap-1.5 cursor-pointer pt-1"
                              >
                                <MapPin className="w-3.5 h-3.5 text-amber-400" /> عرض الموقع الجغرافي بالخريطة
                              </button>
                            </div>
                          );
                        }

                        // 5. Morshid / Guide Cards
                        if (c.type === 'morshid') {
                          const guide = c.data;
                          return (
                            <div key={cIdx} className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border border-emerald-500/40 text-white space-y-3.5 shadow-2xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center justify-center font-bold font-cairo text-xl shadow">
                                    {guide.avatar || 'أ'}
                                  </div>
                                  <div>
                                    <h4 className="font-black text-base font-cairo text-amber-300">{guide.name}</h4>
                                    <p className="text-xs text-emerald-400 font-bold">{guide.roleName}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ⭐ {guide.rating || '4.9'} ({guide.experience_years || 12} سنة خبرة)
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-white/5">
                                📌 **التخصص والمرافقة:** {guide.specialization}
                              </p>

                              <div className="flex items-center justify-between text-xs text-slate-300">
                                <span>اللغات: {Array.isArray(guide.languages) ? guide.languages.join(' • ') : guide.languages}</span>
                                <span className="text-emerald-400 font-bold">● {guide.status || 'متاح'}</span>
                              </div>

                              <div className="flex gap-2.5 pt-1">
                                <button
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      window.location.href = '/portal?tab=chat';
                                    }
                                  }}
                                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                                >
                                  💬 مراسلة المرشد الآن
                                </button>
                                <a
                                  href={`tel:${guide.phone || '+213550123456'}`}
                                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
                                >
                                  📞 اتصال
                                </a>
                              </div>
                            </div>
                          );
                        }

                        // 6. Action Navigation Cards
                        if (c.type === 'action') {
                          const act = c.data;
                          return (
                            <div key={cIdx} className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-indigo-500/15 border border-amber-500/40 text-white space-y-3 shadow-2xl">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <h4 className="font-bold text-sm sm:text-base text-amber-300 font-cairo">{act.title}</h4>
                              </div>
                              {act.description && <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{act.description}</p>}
                              <button
                                onClick={() => {
                                  if (act.targetModal === 'login') {
                                    if (typeof window !== 'undefined') {
                                      window.dispatchEvent(new CustomEvent('southstreet:open-login'));
                                    }
                                  } else if (act.targetUrl) {
                                    if (typeof window !== 'undefined') {
                                      const target = act.targetUrl;
                                      if (target.startsWith('#')) {
                                        const elem = document.querySelector(target);
                                        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                                        else window.location.href = '/' + target;
                                      } else {
                                        window.location.href = target;
                                      }
                                    }
                                  }
                                }}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                              >
                                <ArrowRight className="w-4 h-4" />
                                {act.buttonText || 'الانتقال للصفحة الآن'}
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}

                  {/* Render Media Gallery */}
                  {m.media && m.media.length > 0 && (
                    <div className="w-full space-y-2.5 mt-2">
                      {m.media.map((med, medIdx) => {
                        if (med.type === 'VIDEO') {
                          return (
                            <div key={medIdx} className="rounded-2xl overflow-hidden border border-indigo-500/40 bg-slate-950 p-2 space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-bold px-1">
                                <Play className="w-4 h-4 text-amber-400 fill-amber-400" /> {med.title}
                              </div>
                              <video
                                controls
                                playsInline
                                src={med.url}
                                className="w-full rounded-xl max-h-52 object-cover bg-black"
                                poster={med.thumbnail_url}
                              />
                              <p className="text-[11px] text-slate-400 px-1">{med.description}</p>
                            </div>
                          );
                        }

                        return (
                          <div key={medIdx} className="relative rounded-xl overflow-hidden border border-white/20 group">
                            <img src={med.url} alt={med.title} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2.5 flex flex-col justify-end">
                              <p className="text-xs text-white font-bold truncate">{med.title}</p>
                              <span className="text-[9px] text-emerald-400 font-medium">{med.license}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ANIMATED SAKHR AI ICON LOADING STATE */}
            {isThinking && (
              <div className="flex items-start gap-3 justify-start animate-fade-in my-3">
                <div className="relative w-10 h-10 rounded-full shrink-0 flex items-center justify-center mt-1">
                  <span className="absolute -inset-2 rounded-full sakhr-breath opacity-70 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 70%)' }} />
                  <span className="absolute inset-0 rounded-full border border-dashed border-indigo-400 sakhr-orbit pointer-events-none" />
                  <div className="w-full h-full rounded-full sakhr-orb shadow-[0_0_20px_rgba(99,102,241,0.9)] flex items-center justify-center border border-white/30">
                    <span className="text-white font-black text-sm font-cairo leading-none">ص</span>
                  </div>
                </div>

                <div
                  className="px-5 py-4 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border border-indigo-500/50 text-white shadow-2xl max-w-[85%]"
                  style={{ borderRadius: '24px 24px 24px 4px' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs sm:text-sm text-indigo-200 font-bold font-tajawal">
                      صخر الذكي يستعلم قاعدة البيانات الحية ويعد الإجابة...
                    </span>
                    <div className="flex gap-1.5 items-center">
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span
                          key={i}
                          className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-bounce"
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Bar — ChatGPT / Gemini style */}
          <div className="px-4 sm:px-6 pb-5 pt-3 shrink-0 bg-slate-950/80 border-t border-white/10">
            <div
              className="flex items-center gap-3 rounded-2xl border border-white/15 px-4 py-3 focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                dir="rtl"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isAdmin ? "اسأل، أظهر الجداول، أضف بيانات، أو درب صيغة إجابة..." : "اسأل صخر عن الباقات، الأسعار، المدير، المحاسب، المقر أو التقسيط..."}
                className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none font-tajawal text-right resize-none leading-relaxed"
              />
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || !query.trim()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                style={{ background: query.trim() ? 'linear-gradient(135deg,#4f46e5,#2563eb)' : 'rgba(255,255,255,0.08)' }}
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 pt-2 font-tajawal">
              <span>وكالة ساوث ستريت للأسفار والعمرة • الجزائر 🇩🇿</span>
              <span>إجابات معتمدة فورية من قاعدة البيانات SQLite</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           PROFESSIONAL DATABASE TABLE DATA VIEWER MODAL
      ══════════════════════════════════════════════════════════ */}
      {tableModalData && (
        <div className="fixed inset-0 z-[320] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 font-tajawal">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl text-white overflow-hidden">
            {/* Table Viewer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg font-cairo text-emerald-300">
                      جدول: {tableModalData.label} ({tableModalData.tableName})
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                      {tableModalData.rows?.length || 0} سطر
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">استعراض وتصفية بيانات SQLite الحية مباشرة من واجهة الشات</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openInsertForm(tableModalData.tableName)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  إضافة سطر لهذا الجدول
                </button>
                <button
                  onClick={() => setTableModalData(null)}
                  className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Table Controls (Search & Switcher) */}
            <div className="px-6 py-3 bg-slate-950/50 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="تصفية وسحب البيانات بالبحث..."
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl pr-9 pl-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>تغيير الجدول:</span>
                <select
                  value={tableModalData.tableName}
                  onChange={(e) => fetchTableData(e.target.value)}
                  className="bg-slate-800 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none"
                >
                  {Object.keys(TABLE_LABELS).map((tblKey) => (
                    <option key={tblKey} value={tblKey}>
                      {TABLE_LABELS[tblKey]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data Grid Body */}
            <div className="flex-1 overflow-auto p-4 font-tajawal text-xs">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-white/10 text-slate-400 sticky top-0 font-cairo">
                    {tableModalData.columns?.map((col: any) => (
                      <th key={col.name} className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-bold text-slate-200">
                          <span>{col.name}</span>
                          <span className="text-[9px] font-normal px-1 rounded bg-slate-800 text-slate-400">{col.type}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableModalData.rows
                    ?.filter((row: any) => {
                      if (!tableSearchQuery.trim()) return true;
                      return JSON.stringify(row).toLowerCase().includes(tableSearchQuery.toLowerCase());
                    })
                    .map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                        {tableModalData.columns?.map((col: any) => {
                          const val = row[col.name];
                          let valStr = '';
                          if (val === null || val === undefined) valStr = 'NULL';
                          else if (typeof val === 'object') valStr = JSON.stringify(val);
                          else valStr = String(val);

                          return (
                            <td key={col.name} className="px-3 py-2 max-w-xs truncate text-slate-200 font-mono text-[11px]">
                              {valStr.length > 50 ? (
                                <span title={valStr} className="cursor-help text-indigo-300">
                                  {valStr.substring(0, 50)}...
                                </span>
                              ) : (
                                <span>{valStr}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           FORMULA TRAINING MODAL (FOR ADMIN RESPONSE TEMPLATES)
      ══════════════════════════════════════════════════════════ */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-[330] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-tajawal">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base font-cairo text-amber-300">تدريب صيغة إجابة رسمية لـ صخر AI</h3>
              </div>
              <button onClick={() => setFormulaModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {formulaSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                {formulaSuccessMsg}
              </div>
            )}

            <form onSubmit={handleTrainFormulaSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">السؤال / الموضوع الذي يطرحه المعتمر:</label>
                <input
                  type="text"
                  required
                  value={formulaQuestion}
                  onChange={(e) => setFormulaQuestion(e.target.value)}
                  placeholder="مثال: شروط استرجاع الحجز عند الإلغاء"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">صيغة الإجابة المعتمدة (النموذج الرسمي):</label>
                <textarea
                  required
                  rows={5}
                  value={formulaPattern}
                  onChange={(e) => setFormulaPattern(e.target.value)}
                  placeholder="اكتب نموذج الإجابة الرسمي هنا، يمكنك استخدام التنسيق **عريض** أو النقاط..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={formulaSaving}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  {formulaSaving ? 'جاري الحفظ...' : '🎉 اعتماد وحفظ النموذج بنجاح'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormulaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           TABLE ROW INSERTION MODAL
      ══════════════════════════════════════════════════════════ */}
      {insertModalData && (
        <div className="fixed inset-0 z-[340] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-tajawal">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-base font-cairo text-indigo-300">
                  إضافة سطر جديد إلى جدول [{insertModalData.label}]
                </h3>
              </div>
              <button onClick={() => setInsertModalData(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleInsertSubmit} className="flex-1 overflow-y-auto space-y-3 py-3 text-xs pr-1">
              {insertModalData.columns?.map((col: any) => (
                <div key={col.name}>
                  <label className="block text-slate-300 font-bold mb-1">
                    {col.name} <span className="text-[10px] text-slate-500 font-normal">({col.type})</span>
                  </label>
                  <input
                    type="text"
                    value={insertFormData[col.name] || ''}
                    onChange={(e) => setInsertFormData({ ...insertFormData, [col.name]: e.target.value })}
                    placeholder={`أدخل قيمة ${col.name}...`}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              ))}

              <div className="flex gap-2.5 pt-4 shrink-0">
                <button
                  type="submit"
                  disabled={insertSaving}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
                >
                  {insertSaving ? 'جاري الإضافة...' : '✅ إضافة السطر فوراً لـ SQLite'}
                </button>
                <button
                  type="button"
                  onClick={() => setInsertModalData(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAP VIEW MODAL */}
      {selectedMap && (
        <div className="fixed inset-0 z-[300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-white">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base font-cairo text-amber-300 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" /> {selectedMap.title}
              </h3>
              <button onClick={() => setSelectedMap(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="w-full h-64 rounded-2xl bg-slate-800 flex flex-col items-center justify-center border border-white/10 p-4 text-center space-y-2">
              <MapPin className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-sm font-bold text-white">إحداثيات صحن الحرم المكي والفندق المعتمد</p>
              <p className="text-xs text-indigo-300">
                خط العرض: {selectedMap.latitude} | خط الطول: {selectedMap.longitude}
              </p>
            </div>
            <button
              onClick={() => setSelectedMap(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs"
            >
              إغلاق الخريطة
            </button>
          </div>
        </div>
      )}

      {/* INSTANT BOOKING MODAL */}
      {bookingPackage && (
        <div className="fixed inset-0 z-[300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-white">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base font-cairo text-amber-300">تأكيد طلب الحجز المبدئي</h3>
              <button onClick={() => setBookingPackage(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-1">
              <p className="font-bold text-amber-300">{bookingPackage.name}</p>
              <p className="text-slate-300">السعر: {bookingPackage.prices[0]?.amount.toLocaleString()} دج / معتمر</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(`احجزلي الباقة ${bookingPackage.name}`);
                setBookingPackage(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-300 mb-1">الاسم واللقب</label>
                <input
                  type="text"
                  required
                  placeholder="محمد بن عبد الله"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  required
                  placeholder="+213 550 00 00 00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                  تأكيد الحجز وتوليد الرقم
                </button>
                <button
                  type="button"
                  onClick={() => setBookingPackage(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
