'use client';

/**
 * Admin editor for the public "عن الوكالة" page (/about): texts, images, the
 * "why us" cards, the journey steps, a photo gallery and which blocks show.
 * Saved as page_content rows (see lib/about-content.ts).
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import { ABOUT_DEFAULTS, aboutRows, readAboutContent, type AboutContent, type AboutItem } from '@/lib/about-content';
import type { PageContentRow } from '@/lib/page-content';

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await adminFetch('/api/admin/upload-image', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || 'تعذّر رفع الصورة');
  return String(data.url);
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const input = 'w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10';
const area = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm leading-7 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 resize-y';
const label = 'block text-[13px] font-bold text-slate-700 mb-1.5';
const iconBtn = 'grid place-items-center w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40';

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

function ImageField({ value, onChange, onError }: { value: string; onChange: (url: string) => void; onError: (msg: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="w-40 aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 grid place-items-center">
        {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-6 h-6 text-slate-300" />}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:border-emerald-600 hover:text-emerald-700"
          disabled={busy}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} تغيير الصورة
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
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
          }}
        />
      </div>
    </div>
  );
}

function ItemsEditor({ items, onChange, addLabel, titleHint }: { items: AboutItem[]; onChange: (next: AboutItem[]) => void; addLabel: string; titleHint: string }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start p-3 rounded-xl border border-slate-200 bg-slate-50/60">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-emerald-700 text-white text-sm font-black shrink-0 mt-1">{i + 1}</span>
          <div className="flex-1 min-w-0 space-y-2">
            <input className={input} value={item.title} placeholder={titleHint} maxLength={80}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <textarea className={area} rows={2} value={item.text} placeholder="الوصف" maxLength={300}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, i - 1))} disabled={i === 0} aria-label="أعلى"><ArrowUp className="w-4 h-4" /></button>
            <button type="button" className={iconBtn} onClick={() => onChange(move(items, i, i + 1))} disabled={i === items.length - 1} aria-label="أسفل"><ArrowDown className="w-4 h-4" /></button>
            <button type="button" className={`${iconBtn} hover:text-red-600`} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {items.length < 8 ? (
        <button type="button" onClick={() => onChange([...items, { title: '', text: '' }])}
          className="h-10 px-4 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 inline-flex items-center gap-2 hover:border-emerald-600 hover:text-emerald-700">
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      ) : null}
    </div>
  );
}

function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 cursor-pointer">
      <span>
        <b className="block text-sm text-slate-900">{title}</b>
        <small className="text-[12.5px] text-slate-500">{hint}</small>
      </span>
      <input type="checkbox" className="w-5 h-5 accent-emerald-700" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function AboutPageEditor() {
  const [content, setContent] = useState<AboutContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/content', { cache: 'no-store' })
      .then((r) => r.json())
      .then((rows: PageContentRow[]) => setContent(readAboutContent(Array.isArray(rows) ? rows : [])))
      .catch(() => setContent(readAboutContent([])));
  }, []);

  if (!content) {
    return <div className="py-20 text-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin inline" /> جاري التحميل…</div>;
  }

  const set = <K extends keyof AboutContent>(key: K, value: AboutContent[K]) => setContent((c) => (c ? { ...c, [key]: value } : c));
  const fail = (text: string) => setMessage({ text, tone: 'error' });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      for (const row of aboutRows(content)) {
        const res = await adminFetch('/api/admin/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'تعذّر الحفظ');
        }
      }
      setMessage({ text: 'تم حفظ صفحة «عن الوكالة». التغييرات ظاهرة الآن للزوار.', tone: 'ok' });
    } catch (err) {
      fail(keyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setGalleryBusy(true);
    try {
      const added: { url: string; caption: string }[] = [];
      for (const file of Array.from(files).slice(0, 12 - content.gallery.items.length)) {
        added.push({ url: await uploadImage(file), caption: '' });
      }
      set('gallery', { ...content.gallery, items: [...content.gallery.items, ...added] });
    } catch (err) {
      fail(keyErrorMessage(err));
    } finally {
      setGalleryBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-900" dir="rtl">
      <header className="flex items-start justify-between gap-4 flex-wrap bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-2 z-10">
        <div>
          <h2 className="font-cairo font-extrabold text-xl">صفحة «عن الوكالة»</h2>
          <p className="text-[13px] text-slate-500">عدّل النصوص والصور وما يظهر في الصفحة. الأرقام والطاقم والتقييمات تُقرأ تلقائياً من بيانات الوكالة.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/about" target="_blank" rel="noreferrer" className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50">
            <ExternalLink className="w-4 h-4" /> عرض الصفحة
          </a>
          <button type="button" onClick={save} disabled={saving}
            className="h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-emerald-800 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ ونشر
          </button>
        </div>
        {message ? (
          <p className={`w-full text-[13px] font-bold rounded-xl px-3 py-2 ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
        ) : null}
      </header>

      <Card title="الواجهة الرئيسية" hint="أول ما يراه الزائر: عنوان كبير، جملة تعريفية، وصورة.">
        <div><span className={label}>العنوان</span><input className={input} value={content.hero.title} maxLength={90} onChange={(e) => set('hero', { ...content.hero, title: e.target.value })} /></div>
        <div>
          <span className={label}>النص التعريفي</span>
          <textarea className={area} rows={3} value={content.hero.text} maxLength={400} placeholder="اتركه فارغاً لاستعمال وصف الوكالة من الإعدادات"
            onChange={(e) => set('hero', { ...content.hero, text: e.target.value })} />
        </div>
        <div><span className={label}>الصورة</span><ImageField value={content.hero.image} onChange={(image) => set('hero', { ...content.hero, image })} onError={fail} /></div>
      </Card>

      <Card title="قصتنا" hint="من أنتم، منذ متى، وما الذي يميّزكم. يمكنك كتابة عدة فقرات.">
        <div><span className={label}>العنوان</span><input className={input} value={content.story.title} maxLength={90} onChange={(e) => set('story', { ...content.story, title: e.target.value })} /></div>
        <div><span className={label}>النص</span><textarea className={area} rows={7} value={content.story.text} maxLength={3000} onChange={(e) => set('story', { ...content.story, text: e.target.value })} /></div>
        <div><span className={label}>الصورة</span><ImageField value={content.story.image} onChange={(image) => set('story', { ...content.story, image })} onError={fail} /></div>
      </Card>

      <Card title="لماذا نحن" hint="بطاقات قصيرة تعرض نقاط قوة الوكالة (حتى 8).">
        <div><span className={label}>عنوان القسم</span><input className={input} value={content.values.heading} maxLength={90} onChange={(e) => set('values', { ...content.values, heading: e.target.value })} /></div>
        <ItemsEditor items={content.values.items} onChange={(items) => set('values', { ...content.values, items })} addLabel="إضافة بطاقة" titleHint="عنوان البطاقة" />
      </Card>

      <Card title="كيف نعمل" hint="مراحل الرحلة مع الوكالة، بالترتيب.">
        <div><span className={label}>عنوان القسم</span><input className={input} value={content.journey.heading} maxLength={90} onChange={(e) => set('journey', { ...content.journey, heading: e.target.value })} /></div>
        <ItemsEditor items={content.journey.items} onChange={(items) => set('journey', { ...content.journey, items })} addLabel="إضافة مرحلة" titleHint="اسم المرحلة" />
      </Card>

      <Card title="معرض الصور" hint="صور من رحلاتكم ومكاتبكم (حتى 12 صورة). يظهر القسم عند إضافة صورة واحدة على الأقل.">
        <div><span className={label}>عنوان القسم</span><input className={input} value={content.gallery.heading} maxLength={90} onChange={(e) => set('gallery', { ...content.gallery, heading: e.target.value })} /></div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {content.gallery.items.map((photo, i) => (
            <figure key={`${photo.url}-${i}`} className="m-0 rounded-xl border border-slate-200 overflow-hidden bg-white">
              <img src={photo.url} alt="" className="w-full aspect-[4/3] object-cover" />
              <div className="p-2 space-y-2">
                <input className={`${input} h-9`} value={photo.caption} placeholder="تعليق (اختياري)" maxLength={80}
                  onChange={(e) => set('gallery', { ...content.gallery, items: content.gallery.items.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" className={iconBtn} onClick={() => set('gallery', { ...content.gallery, items: move(content.gallery.items, i, i - 1) })} disabled={i === 0} aria-label="قبل"><ArrowUp className="w-4 h-4 rotate-90" /></button>
                  <button type="button" className={iconBtn} onClick={() => set('gallery', { ...content.gallery, items: move(content.gallery.items, i, i + 1) })} disabled={i === content.gallery.items.length - 1} aria-label="بعد"><ArrowDown className="w-4 h-4 rotate-90" /></button>
                  <button type="button" className={`${iconBtn} hover:text-red-600`} onClick={() => set('gallery', { ...content.gallery, items: content.gallery.items.filter((_, j) => j !== i) })} aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </figure>
          ))}
          {content.gallery.items.length < 12 ? (
            <button type="button" onClick={() => galleryRef.current?.click()} disabled={galleryBusy}
              className="min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold text-sm grid place-items-center hover:border-emerald-600 hover:text-emerald-700">
              <span className="inline-flex flex-col items-center gap-2">
                {galleryBusy ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
                إضافة صور
              </span>
            </button>
          ) : null}
          <input ref={galleryRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        </div>
      </Card>

      <Card title="الأقسام التلقائية" hint="تُبنى من بيانات الوكالة الحقيقية؛ اختر ما يظهر منها.">
        <Toggle on={content.settings.stats} onChange={(stats) => set('settings', { ...content.settings, stats })} title="الأرقام" hint="عدد البرامج والفنادق والطاقم وتقييم المعتمرين" />
        <Toggle on={content.settings.team} onChange={(team) => set('settings', { ...content.settings, team })} title="الطاقم والمرشدون" hint="من «الفريق والحسابات»: الصورة، النبذة، المهارات، الخبرة" />
        <Toggle on={content.settings.reviews} onChange={(reviews) => set('settings', { ...content.settings, reviews })} title="تقييمات المعتمرين" hint="التقييمات المعتمدة فقط" />
      </Card>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <button type="button" onClick={() => { setContent(ABOUT_DEFAULTS); setMessage({ text: 'أُعيد المحتوى الافتراضي. اضغط «حفظ ونشر» لاعتماده.', tone: 'ok' }); }}
          className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 inline-flex items-center gap-2 hover:bg-slate-50">
          <RotateCcw className="w-4 h-4" /> استعادة المحتوى الافتراضي
        </button>
        <button type="button" onClick={save} disabled={saving}
          className="h-11 px-6 rounded-xl bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-emerald-800 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ ونشر
        </button>
      </div>
    </div>
  );
}
