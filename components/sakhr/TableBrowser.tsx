'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { RecordCardModel, buildRecordCard, emptyRecordCard } from '@/lib/record-card';
import { isAdminTable, tablesForRole, REDIRECT_TABLES } from '@/lib/admin-tables';
import { tableLabelPlain } from '@/components/sakhr/SakhrAgentHelpers';
import { authHeaders } from '@/lib/api-client';
import { expireSession } from '@/lib/client-session';

const RecordCardGrid = dynamic(() => import('@/components/RecordCardGrid').then((m) => m.RecordCardGrid), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-sm text-slate-400">جاري تحضير البطاقات…</div>,
});

const RecordBigCard = dynamic(() => import('@/components/RecordCardGrid').then((m) => m.RecordBigCard), {
  ssr: false,
});

const TeamWorkspace = dynamic(() => import('@/components/team/TeamWorkspace'), { ssr: false });

/** Staff are managed in the Team workspace (profile + login together), not as raw rows. */
const TEAM_TABLE = 'morshids';

type TableData = {
  tableName: string;
  label: string;
  columns: any[];
  rows: any[];
  writable?: boolean;
  total?: number;
};

/**
 * The "الجداول" visual table editor (cards, search, paging, add / edit / delete).
 * Opened from Sakhr's header button or by Sakhr itself (open_table tool).
 * Permissions come from the server (/api/admin/db-tables).
 */
export default function TableBrowser({
  table,
  role,
  onClose,
  onNotice,
}: {
  table: string;
  role: string;
  onClose: () => void;
  onNotice?: (text: string) => void;
}) {
  const [data, setData] = useState<TableData | null>(null);
  const [search, setSearch] = useState('');
  const [deferredSearch, setDeferredSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [bigCard, setBigCard] = useState<RecordCardModel | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(table === TEAM_TABLE);
  // Reopening a table renders from cache first, then refreshes in the background.
  const cache = useRef<Map<string, TableData>>(new Map());
  // The parent passes a fresh callback each render; keeping it in a ref stops
  // that from re-running the load effect (which used to loop and spam notices).
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;
  const notify = useCallback((text: string) => noticeRef.current?.(text), []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => setDeferredSearch(search), 160);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // A fullscreen modal replaces everything behind it.
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  /** Returns the table, or the server's error text (e.g. an expired session). */
  const loadMeta = async (name: string): Promise<{ meta?: any; error?: string }> => {
    let error = 'تعذر تحميل بيانات الجدول. أعد المحاولة من فضلك.';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/admin/db-tables?table=${encodeURIComponent(name)}`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (res.ok) return { meta: await res.json() };
        const body = await res.json().catch(() => null);
        if (body?.error) error = body.error;
        if (res.status === 401) {
          // Session expired: say so, then show the signed-out page to sign in again.
          expireSession(1800);
          return { error: 'انتهت جلستك. سجّل الدخول من جديد.' };
        }
        // A permission answer will not change on a retry.
        if (res.status === 403) return { error };
      } catch {
        // network hiccup: fall through to the retry
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return { error };
  };

  const fetchTable = useCallback(async (name: string, opts?: { keepCard?: boolean }) => {
    if (!isAdminTable(name)) {
      const info = REDIRECT_TABLES[name];
      notify(info ? `${info.label}: ${info.message}` : 'هذا الجدول غير متاح.');
      return;
    }
    const cached = cache.current.get(name);
    if (cached) {
      setData(cached);
      if (!opts?.keepCard) {
        setSelectedKey(null);
        setBigCard(null);
      }
    }

    const { meta, error } = await loadMeta(name);
    if (!meta) {
      if (!cached) {
        notify(error || 'تعذر تحميل بيانات الجدول.');
        closeRef.current();
      }
      return;
    }

    const next: TableData = {
      tableName: meta.tableName,
      label: meta.label,
      columns: meta.columns,
      rows: meta.rows,
      writable: meta.writable !== false,
      total: Number(meta.totalCount) || (meta.rows || []).length,
    };
    cache.current.set(name, next);
    setData(next);
    if (opts?.keepCard) {
      setBigCard((current) => {
        if (!current) return current;
        const rows = next.rows || [];
        const cols = next.columns || [];
        const match = current.keyColumn
          ? rows.find((row: Record<string, unknown>) => row[current.keyColumn as string] === current.keyValue)
          : undefined;
        const index = match
          ? rows.indexOf(match)
          : rows.findIndex((row: Record<string, unknown>, i: number) => buildRecordCard(row, cols, i).key === current.key);
        if (index < 0) return current;
        return buildRecordCard(rows[index], cols, index);
      });
    } else if (!cached) {
      setSelectedKey(null);
      setBigCard(null);
    }
  }, [notify]);

  useEffect(() => {
    if (table === TEAM_TABLE) {
      setTeamOpen(true);
      return;
    }
    void fetchTable(table);
  }, [table, fetchTable]);

  /** Tables load 150 rows at a time; this fetches the next page and appends it. */
  const loadMore = async () => {
    if (!data) return;
    try {
      const res = await fetch(`/api/admin/db-tables?table=${encodeURIComponent(data.tableName)}&offset=${data.rows.length}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const page = await res.json();
      const merged = { ...data, rows: [...data.rows, ...(page.rows || [])], total: Number(page.totalCount) || data.total };
      cache.current.set(data.tableName, merged);
      setData(merged);
    } catch {
      notify('تعذر تحميل المزيد من السجلات. أعد المحاولة.');
    }
  };

  const openInsert = async () => {
    if (!data) return;
    await fetchTable(data.tableName, { keepCard: true });
    const columns = cache.current.get(data.tableName)?.columns || data.columns;
    if (!columns?.length) {
      notify('تعذر تجهيز نافذة الإضافة. أعد المحاولة من فضلك.');
      return;
    }
    setCreatingNew(true);
    setSelectedKey(null);
    setBigCard(emptyRecordCard(columns, data.tableName));
  };

  const switchTable = (name: string) => {
    if (name === TEAM_TABLE) {
      setMenuOpen(false);
      setTeamOpen(true);
      return;
    }
    setSearch('');
    setSelectedKey(null);
    setBigCard(null);
    setCreatingNew(false);
    setMenuOpen(false);
    void fetchTable(name);
  };

  if (teamOpen) {
    return (
      <TeamWorkspace
        variant="modal"
        onClose={() => {
          setTeamOpen(false);
          // Opened straight onto the team: closing returns to the chat.
          if (table === TEAM_TABLE || !data) onClose();
        }}
      />
    );
  }

  return (
    <>
      <div className={`fixed inset-0 z-[320] luxury-modal-overlay flex items-center justify-center p-3 sm:p-6 font-tajawal ${bigCard ? 'modal-layer-hidden' : ''}`}>
        <div className="luxury-table-shell relative w-full max-w-[92rem] h-[88vh] flex flex-col text-slate-900" dir="rtl">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
            <h3 className="font-bold text-base sm:text-lg font-cairo text-slate-900 truncate">{data?.label || 'الجداول'}</h3>
            <div className="flex items-center gap-2 shrink-0">
              {data && data.writable !== false && (
                <button onClick={openInsert} className="btn-pro-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">إضافة جديد</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="luxury-table-toolbar px-5 sm:px-6 py-3 flex items-center gap-3 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="luxury-table-search w-full pr-9 pl-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} className="luxury-table-select px-3.5 py-2.5 text-sm shrink-0 cursor-pointer">
              الجداول
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto luxury-table-scroll">
            {data ? (
              <>
                <RecordCardGrid
                  rows={data.rows || []}
                  columns={data.columns}
                  search={deferredSearch}
                  selectedKey={selectedKey}
                  onSelect={(card: RecordCardModel) => {
                    setCreatingNew(false);
                    setBigCard(card);
                    setSelectedKey(card.key);
                  }}
                  tableName={data.tableName}
                />
                {(data.total || 0) > (data.rows?.length || 0) && (
                  <div className="py-4 text-center">
                    <button type="button" onClick={loadMore} className="btn-pro-outline text-xs py-2 px-4 cursor-pointer">
                      تحميل المزيد ({data.rows.length} من {data.total})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-sm text-slate-400">جاري التحميل…</div>
            )}
          </div>

          <div className={`table-side-menu-scrim ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)} />
          <aside className={`table-side-menu ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
            <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-200">
              <h4 className="font-cairo font-bold text-base text-slate-900">الجداول</h4>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1 luxury-table-scroll">
              {tablesForRole(role).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => switchTable(name)}
                  className={`table-side-menu-item ${data?.tableName === name ? 'is-active' : ''}`}
                >
                  {tableLabelPlain(name)}
                </button>
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-slate-200">
              <a href={REDIRECT_TABLES.users.href || '/admin'} className="table-side-menu-item block text-center" title={REDIRECT_TABLES.users.message}>
                {REDIRECT_TABLES.users.label} ↗
              </a>
            </div>
          </aside>
        </div>
      </div>

      {bigCard && data && (
        <RecordBigCard
          card={bigCard}
          columns={data.columns}
          tableName={data.tableName}
          tableLabel={creatingNew ? 'إضافة جديد' : data.label}
          isNew={creatingNew}
          readOnly={data.writable === false}
          onClose={() => {
            setCreatingNew(false);
            setBigCard(null);
          }}
          onSaved={(closeCard = true) => {
            setCreatingNew(false);
            cache.current.delete(data.tableName);
            void fetchTable(data.tableName, { keepCard: !closeCard });
            if (closeCard) setBigCard(null);
          }}
        />
      )}
    </>
  );
}
