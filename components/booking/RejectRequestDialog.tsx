'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, XCircle } from 'lucide-react';

/**
 * Refuse a new Umrah request, or cancel an accepted one that has no deposit yet.
 * The reason is required: it is shown to the pilgrim in their account and sent
 * to them in the agency chat (optionally on WhatsApp too).
 */

type Mode = 'reject' | 'cancel';

const REASONS: { id: string; label: string; text: string; modes: Mode[] }[] = [
  { id: 'full', label: 'اكتملت المقاعد', text: 'نعتذر، اكتملت المقاعد في هذا البرنامج. يسعدنا حجزك في برنامج آخر.', modes: ['reject', 'cancel'] },
  { id: 'passport', label: 'بيانات الجواز', text: 'بيانات جواز السفر غير صحيحة أو قاربت على الانتهاء. يرجى التحقق منها ثم إعادة الطلب.', modes: ['reject'] },
  { id: 'docs', label: 'وثائق ناقصة', text: 'بعض الوثائق المطلوبة ناقصة. يرجى تجهيزها ثم إعادة الطلب أو مراسلتنا.', modes: ['reject'] },
  { id: 'contact', label: 'تعذّر التواصل', text: 'حاولنا التواصل معك دون رد. يرجى مراسلتنا لتأكيد طلبك من جديد.', modes: ['reject', 'cancel'] },
  { id: 'deposit', label: 'لم يُسدَّد العربون', text: 'لم يُسدَّد العربون في الأجل المحدد، لذلك أُلغي الطلب. يمكنك إعادة الحجز متى شئت.', modes: ['cancel'] },
  { id: 'program', label: 'تغيّر البرنامج', text: 'عُدّل هذا البرنامج من طرف الوكالة. يمكنك اختيار برنامج آخر يناسبك.', modes: ['reject', 'cancel'] },
  { id: 'other', label: 'سبب آخر', text: '', modes: ['reject', 'cancel'] },
];

function whatsappLink(phone: string, text: string): string | null {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `213${digits.slice(1)}`; // Algerian local number
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function RejectRequestDialog({
  mode,
  customerName,
  customerPhone,
  reference,
  packageName,
  busy,
  onCancel,
  onConfirm,
}: {
  mode: Mode;
  customerName: string;
  customerPhone?: string;
  reference: string;
  packageName?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, whatsapp: string | null) => void;
}) {
  const reasons = useMemo(() => REASONS.filter((r) => r.modes.includes(mode)), [mode]);
  const [picked, setPicked] = useState<string>('');
  const [text, setText] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(Boolean(customerPhone));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const title = mode === 'cancel' ? 'إلغاء الطلب' : 'رفض الطلب';
  const valid = text.trim().length >= 3;
  const preview = `${mode === 'cancel' ? 'أُلغي' : 'لم تتم الموافقة على'} طلب العمرة ${reference}. السبب: ${text.trim() || '…'}`;

  return (
    <div className="fixed inset-0 z-[400] grid place-items-center p-4 bg-slate-900/40 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label={title} dir="rtl">
      <div className="w-full max-w-lg max-h-[calc(100vh-32px)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-up">
        <header className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-rose-50 text-rose-600">
            <XCircle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-cairo font-extrabold text-[17px] text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {customerName} · <span dir="ltr" className="font-mono">{reference}</span>
              {packageName ? ` · ${packageName}` : ''}
            </p>
          </div>
        </header>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div>
            <p className="text-[13px] font-bold text-slate-700 mb-2">السبب</p>
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setPicked(r.id);
                    setText(r.text);
                  }}
                  className={`h-8 px-3 rounded-full border text-[12.5px] font-bold transition-colors ${
                    picked === r.id ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                  aria-pressed={picked === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-[13px] font-bold text-slate-700 mb-1.5">رسالة للمعتمر *</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="اكتب السبب بوضوح ولطف — يقرؤه المعتمر في حسابه"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 resize-none"
              autoFocus
            />
            <span className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>يظهر في حساب المعتمر ويصله في المحادثة.</span>
              <span>{text.length}/500</span>
            </span>
          </label>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-bold text-slate-400 mb-1">ما سيقرؤه المعتمر</p>
            <p className="text-[13px] text-slate-700 leading-relaxed">{preview}</p>
          </div>

          {customerPhone ? (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-[13px] text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                إرسال السبب أيضاً عبر واتساب إلى <span dir="ltr" className="font-mono">{customerPhone}</span>
              </span>
            </label>
          ) : null}

          {mode === 'cancel' ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              الطلب مقبول سابقاً ولم يُسجَّل له عربون. يُلغى ويُحرَّر مقعده.
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={onCancel} disabled={busy} className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">
            تراجع
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => {
              const reason = text.trim();
              onConfirm(reason, sendWhatsapp && customerPhone ? whatsappLink(customerPhone, `السلام عليكم ${customerName}،\n${preview}`) : null);
            }}
            className="h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {mode === 'cancel' ? 'تأكيد الإلغاء' : 'تأكيد الرفض'}
          </button>
        </footer>
      </div>
    </div>
  );
}
