'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="adm-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adm-confirm-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="adm-confirm-card adm-confirm-modal"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="adm-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="adm-confirm-actions">
          <button type="button" className="adm-confirm-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`adm-confirm-ok${danger ? ' is-danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'جاري التنفيذ…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
