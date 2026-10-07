'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { adminFetch, createKey, keyErrorMessage } from '@/lib/webauthn-client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

type KeyRow = { id: string; label: string; createdAt: string | null; lastUsedAt: string | null };

function when(value: string | null): string {
  if (!value) return 'لم يُستعمل بعد';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Super Admin / Admin: manage your own security keys and recovery codes. */
export default function SecurityKeysPanel() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [codesLeft, setCodesLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [label, setLabel] = useState('مفتاح احتياطي');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/account/security-keys', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر تحميل المفاتيح');
      setKeys(data.keys || []);
      setCodesLeft(Number(data.recoveryCodesLeft) || 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError('');
    setFlash('');
    try {
      await fn();
    } catch (err) {
      setError(keyErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const addKey = (kind: 'platform' | 'cross-platform') =>
    run('add', async () => {
      const startRes = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'options', kind }),
      });
      const start = await startRes.json().catch(() => ({}));
      if (!startRes.ok) throw new Error(start.error || 'تعذّر بدء التسجيل');
      const response = await createKey(start.options);
      const doneRes = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', flowToken: start.flowToken, response, label }),
      });
      const done = await doneRes.json().catch(() => ({}));
      if (!doneRes.ok) throw new Error(done.error || 'تعذّر حفظ المفتاح');
      setFlash('أُضيف المفتاح بنجاح');
      setLabel('مفتاح احتياطي');
      await load();
    });

  const removeKey = (id: string) =>
    run('remove', async () => {
      const res = await adminFetch(`/api/account/security-keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر حذف المفتاح');
      setFlash('حُذف المفتاح');
      await load();
    });

  const regenerate = () =>
    run('codes', async () => {
      const res = await adminFetch('/api/account/security-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recovery' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذّر إصدار الرموز');
      setCodes(data.recoveryCodes || []);
      await load();
    });

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="skm" dir="rtl" aria-labelledby="skm-title">
      <header className="skm-head">
        <span className="skm-icon"><ShieldCheck className="w-5 h-5" aria-hidden /></span>
        <div>
          <h2 id="skm-title">مفاتيح الأمان</h2>
          <p>الدخول إلى الإدارة يتطلب كلمة المرور ثم لمس أحد هذه المفاتيح.</p>
        </div>
      </header>

      {error ? <p className="skm-error" role="alert">{error}</p> : null}
      {flash ? <p className="skm-flash" role="status">{flash}</p> : null}
      {!loading && keys.length < 2 ? (
        <p className="skm-warn"><ShieldAlert className="w-4 h-4" aria-hidden /> لديك مفتاح واحد فقط. سجّل مفتاحاً احتياطياً حتى لا تفقد الوصول.</p>
      ) : null}

      {loading ? (
        <p className="skm-muted"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> جاري التحميل...</p>
      ) : (
        <ul className="skm-list">
          {keys.map((k) => (
            <li key={k.id}>
              <span className="skm-key"><KeyRound className="w-4 h-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <strong>{k.label}</strong>
                <span>أُضيف {when(k.createdAt)} · آخر استعمال {when(k.lastUsedAt)}</span>
              </div>
              <button
                type="button"
                className="skm-btn is-danger"
                onClick={() => setRemoveId(k.id)}
                disabled={Boolean(busy) || keys.length <= 1}
                title={keys.length <= 1 ? 'لا يمكن حذف آخر مفتاح' : 'حذف المفتاح'}
              >
                <Trash2 className="w-4 h-4" aria-hidden />
                <span className="sr-only">حذف {k.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="skm-add">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} aria-label="اسم المفتاح الجديد" />
        <button type="button" className="skm-btn is-primary" onClick={() => addKey('platform')} disabled={Boolean(busy)}>
          {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
          Windows Hello
        </button>
        <button type="button" className="skm-btn" onClick={() => addKey('cross-platform')} disabled={Boolean(busy)}>
          <Plus className="w-4 h-4" aria-hidden />
          مفتاح USB / هاتف
        </button>
      </div>

      <div className="skm-codes">
        <div>
          <strong>رموز الاسترداد</strong>
          <span>المتبقي: {codesLeft} من 10 — لكل رمز استعمال واحد عند فقدان المفاتيح.</span>
        </div>
        <button type="button" className="skm-btn" onClick={regenerate} disabled={Boolean(busy)}>
          {busy === 'codes' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
          إصدار رموز جديدة
        </button>
      </div>

      {codes.length ? (
        <div className="skm-newcodes">
          <p>احفظ هذه الرموز الآن — لن تظهر مرة أخرى، والرموز السابقة أُبطلت.</p>
          <ol dir="ltr">{codes.map((c) => <li key={c}>{c}</li>)}</ol>
          <div className="flex gap-2">
            <button type="button" className="skm-btn" onClick={copyCodes}>
              {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
            <button type="button" className="skm-btn" onClick={() => setCodes([])}>تم الحفظ</button>
          </div>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(removeId)}
        title="حذف مفتاح الأمان؟"
        message="لن يعود هذا المفتاح صالحاً للدخول. ستحتاج إلى لمس مفتاح آخر لتأكيد الحذف."
        confirmLabel="حذف المفتاح"
        danger
        busy={busy === 'remove'}
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          const id = removeId;
          setRemoveId(null);
          if (id) void removeKey(id);
        }}
      />
    </section>
  );
}
