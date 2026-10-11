'use client';

/**
 * Dashboard → "واتساب والتواصل":
 *   المحادثات   WhatsApp inbox (Sakhr's answers + manual replies, bot on/off per customer)
 *   القنوات     WhatsApp number, welcome message, social profile links
 *   الربط       WhatsApp Business connection status and setup steps
 *   أدوات النشر links with tracking tags, QR codes, ready-to-post bio text
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Bot, CheckCircle2, Copy, Download, Loader2, MessageCircle, RefreshCw, Save, Send, Settings2, Share2, UserRound, XCircle } from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { EMPTY_SOCIAL, SOCIAL_KEY, SOCIAL_LABELS, readSocialLinks, waLink, withUtm, type SocialLinks } from '@/lib/social';
import type { PageContentRow } from '@/lib/page-content';
import { SOCIAL_ICON, WhatsAppIcon } from '@/components/social/SocialIcons';

type Tab = 'inbox' | 'channels' | 'connect' | 'kit';
type Conv = { phoneHash: string; phone: string; name: string; userId: string; botEnabled: boolean; lastTs: number; unread: number; lastText: string };
type Msg = { id: string; direction: 'in' | 'out'; author: 'customer' | 'bot' | 'agent'; body: string; ts: number; agentName?: string };

const input = 'w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10';
const btn = 'h-10 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60';

function timeLabel(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });
}

function prettyPhone(p: string) {
  return p.startsWith('213') ? `+213 ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)} ${p.slice(10)}`.trim() : `+${p}`;
}

function copyText(text: string, done: (msg: string) => void) {
  void navigator.clipboard?.writeText(text).then(() => done('تم النسخ'));
}

/* ---------------- Inbox ---------------- */
function Inbox({ configured, onToast }: { configured: boolean; onToast: (t: string, bad?: boolean) => void }) {
  const [list, setList] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<{ conversation: Conv; messages: Msg[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const res = await adminFetch('/api/admin/whatsapp', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setList(data.conversations || []);
  }, []);
  const loadThread = useCallback(async (hash: string) => {
    const res = await adminFetch(`/api/admin/whatsapp?c=${encodeURIComponent(hash)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setThread({ conversation: data.conversation, messages: data.messages || [] });
  }, []);

  useEffect(() => {
    void loadList();
    const id = window.setInterval(() => {
      void loadList();
      if (active) void loadThread(active);
    }, 8000);
    return () => window.clearInterval(id);
  }, [loadList, loadThread, active]);

  useEffect(() => {
    if (active) void loadThread(active);
  }, [active, loadThread]);

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [thread?.messages.length]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      const res = await adminFetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c: active, text: draft }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return onToast(data.error || 'تعذّر الإرسال', true);
      setDraft('');
      await loadThread(active);
      void loadList();
    } catch (err) {
      onToast(keyErrorMessage(err), true);
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async (on: boolean) => {
    if (!active) return;
    const res = await adminFetch('/api/admin/whatsapp', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c: active, botEnabled: on }) });
    if (res.ok) {
      onToast(on ? 'صخر يردّ على هذا العميل من جديد' : 'أوقفت صخر لهذا العميل — الفريق يتولى المحادثة');
      void loadThread(active);
      void loadList();
    }
  };

  if (!list.length) {
    return (
      <div className="text-center py-16 text-slate-500">
        <MessageCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="font-bold text-slate-700">لا توجد محادثات بعد</p>
        <p className="text-sm mt-1">{configured ? 'ستظهر هنا رسائل العملاء على واتساب وردود صخر عليها.' : 'اربط رقم واتساب الأعمال من تبويب «الربط» لتبدأ استقبال الرسائل هنا.'}</p>
      </div>
    );
  }

  const conv = thread?.conversation;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] min-h-[520px]">
      <aside className={`border border-slate-200 rounded-2xl overflow-hidden bg-white ${active ? 'hidden lg:block' : ''}`}>
        {list.map((c) => (
          <button key={c.phoneHash} type="button" onClick={() => setActive(c.phoneHash)}
            className={`w-full text-right flex gap-3 items-start p-3 border-b border-slate-100 hover:bg-slate-50 ${active === c.phoneHash ? 'bg-emerald-50' : ''}`}>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black shrink-0">{(c.name || '؟').charAt(0)}</span>
            <span className="flex-1 min-w-0">
              <span className="flex justify-between gap-2">
                <b className="text-sm text-slate-900 truncate">{c.name || prettyPhone(c.phone)}</b>
                <small className="text-[11px] text-slate-400 shrink-0">{timeLabel(c.lastTs)}</small>
              </span>
              <span className="flex justify-between gap-2 mt-0.5">
                <small className="text-[12.5px] text-slate-500 truncate">{c.lastText}</small>
                {c.unread ? <span className="text-[11px] font-black bg-emerald-600 text-white rounded-full px-1.5 min-w-[20px] text-center">{c.unread}</span> : null}
              </span>
              <span className="flex gap-1.5 mt-1">
                {c.userId ? <span className="text-[10.5px] font-bold text-sky-700 bg-sky-50 rounded px-1.5">مسجّل</span> : null}
                {!c.botEnabled ? <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 rounded px-1.5">الفريق يتولى</span> : null}
              </span>
            </span>
          </button>
        ))}
      </aside>

      {active && conv ? (
        <section className="border border-slate-200 rounded-2xl bg-white flex flex-col min-h-[520px]">
          <header className="flex items-center justify-between gap-3 p-3 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-3">
              <button type="button" className="lg:hidden text-sm text-slate-500" onClick={() => setActive(null)}>رجوع</button>
              <div>
                <b className="text-slate-900">{conv.name || prettyPhone(conv.phone)}</b>
                <small className="block text-xs text-slate-500" dir="ltr">{prettyPhone(conv.phone)}</small>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={waLink(conv.phone)} target="_blank" rel="noreferrer" className={`${btn} border border-slate-200 text-slate-700`}><WhatsAppIcon /> فتح في واتساب</a>
              {conv.botEnabled ? (
                <button type="button" onClick={() => toggleBot(false)} className={`${btn} border border-amber-300 text-amber-800 bg-amber-50`}><UserRound className="w-4 h-4" /> أتولى المحادثة</button>
              ) : (
                <button type="button" onClick={() => toggleBot(true)} className={`${btn} border border-emerald-300 text-emerald-800 bg-emerald-50`}><Bot className="w-4 h-4" /> إعادة صخر</button>
              )}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]" style={{ maxHeight: 520 }}>
            {thread!.messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-7 whitespace-pre-line shadow-sm ${m.direction === 'out' ? (m.author === 'bot' ? 'bg-white text-slate-800' : 'bg-emerald-100 text-emerald-950') : 'bg-[#d9fdd3] text-slate-900'}`}>
                  {m.direction === 'out' ? (
                    <small className="block text-[11px] font-bold mb-0.5 text-slate-500">{m.author === 'bot' ? 'صخر' : m.agentName || 'الفريق'}</small>
                  ) : null}
                  {m.body}
                  <small className="block text-[10.5px] text-slate-400 mt-0.5 text-left">{timeLabel(m.ts)}</small>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 p-3 border-t border-slate-100" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input className={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={configured ? 'اكتب ردّاً — يُرسل من رقم الوكالة على واتساب' : 'واتساب غير مربوط بعد'} disabled={!configured} maxLength={3800} />
            <button type="submit" className={`${btn} bg-emerald-700 text-white`} disabled={!configured || sending || !draft.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
            </button>
          </form>
        </section>
      ) : (
        <div className="hidden lg:grid place-items-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">اختر محادثة</div>
      )}
    </div>
  );
}

/* ---------------- Channels ---------------- */
function Channels({ social, setSocial, onSave, saving }: { social: SocialLinks; setSocial: (s: SocialLinks) => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[13px] font-bold text-slate-700 mb-1.5">رقم واتساب الوكالة</span>
          <input className={input} dir="ltr" value={social.whatsapp} onChange={(e) => setSocial({ ...social, whatsapp: e.target.value })} placeholder="+213 550 12 34 56" maxLength={30} />
          <small className="text-[12px] text-slate-500">يظهر زر «راسلنا على واتساب» في الموقع وفي صفحة الروابط.</small>
        </label>
        <label className="block">
          <span className="block text-[13px] font-bold text-slate-700 mb-1.5">الرسالة الجاهزة عند فتح المحادثة</span>
          <input className={input} value={social.welcome} onChange={(e) => setSocial({ ...social, welcome: e.target.value })} maxLength={200} />
        </label>
      </div>
      <div>
        <h4 className="font-bold text-slate-900 mb-2">صفحات التواصل الاجتماعي</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).map((k) => {
            const Icon = SOCIAL_ICON[k];
            return (
              <label key={k} className="flex items-center gap-2">
                <span className="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 text-slate-600 shrink-0"><Icon /></span>
                <input className={input} dir="ltr" value={social[k]} onChange={(e) => setSocial({ ...social, [k]: e.target.value })} placeholder={`رابط ${SOCIAL_LABELS[k]}`} maxLength={300} />
              </label>
            );
          })}
        </div>
      </div>
      <button type="button" onClick={onSave} disabled={saving} className={`${btn} bg-emerald-700 text-white`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ
      </button>
    </div>
  );
}

/* ---------------- Connect (WhatsApp Business) ---------------- */
function Connect({ configured, origin, onToast }: { configured: boolean; origin: string; onToast: (t: string) => void }) {
  const webhook = `${origin}/api/whatsapp/webhook`;
  return (
    <div className="space-y-4 max-w-3xl text-[14px] leading-7 text-slate-700">
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${configured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        {configured ? <CheckCircle2 className="w-6 h-6 text-emerald-700" /> : <XCircle className="w-6 h-6 text-amber-600" />}
        <div>
          <b className="text-slate-900">{configured ? 'واتساب الأعمال مربوط — صخر يردّ على العملاء' : 'واتساب الأعمال غير مربوط بعد'}</b>
          <p className="text-[13px]">{configured ? 'الرسائل الواردة تظهر في «المحادثات»، ويمكن للفريق الرد أو إيقاف صخر لأي عميل.' : 'زر واتساب في الموقع يعمل الآن (يفتح المحادثة مع رقمكم). لتفعيل الرد الآلي من صخر اتبع الخطوات:'}</p>
        </div>
      </div>
      <ol className="list-decimal pr-5 space-y-2">
        <li>أنشئوا حساباً في <b>Meta Business</b> (business.facebook.com) باسم الوكالة، ثم تطبيقاً من نوع Business في developers.facebook.com وأضيفوا له منتج <b>WhatsApp</b>.</li>
        <li>أضيفوا رقم هاتف الوكالة (رقم غير مستعمل في تطبيق واتساب العادي، أو انقلوه إلى الأعمال) وأكّدوه بالرسالة القصيرة.</li>
        <li>أنشئوا «مستخدم نظام» (System User) ورمز وصول دائم بصلاحيتي whatsapp_business_messaging و whatsapp_business_management.</li>
        <li>
          في إعدادات Webhook ضعوا العنوان:
          <span className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-[12.5px] break-all" dir="ltr">{webhook}</code>
            <button type="button" className={`${btn} border border-slate-200`} onClick={() => copyText(webhook, onToast)}><Copy className="w-4 h-4" /></button>
          </span>
          واختاروا رمز تحقق سرياً (Verify token) واشتركوا في حقل <b>messages</b>.
        </li>
        <li>
          أضيفوا في إعدادات الخادم (Vercel ← Environment Variables، أو ملف .env على الخادم):
          <code className="block bg-slate-100 rounded-lg px-3 py-2 mt-1 text-[12.5px] leading-6" dir="ltr">
            WHATSAPP_TOKEN=…<br />WHATSAPP_PHONE_NUMBER_ID=…<br />WHATSAPP_VERIFY_TOKEN=…<br />WHATSAPP_APP_SECRET=…
          </code>
          ثم أعيدوا النشر. سيظهر هنا «مربوط».
        </li>
      </ol>
      <div className="p-4 rounded-2xl border border-slate-200 bg-white">
        <b className="text-slate-900">ماذا يفعل صخر على واتساب؟</b>
        <ul className="list-disc pr-5 mt-1 space-y-1 text-[13.5px]">
          <li>يجيب عن البرامج والأسعار والفنادق والمواعيد ودليل العمرة، ويرسل روابط الحجز.</li>
          <li>يفهم الرسائل الصوتية.</li>
          <li>العميل المسجّل (بنفس رقم الهاتف) يعرف حالة حجزه والمبلغ المتبقي.</li>
          <li>أعضاء الفريق يحصلون على ملخص سريع للعمل — دون أي تعديل: التعديلات والدفع والحسابات تبقى في التطبيق المحمي بمفتاح الأمان.</li>
          <li>من يكتب «موظف» يُحوَّل إلى الفريق، ويتوقف صخر لتلك المحادثة.</li>
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Publishing kit ---------------- */
function Kit({ social, origin, onToast }: { social: SocialLinks; origin: string; onToast: (t: string) => void }) {
  const [qrWa, setQrWa] = useState('');
  const [qrLinks, setQrLinks] = useState('');
  const wa = social.whatsapp ? waLink(social.whatsapp, social.welcome) : '';
  const linksPage = `${origin}/links`;

  useEffect(() => {
    const opts = { margin: 1, width: 520, color: { dark: '#064e3b', light: '#ffffff' } };
    if (wa) void QRCode.toDataURL(withUtm(wa, 'print', 'qr'), opts).then(setQrWa);
    void QRCode.toDataURL(withUtm(linksPage, 'print', 'qr'), opts).then(setQrLinks);
  }, [wa, linksPage]);

  const rows = useMemo(
    () => [
      { label: 'رابط صخر (لرسالة الترحيب في واتساب)', url: `${origin}/sakhr` },
      { label: 'رابط البايو (فيسبوك)', url: withUtm(linksPage, 'facebook', 'bio') },
      { label: 'رابط البايو (إنستغرام)', url: withUtm(linksPage, 'instagram', 'bio') },
      { label: 'رابط البايو (تيك توك)', url: withUtm(linksPage, 'tiktok', 'bio') },
      ...(wa ? [{ label: 'زر واتساب لإعلانات فيسبوك/إنستغرام', url: withUtm(wa, 'facebook', 'ads') }] : []),
      { label: 'صفحة البرامج (للمنشورات)', url: withUtm(`${origin}/packages`, 'facebook', 'post') },
      { label: 'دليل العمرة (محتوى للنشر)', url: withUtm(`${origin}/guide`, 'facebook', 'post') },
    ],
    [linksPage, wa, origin]
  );

  const greeting = `السلام عليكم 👋 مرحباً بكم في ساوث ستريت.
للرد الفوري على مدار الساعة تحدّث مع صخر، مساعدنا الذكي:
${origin}/sakhr
أو اترك رسالتك وسيردّ عليك فريقنا قريباً إن شاء الله.`;
  const bio = `🕋 رحلات العمرة والحج من الجزائر\n✈️ برامج وأسعار واضحة · فنادق قريبة من الحرم\n🤝 مرافقة دينية طوال الرحلة\n💬 راسلونا على واتساب أو احجزوا من هنا 👇\n${linksPage}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {[{ title: 'QR واتساب (للملصقات والمكتب)', src: qrWa, name: 'whatsapp-qr.png', hint: wa ? 'يفتح محادثة واتساب مع الوكالة مباشرة' : 'أضيفوا رقم واتساب في «القنوات» أولاً' },
          { title: 'QR صفحة الروابط (للمطويات والبطاقات)', src: qrLinks, name: 'links-qr.png', hint: 'يفتح صفحة: واتساب، البرامج، الحجز، الدليل' }].map((q) => (
          <div key={q.title} className="border border-slate-200 rounded-2xl p-4 bg-white flex gap-4 items-center">
            {q.src ? <img src={q.src} alt="" className="w-32 h-32 rounded-lg border border-slate-100" /> : <div className="w-32 h-32 rounded-lg bg-slate-100" />}
            <div className="space-y-2">
              <b className="block text-slate-900 text-sm">{q.title}</b>
              <small className="block text-slate-500 text-[12.5px]">{q.hint}</small>
              {q.src ? <a href={q.src} download={q.name} className={`${btn} border border-slate-200 text-slate-700`}><Download className="w-4 h-4" /> تنزيل PNG</a> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100"><b className="text-slate-900">روابط جاهزة للنشر</b><small className="block text-slate-500 text-[12.5px]">كل رابط يحمل علامة المصدر، فتعرفون أي منصة تجلب الزوار.</small></div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 p-3 border-b border-slate-100 last:border-0">
            <span className="text-sm font-bold text-slate-700 w-56 shrink-0">{r.label}</span>
            <code className="flex-1 text-[12px] text-slate-500 truncate" dir="ltr">{r.url}</code>
            <button type="button" className={`${btn} border border-slate-200`} onClick={() => copyText(r.url, onToast)}><Copy className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-white">
        <div className="flex justify-between items-center gap-2 mb-2">
          <b className="text-slate-900">رسالة الترحيب في تطبيق واتساب للأعمال</b>
          <button type="button" className={`${btn} border border-slate-200`} onClick={() => copyText(greeting, onToast)}><Copy className="w-4 h-4" /> نسخ</button>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700 font-[inherit]">{greeting}</pre>
        <p className="text-[12.5px] text-slate-500 mt-2">في تطبيق WhatsApp Business: الإعدادات ← أدوات الأعمال ← رسالة الترحيب ← تفعيل، ثم الصق هذا النص. كل عميل جديد يصله الرابط فيفتح محادثة صخر في الموقع مباشرة.</p>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-white">
        <div className="flex justify-between items-center gap-2 mb-2">
          <b className="text-slate-900">نص البايو المقترح</b>
          <button type="button" className={`${btn} border border-slate-200`} onClick={() => copyText(bio, onToast)}><Copy className="w-4 h-4" /> نسخ</button>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700 font-[inherit]">{bio}</pre>
      </div>
    </div>
  );
}

export default function WhatsAppHub() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [configured, setConfigured] = useState(false);
  const [social, setSocial] = useState<SocialLinks>(EMPTY_SOCIAL);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const notify = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    const [status, rows, info] = await Promise.all([
      adminFetch('/api/admin/whatsapp', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/content', { cache: 'no-store' }).then((r) => r.json()).catch(() => []),
      fetch('/api/agency-info', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ]);
    setConfigured(Boolean(status?.configured));
    setSocial(readSocialLinks(Array.isArray(rows) ? (rows as PageContentRow[]) : [], info?.whatsapp || ''));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SOCIAL_KEY, section: 'general', title_ar: 'قنوات التواصل', content_ar: JSON.stringify(social), image_url: '' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'تعذّر الحفظ');
      notify('تم الحفظ — الأزرار والروابط محدّثة في الموقع');
    } catch (err) {
      notify(keyErrorMessage(err), true);
    } finally {
      setSaving(false);
    }
  };

  const tabs: [Tab, string, typeof MessageCircle][] = [
    ['inbox', 'المحادثات', MessageCircle],
    ['channels', 'القنوات والروابط', Settings2],
    ['connect', 'الربط بواتساب', Bot],
    ['kit', 'أدوات النشر', Share2],
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900 space-y-5" dir="rtl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#25d366]/10 text-[#128c4a] border border-[#25d366]/30"><WhatsAppIcon className="w-5 h-5" /></span>
          <div>
            <h2 className="font-cairo font-extrabold text-xl">واتساب والتواصل</h2>
            <p className="text-[13px] text-slate-500">محادثات العملاء مع صخر والفريق، وقنوات التواصل وأدوات النشر على الشبكات الاجتماعية.</p>
          </div>
        </div>
        <button type="button" onClick={load} className="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="تحديث"><RefreshCw className="w-4 h-4" /></button>
      </header>
      <nav className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit max-w-full overflow-x-auto" role="tablist">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-9 px-3 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${tab === id ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </nav>
      {toast ? <p className={`text-[13px] font-bold rounded-xl px-3 py-2 ${toast.bad ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{toast.text}</p> : null}
      {tab === 'inbox' ? <Inbox configured={configured} onToast={notify} /> : null}
      {tab === 'channels' ? <Channels social={social} setSocial={setSocial} onSave={save} saving={saving} /> : null}
      {tab === 'connect' ? <Connect configured={configured} origin={origin} onToast={notify} /> : null}
      {tab === 'kit' ? <Kit social={social} origin={origin} onToast={notify} /> : null}
    </section>
  );
}
