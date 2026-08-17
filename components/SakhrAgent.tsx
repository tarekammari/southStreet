'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send, X, Sparkles, Bot, User as UserIcon, RefreshCw,
  MapPin, CheckCircle, ArrowRight, Eye, Layers, Calendar, DollarSign,
  PhoneCall, ShieldCheck, Play, Image as ImageIcon
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

export default function SakhrAgent({ onSearchFilter }: SakhrAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<SakhrMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Modals & Drawers state
  const [selectedMap, setSelectedMap] = useState<{ title: string; latitude: number; longitude: number } | null>(null);
  const [comparisonPackages, setComparisonPackages] = useState<Package[] | null>(null);
  const [bookingPackage, setBookingPackage] = useState<Package | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
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
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text }))
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

      // Trigger automatic UI actions if specified by backend
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act: AiAction) => {
          if (act.type === 'open_modal' && act.target === 'login') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('southstreet:open-login'));
            }
          } else if (act.type === 'navigate' && act.target) {
            if (typeof window !== 'undefined') {
              window.location.href = '/' + act.target.replace(/^\//, '');
            }
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

  const renderFormattedMessage = (content: string) => {
    return content.split('\n').map((line, lIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={lIdx} className="min-h-[1.2rem] my-0.5">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-black text-amber-300">
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
          className="relative w-[68px] h-[68px] sm:w-[88px] sm:h-[88px] rounded-full focus:outline-none group cursor-pointer"
        >
          <span
            className="absolute -inset-3 sm:-inset-5 rounded-full sakhr-breath opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)' }}
          />
          <span
            className="absolute -inset-2 sm:-inset-3 rounded-full sakhr-breath opacity-30 pointer-events-none"
            style={{ animationDelay: '0.5s', background: 'radial-gradient(circle, rgba(56,189,248,0.8), transparent 65%)' }}
          />
          <span
            className="absolute -inset-1 rounded-full sakhr-breath opacity-50 pointer-events-none"
            style={{ animationDelay: '1s', background: 'radial-gradient(circle, rgba(124,58,237,0.6), transparent 65%)' }}
          />

          <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/50 sakhr-orbit pointer-events-none" />

          <span className="absolute inset-0 rounded-full sakhr-orb shadow-[0_0_30px_rgba(99,102,241,0.6)] group-hover:shadow-[0_0_50px_rgba(99,102,241,0.8)] transition-shadow duration-500 flex flex-col items-center justify-center gap-0.5">
            <span className="absolute top-2 left-1/3 w-4 h-1.5 sm:w-5 sm:h-2 rounded-full bg-white/25 rotate-12 blur-sm pointer-events-none" />
            <span className="text-white font-black leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] text-xl sm:text-3xl font-cairo">
              صخر
            </span>
            <span className="text-white/80 tracking-[0.15em] leading-none text-[7px] sm:text-[9px] font-tajawal font-bold">
              AI
            </span>
          </span>
        </button>

        <span className="hidden sm:flex text-[11px] font-bold text-white/90 font-tajawal bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-xl items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>المساعد الذكي صخر</span>
        </span>
      </div>

      {/* ════════════════════════════════
           MODERN ULTRA-WIDE SAKHR CHAT PANEL
      ════════════════════════════════ */}
      {isOpen && (
        <div
          className="fixed top-[84px] bottom-6 right-3 sm:right-8 z-[250] w-[calc(100vw-24px)] sm:w-[600px] md:w-[700px] lg:w-[780px] max-w-[95vw] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-fade-in border border-white/10"
          style={{
            background: 'rgba(13, 13, 15, 0.98)',
            backdropFilter: 'blur(40px) saturate(160%)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.9)'
          }}
        >
          {/* Header — minimal like ChatGPT */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full sakhr-orb flex items-center justify-center shrink-0">
                <span className="text-white font-black text-base font-cairo leading-none">ص</span>
              </div>
              <span className="text-white font-bold text-sm font-cairo">صخر</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center text-base transition-all cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 font-tajawal text-sm leading-relaxed" style={{ minHeight: 220 }}>

            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'} space-y-2`}>
                <div
                  className="max-w-[88%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-lg font-tajawal"
                  style={
                    m.role === 'user'
                      ? {
                          background: 'rgba(255,255,255,0.12)',
                          color: '#f8fafc',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '20px 20px 4px 20px'
                        }
                      : {
                          background: 'linear-gradient(135deg, #3730a3, #1d4ed8)',
                          color: '#ffffff',
                          border: '1px solid rgba(129,140,248,0.4)',
                          borderRadius: '20px 20px 20px 4px'
                        }
                  }
                >
                  {renderFormattedMessage(m.text)}

                  {/* Escalation Alert Banner */}
                  {m.escalated && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-amber-400" />
                        <span>تم تحويل التذكرة لمستشار الوكالة المباشر</span>
                      </div>
                      <a
                        href="tel:+21321554433"
                        className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400"
                      >
                        اتصال الآن
                      </a>
                    </div>
                  )}
                </div>

                {/* Render Package Cards */}
                {m.cards && m.cards.length > 0 && (
                  <div className="w-full space-y-3 mt-2">
                    {m.cards.map((c, cIdx) => {
                      if (c.type === 'package') {
                        const pkg: Package = c.data;
                        return (
                          <div
                            key={cIdx}
                            className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 text-white space-y-3 shadow-xl"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  {pkg.type}
                                </span>
                                <h4 className="font-black text-sm font-cairo text-amber-300 mt-1">{pkg.name}</h4>
                              </div>
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                                متوفر {pkg.available} مقاعد
                              </span>
                            </div>

                            <p className="text-xs text-slate-300">{pkg.description}</p>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200 bg-slate-950/60 p-2.5 rounded-xl">
                              <div>🏨 **فندق مكة:** {pkg.makkah_hotel_name} ({pkg.makkah_hotel_dist})</div>
                              <div>✈️ **الطيران:** {pkg.airline}</div>
                              <div>📅 **المدة:** {pkg.duration_days} يومًا</div>
                              <div>💰 **يبدأ من:** {pkg.prices[0]?.amount.toLocaleString()} {pkg.prices[0]?.currency}</div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => setBookingPackage(pkg)}
                                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> حجز فوري
                              </button>
                              <button
                                onClick={() => sendMessage(`قارنلي الباقة ${pkg.name}`)}
                                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5" /> مقارنة
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (c.type === 'hotel') {
                        const htl: Hotel = c.data;
                        return (
                          <div key={cIdx} className="p-3.5 rounded-2xl bg-slate-900/80 border border-indigo-500/30 text-white space-y-2">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-xs text-indigo-200 font-cairo">{htl.name}</h4>
                              <span className="text-[10px] text-amber-400 font-bold">{htl.category}</span>
                            </div>
                            <p className="text-[11px] text-slate-300">📍 {htl.distance_from_haram}</p>
                            <button
                              onClick={() => setSelectedMap({ title: htl.name, latitude: htl.latitude, longitude: htl.longitude })}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" /> عرض الموقع الجغرافي بالخريطة
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}

                {/* Render Media Gallery (Images & Videos) */}
                {m.media && m.media.length > 0 && (
                  <div className="w-full space-y-2 mt-2">
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
                              className="w-full rounded-xl max-h-48 object-cover bg-black"
                              poster={med.thumbnail_url}
                            />
                            <p className="text-[10px] text-slate-400 px-1">{med.description}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={medIdx} className="relative rounded-xl overflow-hidden border border-white/20 group">
                          <img src={med.url} alt={med.title} className="w-full h-28 object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2 flex flex-col justify-end">
                            <p className="text-[10px] text-white font-bold truncate">{med.title}</p>
                            <span className="text-[8px] text-emerald-400 font-medium">{med.license}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-end">
                <div className="px-5 py-3.5 rounded-2xl bg-indigo-900/60 border border-indigo-500/40" style={{ borderRadius: '20px 20px 20px 4px' }}>
                  <span className="flex gap-2 items-center">
                    <span className="text-xs text-indigo-200 font-bold font-tajawal">صخر يستعلم قاعدة البيانات ويعد الإجابة...</span>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>


          {/* Input Bar — ChatGPT style */}
          <div className="px-4 pb-4 pt-3 shrink-0">
            <div
              className="flex items-end gap-3 rounded-2xl border border-white/10 px-4 py-3 focus-within:border-white/25 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                dir="rtl"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="اكتب رسالتك..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none font-tajawal text-right resize-none leading-relaxed"
              />
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || !query.trim()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: query.trim() ? 'linear-gradient(135deg,#4f46e5,#2563eb)' : 'rgba(255,255,255,0.08)' }}
                title="إرسال"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
           MAP VIEW MODAL
      ════════════════════════════════ */}
      {selectedMap && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
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

      {/* ════════════════════════════════
           INSTANT BOOKING MODAL
      ════════════════════════════════ */}
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
