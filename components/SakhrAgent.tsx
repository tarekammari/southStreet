'use client';

import dynamic from 'next/dynamic';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send, X, User as UserIcon, RefreshCw,
  MapPin, CheckCircle, Eye, Layers,
  PhoneCall, Play,
  Table, Database, Plus, Search, FileText,
  Sparkles, BookOpen, ShieldCheck
} from 'lucide-react';
import { Package, Hotel, MediaAsset, AiAction, AiCard } from '@/types';
import { RecordCardModel, buildRecordCard, emptyRecordCard } from '@/lib/record-card';
import { detectAdminTableIntent, describeIntent, AdminTableIntent, TableRef } from '@/lib/admin-table-intent';
import {
  AdminSession,
  ParsedCommand,
  parseAdminCommand,
  resolveMutation,
  createInsertSession,
  createMutateSession,
  matchRows,
  matchField,
  selectRow,
  setEditField,
  nextStep,
  applyAnswer,
  acceptOptional,
  promptFor,
  openingLine,
  buildPayload,
  rowTitle,
  isYes,
  isNo,
  isCancel,
} from '@/lib/admin-chat-agent';

const RecordCardGrid = dynamic(() => import('@/components/RecordCardGrid').then((m) => m.RecordCardGrid), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-sm text-slate-400">جاري تحضير البطاقات…</div>,
});

const RecordBigCard = dynamic(() => import('@/components/RecordCardGrid').then((m) => m.RecordBigCard), {
  ssr: false,
});

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
  adminIntent?: { action: 'insert' | 'edit' | 'view'; alternatives: TableRef[] };
}

interface SakhrAgentProps {
  onSearchFilter?: (keyword: string) => void;
  theme?: 'light' | 'dark';
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

function tableLabelPlain(key: string): string {
  return (TABLE_LABELS[key] || key).replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

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

export default function SakhrAgent({ onSearchFilter, theme = 'dark' }: SakhrAgentProps) {
  const isLight = theme === 'light';
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
  const [deferredTableSearch, setDeferredTableSearch] = useState('');
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [bigCard, setBigCard] = useState<RecordCardModel | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);

  useEffect(() => {
    if (!tableMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTableMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tableMenuOpen]);

  // Reopening a table renders from cache first, then refreshes in the background
  const tableCacheRef = useRef<Map<string, { tableName: string; label: string; columns: any[]; rows: any[] }>>(new Map());

  // Debounce so typing never blocks on filtering large tables
  useEffect(() => {
    const t = setTimeout(() => setDeferredTableSearch(tableSearchQuery), 160);
    return () => clearTimeout(t);
  }, [tableSearchQuery]);

  const handleCardSelect = useCallback((card: RecordCardModel) => {
    setCreatingNew(false);
    setBigCard(card);
    setSelectedRowKey(card.key);
  }, []);

  // Formula Training Modal State
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [formulaQuestion, setFormulaQuestion] = useState('');
  const [formulaPattern, setFormulaPattern] = useState('');
  const [formulaSaving, setFormulaSaving] = useState(false);
  const [formulaSuccessMsg, setFormulaSuccessMsg] = useState('');

  // Conversational admin CRUD session (add/edit/delete by chat)
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);

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

  const runAdminTableIntent = (intent: AdminTableIntent) => {
    if (intent.action === 'insert') {
      openInsertForm(intent.table);
    } else {
      fetchTableData(intent.table);
    }
  };

  const pushAi = (text: string, extra?: Partial<SakhrMessage>) => {
    setMessages((prev) => [
      ...prev,
      { role: 'ai', text, sourceType: 'agency_db', trusted: true, ...extra },
    ]);
  };

  /** Shows the session's next question (optionally preceded by a status line). */
  const askNext = (session: AdminSession, prefix?: string) => {
    setAdminSession(session);
    const prompt = promptFor(session);
    pushAi(prefix ? `${prefix}\n\n${prompt}` : prompt, {
      source: session.table,
      sourceLabel: session.label,
    });
  };

  /** Retries once: a cold route can 500 on the request that triggers its compile. */
  const loadTableMeta = async (table: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/admin/db-tables?table=${table}`);
        if (res.ok) return await res.json();
      } catch {
        // fall through to the retry
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return null;
  };

  const commitAdminSession = async (session: AdminSession) => {
    setIsThinking(true);
    try {
      const body: Record<string, unknown> = { tableName: session.table };

      if (session.op === 'insert') {
        body.action = 'insert_data';
        body.rowData = buildPayload(session);
      } else if (session.op === 'update') {
        body.action = 'update_data';
        body.rowData = buildPayload(session);
        body.keyColumn = session.keyColumn;
        body.keyValue = session.keyValue;
      } else {
        body.action = 'delete_data';
        body.keyColumn = session.keyColumn;
        body.keyValue = session.keyValue;
      }

      const res = await fetch('/api/admin/db-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      setIsThinking(false);
      setAdminSession(null);

      if (!res.ok || !data.success) {
        pushAi(`⚠️ ${data.error || 'تعذر تنفيذ العملية على قاعدة البيانات.'}`);
        return;
      }

      tableCacheRef.current.delete(session.table);
      if (tableModalData?.tableName === session.table) {
        fetchTableData(session.table);
      }

      const done =
        session.op === 'insert' ? 'تمت الإضافة' : session.op === 'update' ? 'تم التعديل' : 'تم الحذف';
      pushAi(`✅ ${done} في جدول **${session.label}** وحُفظ في قاعدة البيانات.`, {
        source: session.table,
        sourceLabel: session.label,
      });
    } catch {
      setIsThinking(false);
      setAdminSession(null);
      pushAi('⚠️ حدث خطأ أثناء الحفظ في قاعدة البيانات.');
    }
  };

  const beginAdminCommand = async (cmd: ParsedCommand) => {
    setIsThinking(true);
    const meta = await loadTableMeta(cmd.table);
    setIsThinking(false);

    if (!meta?.columns) {
      pushAi(`⚠️ تعذر قراءة بنية جدول **${cmd.label}**.`);
      return;
    }

    if (cmd.op === 'insert') {
      const session = nextStep(createInsertSession(cmd, meta.label, meta.columns));
      askNext(session, openingLine(session));
      return;
    }

    const { field, rowQuery } = resolveMutation(cmd, meta.columns);
    const rows: Record<string, unknown>[] = meta.rows || [];
    let session = createMutateSession({ ...cmd, field, rowQuery }, meta.label, meta.columns, rows);

    const matches = matchRows(rows, rowQuery, meta.columns);
    let notice = openingLine(session);

    if (matches.length === 1) {
      session = selectRow(session, matches[0]);
    } else if (matches.length > 1) {
      session = { ...session, stage: 'pick_row', candidates: matches };
    } else {
      // Offer a shortlist instead of a dead end when the name wasn't recognised
      session = { ...session, stage: 'pick_row', candidates: rows.slice(0, 8) };
      notice = `${notice}\n\nلم أتعرف على السجل من كلامك.`;
    }

    askNext(session, notice);
  };

  const handleAdminSessionReply = async (session: AdminSession, text: string) => {
    if (isCancel(text)) {
      setAdminSession(null);
      pushAi('تم إلغاء العملية. لم يُحفظ أي شيء في قاعدة البيانات.');
      return;
    }

    if (session.stage === 'pick_row') {
      const index = parseInt(text.replace(/[^\d]/g, ''), 10);
      let picked: Record<string, unknown> | null = null;

      if (Number.isFinite(index) && index >= 1 && index <= session.candidates.length) {
        picked = session.candidates[index - 1];
      } else {
        const found = matchRows(session.allRows, text, session.columns);
        if (found.length === 1) picked = found[0];
        else if (found.length > 1) {
          askNext({ ...session, candidates: found }, 'أكثر من سجل يطابق ما كتبت.');
          return;
        } else {
          askNext(
            { ...session, candidates: session.allRows.slice(0, 8) },
            'لم أجد هذا الاسم في الجدول.'
          );
          return;
        }
      }

      askNext(selectRow(session, picked), `اخترت: **${rowTitle(picked, session.columns)}**`);
      return;
    }

    if (session.stage === 'pick_field') {
      const field = matchField(text, session.columns);
      if (!field) {
        askNext(session, 'لم أتعرف على الحقل المطلوب.');
        return;
      }
      askNext(setEditField(session, field));
      return;
    }

    if (session.stage === 'offer_optional') {
      if (isNo(text)) {
        askNext(acceptOptional(session, false));
        return;
      }
      if (isYes(text)) {
        askNext(acceptOptional(session, true));
        return;
      }
      askNext(session, 'أجب بـ **نعم** أو **لا**.');
      return;
    }

    if (session.stage === 'confirm') {
      if (isNo(text)) {
        setAdminSession(null);
        pushAi('تم الإلغاء. لم يُحفظ أي شيء في قاعدة البيانات.');
        return;
      }
      if (isYes(text)) {
        await commitAdminSession(session);
        return;
      }
      askNext(session, 'أجب بـ **نعم** للحفظ أو **لا** للإلغاء.');
      return;
    }

    askNext(applyAnswer(session, text));
  };

  const sendMessage = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery('');

    const userMsg: SakhrMessage = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);

    // A running add/edit/delete conversation owns every reply until it ends
    if (isAdmin && adminModeEnabled && adminSession) {
      await handleAdminSessionReply(adminSession, q);
      return;
    }

    // Admins can ask in plain Arabic: "أضف مرشد جديد" / "افتح جدول الفنادق"
    if (isAdmin && adminModeEnabled) {
      const command = parseAdminCommand(q);
      if (command) {
        await beginAdminCommand(command);
        return;
      }

      const intent = detectAdminTableIntent(q);
      if (intent) {
        runAdminTableIntent(intent);
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: describeIntent(intent),
            sourceType: 'agency_db',
            trusted: true,
            source: intent.table,
            sourceLabel: intent.label,
            adminIntent: { action: intent.action, alternatives: intent.alternatives },
          },
        ]);
        return;
      }
    }

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

  const fetchTableData = async (tableName: string, opts?: { keepCard?: boolean }) => {
    const cached = tableCacheRef.current.get(tableName);
    if (cached) {
      setTableModalData(cached);
      if (!opts?.keepCard) {
        setSelectedRowKey(null);
        setBigCard(null);
      }
    }

    const data = await loadTableMeta(tableName);
    if (!data) {
      if (!cached) {
        pushAi('⚠️ تعذر تحميل بيانات الجدول. أعد المحاولة من فضلك.');
      }
      return;
    }

    const next = {
      tableName: data.tableName,
      label: data.label,
      columns: data.columns,
      rows: data.rows,
    };
    tableCacheRef.current.set(tableName, next);
    setTableModalData(next);
    if (opts?.keepCard) {
      setBigCard((current) => {
        if (!current) return current;
        const rows = next.rows || [];
        const cols = next.columns || [];
        const match = current.keyColumn
          ? rows.find((row: Record<string, unknown>) => row[current.keyColumn as string] === current.keyValue)
          : undefined;
        const index = match ? rows.indexOf(match) : rows.findIndex((row: Record<string, unknown>, i: number) => buildRecordCard(row, cols, i).key === current.key);
        if (index < 0) return current;
        return buildRecordCard(rows[index], cols, index);
      });
    } else if (!cached) {
      setSelectedRowKey(null);
      setBigCard(null);
    }
  };

  const openInsertForm = async (tableName: string) => {
    await fetchTableData(tableName, { keepCard: true });
    const cached = tableCacheRef.current.get(tableName);
    const columns = cached?.columns || tableModalData?.columns;
    if (!columns?.length) {
      pushAi('⚠️ تعذر تجهيز نافذة الإضافة. أعد المحاولة من فضلك.');
      return;
    }
    setCreatingNew(true);
    setSelectedRowKey(null);
    setBigCard(emptyRecordCard(columns, tableName));
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
    setAdminSession(null);
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

  const anyModalOpen = Boolean(tableModalData || bigCard || formulaModalOpen);

  // A fullscreen admin modal replaces everything behind it: lock scrolling and
  // let CSS drop the page + chat panel out of the paint path.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('modal-open', anyModalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [anyModalOpen]);

  return (
    <>
      {/* Floating trigger */}
      <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 select-none">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="مساعد صخر الذكي"
          className={`relative w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full focus:outline-none group cursor-pointer flex items-center justify-center ${isLight ? 'sakhr-fab-light' : 'sakhr-fab'}`}
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
        <div className={`sakhr-panel-shell fixed top-[72px] sm:top-[80px] bottom-4 sm:bottom-6 right-2 sm:right-8 z-[250] w-[calc(100vw-16px)] sm:w-[420px] md:w-[480px] lg:w-[520px] max-w-[96vw] flex flex-col rounded-2xl overflow-hidden animate-fade-in ${isLight ? 'sakhr-chat-panel-light sakhr-theme-light' : 'sakhr-chat-panel'}`}>

          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 shrink-0 border-b sakhr-panel-border ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'bg-emerald-soft border border-emerald-main/20' : 'sakhr-avatar-accent'}`}>
                <span className={`font-semibold text-sm font-cairo leading-none ${isLight ? 'text-emerald-main' : 'text-[#c9a962]'}`}>ص</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`sakhr-header-title font-medium text-sm font-cairo truncate ${isLight ? 'text-slate-900' : 'text-[#ececec]'}`}>صخر</span>
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
                title="إضافة جديد"
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
                  <h3 className={`font-medium text-[17px] font-cairo ${isLight ? 'text-slate-900' : 'text-[#ececec]'}`}>
                    كيف يمكنني مساعدتك؟
                  </h3>
                  <p className={`text-[13px] leading-relaxed font-tajawal ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
                    {isAdmin
                      ? 'أدر كل الجداول بالمحادثة: "أضف مرشد اسمه محمد الأمين"، "عدّل هاتف فندق دار التوحيد"، "احذف الباقة كذا" — وسأسألك عن باقي البيانات حقلاً بعد حقل.'
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
                          { label: '➕ إضافة مرشد', query: 'أضف مرشد جديد' },
                          { label: '➕ إضافة فندق', query: 'أضف فندق جديد' },
                          { label: '➕ إضافة باقة', query: 'أضف باقة جديدة' },
                          { label: '✏️ تعديل مرشد', query: 'عدّل بيانات مرشد' },
                          { label: '🏨 جدول الفنادق', query: 'افتح جدول الفنادق' },
                          { label: '👤 المستخدمين', query: 'أظهر جدول المستخدمين والحسابات' },
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

                  {m.role === 'ai' && m.adminIntent && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          m.adminIntent!.action === 'insert'
                            ? openInsertForm(m.source!)
                            : fetchTableData(m.source!)
                        }
                        className="sakhr-chip px-3 py-1.5 rounded-full text-[12px] text-neutral-300 hover:text-[#ececec] font-tajawal cursor-pointer flex items-center gap-1.5"
                      >
                        {m.adminIntent!.action === 'insert' ? <Plus className="w-3.5 h-3.5" /> : <Table className="w-3.5 h-3.5" />}
                        إعادة فتح {m.sourceLabel}
                      </button>

                      {m.adminIntent!.alternatives.map((alt) => (
                        <button
                          key={alt.table}
                          onClick={() =>
                            m.adminIntent!.action === 'insert'
                              ? openInsertForm(alt.table)
                              : fetchTableData(alt.table)
                          }
                          className="sakhr-chip px-3 py-1.5 rounded-full text-[12px] text-neutral-400 hover:text-[#ececec] font-tajawal cursor-pointer"
                        >
                          بدلاً منه: {alt.label}
                        </button>
                      ))}
                    </div>
                  )}

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
          <div className={`px-4 pb-4 pt-2 shrink-0 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
            {adminSession && (
              <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-[11px] font-tajawal ${isLight ? 'bg-emerald-soft border border-emerald-main/25 text-emerald-main' : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">
                  {adminSession.op === 'insert' ? 'إضافة إلى' : adminSession.op === 'update' ? 'تعديل في' : 'حذف من'}{' '}
                  {adminSession.label}
                </span>
                <button
                  onClick={() => {
                    setAdminSession(null);
                    pushAi('تم إلغاء العملية. لم يُحفظ أي شيء في قاعدة البيانات.');
                  }}
                  className="mr-auto shrink-0 px-2 py-0.5 rounded-md hover:bg-white/10 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}
            <div className={`flex items-end gap-2 rounded-2xl px-3 py-2.5 ${isLight ? 'bg-slate-50 border border-slate-200' : 'sakhr-input-wrap'}`}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                dir="rtl"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={
                  adminSession
                    ? 'اكتب الجواب... ("تخطي" أو "إلغاء")'
                    : isAdmin
                    ? 'اسأل أو أدر البيانات...'
                    : 'اكتب رسالتك...'
                }
                className={`flex-1 bg-transparent text-[15px] focus:outline-none font-tajawal text-right leading-relaxed py-1 ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-[#ececec] placeholder:text-neutral-500'}`}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || !query.trim()}
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${
                  isLight
                    ? 'bg-emerald-main text-white hover:bg-emerald-light disabled:bg-slate-200 disabled:text-slate-400'
                    : 'bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500'
                }`}
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-[10px] text-center pt-2 font-tajawal ${isLight ? 'text-slate-400' : 'text-neutral-600'}`}>
              صخر قد يرتكب أخطاء. تحقق من المعلومات المهمة.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           DATABASE RECORDS AS CARDS — hidden (not unmounted) while a
           detail card is open, so only one window ever paints
      ══════════════════════════════════════════════════════════ */}
      {tableModalData && (
        <div className={`fixed inset-0 z-[320] luxury-modal-overlay flex items-center justify-center p-3 sm:p-6 font-tajawal ${bigCard ? 'modal-layer-hidden' : ''}`}>
          <div className="luxury-table-shell relative w-full max-w-[92rem] h-[88vh] flex flex-col text-slate-900">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
              <h3 className="font-bold text-base sm:text-lg font-cairo text-slate-900 truncate">
                {tableModalData.label}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openInsertForm(tableModalData.tableName)}
                  className="btn-pro-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">إضافة جديد</span>
                </button>
                <button
                  onClick={() => {
                    setTableModalData(null);
                    setTableSearchQuery('');
                    setSelectedRowKey(null);
                    setBigCard(null);
                    setTableMenuOpen(false);
                    setCreatingNew(false);
                  }}
                  className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="luxury-table-toolbar px-5 sm:px-6 py-3 flex items-center gap-3 shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="بحث..."
                  className="luxury-table-search w-full pr-9 pl-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setTableMenuOpen((open) => !open)}
                className="luxury-table-select px-3.5 py-2.5 text-sm shrink-0 cursor-pointer"
              >
                الجداول
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto luxury-table-scroll">
              <RecordCardGrid
                rows={tableModalData.rows || []}
                columns={tableModalData.columns}
                search={deferredTableSearch}
                selectedKey={selectedRowKey}
                onSelect={handleCardSelect}
                tableName={tableModalData.tableName}
              />
            </div>

            <div
              className={`table-side-menu-scrim ${tableMenuOpen ? 'is-open' : ''}`}
              onClick={() => setTableMenuOpen(false)}
            />
            <aside className={`table-side-menu ${tableMenuOpen ? 'is-open' : ''}`} aria-hidden={!tableMenuOpen}>
              <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-200">
                <h4 className="font-cairo font-bold text-base text-slate-900">الجداول</h4>
                <button
                  type="button"
                  onClick={() => setTableMenuOpen(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                  aria-label="إغلاق القائمة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1 luxury-table-scroll">
                {Object.keys(TABLE_LABELS).map((tblKey) => (
                  <button
                    key={tblKey}
                    type="button"
                    onClick={() => {
                      fetchTableData(tblKey);
                      setTableSearchQuery('');
                      setSelectedRowKey(null);
                      setBigCard(null);
                      setCreatingNew(false);
                      setTableMenuOpen(false);
                    }}
                    className={`table-side-menu-item ${tableModalData.tableName === tblKey ? 'is-active' : ''}`}
                  >
                    {tableLabelPlain(tblKey)}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        </div>
      )}

      {/* Expanded, editable record card */}
      {bigCard && tableModalData && (
        <RecordBigCard
          card={bigCard}
          columns={tableModalData.columns}
          tableName={tableModalData.tableName}
          tableLabel={creatingNew ? 'إضافة جديد' : tableModalData.label}
          isNew={creatingNew}
          onClose={() => {
            setCreatingNew(false);
            setBigCard(null);
          }}
          onSaved={(closeCard = true) => {
            setCreatingNew(false);
            tableCacheRef.current.delete(tableModalData.tableName);
            fetchTableData(tableModalData.tableName, { keepCard: !closeCard });
            if (closeCard) setBigCard(null);
          }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════
           FORMULA TRAINING MODAL (FOR ADMIN RESPONSE TEMPLATES)
      ══════════════════════════════════════════════════════════ */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-[330] luxury-modal-overlay flex items-center justify-center p-3 sm:p-6 font-tajawal animate-fade-in">
          <div className="luxury-table-shell w-full max-w-[92rem] h-[88vh] flex flex-col text-slate-900">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
              <h3 className="font-bold text-base sm:text-lg font-cairo text-slate-900">
                تدريب صيغة إجابة
              </h3>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors border border-slate-200 shrink-0"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formulaSuccessMsg && (
              <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-soft border border-emerald-main/25 text-emerald-main text-xs font-semibold text-center">
                {formulaSuccessMsg}
              </div>
            )}

            <form onSubmit={handleTrainFormulaSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="luxury-form-scroll luxury-table-scroll flex-1 space-y-5">
                <div className="max-w-3xl mx-auto w-full">
                  <label className="luxury-form-label" htmlFor="formula-question">
                    السؤال
                  </label>
                  <input
                    id="formula-question"
                    type="text"
                    required
                    value={formulaQuestion}
                    onChange={(e) => setFormulaQuestion(e.target.value)}
                    className="luxury-form-input"
                  />
                </div>

                <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                  <label className="luxury-form-label" htmlFor="formula-pattern">
                    صيغة الإجابة
                  </label>
                  <textarea
                    id="formula-pattern"
                    required
                    value={formulaPattern}
                    onChange={(e) => setFormulaPattern(e.target.value)}
                    className="luxury-form-input resize-none leading-relaxed min-h-[280px] flex-1"
                  />
                </div>
              </div>

              <div className="luxury-form-footer">
                <div className="flex gap-2.5 w-full sm:w-auto sm:mr-auto">
                  <button
                    type="button"
                    onClick={() => setFormulaModalOpen(false)}
                    className="btn-pro-outline text-xs py-2.5 px-5 flex-1 sm:flex-none"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={formulaSaving}
                    className="btn-pro-primary text-xs py-2.5 px-5 flex-1 sm:flex-none disabled:opacity-50"
                  >
                    {formulaSaving ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                </div>
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
