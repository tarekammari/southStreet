'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, VolumeX, X, Sparkles, Bot, User as UserIcon, RefreshCw } from 'lucide-react';

interface SakhrAgentProps {
  onSearchFilter?: (keyword: string) => void;
}

export default function SakhrAgent({ onSearchFilter }: SakhrAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    '📋 شروط التقديم والوثائق',
    '💰 الأسعار وتسهيلات الدفع',
    '🏨 الفنادق والمسافة عن الحرم',
    '✈️ رحلات الطيران المباشر',
    '🕋 حجز الروضة الشريفة',
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isSpeaking]);

  const sanitizeForSpeech = (rawText: string): string => {
    return rawText
      .replace(/[*#\-_()\[\]]/g, ' ')
      .replace(/215,000/g, 'مائتين وخمسة عشر ألف')
      .replace(/295,000/g, 'مائتين وخمسة وتسعين ألف')
      .replace(/350م/g, 'ثلاثمائة وخمسين متراً')
      .replace(/600م/g, 'ستمائة متر')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speakArabicVoice = (textToSpeak: string) => {
    if (!isVoiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const spokenText = sanitizeForSpeech(textToSpeak);
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const bestVoice =
        voices.find((v) => v.lang.startsWith('ar') && (v.name.includes('Male') || v.name.includes('Maged') || v.name.includes('Tarik') || v.name.includes('Naayf'))) ||
        voices.find((v) => v.lang === 'ar-SA' || v.lang === 'ar-EG') ||
        voices.find((v) => v.lang.startsWith('ar'));

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const getFastResponse = (q: string): string => {
    const p = q.trim().toLowerCase();
    if (p.includes('مناسك') || p.includes('عمرة') || p.includes('طواف') || p.includes('سعي') || p.includes('إحرام')) {
      return `🕋 **مناسك العمرة الأربعة:**\n1. **الإحرام** من الميقات.\n2. **الطواف** حول الكعبة 7 أشواط.\n3. **السعي** بين الصفا والمروة 7 أشواط.\n4. **الحلق أو التقصير** للتحلل.\n💡 توفر الوكالة مرشدين شرعيين لمرافقتك خطوة بخطوة!`;
    } else if (p.includes('عرف عن نفسك') || p.includes('عرف بنفسك') || p.includes('من أنت') || p.includes('من انت') || p.includes('شكون أنت')) {
      return `🤖 **أنا "صخر" (Sakhr AI) — المساعد الذكي لوكالة ساوث ستريت.**\nأوفر لك معلومات مؤكدة حول الشروط، أسعار الباقات (215,000 دج - 295,000 دج)، الفنادق القريبة من الحرم (350م-600م)، ورحلات الطيران المباشر.`;
    } else if (p.includes('مرحبا') || p.includes('سلام') || p.includes('أهلا') || p.includes('اهلا')) {
      return `👋 **أهلاً وسهلاً بك! أنا "صخر" المساعد الذكي لوكالة ساوث ستريت.**\nيسعدني مرافقتك والإجابة عن جميع استفساراتك حول باقات العمرة، المناسك، الشروط، الفنادق، والطيران المباشر. كيف يمكنني مساعدتك اليوم؟`;
    } else if (p.includes('عرض') || p.includes('عروض') || p.includes('برنامج') || p.includes('برامج') || p.includes('لديكم') || p.includes('عندكم') || p.includes('متوفر')) {
      return `✨ **العروض والبرامج المتوفرة لدى ساوث ستريت:**\n1. 🕋 **باقة أوت المميزة (215,000 دج):** طيران مباشر + فندق منارات غزة (350م عن صحن الحرم).\n2. 🌟 **باقة المولد VIP (295,000 دج):** فندق سويس أوتيل برج الساعة (50م عن صحن الحرم).\n3. ✈️ **رحلات مباشرة وتسهيلات دفع ميسرة.**`;
    } else if (p.includes('شرط') || p.includes('شروط') || p.includes('وثائق') || p.includes('أوراق') || p.includes('ملف')) {
      return `📋 **شروط وأوراق التقديم للعمرة مع ساوث ستريت:**\n• **جواز سفر بيومتري** (صالح 6 أشهر على الأقل).\n• **2 صور شمسية** بخلفية بيضاء.\n• **دفتر العائلة** أو شهادة الميلاد للمحارم.\n• **دفتر التلقيح الصحي** المعتمد.\n• تسديد دفعة الحجز الأولى 30%.`;
    } else if (p.includes('سعر') || p.includes('أسعار') || p.includes('باقة') || p.includes('دج')) {
      return `💰 **الأسعار والباقات المتاحة:**\n• **عمرة أوت المميزة:** 215,000 دج (طيران مباشر + إقامة 350م).\n• **عمرة المولد النبوي VIP:** 295,000 دج (فندق سويس أوتيل 50م).\n• نوفر **تسهيلات دفع ميسرة** على دفعات.`;
    } else if (p.includes('فندق') || p.includes('حرم') || p.includes('قريب')) {
      return `🏨 **فنادقنا والقرب من الحرم:**\n• **مكة المكرمة:** فنادق منارات غزة وميسان المقام (350م إلى 600م فقط عن صحن الحرم المكي).\n• **المدينة المنورة:** المنطقة المركزية على بعد خطوات من المسجد النبوي.`;
    } else if (p.includes('مطار') || p.includes('مطارات') || (p.includes('طيران') && (p.includes('جزائر') || p.includes('وهران') || p.includes('عنابة')))) {
      return `✈️ **رحلات الطيران المباشر:**\nرحلات مباشرة بدون توقف عبر **الخطوط الجوية الجزائرية والخطوط السعودية** انطلاقاً من مطارات العاصمة، وهران، وعنابة.`;
    } else if (p.includes('نساء') || p.includes('مرشدة') || p.includes('روضة')) {
      return `🕋 **إرشاد النساء والروضة الشريفة:**\n• مرافقة دينية خاصة من **المرشدات الشرعيات**.\n• استخراج تصاريح **تطبيق نسك** لدخول الروضة الشريفة بأمان ويسر.`;
    } else if (p.includes('مساحة الجزائر') || (p.includes('مساحة') && p.includes('جزائر'))) {
      return `🇩🇿 **مساحة الجزائر:** تبلغ مساحة كوكب الأرض والجمهورية الجزائرية **2,381,741 كيلومتر مربع** (أكبر دولة في إفريقيا والعالم العربي).`;
    } else if (p.includes('قمر')) {
      return `🌕 **مساحة سطح القمر:** تبلغ حوالي **37.9 مليون كيلومتر مربع** (نحو 7.4% من مساحة الأرض).`;
    }
    return `أهلاً بك! صخر المساعد الذكي لوكالة ساوث ستريت في خدمتك 🕋 تفضل بطرح سؤالك حول مناسك العمرة، الشروط، الأسعار، أو الفنادق وسأجيبك بالتفصيل!`;
  };

  const sendMessage = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery('');
    const userMsg = { role: 'user' as const, text: q };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    stopSpeaking();
    if (onSearchFilter) onSearchFilter(q);

    const fastLocalAnswer = getFastResponse(q);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ prompt: q, history: messages.slice(-6) }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const aiText = data.text || fastLocalAnswer;

      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'ai', text: aiText }]);
      speakArabicVoice(aiText);
    } catch (err) {
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'ai', text: fastLocalAnswer }]);
      speakArabicVoice(fastLocalAnswer);
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
          onClick={() => {
            setIsOpen((v) => !v);
            if (isOpen) stopSpeaking();
          }}
          aria-label="مساعد صخر الذكي"
          className="relative w-[68px] h-[68px] sm:w-[88px] sm:h-[88px] rounded-full focus:outline-none group cursor-pointer"
        >
          <span className="absolute -inset-3 sm:-inset-5 rounded-full sakhr-breath opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)' }} />
          <span className="absolute -inset-2 sm:-inset-3 rounded-full sakhr-breath opacity-30 pointer-events-none"
            style={{ animationDelay: '0.5s', background: 'radial-gradient(circle, rgba(56,189,248,0.8), transparent 65%)' }} />
          <span className="absolute -inset-1 rounded-full sakhr-breath opacity-50 pointer-events-none"
            style={{ animationDelay: '1s', background: 'radial-gradient(circle, rgba(124,58,237,0.6), transparent 65%)' }} />

          <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/50 sakhr-orbit pointer-events-none" />

          <span className="absolute inset-0 rounded-full sakhr-orb shadow-[0_0_30px_rgba(99,102,241,0.6)] group-hover:shadow-[0_0_50px_rgba(99,102,241,0.8)] transition-shadow duration-500 flex flex-col items-center justify-center gap-0.5">
            <span className="absolute top-2 left-1/3 w-4 h-1.5 sm:w-5 sm:h-2 rounded-full bg-white/25 rotate-12 blur-sm pointer-events-none" />
            <span className="text-white font-black leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] text-xl sm:text-3xl font-cairo">
              صخر
            </span>
            <span className="text-white/80 tracking-[0.15em] leading-none text-[7px] sm:text-[9px] font-tajawal font-bold">
              {isSpeaking ? 'صوت مباشر' : 'AI AGENT'}
            </span>
          </span>
        </button>

        <span className="hidden sm:flex text-[11px] font-bold text-white/90 font-tajawal bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-xl items-center gap-1.5">
          {isSpeaking && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
          <span>{isSpeaking ? 'يتحدث الآن...' : 'المساعد الذكي صخر'}</span>
        </span>
      </div>

      {/* ════════════════════════════════
           MODERN ULTRA-WIDE SAKHR CHAT PANEL
           Positioned at top-[84px] below fixed navbar with clear spacing gap!
      ════════════════════════════════ */}
      {isOpen && (
        <div
          className="fixed top-[84px] bottom-6 right-3 sm:right-8 z-[250] w-[calc(100vw-24px)] sm:w-[680px] md:w-[780px] lg:w-[860px] max-w-[95vw] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-fade-in border border-indigo-500/35"
          style={{
            background: 'rgba(6, 8, 20, 0.97)',
            backdropFilter: 'blur(36px) saturate(160%)',
            boxShadow: '0 35px 90px rgba(0,0,0,0.8), 0 0 50px rgba(99,102,241,0.3)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/10 bg-slate-950/80">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full sakhr-orb flex items-center justify-center shadow-lg shrink-0 relative border border-white/20">
                <span className="text-white font-black text-xl font-cairo">ص</span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <p className="text-white font-black text-base sm:text-lg font-cairo leading-none">صخر الذكي — Sakhr Real AI</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> Real AI
                  </span>
                  {isSpeaking && (
                    <span className="flex items-center gap-0.5 mr-2">
                      <span className="w-1 h-3.5 bg-emerald-400 animate-pulse"></span>
                      <span className="w-1 h-4 bg-emerald-400 animate-pulse delay-75"></span>
                      <span className="w-1 h-2.5 bg-emerald-400 animate-pulse delay-150"></span>
                    </span>
                  )}
                </div>
                <p className="text-indigo-300 text-xs font-tajawal mt-1">
                  المساعد الذكي التفاعلي لوكالة ساوث ستريت (إجابات فورية ونطق صوتي مباشر)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  setIsVoiceEnabled(!isVoiceEnabled);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold font-tajawal transition-all cursor-pointer border ${
                  isVoiceEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={isVoiceEnabled ? 'إيقاف الصوت' : 'تفعيل الصوت'}
              >
                {isVoiceEnabled ? '🔊 مفعّل' : '🔇 كتم'}
              </button>

              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="w-9 h-9 rounded-full text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-base transition-all cursor-pointer"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 font-tajawal text-sm leading-relaxed"
            style={{ minHeight: 220 }}>
            {messages.length === 0 && !isThinking && (
              <div className="text-center text-slate-400 py-10 space-y-3 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/40 mx-auto flex items-center justify-center text-3xl shadow-lg">
                  🤖
                </div>
                <h3 className="text-white font-black text-lg font-cairo">كيف يمكن لصخر مساعدتك اليوم؟</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-tajawal">
                  اطرح أي سؤال حول **الشروط، الوثائق، الأسعار، فنادق مكة والمدينة، الطيران المباشر، وحجز الروضة الشريفة** وسيجيبك صخر فوراً وبنطق صوتي مريح.
                </p>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="max-w-[88%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-lg font-tajawal"
                  style={m.role === 'user'
                    ? { background: 'rgba(255,255,255,0.12)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px 20px 4px 20px' }
                    : { background: 'linear-gradient(135deg, #3730a3, #1d4ed8)', color: '#ffffff', border: '1px solid rgba(129,140,248,0.4)', borderRadius: '20px 20px 20px 4px' }
                  }
                >
                  {renderFormattedMessage(m.text)}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-end">
                <div className="px-5 py-3.5 rounded-2xl bg-indigo-900/60 border border-indigo-500/40" style={{ borderRadius: '20px 20px 20px 4px' }}>
                  <span className="flex gap-2 items-center">
                    <span className="text-xs text-indigo-200 font-bold font-tajawal">صخر يفكر ويعد الإجابة...</span>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"
                        style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-5 py-2.5 bg-slate-950/50 border-t border-white/5 flex flex-wrap gap-2 shrink-0">
            {SUGGESTIONS.map((s, i) => (
              <button key={i}
                onClick={() => sendMessage(s.replace(/^[^\s]+\s*/, ''))}
                className="text-xs text-indigo-200 bg-indigo-950/60 border border-indigo-500/40 hover:border-gold-main hover:text-white hover:bg-indigo-600/30 px-3.5 py-1.5 rounded-full transition-all cursor-pointer font-tajawal font-medium"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="px-5 pb-5 pt-3 flex gap-3 items-center shrink-0 border-t border-white/10 bg-slate-950/80">
            <button
              onClick={() => sendMessage()}
              disabled={isThinking || !query.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0 transition-all cursor-pointer disabled:opacity-40 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#2563eb)' }}
              title="إرسال"
            >
              ↑
            </button>
            <input
              ref={inputRef}
              type="text"
              value={query}
              dir="rtl"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="اطرح سؤالك أو شرطك هنا حول الرحلة والعمرة..."
              className="flex-1 bg-white/10 border border-white/15 focus:border-indigo-400 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none transition-colors font-tajawal text-right shadow-inner"
            />
          </div>
        </div>
      )}
    </>
  );
}
