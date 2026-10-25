'use client';

/**
 * «هوية الوكالة» (Super Admin): the agency's name, logo, colour, address,
 * phones and social links — everything that makes this installation one
 * agency (lib/brand.ts). Also the first-run wizard shown while the brand is
 * still the default one.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Palette, Save, Upload, X } from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { BRAND_FIELDS, DEFAULT_BRAND, brandHeroImages, type Brand, type BrandField } from '@/lib/brand';
import { SOCIAL_LABELS, type SocialLinks } from '@/lib/social';

type SocialKey = keyof typeof SOCIAL_LABELS;
type Draft = Record<BrandField, string> & { social: Pick<SocialLinks, SocialKey> };

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await adminFetch('/api/admin/upload-image', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || 'تعذّر رفع الصورة');
  return String(data.url);
}

function draftOf(brand: Brand): Draft {
  const out = {} as Draft;
  for (const key of BRAND_FIELDS) out[key] = brand[key];
  out.social = Object.fromEntries((Object.keys(SOCIAL_LABELS) as SocialKey[]).map((k) => [k, brand.social[k] || ''])) as Draft['social'];
  return out;
}

const input = 'w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10';
const area = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm leading-7 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 resize-y';
const label = 'block text-[13px] font-bold text-slate-700 mb-1.5';
const primaryBtn = 'h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-emerald-800 disabled:opacity-60';
const ghostBtn = 'h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50';

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <header className="mb-4">
        <h3 className="font-cairo font-extrabold text-[17px] text-slate-900">{title}</h3>
        {hint ? <p className="text-[12.5px] text-slate-500 mt-0.5">{hint}</p> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Text({ title, hint, value, onChange, ltr, max = 120, placeholder }: {
  title: string; hint?: string; value: string; onChange: (v: string) => void; ltr?: boolean; max?: number; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      <input className={input} value={value} maxLength={max} dir={ltr ? 'ltr' : undefined} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="block text-[11.5px] text-slate-500 mt-1">{hint}</span> : null}
    </label>
  );
}

function ImageField({ title, hint, value, onChange, onError, fit = 'contain', clearable }: {
  title: string; hint?: string; value: string; onChange: (url: string) => void; onError: (msg: string) => void; fit?: 'contain' | 'cover'; clearable?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <span className={label}>{title}</span>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-32 h-20 rounded-xl overflow-hidden border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] grid place-items-center">
          {value ? <img src={value} alt="" className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain p-1.5'}`} /> : <ImagePlus className="w-6 h-6 text-slate-300" />}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
            className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-emerald-600 hover:text-emerald-700">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} رفع صورة
          </button>
          {clearable && value ? (
            <button type="button" onClick={() => onChange('')} className={ghostBtn}><X className="w-4 h-4" /> إزالة</button>
          ) : null}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            try {
              onChange(await uploadImage(file));
            } catch (err) {
              onError(keyErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }} />
      </div>
      {hint ? <span className="block text-[11.5px] text-slate-500 mt-1.5">{hint}</span> : null}
    </div>
  );
}

/** How the navbar and buttons will look with these values. */
function Preview({ draft }: { draft: Draft }) {
  const color = /^#[0-9a-f]{6}$/i.test(draft.primary_color) ? draft.primary_color : DEFAULT_BRAND.primary_color;
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0" dir="ltr">
          {draft.logo_url ? <img src={draft.logo_url} alt="" className="h-10 w-auto max-w-[110px] object-contain" /> : null}
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 truncate">{draft.name_latin || '—'}</p>
            <p className="text-[11px] text-slate-500 truncate" dir="rtl">{draft.tagline}</p>
          </div>
        </div>
        <span className="h-9 px-4 rounded-full text-white text-[13px] font-bold inline-flex items-center" style={{ background: color }}>احجز الآن</span>
      </div>
      <div className="px-4 py-3 text-[12.5px] text-slate-600 space-y-1">
        <p><b className="text-slate-900">{draft.agency_name || '—'}</b></p>
        <p>{[draft.address, draft.city, draft.country].filter(Boolean).join('، ')}</p>
        <p dir="ltr" className="text-right">{[draft.phone, draft.email].filter(Boolean).join(' · ')}</p>
        <p className="text-slate-400">عنوان الصفحات: «… | {draft.short_name || '—'}»</p>
      </div>
    </div>
  );
}

/** The wizard starts with empty identity fields, not South Street's (the default brand). */
const IDENTITY_FIELDS: BrandField[] = [
  'agency_name', 'short_name', 'name_latin', 'legal_name', 'site_title', 'description', 'address', 'city',
  'map_url', 'map_lat', 'map_lng', 'phone', 'whatsapp', 'emergency_phone', 'email', 'website',
];

function useBrandDraft(blankDefaults = false) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    adminFetch('/api/admin/brand', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'تعذّر تحميل هوية الوكالة');
        const next = draftOf({ ...DEFAULT_BRAND, ...data, social: { ...DEFAULT_BRAND.social, ...(data.social || {}) } });
        if (blankDefaults) for (const key of IDENTITY_FIELDS) if (next[key] === DEFAULT_BRAND[key]) next[key] = '';
        setDraft(next);
      })
      .catch((err) => setError(keyErrorMessage(err)));
  }, [blankDefaults]);
  const set = <K extends BrandField>(key: K, value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const setSocial = (key: SocialKey, value: string) => setDraft((d) => (d ? { ...d, social: { ...d.social, [key]: value } } : d));
  return { draft, setDraft, set, setSocial, error };
}

async function saveBrand(draft: Draft): Promise<void> {
  const res = await adminFetch('/api/admin/brand', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'تعذّر الحفظ');
}

/* ------------------------------------------------------------------ sections */

type SectionProps = { draft: Draft; set: (key: BrandField, value: string) => void; fail: (msg: string) => void };

function NamesSection({ draft, set }: SectionProps) {
  return (
    <Card title="الاسم" hint="يظهر في الشريط العلوي، التذييل، عناوين الصفحات، الوثائق المطبوعة وردود صخر.">
      <Grid>
        <Text title="اسم الوكالة الكامل" value={draft.agency_name} onChange={(v) => set('agency_name', v)} placeholder="وكالة … للأسفار والعمرة" />
        <Text title="الاسم المختصر" hint="في عناوين الصفحات وجُمل الموقع: «عن الوكالة | الاسم المختصر»" value={draft.short_name} onChange={(v) => set('short_name', v)} max={40} />
        <Text title="الاسم بالحروف اللاتينية" hint="بجانب الشعار وفي اسم تطبيق Connect" value={draft.name_latin} onChange={(v) => set('name_latin', v)} ltr max={40} />
        <Text title="الاسم القانوني (السجل التجاري)" value={draft.legal_name} onChange={(v) => set('legal_name', v)} />
        <Text title="شعار قصير تحت الاسم" value={draft.tagline} onChange={(v) => set('tagline', v)} max={60} placeholder="عمرة · حج · رحلات" />
        <Text title="عنوان الصفحة الرئيسية في محركات البحث" hint="اتركه فارغاً ليُبنى من الأسماء" value={draft.site_title} onChange={(v) => set('site_title', v)} max={120} />
      </Grid>
      <label className="block">
        <span className={label}>وصف الوكالة</span>
        <textarea className={area} rows={3} maxLength={600} value={draft.description} onChange={(e) => set('description', e.target.value)} />
      </label>
    </Card>
  );
}

function LookSection({ draft, set, fail }: SectionProps) {
  return (
    <Card title="الشعار واللون" hint="PNG بخلفية شفافة أفضل. اللون الرئيسي يلوّن الأزرار والروابط والعناوين.">
      <Grid>
        <ImageField title="الشعار" value={draft.logo_url} onChange={(v) => set('logo_url', v)} onError={fail} />
        <ImageField title="الرمز (مربّع)" hint="لرمز QR والأيقونات الصغيرة" value={draft.mark_url} onChange={(v) => set('mark_url', v)} onError={fail} />
        <ImageField title="أيقونة المتصفح (favicon)" hint="اختياري — مربّعة 512×512" value={draft.favicon_url} onChange={(v) => set('favicon_url', v)} onError={fail} clearable />
        <ImageField title="صورة المشاركة" hint="تظهر عند مشاركة رابط الموقع في واتساب وفيسبوك (1200×630)" value={draft.og_image_url} onChange={(v) => set('og_image_url', v)} onError={fail} fit="cover" />
      </Grid>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className={label}>اللون الرئيسي</span>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.primary_color) ? draft.primary_color : DEFAULT_BRAND.primary_color}
            onChange={(e) => set('primary_color', e.target.value)} className="h-11 w-16 rounded-xl border border-slate-300 bg-white p-1 cursor-pointer" />
        </label>
        <div className="w-32"><Text title="الرمز" value={draft.primary_color} onChange={(v) => set('primary_color', v)} ltr max={7} /></div>
        <button type="button" className={ghostBtn} onClick={() => set('primary_color', DEFAULT_BRAND.primary_color)}><Palette className="w-4 h-4" /> اللون الافتراضي</button>
      </div>
    </Card>
  );
}

function PlaceSection({ draft, set }: SectionProps) {
  return (
    <Card title="العنوان والخريطة" hint="في صفحة «عن الوكالة»، التذييل، الوثائق وردود صخر.">
      <Text title="العنوان" value={draft.address} onChange={(v) => set('address', v)} max={160} />
      <Grid>
        <Text title="المدينة / الولاية" value={draft.city} onChange={(v) => set('city', v)} max={60} />
        <Text title="البلد" value={draft.country} onChange={(v) => set('country', v)} max={60} />
        <Text title="خط العرض" value={draft.map_lat} onChange={(v) => set('map_lat', v)} ltr max={20} placeholder="33.36252" />
        <Text title="خط الطول" value={draft.map_lng} onChange={(v) => set('map_lng', v)} ltr max={20} placeholder="6.858862" />
      </Grid>
      <Text title="رابط الموقع في خرائط جوجل" hint="من «مشاركة» في خرائط جوجل. اتركه فارغاً ليُبنى من الإحداثيات أو العنوان." value={draft.map_url} onChange={(v) => set('map_url', v)} ltr max={300} />
    </Card>
  );
}

function ContactSection({ draft, set }: SectionProps) {
  return (
    <Card title="التواصل">
      <Grid>
        <Text title="الهاتف" value={draft.phone} onChange={(v) => set('phone', v)} ltr max={30} />
        <Text title="واتساب" value={draft.whatsapp} onChange={(v) => set('whatsapp', v)} ltr max={30} />
        <Text title="هاتف الطوارئ" value={draft.emergency_phone} onChange={(v) => set('emergency_phone', v)} ltr max={30} />
        <Text title="البريد الإلكتروني" value={draft.email} onChange={(v) => set('email', v)} ltr max={120} />
        <Text title="موقع الوكالة (النطاق)" hint="مثال: https://agency.example" value={draft.website} onChange={(v) => set('website', v)} ltr max={120} />
        <Text title="أوقات العمل" value={draft.opening_hours} onChange={(v) => set('opening_hours', v)} max={200} />
      </Grid>
    </Card>
  );
}

function SocialSection({ draft, setSocial }: { draft: Draft; setSocial: (k: SocialKey, v: string) => void }) {
  return (
    <Card title="الشبكات الاجتماعية" hint="روابط الصفحات كاملة (https://…). الفارغ لا يظهر.">
      <Grid>
        {(Object.keys(SOCIAL_LABELS) as SocialKey[]).map((k) => (
          <Text key={k} title={SOCIAL_LABELS[k]} value={draft.social[k]} onChange={(v) => setSocial(k, v)} ltr max={300} />
        ))}
      </Grid>
    </Card>
  );
}

function PhotosSection({ draft, set, fail }: SectionProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos = brandHeroImages(draft);
  const write = (list: string[]) => set('hero_images', list.join('\n'));
  return (
    <Card title="صور الواجهة" hint="صور البطاقات المتحركة في أعلى الصفحة الرئيسية. بدونها تظهر صور الحرم المدمجة.">
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {photos.map((url, i) => (
          <figure key={`${url}-${i}`} className="m-0 relative rounded-xl border border-slate-200 overflow-hidden">
            <img src={url} alt="" className="w-full aspect-[4/5] object-cover" />
            <button type="button" aria-label="حذف" onClick={() => write(photos.filter((_, j) => j !== i))}
              className="absolute top-1.5 left-1.5 grid place-items-center w-8 h-8 rounded-lg bg-white/90 text-slate-600 hover:text-red-600"><X className="w-4 h-4" /></button>
          </figure>
        ))}
        {photos.length < 8 ? (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}
            className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold text-sm grid place-items-center hover:border-emerald-600 hover:text-emerald-700">
            <span className="inline-flex flex-col items-center gap-2">{busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />} إضافة صور</span>
          </button>
        ) : null}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files || []).slice(0, 8 - photos.length);
          e.target.value = '';
          if (!files.length) return;
          setBusy(true);
          try {
            const added: string[] = [];
            for (const file of files) added.push(await uploadImage(file));
            write([...photos, ...added]);
          } catch (err) {
            fail(keyErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }} />
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

export default function BrandSettings() {
  const { draft, set, setSocial, error } = useBrandDraft();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);
  const fail = (text: string) => setMessage({ text, tone: 'bad' });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveBrand(draft);
      setMessage({ text: 'تم الحفظ. يُعاد تحميل الصفحة لتظهر الهوية الجديدة…', tone: 'ok' });
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      fail(keyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm font-bold" dir="rtl">{error}</p>;
  if (!draft) return <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const props = { draft, set, fail };
  return (
    <div className="space-y-5 text-slate-900" dir="rtl">
      <header className="flex items-start justify-between gap-4 flex-wrap bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-2 z-10">
        <div>
          <h2 className="font-cairo font-extrabold text-xl">هوية الوكالة</h2>
          <p className="text-[13px] text-slate-500">اسم الوكالة وشعارها ولونها وعنوانها: يتغيّر بها الموقع كله، الوثائق المطبوعة، الرسائل وردود صخر.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noreferrer" className={ghostBtn}><ExternalLink className="w-4 h-4" /> عرض الموقع</a>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ ونشر
          </button>
        </div>
        {message ? (
          <p className={`w-full text-[13px] font-bold rounded-xl px-3 py-2 ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
        ) : null}
      </header>

      <Preview draft={draft} />
      <NamesSection {...props} />
      <LookSection {...props} />
      <PlaceSection {...props} />
      <ContactSection {...props} />
      <SocialSection draft={draft} setSocial={setSocial} />
      <PhotosSection {...props} />

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className={`${primaryBtn} h-11 px-6`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ ونشر
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ first run */

const STEPS = [
  { title: 'اسم وكالتك', hint: 'كيف يعرفكم المعتمرون.' },
  { title: 'الشعار واللون', hint: 'يظهران في كل صفحات الموقع.' },
  { title: 'العنوان والتواصل', hint: 'للصفحة «عن الوكالة» والوثائق وصخر.' },
] as const;

/** Shown to the Super Admin of a new installation until the brand is saved once. */
export function BrandSetupWizard({ onLater }: { onLater: () => void }) {
  const { draft, set, error } = useBrandDraft(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fail = (text: string) => setMessage(text);

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage('');
    try {
      await saveBrand(draft);
      window.location.reload();
    } catch (err) {
      fail(keyErrorMessage(err));
      setSaving(false);
    }
  };

  const props = draft ? { draft, set, fail } : null;
  const canNext = step !== 0 || Boolean(draft?.agency_name.trim() && draft.short_name.trim() && draft.name_latin.trim());
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="brand-wizard-title">
      <div className="w-full max-w-3xl bg-slate-50 rounded-3xl shadow-2xl my-6">
        <header className="px-6 pt-6 pb-4">
          <p className="text-[12px] font-bold text-emerald-700">الإعداد الأول · الخطوة {step + 1} من {STEPS.length}</p>
          <h2 id="brand-wizard-title" className="font-cairo font-extrabold text-2xl text-slate-900 mt-1">{STEPS[step].title}</h2>
          <p className="text-[13px] text-slate-500">{STEPS[step].hint} يمكنك تعديل كل شيء لاحقاً من «هوية الوكالة».</p>
          <div className="flex gap-1.5 mt-4">
            {STEPS.map((s, i) => <span key={s.title} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-emerald-600' : 'bg-slate-200'}`} />)}
          </div>
        </header>
        <div className="px-6 pb-2 space-y-4">
          {error ? <p className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">{error}</p> : null}
          {!props ? (
            error ? null : <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : step === 0 ? (
            <NamesSection {...props} />
          ) : step === 1 ? (
            <>
              <LookSection {...props} />
              <Preview draft={props.draft} />
            </>
          ) : (
            <>
              <PlaceSection {...props} />
              <ContactSection {...props} />
            </>
          )}
          {message ? <p className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-[13px] font-bold">{message}</p> : null}
        </div>
        <footer className="flex items-center justify-between gap-3 flex-wrap px-6 py-5">
          <button type="button" onClick={onLater} className="text-sm font-bold text-slate-500 hover:text-slate-800">لاحقاً</button>
          <div className="flex gap-2">
            {step > 0 ? <button type="button" className={ghostBtn} onClick={() => setStep(step - 1)}><ArrowRight className="w-4 h-4" /> السابق</button> : null}
            {step < STEPS.length - 1 ? (
              <button type="button" className={primaryBtn} disabled={!draft || !canNext} onClick={() => setStep(step + 1)}>التالي <ArrowLeft className="w-4 h-4" /></button>
            ) : (
              <button type="button" className={primaryBtn} disabled={!draft || saving} onClick={finish}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} حفظ وإنهاء
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
