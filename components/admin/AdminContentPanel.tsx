'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

type ContentRow = {
  key: string;
  section?: string;
  title_ar?: string;
  content_ar?: string;
  updated_at?: string;
};

export default function AdminContentPanel() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ key: '', section: 'general', title_ar: '', content_ar: '' });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content', { cache: 'no-store', headers: authHeaders() });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('southstreet:admin-session-expired'));
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: jsonAuthHeaders(),
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setToast(res.ok ? data.message || 'تم الحفظ' : data.error || 'فشل الحفظ');
    window.setTimeout(() => setToast(''), 2800);
    if (res.ok) {
      setForm({ key: '', section: 'general', title_ar: '', content_ar: '' });
      void load();
    }
  };

  const remove = async (key: string) => {
    const res = await fetch(`/api/admin/content?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    setToast(res.ok ? data.message || 'تم الحذف' : data.error || 'فشل الحذف');
    window.setTimeout(() => setToast(''), 2800);
    setPendingDelete(null);
    if (res.ok) void load();
  };

  return (
    <div className="adm-panel" dir="rtl">
      <div className="adm-panel-head">
        <div>
          <h2>إدارة المحتوى</h2>
          <p>عرض وتحديث كتل page_content عبر الواجهة الحالية — دون حذف CSS التسويقي.</p>
        </div>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5${loading ? ' animate-spin' : ''}`} />
          تحديث
        </button>
      </div>
      <div className="adm-panel-body">
        {toast ? <div className="inn-toast" style={{ position: 'relative', marginBottom: '0.75rem' }}>{toast}</div> : null}

        <form className="adm-form-grid" onSubmit={save}>
          <label>
            المفتاح
            <input
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="hero_title"
              dir="ltr"
            />
          </label>
          <label>
            القسم
            <input
              value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              placeholder="general"
              dir="ltr"
            />
          </label>
          <label>
            العنوان (عربي)
            <input
              value={form.title_ar}
              onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
              required
            />
          </label>
          <label>
            المحتوى (عربي)
            <textarea
              rows={3}
              value={form.content_ar}
              onChange={(e) => setForm((f) => ({ ...f, content_ar: e.target.value }))}
            />
          </label>
          <button type="submit" className="adm-btn adm-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            حفظ الكتلة
          </button>
        </form>

        {loading ? (
          <p className="adm-empty">جاري التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">لا توجد كتل محتوى بعد.</p>
        ) : (
          <div className="adm-list">
            {rows.map((row) => (
              <div key={row.key} className="adm-list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <strong>
                      <FileText className="w-3.5 h-3.5 inline" /> {row.title_ar || row.key}
                    </strong>
                    <span dir="ltr">
                      {row.section || 'general'} · {row.key}
                    </span>
                    {row.content_ar ? <span>{row.content_ar.slice(0, 140)}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger"
                    onClick={() => setPendingDelete(row.key)}
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف كتلة محتوى؟"
        message={`سيتم حذف المفتاح «${pendingDelete}» نهائياً من page_content.`}
        confirmLabel="حذف"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />
    </div>
  );
}
