'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, User, MessageType } from '@/types';
import { Send, MapPin, Mic, ShieldCheck, CheckCheck, Phone, Video, Lock, Loader2 } from 'lucide-react';

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
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('south_street_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ChatModule({ currentUser }: ChatModuleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChat);

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/contacts', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        if (!activeChat && data.channels?.length) {
          setActiveChat(data.channels[0].id);
        }
      } else {
        setChannels(fallbackChannels(currentUser));
        if (!activeChat) setActiveChat('group-campaign-makkah');
      }
    } catch {
      setChannels(fallbackChannels(currentUser));
      if (!activeChat) setActiveChat('group-campaign-makkah');
    } finally {
      setLoadingChannels(false);
    }
  }, [activeChat, currentUser]);

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

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
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

      <div className="chat-app flex-col md:flex-row">
        {/* Sidebar */}
        <div className="chat-sidebar w-full md:w-auto shrink-0 max-h-48 md:max-h-none overflow-y-auto md:overflow-visible">
          <div className="chat-sidebar-header">
            <p className="font-bold text-sm text-slate-800 font-cairo">المحادثات</p>
            <p className="text-[11px] text-slate-500">{currentUser.roleName}</p>
          </div>

          {loadingChannels ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            channels.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveChat(c.id)}
                className={`chat-contact ${c.id === activeChat ? 'chat-contact-active' : ''}`}
              >
                <div className="chat-avatar">{c.avatar}</div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800 truncate">{c.name}</span>
                    {c.lastTime && <span className="text-[10px] text-slate-400 shrink-0">{c.lastTime}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.lastMessage || c.subtitle}</p>
                </div>
                {c.type === 'dm' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-soft text-emerald-main font-bold shrink-0">خاص</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Main chat */}
        <div className="chat-main flex-1 min-h-[360px]">
          {activeChannel ? (
            <>
              <div className="chat-main-header">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="chat-avatar">{activeChannel.avatar}</div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-800 truncate font-cairo">{activeChannel.name}</h4>
                    <span className="text-[10px] text-emerald-main font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {activeChannel.type === 'dm' ? 'محادثة خاصة مشفرة' : 'قناة جماعية'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="مكالمة صوتية">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="مكالمة فيديو">
                    <Video className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={shareLocation}
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-soft text-emerald-main text-[11px] font-bold hover:bg-emerald-main/10 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    موقعي
                  </button>
                </div>
              </div>

              {/* Quick replies */}
              <div className="px-3 py-2 bg-white/80 border-b border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none">
                {['وصلت للفندق', 'عند باب الملك عبد العزيز', 'محتاج توجيه'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend('text', q)}
                    className="shrink-0 px-3 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-200 text-slate-600 hover:border-emerald-main/40 hover:text-emerald-main transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="chat-messages">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-main" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <p>لا رسائل بعد — ابدأ المحادثة</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === currentUser.id;
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={isMe ? 'chat-bubble-me' : 'chat-bubble-them'}>
                          {!isMe && (
                            <div className="text-[10px] font-bold text-emerald-main mb-1">{m.senderName}</div>
                          )}
                          {m.type === 'location' ? (
                            <div className="space-y-1">
                              <p>{m.text}</p>
                              {m.coords && (
                                <span className="text-[10px] text-slate-500 font-mono">{m.coords}</span>
                              )}
                            </div>
                          ) : (
                            <p>{m.text}</p>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400">
                            <span>{m.time}</span>
                            {isMe && <CheckCheck className="w-3 h-3 text-emerald-main" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-bar">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend('text')}
                  placeholder="اكتب رسالتك..."
                  className="chat-input-field text-right"
                  disabled={sending}
                />
                <button
                  type="button"
                  onClick={() => handleSend('voice', '🎙️ رسالة صوتية')}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors hidden sm:flex"
                  title="رسالة صوتية"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSend('text')}
                  disabled={!inputText.trim() || sending}
                  className="chat-send-btn"
                  title="إرسال"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              اختر محادثة للبدء
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fallbackChannels(user: User): ChatChannel[] {
  const base: ChatChannel[] = [
    {
      id: 'group-campaign-makkah',
      type: 'group',
      name: 'حملة العمرة — مكة',
      subtitle: 'قناة الفوج',
      avatar: '🕋',
      lastMessage: 'مرحباً بالجميع',
    },
  ];
  if (user.role !== 'pilgrim') {
    base.push({
      id: 'staff-internal',
      type: 'staff',
      name: 'طاقم الإدارة',
      subtitle: 'داخلي',
      avatar: '💼',
    });
  }
  return base;
}
