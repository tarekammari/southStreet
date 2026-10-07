'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Self-contained confirmation for deleting a table row. It does not rely on the
 * /admin stylesheet, because the Tables panel also opens on the public pages.
 */
export interface DeleteDialogState {
  open: boolean;
  /** true while the server is checking what depends on the row */
  loading: boolean;
  /** true while the delete itself is running */
  busy: boolean;
  /** a reason the row can't be deleted; hides the delete button */
  blocker: string | null;
  notes: string[];
  needsKey: boolean;
  error: string;
}

export const CLOSED_DELETE_DIALOG: DeleteDialogState = {
  open: false,
  loading: false,
  busy: false,
  blocker: null,
  notes: [],
  needsKey: false,
  error: '',
};

export default function DeleteRecordDialog({
  state,
  title,
  tableLabel,
  onConfirm,
  onCancel,
}: {
  state: DeleteDialogState;
  title: string;
  tableLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !state.busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, state.busy, onCancel]);

  if (!state.open || typeof document === 'undefined') return null;

  const blocked = Boolean(state.blocker);

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 p-4 font-tajawal"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!state.busy) onCancel();
      }}
    >
      <div
        dir="rtl"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5 text-slate-900">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${blocked ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-bold">{blocked ? 'لا يمكن الحذف' : 'تأكيد الحذف'}</h3>
        </div>

        {state.loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري فحص ارتباطات السجل…
          </p>
        ) : blocked ? (
          <p className="text-sm leading-relaxed text-slate-700">{state.blocker}</p>
        ) : (
          <div className="space-y-2 text-sm leading-relaxed text-slate-700">
            <p>
              سيتم حذف <strong className="text-slate-900">«{title}»</strong> من جدول {tableLabel} نهائياً، ولا يمكن التراجع عن ذلك.
            </p>
            {state.notes.map((note) => (
              <p key={note} className="text-slate-600">• {note}</p>
            ))}
            {state.needsKey && (
              <p className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
                <ShieldCheck className="h-4 w-4 shrink-0" /> سيُطلب منك لمس مفتاح الأمان لتأكيد الحذف.
              </p>
            )}
          </div>
        )}

        {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div className="mt-5 flex justify-start gap-2.5">
          {!blocked && !state.loading && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={state.busy}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {state.busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {state.busy ? 'جاري الحذف…' : 'نعم، احذف'}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={state.busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {blocked ? 'حسناً' : 'إلغاء'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
