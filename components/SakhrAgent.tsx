'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, X, User as UserIcon, RefreshCw,
  MapPin, CheckCircle, Eye, Layers,
  PhoneCall, Play,
  Table, Database, Plus, Search, FileText,
  Sparkles, BookOpen, ShieldCheck
} from 'lucide-react';
import { Package, Hotel, MediaAsset, AiAction, AiCard } from '@/types';

interface SakhrMessage {
  role: 'user' | 'ai';
  text: string;
  cards?: AiCard[];
  media?: MediaAsset[];
  map?: { title: string; latitude: number; longitude: number };
  escalated?: boolean;
  noKnowledge?: boolean;
  trusted?: boolean;
  externalAi?: boolean;
  sourceType?: 'agency_db' | 'external_ai' | 'local_guidance' | 'system';
  source?: string;
  sourceLabel?: string;
  model?: string;
  toolsUsed?: string[];
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

/** Strip legacy inline source footers — UI banner handles attribution */
function stripInlineSourceFooters(text: string): string {
  return text
    .replace(/\n\n---\n🤖 \*\*مصدر الإجابة:\*\*[\s\S]*$/u, '')
    .replace(/\n\n---\n📘 \*\*مصدر الإجابة:\*\*[\s\S]*$/u, '')
    .replace(/\n\n✅ \*مصدر موثوق:[\s\S]*$/u, '')
    .trim();
}

type ResolvedSource =
  | { kind: 'agency_db'; label: string; table?: string }
  | { kind: 'external_ai'; label: string; model?: string }
  | { kind: 'local_guidance'; label: string }
  | null;

function resolveMessageSource(m: SakhrMessage): ResolvedSource {
  if (m.noKnowledge) return null;

  const isExternal =
    m.externalAi === true ||
    m.sourceType === 'external_ai' ||
    m.sourceType === 'local_guidance' ||
    (m.model?.includes('gemini') ?? false) ||
    m.model === 'local-faq';

  if (isExternal) {
    if (m.sourceType === 'local_guidance' || m.model === 'local-faq') {
      return {
        kind: 'local_guidance',
        label: m.sourceLabel || m.source || 'إرشادات عامة — ليست من قاعدة الوكالة',
      };
    }
    return {
      kind: 'external_ai',
      label: m.sourceLabel || m.source || 'Google Gemini',
      model: m.model,
    };
  }

  if (m.trusted === true || m.sourceType === 'agency_db') {
    return {
      kind: 'agency_db',
      label: m.sourceLabel || TABLE_LABELS[m.source || ''] || 'قاعدة بيانات الوكالة',
      table: m.source,
    };
  }

  return null;
}

function SourceAttributionBanner({ source }: { source: ResolvedSource }) {
  if (!source) return null;

  if (source.kind === 'agency_db') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-l from-emerald-950/60 to-emerald-900/20 border border-emerald-500/35 shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-emerald-300 font-cairo leading-snug">
            إجابة معتمدة — من قاعدة بيانات الوكالة
          </p>
          <p className="text-[10px] text-emerald-400/75 font-tajawal mt-0.5 truncate">
            {source.label}
          </p>
        </div>
        <Database className="w-4 h-4 text-emerald-500/50 shrink-0 mt-1" />
      </div>
    );
  }

  if (source.kind === 'external_ai') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-l from-violet-950/60 to-indigo-900/20 border border-violet-500/35 shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-violet-200 font-cairo leading-snug">
            إجابة من ذكاء اصطناعي خارجي — ليست من قاعدة الوكالة
          </p>
          <p className="text-[10px] text-violet-300/80 font-tajawal mt-0.5">
            المصدر: {source.label}
          </p>
          <p className="text-[9px] text-neutral-500 font-tajawal mt-1">
            ⚠️ تحقق من المعلومات المهمة مع المرشد أو الإدارة
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-l from-amber-950/50 to-orange-900/15 border border-amber-500/30 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
        <BookOpen className="w-4 h-4 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-amber-300 font-cairo leading-snug">
          إرشاد عام — ليس من قاعدة بيانات الوكالة
        </p>
        <p className="text-[10px] text-amber-400/75 font-tajawal mt-0.5">
          {source.label}
        </p>
      </div>
    </div>
  );
}

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
        escalated: data.escalated,
        noKnowledge: data.noKnowledge,
        trusted: data.trusted,
        externalAi: data.externalAi,
        sourceType: data.sourceType,
        source: data.source,
        sourceLabel: data.sourceLabel,
        model: data.model,
        toolsUsed: data.toolsUsed,
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
              const target = String(act.target);
              const highlightSection = (selector: string) => {
                const elem = document.querySelector(selector);
                if (elem) {
                  elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  elem.classList.add('section-highlight');
                  setTimeout(() => elem.classList.remove('section-highlight'), 2800);
                }
              };

              if (target.startsWith('#')) {
                highlightSection(target);
                if (!document.querySelector(target)) {
                  window.location.href = '/' + target;
                }
              } else if (target.includes('?')) {
                window.location.href = '/' + target.replace(/^\//, '');
              } else if (target === '' || target === '/') {
                window.location.href = '/';
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
          className={`min-h-[1.4rem] my-0.5 text-[15px] leading-relaxed ${
            isBullet ? 'pr-2 text-neutral-200' : 'text-neutral-200'
          }`}
        >
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-[#ececec]">
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
      {/* Floating trigger */}
      <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 select-none">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="مساعد صخر الذكي"
          className="relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full focus:outline-none group cursor-pointer sakhr-fab flex items-center justify-center"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          ) : (
            <>
              <span className="text-[#c9a962] font-bold text-lg sm:text-xl font-cairo leading-none">ص</span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#171717]" />
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed top-[72px] sm:top-[80px] bottom-4 sm:bottom-6 right-2 sm:right-8 z-[250] w-[calc(100vw-16px)] sm:w-[420px] md:w-[480px] lg:w-[520px] max-w-[96vw] flex flex-col rounded-2xl overflow-hidden animate-fade-in sakhr-chat-panel">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full sakhr-avatar-accent flex items-center justify-center shrink-0">
                <span className="text-[#c9a962] font-semibold text-sm font-cairo leading-none">ص</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#ececec] font-medium text-sm font-cairo truncate">صخر</span>
                  {isAdmin && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-neutral-400 text-[10px] font-tajawal shrink-0">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-500 font-tajawal truncate">
                  مساعد ساوث ستريت
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="محادثة جديدة"
                  className="w-8 h-8 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Admin tools — subtle icon bar */}
          {isAdmin && (
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-1">
              <button
                onClick={() => fetchTableData('packages')}
                title="استعراض الجداول"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] text-[11px] font-tajawal transition-colors cursor-pointer"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">الجداول</span>
              </button>
              <button
                onClick={() => openInsertForm('packages')}
                title="إضافة سطر"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] text-[11px] font-tajawal transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">إضافة</span>
              </button>
              <button
                onClick={() => setFormulaModalOpen(true)}
                title="تدريب صيغة إجابة"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] text-[11px] font-tajawal transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تدريب</span>
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 font-tajawal text-[15px] leading-relaxed scrollbar-none" style={{ minHeight: 250 }}>

            {/* Welcome */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-8 px-2 space-y-5 my-auto">
                <div className="w-12 h-12 rounded-full sakhr-avatar-accent flex items-center justify-center">
                  <span className="text-[#c9a962] font-semibold text-xl font-cairo">ص</span>
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <h3 className="font-medium text-[17px] text-[#ececec] font-cairo">
                    كيف يمكنني مساعدتك؟
                  </h3>
                  <p className="text-[13px] text-neutral-500 leading-relaxed font-tajawal">
                    {isAdmin
                      ? 'استعلم عن البيانات، أدر الجداول، أو درّب صيغ الإجابات.'
                      : 'أستطيع الإجابة عن أي صفحة أو قسم في التطبيق وفتحه لك مباشرة.'}
                  </p>
                </div>

                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2 w-full max-w-md pt-1">
                  {[
                    { label: '🗺️ صفحات التطبيق', query: 'ما هي صفحات وأقسام التطبيق؟' },
                    { label: '👥 طاقم المرشدين', query: 'افتح قسم المرشدين وطاقم الوكالة' },
                    { label: '📦 باقات العمرة', query: 'عرض باقات وأسعار العمرة 2026' },
                    { label: '🏨 الفنادق', query: 'افتح صفحة الفنادق' },
                    { label: '💳 التقسيط', query: 'ما شروط التقسيط من 2 الى 10 أشهر؟' },
                    ...(isAdmin
                      ? [
                          { label: 'جدول الباقات', query: 'أظهر لي جدول الباقات' },
                          { label: 'إضافة بيانات', query: 'أريد إضافة بيانات إلى الجدول' },
                        ]
                      : []),
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(chip.query)}
                      className="sakhr-chip px-3.5 py-2 rounded-full text-[13px] text-neutral-300 hover:text-[#ececec] font-tajawal cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message history */}
            {messages.map((m, i) => {
              const resolvedSource = m.role === 'ai' ? resolveMessageSource(m) : null;
              const displayText =
                m.role === 'ai' && resolvedSource ? stripInlineSourceFooters(m.text) : m.text;

              return (
              <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                {m.role === 'ai' ? (
                  <div className="w-7 h-7 rounded-full sakhr-avatar-accent flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[#c9a962] font-semibold text-xs font-cairo leading-none">ص</span>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full sakhr-avatar flex items-center justify-center shrink-0 text-neutral-400 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex flex-col space-y-2 max-w-[88%] sm:max-w-[85%] min-w-0">
                  {/* Knowledge gap — prominent Sakhr icon */}
                  {m.role === 'ai' && m.noKnowledge && (
                    <div className="flex flex-col items-center text-center py-4 px-3 rounded-2xl bg-gradient-to-b from-amber-950/30 to-neutral-900/50 border border-amber-500/20 space-y-3">
                      <div className="w-16 h-16 rounded-full sakhr-avatar-accent flex items-center justify-center shadow-lg ring-2 ring-amber-500/30">
                        <span className="text-[#c9a962] font-black text-2xl font-cairo leading-none">ص</span>
                      </div>
                      <p className="text-xs font-bold text-amber-400/90 font-cairo">صخر — لا توجد معرفة بعد</p>
                    </div>
                  )}

                  {m.role === 'ai' && resolvedSource && (
                    <SourceAttributionBanner source={resolvedSource} />
                  )}

                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed font-tajawal ${
                      m.role === 'user' ? 'sakhr-msg-user text-[#ececec]' : 'sakhr-msg-ai text-neutral-200'
                    }`}
                    style={
                      m.role === 'user'
                        ? { borderRadius: '18px 18px 4px 18px' }
                        : { borderRadius: '18px 18px 18px 4px' }
                    }
                  >
                    {renderFormattedMessage(displayText)}
                  </div>

                  {m.escalated && (
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-[13px] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span>تم تحويل التذكرة لمستشار الوكالة</span>
                      </div>
                      <a
                        href="tel:+21321554433"
                        className="px-3 py-1.5 rounded-lg bg-white text-black font-medium text-xs hover:bg-neutral-200 transition-colors shrink-0"
                      >
                        اتصال
                      </a>
                    </div>
                  )}

                  {/* Admin correction */}
                  {isAdmin && m.role === 'ai' && (
                    <div className="flex justify-start">
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
                        className="px-2.5 py-1 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] text-[11px] font-tajawal flex items-center gap-1 transition-colors cursor-pointer"
                        title="تصحيح واعتماد الإجابة"
                      >
                        <FileText className="w-3 h-3" />
                        <span>تصحيح</span>
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
                            <div key={cIdx} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Table className="w-4 h-4 text-neutral-400" />
                                  <h4 className="font-medium text-sm font-cairo text-[#ececec]">{tableInfo.label}</h4>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-neutral-400 text-[11px]">
                                  {tableInfo.totalRows || tableInfo.rows?.length || 0} سطر
                                </span>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => setTableModalData(tableInfo)}
                                  className="flex-1 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  عرض البيانات
                                </button>
                                <button
                                  onClick={() => openInsertForm(tableInfo.tableName)}
                                  className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-medium text-xs flex items-center justify-center gap-1 cursor-pointer border border-white/[0.08] transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  إضافة
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // 2. Table Selector Prompt Card (When target table is ambiguous)
                        if (c.type === 'table_selector_prompt') {
                          const options = c.data?.options || [];
                          return (
                            <div key={cIdx} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-3">
                              <h4 className="font-medium text-xs font-cairo text-neutral-400 flex items-center gap-2">
                                <Database className="w-3.5 h-3.5" />
                                {c.data?.title || 'اختر الجدول:'}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt: any, oIdx: number) => (
                                  <button
                                    key={oIdx}
                                    onClick={() => openInsertForm(opt.name)}
                                    className="sakhr-chip px-3 py-1.5 rounded-lg text-xs text-neutral-300 hover:text-[#ececec] flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>{opt.label}</span>
                                    <Plus className="w-3 h-3 text-neutral-500" />
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
                              className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-3"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.06] text-neutral-400">
                                    {pkg.type}
                                  </span>
                                  <h4 className="font-medium text-sm font-cairo text-[#ececec] mt-1.5">{pkg.name}</h4>
                                </div>
                                <span className="text-[11px] text-neutral-400 bg-white/[0.04] px-2 py-0.5 rounded-md shrink-0">
                                  {pkg.available} مقعد
                                </span>
                              </div>

                              <p className="text-[13px] text-neutral-400 leading-relaxed">{pkg.description}</p>

                              <div className="grid grid-cols-2 gap-2 text-[12px] text-neutral-400 bg-white/[0.02] p-3 rounded-lg border border-white/[0.05]">
                                <div>فندق مكة: {pkg.makkah_hotel_name}</div>
                                <div>الطيران: {pkg.airline}</div>
                                <div>المدة: {pkg.duration_days} يوم</div>
                                <div className="text-[#c9a962] font-medium">{pkg.prices[0]?.amount.toLocaleString()} {pkg.prices[0]?.currency}</div>
                              </div>

                              <div className="flex gap-2 pt-0.5">
                                <button
                                  onClick={() => setBookingPackage(pkg)}
                                  className="flex-1 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> حجز
                                </button>
                                <button
                                  onClick={() => sendMessage(`قارنلي الباقة ${pkg.name}`)}
                                  className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-medium text-xs flex items-center justify-center gap-1 cursor-pointer border border-white/[0.08] transition-colors"
                                >
                                  <Layers className="w-3.5 h-3.5" /> مقارنة
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // 4. Hotel Cards
                        if (c.type === 'hotel') {
                          const htl: Hotel = c.data;
                          return (
                            <div key={cIdx} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium text-sm font-cairo text-[#ececec]">{htl.name}</h4>
                                <span className="text-[11px] text-neutral-400">{htl.category}</span>
                              </div>
                              <p className="text-[13px] text-neutral-400">{htl.distance_from_haram}</p>
                              <button
                                onClick={() => setSelectedMap({ title: htl.name, latitude: htl.latitude, longitude: htl.longitude })}
                                className="text-[12px] text-neutral-400 hover:text-neutral-200 font-medium flex items-center gap-1.5 cursor-pointer pt-0.5 transition-colors"
                              >
                                <MapPin className="w-3.5 h-3.5" /> عرض الموقع
                              </button>
                            </div>
                          );
                        }

                        // 5. Morshid / Guide Cards
                        if (c.type === 'morshid') {
                          const guide = c.data;
                          return (
                            <div key={cIdx} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-medium font-cairo text-sm text-neutral-300">
                                    {guide.avatar || 'أ'}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm font-cairo text-[#ececec]">{guide.name}</h4>
                                    <p className="text-[11px] text-neutral-500">{guide.roleName}</p>
                                  </div>
                                </div>
                                <span className="text-[11px] text-neutral-400 shrink-0">
                                  {guide.rating || '4.9'} · {guide.experience_years || 12} سنة
                                </span>
                              </div>

                              <p className="text-[13px] text-neutral-400 leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.05]">
                                {guide.specialization}
                              </p>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      window.location.href = '/portal?tab=chat';
                                    }
                                  }}
                                  className="flex-1 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  مراسلة
                                </button>
                                <a
                                  href={`tel:${guide.phone || '+213550123456'}`}
                                  className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-medium text-xs flex items-center justify-center gap-1 cursor-pointer border border-white/[0.08] transition-colors"
                                >
                                  اتصال
                                </a>
                              </div>
                            </div>
                          );
                        }

                        // 6. Action Navigation Cards
                        if (c.type === 'action') {
                          const act = c.data;
                          return (
                            <div key={cIdx} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 space-y-2.5">
                              <h4 className="font-medium text-sm text-[#ececec] font-cairo">{act.title}</h4>
                              {act.description && <p className="text-[13px] text-neutral-400 leading-relaxed">{act.description}</p>}
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
                                className="w-full py-2 rounded-lg bg-white text-black hover:bg-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                {act.buttonText || 'متابعة'}
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
              );
            })}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex items-start gap-3 animate-fade-in">
                <div className="w-7 h-7 rounded-full sakhr-avatar-accent flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#c9a962] font-semibold text-xs font-cairo leading-none">ص</span>
                </div>
                <div className="flex items-center gap-1 pt-3">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-neutral-500 sakhr-dot"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/[0.06]">
            <div className="sakhr-input-wrap flex items-end gap-2 rounded-2xl px-3 py-2.5">
              <input
                ref={inputRef}
                type="text"
                value={query}
                dir="rtl"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isAdmin ? 'اسأل أو أدر البيانات...' : 'اكتب رسالتك...'}
                className="flex-1 bg-transparent text-[15px] text-[#ececec] placeholder:text-neutral-500 focus:outline-none font-tajawal text-right leading-relaxed py-1"
              />
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || !query.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500"
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 text-center pt-2 font-tajawal">
              صخر قد يرتكب أخطاء. تحقق من المعلومات المهمة.
            </p>
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
