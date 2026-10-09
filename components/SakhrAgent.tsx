'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Brain, Check, Copy, Loader2, Mic, RefreshCw, Table, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { LOGIN_ROLE_LABELS, normalizeLoginRole } from '@/lib/roles';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import type { SakhrAgentProps } from '@/components/sakhr/SakhrAgentHelpers';
import type { VisualSpec } from '@/lib/sakhr/visual';
import { speak, stopSpeaking, unlockAudio, useArabicVoice, useVoiceRecorder, voiceInputSupported } from '@/components/sakhr/voice';

const TableBrowser = dynamic(() => import('@/components/sakhr/TableBrowser'), { ssr: false });
const SakhrVisual = dynamic(() => import('@/components/sakhr/SakhrVisual'), { ssr: false });

/**
 * Sakhr — the agency's AI assistant (Gemini, server side: /api/ai/sakhr).
 * A plain conversation: the server decides which tools the user's role may
 * use; changes come back as confirmation cards the user approves here.
 */

type ActionState = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

type ActionCard = {
  token: string;
  tool: string;
  summary: string;
  state: ActionState;
  result?: string;
  secret?: { label: string; value: string };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: ActionCard[];
  visuals?: VisualSpec[];
  error?: boolean;
};

const STORE_KEY = 'ss_sakhr_chat';
const OPEN_KEY = 'ss_sakhr_open';

// Hands-free mode outlives a page change: the reply that opened a page is still
// being spoken when the next page's Sakhr mounts, and that one listens next.
let handsFreeOn = false;
let resumeListening: (() => void) | null = null;
const MAX_STORED = 40;

function bearer(): Record<string, string> {
  try {
    const token = localStorage.getItem('south_street_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Minimal, safe formatting: paragraphs, bullet / numbered lists, **bold**, links. No HTML is injected. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>);
    else {
      const external = m[3].startsWith('http');
      out.push(
        <a key={`${keyBase}-a${i}`} href={m[3]} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {m[2]}
        </a>
      );
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function FormattedText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[] | null = null;
  const flushTable = (k: number) => {
    if (!table) return;
    const rows = table.filter((l) => !TABLE_RULE.test(l)).map(cells);
    const [head, ...body] = rows;
    if (head) {
      blocks.push(
        <div key={`t${k}`} className="skr-mdtable-wrap">
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{renderInline(c, `th${k}-${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, i) => (
                <tr key={i}>{head.map((_, j) => <td key={j}>{renderInline(row[j] || '', `td${k}-${i}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    table = null;
  };
  const flush = (k: number) => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${k}`}>
        {list.items.map((item, j) => (
          <li key={j}>{renderInline(item, `l${k}-${j}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };
  text.split('\n').forEach((raw, k) => {
    const line = raw.trimEnd();
    if (TABLE_ROW.test(line) || (table && TABLE_RULE.test(line))) {
      flush(k);
      (table ||= []).push(line);
      return;
    }
    flushTable(k);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush(k);
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
      return;
    }
    flush(k);
    if (line.trim()) blocks.push(<p key={`p${k}`}>{renderInline(line.replace(/^#+\s*/, ''), `p${k}`)}</p>);
  });
  flush(-1);
  flushTable(-2);
  return <>{blocks}</>;
}

function SecretBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="skr-secret">
      <span>{label}</span>
      <code dir="ltr">{value}</code>
      <button
        type="button"
        aria-label={`نسخ ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function SakhrAgent(_props: SakhrAgentProps) {
  const router = useRouter();
  // Stays open across pages (each page mounts its own Sakhr) until the user closes it.
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setOpenState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        sessionStorage.setItem(OPEN_KEY, value ? '1' : '0');
      } catch {
        /* ignore */
      }
      return value;
    });
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  // Voice: replies are read aloud after a voice question (unless muted), and on demand.
  const canSpeak = useArabicVoice();
  const [micReady, setMicReady] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState('');
  const sendRef = useRef<(text?: string, viaVoice?: boolean) => void>(() => undefined);
  // Hands-free conversation: speak → Sakhr answers aloud → listens again, no buttons.
  const [handsFree, setHandsFreeState] = useState(false);
  const setHandsFree = useCallback((on: boolean) => {
    handsFreeOn = on;
    setHandsFreeState(on);
  }, []);
  const voice = useVoiceRecorder({
    onText: (text) => {
      setVoiceNotice('');
      setDraft('');
      sendRef.current(text, true);
    },
    onError: (message) => {
      setHandsFree(false);
      setVoiceNotice(message);
    },
    onInterim: (text) => setDraft(text),
    onNoSpeech: () => setHandsFree(false),
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  useEffect(() => {
    const resume = () => {
      if (handsFreeOn && voiceRef.current.state === 'idle') void voiceRef.current.start({ auto: true });
    };
    resumeListening = resume;
    setHandsFreeState(handsFreeOn);
    return () => {
      if (resumeListening === resume) resumeListening = null;
    };
  }, []);
  const listenAgain = useCallback(() => {
    if (!handsFreeOn) return;
    // A short pause so the end of Sakhr's own voice is not recorded.
    window.setTimeout(() => resumeListening?.(), 250);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_KEY) === '1') setOpenState(true);
    } catch {
      /* closed by default */
    }
    setMicReady(voiceInputSupported());
    try {
      setSpeakReplies(localStorage.getItem('ss_sakhr_speak') !== '0');
    } catch {
      /* default on */
    }
  }, []);

  const readAloud = (id: string, text: string) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    unlockAudio();
    if (speak(text, () => setSpeakingId((cur) => (cur === id ? null : cur)))) setSpeakingId(id);
  };
  const [role, setRole] = useState<string>('ANON');
  const [table, setTable] = useState<string | null>(null);
  const closeTable = useCallback(() => setTable(null), []);
  const tableNotice = useCallback((text: string) => {
    // Never stack the same notice twice in a row.
    setMessages((prev) => (prev[prev.length - 1]?.text === text ? prev : [...prev, { id: newId(), role: 'model', text, error: true }]));
  }, []);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore this tab's conversation and the signed-in role.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) setMessages(JSON.parse(saved));
      const user = localStorage.getItem('south_street_user');
      if (user) setRole(normalizeLoginRole(JSON.parse(user).role));
    } catch {
      /* start fresh */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      /* storage full or blocked */
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // A table opened by Sakhr sits beside the chat (below it on phones), never over it.
  const docked = open && !!table;
  useEffect(() => {
    document.documentElement.classList.toggle('skr-side', docked);
    return () => document.documentElement.classList.remove('skr-side');
  }, [docked]);

  const send = useCallback(async (override?: string, viaVoice = false) => {
    const text = (override ?? draft).trim();
    if (!text || thinking) return;
    stopSpeaking();
    setSpeakingId(null);
    const userMsg: ChatMessage = { id: newId(), role: 'user', text };
    const history = messages
      .filter((m) => !m.error && m.text)
      .slice(-16)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setThinking(true);
    try {
      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...bearer() },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر على صخر الرد الآن.');
      if (data.role) setRole(data.role);
      const replyId = newId();
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          role: 'model',
          text: data.reply || '',
          actions: (data.actions || []).map((a: any) => ({ token: a.token, tool: a.tool, summary: a.summary, state: 'pending' as const })),
          visuals: (data.clientActions || []).filter((a: any) => a.type === 'visual' && a.visual).map((a: any) => a.visual as VisualSpec),
        },
      ]);
      const spoken =
        speakReplies &&
        !!data.reply &&
        speak(data.reply, () => {
          setSpeakingId((cur) => (cur === replyId ? null : cur));
          if (viaVoice) listenAgain();
        });
      if (spoken) setSpeakingId(replyId);
      else if (viaVoice) listenAgain();
      for (const action of data.clientActions || []) {
        if (action.type === 'open_table') setTable(action.table);
        if (action.type === 'navigate' && typeof action.href === 'string' && action.href.startsWith('/')) {
          window.setTimeout(() => router.push(action.href), 600);
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: newId(), role: 'model', text: (err as Error).message, error: true }]);
      setHandsFree(false);
    } finally {
      setThinking(false);
    }
  }, [draft, messages, router, thinking, speakReplies, listenAgain, setHandsFree]);

  const closeChat = () => {
    setHandsFree(false);
    stopSpeaking();
    setSpeakingId(null);
    if (voice.state === 'recording') voice.stop(false);
    setOpen(false);
  };
  sendRef.current = (text, viaVoice) => void send(text, viaVoice);

  const updateAction = (msgId: string, token: string, patch: Partial<ActionCard>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, actions: m.actions?.map((a) => (a.token === token ? { ...a, ...patch } : a)) } : m
      )
    );
  };

  const confirmAction = async (msgId: string, card: ActionCard) => {
    updateAction(msgId, card.token, { state: 'running' });
    try {
      // adminFetch adds the session and, when the server asks (428), a security-key tap.
      const res = await adminFetch('/api/ai/sakhr/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: card.token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر التنفيذ');
      const d = data.data || {};
      const secret = d.password_shown_once
        ? { label: `كلمة مرور ${d.username || ''}`.trim(), value: String(d.password_shown_once) }
        : d.activation_link
          ? { label: 'رابط التفعيل', value: String(d.activation_link) }
          : undefined;
      updateAction(msgId, card.token, { state: 'done', result: String(d.message || 'تم التنفيذ'), secret });
    } catch (err) {
      updateAction(msgId, card.token, { state: 'failed', result: keyErrorMessage(err) });
    }
  };

  const clearChat = () => {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  };

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const roleLabel = role !== 'ANON' && role in LOGIN_ROLE_LABELS ? LOGIN_ROLE_LABELS[role as keyof typeof LOGIN_ROLE_LABELS] : '';

  return (
    <>
      <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 select-none sakhr-fab-shell">
        <button
          onClick={() => (open ? closeChat() : setOpen(true))}
          aria-label={open ? 'إغلاق صخر' : 'فتح صخر، المساعد الذكي'}
          aria-expanded={open}
          className={`sakhr-fab-future relative w-14 h-14 sm:w-[64px] sm:h-[64px] rounded-full focus:outline-none group cursor-pointer flex items-center justify-center ${open ? 'is-open' : ''}`}
        >
          <span className="sakhr-fab-attention" aria-hidden="true" />
          <span className="sakhr-fab-aura" aria-hidden="true" />
          <span className="sakhr-fab-ring" aria-hidden="true" />
          <span className="sakhr-fab-ring sakhr-fab-ring-outer" aria-hidden="true" />
          <span className="sakhr-fab-spark-track" aria-hidden="true">
            <span className="sakhr-fab-spark" />
          </span>
          <span className="sakhr-fab-core">
            {open ? <X className="w-5 h-5 text-white drop-shadow" /> : <span className="sakhr-fab-letter">ص</span>}
          </span>
          {!open ? (
            <span className="sakhr-fab-brain-badge" aria-hidden="true">
              <Brain className="w-3 h-3" />
            </span>
          ) : null}
        </button>
      </div>

      {open && (
        <section className="skr-panel" dir="rtl" aria-label="محادثة صخر">
          <header className="skr-head">
            <span className="skr-avatar" aria-hidden>ص</span>
            <div className="skr-title">
              <strong>صخر</strong>
              {roleLabel ? <span>{roleLabel}</span> : null}
            </div>
            <div className="skr-head-acts">
              {isSuperAdmin ? (
                <button type="button" className="skr-tables" onClick={() => setTable('packages')}>
                  <Table className="w-4 h-4" aria-hidden />
                  الجداول
                </button>
              ) : null}
              {canSpeak ? (
                <button
                  type="button"
                  className={`skr-icon${speakReplies ? ' is-on' : ''}`}
                  onClick={() => {
                    const next = !speakReplies;
                    setSpeakReplies(next);
                    if (next) unlockAudio();
                    else setHandsFree(false);
                    if (!next) {
                      stopSpeaking();
                      setSpeakingId(null);
                    }
                    try {
                      localStorage.setItem('ss_sakhr_speak', next ? '1' : '0');
                    } catch {
                      /* ignore */
                    }
                  }}
                  title={speakReplies ? 'الرد بالصوت: مفعّل' : 'الرد بالصوت: متوقف'}
                  aria-label={speakReplies ? 'إيقاف قراءة الردود' : 'تفعيل قراءة الردود'}
                  aria-pressed={speakReplies}
                >
                  {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              ) : null}
              {messages.length ? (
                <button type="button" className="skr-icon" onClick={clearChat} title="محادثة جديدة" aria-label="محادثة جديدة">
                  <RefreshCw className="w-4 h-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="skr-icon"
                onClick={closeChat}
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          <div className="skr-body" aria-live="polite">
            {messages.length === 0 ? (
              <div className="skr-empty">
                <span className="skr-avatar is-big" aria-hidden>ص</span>
                <p>كيف أقدر نعاونك؟</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`skr-msg is-${m.role}${m.error ? ' is-error' : ''}`}>
                  {m.text ? (
                    <div className="skr-bubble">
                      <FormattedText text={m.text} />
                    </div>
                  ) : null}
                  {canSpeak && m.role === 'model' && m.text && !m.error ? (
                    <button
                      type="button"
                      className={`skr-speak${speakingId === m.id ? ' is-on' : ''}`}
                      onClick={() => readAloud(m.id, m.text)}
                      aria-label={speakingId === m.id ? 'إيقاف القراءة' : 'استمع للرد'}
                      title={speakingId === m.id ? 'إيقاف القراءة' : 'استمع للرد'}
                    >
                      {speakingId === m.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : null}
                  {m.visuals?.map((v, i) => <SakhrVisual key={`v${i}`} visual={v} />)}
                  {m.actions?.map((card) => (
                    <div key={card.token} className={`skr-card is-${card.state}`}>
                      <p className="skr-card-summary">{card.summary}</p>
                      {card.state === 'pending' ? (
                        <div className="skr-card-acts">
                          <button type="button" className="is-primary" onClick={() => confirmAction(m.id, card)}>
                            تأكيد
                          </button>
                          <button type="button" onClick={() => updateAction(m.id, card.token, { state: 'cancelled' })}>
                            إلغاء
                          </button>
                        </div>
                      ) : card.state === 'running' ? (
                        <p className="skr-card-status"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> جاري التنفيذ…</p>
                      ) : card.state === 'cancelled' ? (
                        <p className="skr-card-status">أُلغي</p>
                      ) : (
                        <p className="skr-card-status">{card.state === 'done' ? '✓ ' : '⚠ '}{card.result}</p>
                      )}
                      {card.secret ? <SecretBox label={card.secret.label} value={card.secret.value} /> : null}
                    </div>
                  ))}
                </div>
              ))
            )}
            {thinking ? (
              <div className="skr-msg is-model">
                <div className="skr-bubble skr-typing" aria-label="صخر يكتب">
                  <i /><i /><i />
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {handsFree && voice.state === 'idle' ? (
            <p className="skr-voice-note skr-handsfree" role="status">
              <span className="skr-handsfree-dot" aria-hidden />
              {thinking ? 'صخر يفكّر…' : speakingId ? 'صخر يتكلّم… سأستمع إليك بعده' : 'محادثة صوتية'}
              <button type="button" onClick={() => { setHandsFree(false); stopSpeaking(); setSpeakingId(null); }}>
                إنهاء
              </button>
            </p>
          ) : null}
          {voiceNotice ? (
            <p className="skr-voice-note" role="status">
              {voiceNotice}
              <button type="button" onClick={() => setVoiceNotice('')} aria-label="إخفاء"><X className="w-3.5 h-3.5" /></button>
            </p>
          ) : null}
          {voice.state !== 'idle' && !(voice.state === 'recording' && draft) ? (
            <div className={`skr-input skr-rec${voice.state === 'transcribing' ? ' is-busy' : ''}`} role="group" aria-label="تسجيل صوتي">
              {voice.state === 'recording' ? (
                <>
                  <button
                    type="button"
                    className="skr-rec-cancel"
                    onClick={() => {
                      setHandsFree(false);
                      voice.stop(false);
                    }}
                    aria-label="إلغاء التسجيل"
                    title="إلغاء"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="skr-rec-dot" aria-hidden />
                  <span className="skr-rec-time" dir="ltr">
                    {`${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, '0')}`}
                  </span>
                  <span className="skr-rec-levels" aria-hidden>
                    {voice.levels.map((l, i) => (
                      <i key={i} style={{ transform: `scaleY(${l})` }} />
                    ))}
                  </span>
                  <span className="skr-rec-label">{handsFree ? 'أستمع إليك… تكلّم' : 'تكلّم… يُرسل تلقائياً عند توقفك'}</span>
                  <button
                    type="button"
                    className="skr-rec-send"
                    onClick={() => {
                      if (speakReplies) unlockAudio();
                      voice.stop(true);
                    }}
                    aria-label="إرسال التسجيل"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="skr-rec-label"><Loader2 className="w-4 h-4 animate-spin" /> جاري تحويل صوتك إلى نص…</span>
              )}
            </div>
          ) : (
          <form
            className="skr-input"
            onSubmit={(e) => {
              e.preventDefault();
              if (speakReplies) unlockAudio();
              setHandsFree(false);
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (speakReplies) unlockAudio();
                  setHandsFree(false);
                  void send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="اكتب رسالتك…"
              aria-label="رسالتك إلى صخر"
            />
            {micReady && !draft.trim() && !thinking ? (
              <button
                type="button"
                className="skr-mic"
                onClick={() => {
                  setVoiceNotice('');
                  stopSpeaking();
                  setSpeakingId(null);
                  if (speakReplies) unlockAudio();
                  setHandsFree(speakReplies);
                  void voice.start();
                }}
                aria-label="تحدّث مع صخر بالصوت"
                title="تحدّث بالصوت"
              >
                <Mic className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim() || thinking} aria-label="إرسال">
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            )}
          </form>
          )}
        </section>
      )}

      {table ? (
        <TableBrowser
          table={table}
          role={role}
          onClose={closeTable}
          onNotice={tableNotice}
        />
      ) : null}
    </>
  );
}
