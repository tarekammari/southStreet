'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, User, MessageType } from '@/types';
import { Send, MapPin, Mic, ShieldCheck, CheckCheck, Play, Phone, Video } from 'lucide-react';

interface ChatModuleProps {
  currentUser: User;
}

export default function ChatModule({ currentUser }: ChatModuleProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChat, setActiveChat] = useState('group-makkah');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const channels = [
    { id: 'group-makkah', name: 'حملة سوث ستريت الكبرى (مكة)', subtext: 'الشيخ أحمد: الانطلاق لأداء طواف...', time: '10:30 ص', unread: 0, avatar: '🕋' },
    { id: 'staff-private', name: 'طاقم الإدارة والمالية', subtext: 'الأستاذ طارق: تم تأكيد فندق مكة', time: 'أمس', unread: 2, avatar: '💼' },
    { id: 'direct-guide', name: 'الشيخ أحمد بن علي (المرشد)', subtext: 'متصل الآن...', time: '09:45 ص', unread: 0, avatar: '👳' }
  ];

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/messages?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchMessages(activeChat);
    const interval = setInterval(() => fetchMessages(activeChat), 4000);
    return () => clearInterval(interval);
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (type: MessageType = 'text', customText?: string, locData?: { name: string; coords: string }) => {
    const textToSend = customText || inputText.trim();
    if (!textToSend && type === 'text') return;

    const newMsg: Message = {
      id: `MSG-${Date.now()}`,
      chatId: activeChat,
      senderId: currentUser.id,
      senderName: `${currentUser.name} (${currentUser.roleName})`,
      senderRole: currentUser.role,
      text: textToSend,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      type,
      duration: type === 'voice' ? '0:45' : undefined,
      locationName: locData?.name,
      coords: locData?.coords,
      status: 'read'
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!customText) setInputText('');

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
    } catch {
      // Save locally fallback
    }

    // Auto reply simulation from Murshid for demo interactivity if pilgrim sends a message
    if (currentUser.role === 'pilgrim') {
      setTimeout(async () => {
        const guideReply: Message = {
          id: `MSG-REPLY-${Date.now()}`,
          chatId: activeChat,
          senderId: 'USR-003',
          senderName: 'الشيخ أحمد بن علي (مرشد)',
          senderRole: 'murshid',
          text: `حياك الله أخي ${currentUser.name}. تم استلام استفسارك، الفوج يتجه حالياً إلى المسعى. يرجى متابعة المجمّع.`,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
          status: 'read'
        };
        setMessages((prev) => [...prev, guideReply]);
        try {
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guideReply),
          });
        } catch {}
      }, 2200);
    }
  };

  const shareLocation = () => {
    const locations = [
      { name: 'باب الملك عبد العزيز - الحرم المكي', coords: '21.4190, 39.8260' },
      { name: 'فندق سويس أوتيل المقام - برج الساعة', coords: '21.4187, 39.8256' },
      { name: 'محطة حافلات أجياد - مكة المكرمة', coords: '21.4172, 39.8288' }
    ];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    handleSend('location', `موقعي الجغرافي المباشر: ${loc.name}`, loc);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-cairo">محادثات سوث ستريت الخصوصية المشفرة</h2>
          <p className="text-xs text-slate-500">تواصل مباشر مشفر ببروتوكول AES-256 بين أفراد الرحلة والمرشدين</p>
        </div>
        <span className="bg-emerald-soft text-emerald-main border border-emerald-light text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-main" />
          تشفير E2E مفعل بالكامل
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[560px]">
        {/* Sidebar Channels */}
        <div className="w-full md:w-80 bg-slate-950 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-white text-sm">المحادثات والقنوات</span>
            <span className="text-xs text-gold-main font-bold">سوث ستريت</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {channels.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveChat(c.id)}
                className={`p-3 rounded-xl cursor-pointer transition-colors flex items-center gap-3 ${
                  c.id === activeChat ? 'bg-slate-800 border border-gold-main/40' : 'hover:bg-slate-900'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-dark border border-gold-main/50 flex items-center justify-center text-lg shrink-0">
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-white text-xs truncate">{c.name}</span>
                    <span className="text-[10px] text-slate-400">{c.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{c.subtext}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-900 text-right">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-main text-white flex items-center justify-center font-bold text-base shadow">
                🕋
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">حملة سوث ستريت الكبرى (مكة المكرمة)</h4>
                <span className="text-[10px] text-emerald-400 font-semibold">متصل الآن • 45 عضو بالجمّع</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('إجراء مكالمة صوّتية مشفرة WebRTC مع المرشد...')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-gold-main rounded-lg transition-colors"
                title="مكالمة صوتية"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => alert('إجراء مكالمة فيديو مشفرة WebRTC...')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-gold-main rounded-lg transition-colors"
                title="مكالمة فيديو"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                onClick={shareLocation}
                className="bg-gold-main hover:bg-gold-light text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                مشاركة موقعي
              </button>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="p-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span
              onClick={() => handleSend('text', 'أنا عند باب الملك عبد العزيز')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-full cursor-pointer whitespace-nowrap border border-slate-700"
            >
              📍 عند باب الملك عبد العزيز
            </span>
            <span
              onClick={() => handleSend('text', 'وصلت للوبي الفندق')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-full cursor-pointer whitespace-nowrap border border-slate-700"
            >
              🏨 باللوبي
            </span>
            <span
              onClick={() => handleSend('text', 'ضاع مني الفوج ومحتاج توجيه')}
              className="bg-red-950 text-red-300 px-3 py-1 rounded-full cursor-pointer whitespace-nowrap border border-red-800"
            >
              ⚠️ ضاع مني الفوج
            </span>
            <span
              onClick={() => handleSend('text', 'جزاكم الله خيراً يا شيخ')}
              className="bg-slate-800 hover:bg-slate-700 text-gold-main px-3 py-1 rounded-full cursor-pointer whitespace-nowrap border border-gold-main/30"
            >
              🤲 تقبل الله
            </span>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m) => {
              const isMe = m.senderId === currentUser.id || m.senderRole === currentUser.role;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-xs md:max-w-md p-3 rounded-2xl text-xs leading-relaxed space-y-1.5 shadow-md ${
                      isMe
                        ? 'bg-emerald-dark text-white rounded-tl-none border border-emerald-600/40'
                        : 'bg-slate-800 text-white rounded-tr-none border border-slate-700'
                    }`}
                  >
                    {!isMe && (
                      <div className="font-bold text-gold-main text-[11px] mb-1">{m.senderName}</div>
                    )}

                    {m.type === 'location' ? (
                      <div className="space-y-2">
                        <p>{m.text}</p>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-gold-main/40 text-right">
                          <div className="font-bold text-gold-main flex items-center gap-1 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            {m.locationName || 'خريطة التجمع المباشرة'}
                          </div>
                          {m.coords && (
                            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">إحداثيات: {m.coords}</div>
                          )}
                        </div>
                      </div>
                    ) : m.type === 'voice' ? (
                      <div className="space-y-1.5">
                        <p className="font-bold text-[11px] text-gold-main">🎙️ رسالة صوتية إرشادية ({m.duration || '0:42'})</p>
                        <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-lg">
                          <button className="w-7 h-7 rounded-full bg-emerald-main text-white flex items-center justify-center shrink-0">
                            <Play className="w-3.5 h-3.5 fill-white" />
                          </button>
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="w-2/5 h-full bg-emerald-400"></div>
                          </div>
                          <span className="text-[10px] text-slate-400">{m.duration || '0:42'}</span>
                        </div>
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-300/80 pt-1 border-t border-white/10">
                      <span>{m.time}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend('text')}
              placeholder="اكتب رسالتك المشفرة E2E هنا..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-gold-main text-right"
            />
            <button
              onClick={() => handleSend('voice', 'رسالة صوتية مسجلة')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
              title="تسجيل صوتي"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSend('text')}
              className="p-2.5 bg-emerald-main hover:bg-emerald-light text-white rounded-full transition-colors shadow-md"
              title="إرسال"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
