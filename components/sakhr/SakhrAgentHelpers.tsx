'use client';

import React from 'react';
import {
  MapPin, CheckCircle, Eye, Layers,
  PhoneCall, Play,
  Table, Database, Plus, Search, FileText,
  Sparkles, BookOpen, ShieldCheck, Brain
} from 'lucide-react';
import { AiAction, AiCard, MediaAsset, Package, Hotel } from '@/types';
import { type TableRef } from '@/lib/admin-table-intent';
import { ADMIN_TABLES, REDIRECT_TABLES } from '@/lib/admin-tables';

export interface SakhrMessage {
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

export interface SakhrAgentProps {
  onSearchFilter?: (keyword: string) => void;
  theme?: 'light' | 'dark';
}

/**
 * Labels for every source name the chat can mention. The editable tables come
 * from the shared registry; the redirect tables are kept only so old source
 * names still get a readable label (they are NOT shown in the tables menu).
 */
export const TABLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ADMIN_TABLES).map(([name, t]) => [name, `${t.icon} ${t.label}`])
  ),
  ...Object.fromEntries(
    Object.entries(REDIRECT_TABLES).map(([name, t]) => [name, t.label])
  ),
};

export function tableLabelPlain(key: string): string {
  return (TABLE_LABELS[key] || key).replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** Strip legacy inline source footers — UI banner handles attribution */
export function scrubSecretsFromReply(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b(GEMINI_API_KEY|SAKHR_GEMINI_KEY|XAI_API_KEY|GROK_API_KEY|POLLINATIONS_API_KEY)\b/gi, '[محجوب]')
    .replace(/\b(JWT_SECRET|DB_ENCRYPTION_SECRET|DB_LOOKUP_SECRET|SERVER_ENCRYPTION_KEY)\b/gi, '[محجوب]')
    .replace(/\b(SOUTHSTREET-KEY-[A-Za-z0-9\-]+)\b/gi, '[محجوب]')
    .replace(/southstreet_admin\.key/gi, '[ملف مفتاح محمي]')
    .replace(/\.env\b/gi, '[محجوب]');
}

/** Strip legacy inline source footers — UI banner handles attribution */
export function stripInlineSourceFooters(text: string): string {
  return scrubSecretsFromReply(
    text
      .replace(/\n\n---\n🤖 \*\*مصدر الإجابة:\*\*[\s\S]*$/u, '')
      .replace(/\n\n---\n📘 \*\*مصدر الإجابة:\*\*[\s\S]*$/u, '')
      .replace(/\n\n✅ \*مصدر موثوق:[\s\S]*$/u, '')
      .trim()
  );
}

export type ResolvedSource =
  | { kind: 'agency_db'; label: string; table?: string }
  | { kind: 'external_ai'; label: string; model?: string }
  | { kind: 'local_guidance'; label: string }
  | null;

export function resolveMessageSource(m: SakhrMessage): ResolvedSource {
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

export function SourceAttributionBanner({ source }: { source: ResolvedSource }) {
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


