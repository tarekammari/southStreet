'use client';

import React, { useState, useRef, useEffect } from 'react';

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
    'أفضل عروض أوت 2026',
    'طيران مباشر من الجزائر',
    'فنادق قريبة من الحرم',
    'باقات العمرة السريعة',
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isSpeaking]);

  // Clean text for speech synthesis so browser reads naturally without robotic glitches
  const sanitizeForSpeech = (rawText: string): string => {
    return rawText
      .replace(/[*#\-_()\[\]]/g, ' ')
      .replace(/215,000/g, 'مائتين وخمسة عشر ألف')
      .replace(/295,000/g, 'مائتين وخمسة وتسعين ألف')
      .replace(/50م/g, 'خمسين متراً')
      .replace(/600م/g, 'ستمائة متر')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Natural Speech Synthesis
  const speakArabicVoice = (textToSpeak: string) => {
    if (!isVoiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const spokenText = sanitizeForSpeech(textToSpeak);
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;  // Natural speech speed
      utterance.pitch = 1.0; // Natural human pitch

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

  const sendMessage = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setIsThinking(true);
    stopSpeaking();
    if (onSearchFilter) onSearchFilter(q);

    // Instant local response for 0ms delay experience
    const fastLocalAnswer = getFastResponse(q);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('/api/ai/sakhr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ prompt: q }),
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

  const getFastResponse = (q: string): string => {
    if (q.includes('أوت') || q.includes('شهر')) {
      return 'يُوصي صخر بباقتين متميزتين لشهر أوت: عمرة 10 أوت بفندق منارات غزة، وعمرة المولد النبوي بسويس أوتيل بجوار صحن الحرم.';
    } else if (q.includes('فندق') || q.includes('الحرم') || q.includes('قريب')) {
      return 'جميع عروض سوث ستريت توفر إقامة فاخرة على بعد 50م إلى 600م فقط عن صحن الحرم المكي الشريف مع طيران مباشر.';
    } else if (q.includes('مباشر') || q.includes('الجزائر') || q.includes('طيران')) {
      return 'يتوفر طيران مباشر مريح عبر الخطوط الجوية الجزائرية والخطوط السعودية من مطارات الجزائر، وهران، وعنابة.';
    }
    return 'صخر جاهز لمساعدتك في اختيار وتصفية أفضل عروض العمرة والحج المناسبة لك بأسرع وقت.';
  };

  return (
    <>
      {/* ════════════════════════════════
           SAKHR FLOATING ORB TRIGGER
      ════════════════════════════════ */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-2 select-none">
        <button
          onClick={() => {
            setIsOpen((v) => !v);
            if (isOpen) stopSpeaking();
          }}
          aria-label="مساعد صخر الذكي"
          className="relative w-[88px] h-[88px] rounded-full focus:outline-none group cursor-pointer"
        >
          {/* ── Breath rings (3 layers) ── */}
          <span className="absolute -inset-5 rounded-full sakhr-breath opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)' }} />
          <span className="absolute -inset-3 rounded-full sakhr-breath opacity-30 pointer-events-none"
            style={{ animationDelay: '0.5s', background: 'radial-gradient(circle, rgba(56,189,248,0.8), transparent 65%)' }} />
          <span className="absolute -inset-1 rounded-full sakhr-breath opacity-50 pointer-events-none"
            style={{ animationDelay: '1s', background: 'radial-gradient(circle, rgba(124,58,237,0.6), transparent 65%)' }} />

          {/* ── Spinning orbit dashes ── */}
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/50 sakhr-orbit pointer-events-none" />

          {/* ── Main fluid orb ── */}
          <span className="absolute inset-0 rounded-full sakhr-orb shadow-[0_0_40px_rgba(99,102,241,0.6),0_0_80px_rgba(56,189,248,0.3)] group-hover:shadow-[0_0_60px_rgba(99,102,241,0.8),0_0_100px_rgba(56,189,248,0.5)] transition-shadow duration-500 flex flex-col items-center justify-center gap-0.5">
            <span className="absolute top-3 left-1/3 w-5 h-2 rounded-full bg-white/25 rotate-12 blur-sm pointer-events-none" />
            <span className="text-white font-black leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
              style={{ fontFamily: 'Cairo, sans-serif', fontSize: '1.9rem' }}>
              صخر
            </span>
            <span className="text-white/70 tracking-[0.2em] leading-none"
              style={{ fontFamily: 'Tajawal, sans-serif', fontSize: '0.48rem' }}>
              {isSpeaking ? 'صوت مباشر' : 'AI AGENT'}
            </span>
          </span>
        </button>

        {/* ── Label pill ── */}
        <span className="text-[11px] font-bold text-white/90 font-tajawal bg-indigo-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shadow-lg flex items-center gap-1.5">
          {isSpeaking && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
          <span>{isSpeaking ? 'يتحدث الآن...' : 'مساعدك الذكي صخر'}</span>
        </span>
      </div>

      {/* ════════════════════════════════
           SAKHR CHAT PANEL
      ════════════════════════════════ */}
      {isOpen && (
        <div
          className="fixed bottom-36 right-8 z-50 w-[380px] max-w-[93vw] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-fade-in"
          style={{
            background: 'rgba(8, 10, 26, 0.96)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(99,102,241,0.35)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.2)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full sakhr-orb flex items-center justify-center shadow-lg shrink-0 relative">
                <span className="text-white font-black text-base font-cairo">ص</span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <p className="text-white font-black text-sm font-cairo leading-none">صخر</p>
                  {isSpeaking && (
                    <span className="flex items-center gap-0.5">
                      <span className="w-1 h-3 bg-emerald-400 animate-pulse"></span>
                      <span className="w-1 h-4 bg-emerald-400 animate-pulse delay-75"></span>
                      <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150"></span>
                    </span>
                  )}
                </div>
                <p className="text-indigo-300 text-[10px] font-tajawal tracking-wide mt-0.5">
                  استجابة فورية وصوت طبيعي
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  setIsVoiceEnabled(!isVoiceEnabled);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold font-tajawal transition-all cursor-pointer border ${
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
                className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center text-sm transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 font-tajawal text-sm"
            style={{ minHeight: 180, maxHeight: 320 }}>
            {messages.length === 0 && !isThinking && (
              <div className="text-center text-slate-500 text-xs py-6 space-y-2">
                <div className="text-2xl">⚡</div>
                <p className="text-slate-300 font-bold">صخر جاهز لإجابتك الفورية</p>
                <p className="text-[11px] text-slate-400">اطرح سؤالك للرد والكلام بصوت طبيعي ومباشر بدون انتظار</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', borderRadius: '18px 18px 4px 18px' }
                    : { background: 'linear-gradient(135deg,#4f46e5,#2563eb)', color: '#fff', borderRadius: '18px 18px 18px 4px' }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-end">
                <div className="px-4 py-3 rounded-2xl"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#2563eb)', borderRadius: '18px 18px 18px 4px' }}>
                  <span className="flex gap-1.5 items-center">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce"
                        style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions */}
          {messages.length === 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s, i) => (
                <button key={i}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] text-indigo-300 border border-indigo-500/40 hover:border-indigo-400 hover:text-white hover:bg-indigo-600/30 px-3 py-1.5 rounded-full transition-all cursor-pointer font-tajawal"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="px-4 pb-4 pt-2 flex gap-2 items-center shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => sendMessage()}
              disabled={isThinking || !query.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 transition-all cursor-pointer disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#2563eb)' }}
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
              placeholder="اسأل صخر..."
              className="flex-1 bg-white/7 border border-white/12 focus:border-indigo-500/70 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors font-tajawal text-right"
            />
          </div>
        </div>
      )}
    </>
  );
}
