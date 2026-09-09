'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, User, MessageType } from '@/types';
import {
  Send,
  MapPin,
  Mic,
  CheckCheck,
  Phone,
  Video,
  Lock,
  Loader2,
  Users,
  Headphones,
  Compass,
  Wallet,
  Briefcase,
  UserRound,
  ChevronLeft,
  MessageCircle,
} from 'lucide-react';

interface ChatChannel {
  id: string;
  type: 'dm' | 'group' | 'staff';
  name: string;
  subtitle?: string;
  avatar: string;
  lastMessage?: string;
  lastTime?: string;
  unread?: number;
}

interface ChatModuleProps {
  currentUser: User;
  compact?: boolean;
}

type ChannelKind = 'group' | 'guide' | 'agent' | 'accountant' | 'manager' | 'person';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function personBits(name: string, subtitle?: string) {
  const m = String(name || '').match(/^(.*?)\s*[（(](.+?)[）)]\s*$/);
  return {
    title: (m ? m[1] : name).trim(),
    role: (m ? m[2] : subtitle || '').trim(),
  };
}

function channelKind(c: ChatChannel): ChannelKind {
  if (c.type === 'group') return 'group';
  const t = `${c.name} ${c.subtitle || ''}`;
  if (t.includes('مرشد') || t.includes('شيخ')) return 'guide';
  if (t.includes('محاسب')) return 'accountant';
  if (t.includes('مدير') || t.includes('مسير')) return 'manager';
  if (t.includes('موظف') || t.includes('عملاء') || c.type === 'staff') return 'agent';
  return 'person';
}

const KIND_META: Record<ChannelKind, { Icon: typeof Users; label: string }> = {
  group: { Icon: Users, label: 'الفوج' },
  guide: { Icon: Compass, label: 'مرشد' },
  agent: { Icon: Headphones, label: 'الوكالة' },
  accountant: { Icon: Wallet, label: 'محاسبة' },
  manager: { Icon: Briefcase, label: 'إدارة' },
  person: { Icon: UserRound, label: 'تواصل' },
};

export default function ChatModule({ currentUser, compact = false }: ChatModuleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileList, setMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChat);

  const openChat = (id: string) => {
    setActiveChat(id);
    setMobileList(false);
  };

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/contacts', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        if (!compact && !activeChat && data.channels?.length) {
          setActiveChat(data.channels[0].id);
        }
      } else {
        const fallback = fallbackChannels(currentUser);
        setChannels(fallback);
        if (!compact && !activeChat) setActiveChat(fallback[0]?.id || null);
      }
    } catch {
      const fallback = fallbackChannels(currentUser);
      setChannels(fallback);
      if (!compact && !activeChat) setActiveChat(fallback[0]?.id || null);
    } finally {
      setLoadingChannels(false);
    }
  }, [activeChat, compact, currentUser]);

  const fetchMessages = useCallback(async (chatId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      /* keep local state */
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(activeChat, true), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChat, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (type: MessageType = 'text', customText?: string, locData?: { name: string; coords: string }) => {
    const textToSend = customText || inputText.trim();
    if (!textToSend || !activeChat || sending) return;

    setSending(true);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      chatId: activeChat,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: textToSend,
      time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
      type,
      locationName: locData?.name,
      coords: locData?.coords,
      status: 'sent',
    };

    setMessages((prev) => [...prev, optimistic]);
    if (!customText) setInputText('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(optimistic),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
        loadChannels();
      }
    } catch {
      /* optimistic stays */
    } finally {
      setSending(false);
    }
  };

  const shareLocation = () => {
    const locations = [
      { name: 'باب الملك عبد العزيز — الحرم المكي', coords: '21.4190, 39.8260' },
      { name: 'فندق سويس أوتيل المقام', coords: '21.4187, 39.8256' },
      { name: 'محطة حافلات أجياد', coords: '21.4172, 39.8288' },
    ];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    handleSend('location', `📍 ${loc.name}`, loc);
  };

  const paneClass = `chat-app${compact ? ' is-lite' : ''} ${mobileList || !activeChat ? 'is-list' : 'is-thread'}`;

  return (
    <div className={`max-w-5xl mx-auto ${compact ? '' : 'space-y-4'} animate-fade-in`}>
      {compact ? null : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-cairo">المراسلة الخاصة</h2>
            <p className="text-xs text-slate-500 mt-0.5">تواصل آمن وسريع بين المعتمرين والمرشدين وطاقم الوكالة</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-main bg-emerald-soft px-3 py-1.5 rounded-full border border-emerald-main/20">
            <Lock className="w-3.5 h-3.5" />
            اتصال محمي
          </span>
        </div>
      )}

      <div className={paneClass}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <p>من تراسل؟</p>
            <span>اضغط اسماً للحديث</span>
          </div>

          {loadingChannels ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="chat-people">
              {channels.map((c, i) => {
                const kind = channelKind(c);
                const { title, role } = personBits(c.name, c.subtitle);
                const { Icon, label } = KIND_META[kind];
                const on = c.id === activeChat;
                return (
                  <motion.button
                    type="button"
                    key={c.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.28 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openChat(c.id)}
                    className={`chat-person is-${kind}${on ? ' is-on' : ''}`}
                    aria-current={on}
                    aria-label={`مراسلة ${title}`}
                  >
                    <span className={`chat-person-icon is-${kind}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="chat-person-copy">
                      <strong>{title}</strong>
                      <em>{role || label}</em>
                    </span>
                    <ChevronLeft className="chat-person-go" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="chat-main">
          {activeChannel ? (
            <>
              <div className="chat-main-header">
                <div className="chat-main-who">
                  <button
                    type="button"
                    className="chat-back"
                    onClick={() => setMobileList(true)}
                    aria-label="قائمة الأسماء"
                  >
                    <ChevronLeft className="w-5 h-5 rotate-180" />
                  </button>
                  <span className={`chat-person-icon is-${channelKind(activeChannel)}`}>
                    {React.createElement(KIND_META[channelKind(activeChannel)].Icon, { className: 'w-4 h-4' })}
                  </span>
                  <div className="min-w-0">
                    <h4>{personBits(activeChannel.name, activeChannel.subtitle).title}</h4>
                    <small>{personBits(activeChannel.name, activeChannel.subtitle).role || KIND_META[channelKind(activeChannel)].label}</small>
                  </div>
                </div>
                {compact ? (
                  <button type="button" onClick={shareLocation} className="chat-tool" title="موقعي">
                    <MapPin className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" className="chat-tool" title="مكالمة صوتية"><Phone className="w-4 h-4" /></button>
                    <button type="button" className="chat-tool" title="مكالمة فيديو"><Video className="w-4 h-4" /></button>
                    <button type="button" onClick={shareLocation} className="chat-tool is-fill" title="موقعي">
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {compact ? null : (
                <div className="chat-quick">
                  {['وصلت للفندق', 'عند باب الملك عبد العزيز', 'محتاج توجيه'].map((q) => (
                    <button key={q} type="button" onClick={() => handleSend('text', q)}>{q}</button>
                  ))}
                </div>
              )}

              <div className="chat-messages">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-main" />
                  </div>
                ) : messages.length === 0 ? (
                  <motion.div
                    className="chat-empty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <MessageCircle className="w-8 h-8" />
                    <p>اكتب أول رسالة</p>
                  </motion.div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((m) => {
                      const isMe = m.senderId === currentUser.id;
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.22 }}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className={isMe ? 'chat-bubble-me' : 'chat-bubble-them'}>
                            {!isMe ? (
                              <div className="text-[10px] font-bold text-emerald-main mb-1">
                                {personBits(m.senderName).title}
                              </div>
                            ) : null}
                            {m.type === 'location' ? (
                              <div className="space-y-1">
                                <p>{m.text}</p>
                                {m.coords ? <span className="text-[10px] text-slate-500 font-mono">{m.coords}</span> : null}
                              </div>
                            ) : (
                              <p>{m.text}</p>
                            )}
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                              <span>{m.time}</span>
                              {isMe ? <CheckCheck className="w-3 h-3 text-emerald-main" /> : null}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                className="chat-input-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend('text');
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="اكتب هنا..."
                  className="chat-input-field text-right"
                  disabled={sending}
                />
                {compact ? null : (
                  <button type="button" onClick={() => handleSend('voice', '🎙️ رسالة صوتية')} className="chat-tool" title="صوت">
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                <motion.button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="chat-send-btn"
                  title="إرسال"
                  whileTap={{ scale: 0.9 }}
                >
                  <Send className="w-4 h-4 rotate-180" />
                </motion.button>
              </form>
            </>
          ) : (
            <motion.div className="chat-pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <MessageCircle className="w-10 h-10" />
              <p>اختر اسماً من القائمة</p>
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}

function fallbackChannels(user: User): ChatChannel[] {
  const base: ChatChannel[] = [
    {
      id: 'group-campaign-makkah',
      type: 'group',
      name: 'حملة العمرة',
      subtitle: 'الفوج',
      avatar: '',
      lastMessage: 'مرحباً بالجميع',
    },
  ];
  if (user.role !== 'pilgrim') {
    base.push({
      id: 'staff-internal',
      type: 'staff',
      name: 'طاقم الإدارة',
      subtitle: 'داخلي',
      avatar: '',
    });
  }
  return base;
}
