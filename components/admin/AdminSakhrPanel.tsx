'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { authHeaders, jsonAuthHeaders } from '@/lib/api-client';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';

type Rule = {
  id: string;
  category?: string;
  title_ar?: string;
  keywords?: string[];
  response_ar?: string;
  is_active?: boolean;
  updatedAt?: string;
};

export default function AdminSakhrPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    title_ar: '',
    keywords: '',
    response_ar: '',
    category: 'faq',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sakhr-knowledge', { cache: 'no-store', headers: authHeaders() });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('southstreet:admin-session-expired'));
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setRules(Array.isArray(data?.rules) ? data.rules : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = form.keywords
      .split(/[,،]/)
      .map((k) => k.trim())
      .filter(Boolean);
    const res = await fetch('/api/admin/sakhr-knowledge', {
      method: 'POST',
      headers: jsonAuthHeaders(),
      body: JSON.stringify({
        title_ar: form.title_ar,
        response_ar: form.response_ar,
        keywords,
        category: form.category,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setToast(res.ok ? data.message || 'تمت الإضافة' : data.error || 'فشل الحفظ');
    window.setTimeout(() => setToast(''), 2800);
    if (res.ok) {
      setForm({ title_ar: '', keywords: '', response_ar: '', category: 'faq' });
      void load();
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/sakhr-knowledge?id=${encodeURIComponent(id)}`, {
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
          <h2>صخر — قاعدة المعرفة</h2>
          <p>إدارة قواعد الردود الرسمية للمساعد. لا تُدرج مفاتيح API هنا أبداً.</p>
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
            العنوان
            <input
              required
              value={form.title_ar}
              onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            />
          </label>
          <label>
            الكلمات المفتاحية (مفصولة بفاصلة)
            <input
              required
              value={form.keywords}
              onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              placeholder="عمرة, سعر, باقة"
            />
          </label>
          <label>
            الرد الرسمي
            <textarea
              required
              rows={4}
              value={form.response_ar}
              onChange={(e) => setForm((f) => ({ ...f, response_ar: e.target.value }))}
            />
          </label>
          <label>
            التصنيف
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="faq">أسئلة شائعة</option>
              <option value="packages">باقات</option>
              <option value="rituals">مناسك</option>
              <option value="agency">الوكالة</option>
            </select>
          </label>
          <button type="submit" className="adm-btn adm-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            إضافة قاعدة
          </button>
        </form>

        {loading ? (
          <p className="adm-empty">جاري التحميل…</p>
        ) : rules.length === 0 ? (
          <p className="adm-empty">لا قواعد معرفة بعد.</p>
        ) : (
          <div className="adm-list">
            {rules.map((rule) => (
              <div key={rule.id} className="adm-list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <strong>
                      <Bot className="w-3.5 h-3.5 inline" /> {rule.title_ar}
                    </strong>
                    <span>
                      {(rule.category || 'faq') +
                        (rule.is_active === false ? ' · متوقف' : ' · نشط') +
                        (rule.keywords?.length ? ` · ${rule.keywords.slice(0, 4).join('، ')}` : '')}
                    </span>
                    {rule.response_ar ? <span>{rule.response_ar.slice(0, 160)}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger"
                    onClick={() => setPendingDelete(rule.id)}
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
        title="حذف قاعدة صخر؟"
        message="سيتم إزالة قاعدة المعرفة من قاعدة صخر. يمكن إعادة إضافتها لاحقاً."
        confirmLabel="حذف"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void remove(pendingDelete)}
      />
    </div>
  );
}
