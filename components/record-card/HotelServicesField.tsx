'use client';

import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { parseChips } from '@/lib/record-detail-layout';
import { HOTEL_SERVICE_OPTIONS } from '@/lib/record-field-options';

export default function HotelServicesField({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  const selected = useMemo(() => parseChips(value) ?? [], [value]);
  const [draft, setDraft] = useState('');
  const extras = selected.filter((item) => !HOTEL_SERVICE_OPTIONS.includes(item));

  const commit = (next: string[]) => {
    onChange?.(JSON.stringify(next));
  };

  const toggle = (item: string) => {
    if (readOnly) return;
    if (selected.includes(item)) commit(selected.filter((s) => s !== item));
    else commit([...selected, item]);
  };

  const addDraft = () => {
    const text = draft.trim();
    if (!text || selected.includes(text)) {
      setDraft('');
      return;
    }
    commit([...selected, text]);
    setDraft('');
  };

  return (
    <div className="hotel-services">
      <div className="hotel-services-picks" role="group" aria-label="خدمات الفندق">
        {HOTEL_SERVICE_OPTIONS.map((item) => {
          const on = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              disabled={readOnly}
              className={`hotel-service-chip ${on ? 'is-on' : ''}`}
              onClick={() => toggle(item)}
            >
              {item}
            </button>
          );
        })}
        {extras.map((item) => (
          <button
            key={item}
            type="button"
            className="hotel-service-chip is-on"
            disabled={readOnly}
            onClick={() => toggle(item)}
          >
            {item}
            {!readOnly ? <X className="w-3 h-3" aria-hidden /> : null}
          </button>
        ))}
      </div>
      {!readOnly ? (
        <div className="hotel-services-add">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDraft();
              }
            }}
            placeholder="خدمة جديدة…"
            className="luxury-form-input"
          />
          <button type="button" className="hotel-services-add-btn" onClick={addDraft}>
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>
      ) : null}
    </div>
  );
}
