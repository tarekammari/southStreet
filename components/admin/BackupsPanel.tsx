'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Download, Loader2, RefreshCw, ShieldAlert, Terminal } from 'lucide-react';
import { authHeaders } from '@/lib/api-client';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';

type Backup = { name: string; size: number; createdAt: string; reason: string };

const REASON: Record<string, string> = {
  manual: 'يدوية',
  auto: 'تلقائية',
  'pre-update': 'قبل تحديث',
  'pre-restore': 'قبل استرجاع',
};

function size(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Super Admin: list, create and download database backups. */
export default function BackupsPanel() {
  const [list, setList] = useState<Backup[]>([]);
  const [keep, setKeep] = useState(14);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/db-snapshots', { headers: authHeaders(), cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setList(data.backups || []);
        setKeep(data.keep || 14);
      } else setMessage({ text: data.error || 'تعذّر تحميل النسخ', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy('create');
    setMessage(null);
    try {
      const res = await adminFetch('/api/admin/db-snapshots', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setMessage({ text: res.ok ? data.message || 'تم' : data.error || 'تعذّر الإنشاء', tone: res.ok ? 'ok' : 'error' });
      if (res.ok) void load();
    } catch (err) {
      setMessage({ text: keyErrorMessage(err), tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const download = async (name: string) => {
    setBusy(name);
    setMessage(null);
    try {
      // Downloading the whole database asks for a security-key tap (handled by adminFetch).
      const res = await adminFetch(`/api/admin/db-snapshots?download=${encodeURIComponent(name)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ text: data.error || 'تعذّر التنزيل', tone: 'error' });
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ text: keyErrorMessage(err), tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const latest = list[0];
  const stale = !latest || Date.now() - new Date(latest.createdAt).getTime() > 36 * 3600 * 1000;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900" dir="rtl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Archive className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-cairo font-extrabold text-xl">النسخ الاحتياطية</h2>
            <p className="text-[13px] text-slate-500">نسخة مضغوطة من قاعدة البيانات — يُحتفظ بآخر {keep} نسخة.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="تحديث">
            <RefreshCw className={`w-4 h-4${loading ? ' animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={create}
            disabled={busy === 'create'}
            className="h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            إنشاء نسخة الآن
          </button>
        </div>
      </header>

      {stale && !loading ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px] px-3 py-2.5">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          {latest ? 'آخر نسخة أقدم من يوم ونصف — تأكد من تشغيل النسخ التلقائي على الخادم.' : 'لا توجد أي نسخة احتياطية بعد. أنشئ واحدة الآن.'}
        </p>
      ) : null}
      {message ? (
        <p className={`mt-4 rounded-xl text-[13px] font-bold px-3 py-2.5 ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline" /> جاري التحميل…</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">لا توجد نسخ بعد.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-start font-bold px-4 py-2.5">التاريخ</th>
                <th className="text-start font-bold px-4 py-2.5">النوع</th>
                <th className="text-start font-bold px-4 py-2.5">الحجم</th>
                <th className="px-4 py-2.5" aria-label="تنزيل" />
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.name} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-bold">{when(b.createdAt)}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex h-6 items-center px-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{REASON[b.reason] || b.reason}</span></td>
                  <td className="px-4 py-2.5 text-slate-500" dir="ltr">{size(b.size)}</td>
                  <td className="px-4 py-2.5 text-left">
                    <button
                      type="button"
                      onClick={() => download(b.name)}
                      disabled={Boolean(busy)}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      {busy === b.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      تنزيل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-[12.5px] text-slate-600 leading-relaxed">
        <p className="flex items-center gap-1.5 font-bold text-slate-800 mb-1"><Terminal className="w-4 h-4" /> الاسترجاع</p>
        يتم الاسترجاع من الخادم فقط (لأمان البيانات): أوقف التطبيق ثم نفّذ
        <code className="mx-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11.5px]" dir="ltr">npm run db:restore -- &lt;اسم النسخة&gt;</code>
        . النسخ مشفّرة وتحتاج مفاتيح <code className="font-mono text-[11.5px]" dir="ltr">DB_ENCRYPTION_SECRET</code> نفسها — احفظ نسخة من المفاتيح في مكان آمن منفصل.
      </div>
    </section>
  );
}
