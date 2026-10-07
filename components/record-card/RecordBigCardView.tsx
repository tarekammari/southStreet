'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff, Phone, Pencil, Save, RotateCcw, Loader2, ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight, Plus, Briefcase, Landmark, Calculator,
  Users, Ban, X,
} from 'lucide-react';
import { buildRecordCard, RecordCardModel, RecordColumn } from '@/lib/record-card';
import {
  extractImageUrls,
  isImageColumnName,
  isImagesArrayColumn,
  mergeImageAsMain,
  primaryPhotoColumn,
  serializeImageList,
} from '@/lib/table-cell-utils';
import { buildDetailLayout, DetailField, parseChips } from '@/lib/record-detail-layout';
import {
  getFieldSelectOptions,
  isMultiSelectField,
  isListTagField,
  isDateField,
  type FieldOption,
  MAKKAH_HOTEL_OPTIONS,
  MADINAH_HOTEL_OPTIONS,
  STAFF_VIEW_GROUPS,
  ACCOUNT_VIEW_GROUPS,
  staffViewGroup,
  accountViewGroup,
  isPendingStatus,
  isBlockedStatus,
  type StaffViewGroupId,
  type AccountViewGroupId,
} from '@/lib/record-field-options';
import { LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import ImageUploadField, { uploadImageFile } from '@/components/ImageUploadField';
import RecordImagesGalleryField from '@/components/record-card/RecordImagesGalleryField';
import HotelServicesField from '@/components/record-card/HotelServicesField';
import HotelVideosField from '@/components/record-card/HotelVideosField';
import HotelLocationField from '@/components/record-card/HotelLocationField';
import PackageOfferingsPanel from '@/components/record-card/PackageOfferingsPanel';
import LoginCredentialsPanel from '@/components/LoginCredentialsPanel';
import ReviewsModerator from '@/components/ReviewsModerator';
import { StarRating } from '@/components/StarRating';
import { authHeaders, getAuthToken, jsonAuthHeaders } from '@/lib/api-client';

function RecordPhotoSlider({
  photos,
  initial,
  index: controlledIndex,
  onIndex,
}: {
  photos: string[];
  initial: string;
  index?: number;
  onIndex?: (index: number) => void;
}) {
  const [localIndex, setLocalIndex] = useState(0);
  const index = controlledIndex ?? localIndex;
  const setIndex = useCallback((next: number | ((current: number) => number)) => {
    const value = typeof next === 'function' ? next(controlledIndex ?? localIndex) : next;
    if (onIndex) onIndex(value);
    else setLocalIndex(value);
  }, [controlledIndex, localIndex, onIndex]);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const touchStartX = useRef<number | null>(null);
  const visible = useMemo(() => photos.filter((url) => url && !broken[url]), [photos, broken]);
  const count = visible.length;
  const photosKey = useMemo(() => photos.join('|'), [photos]);

  useEffect(() => {
    if (onIndex) onIndex(0);
    else setLocalIndex(0);
  }, [photosKey, onIndex]);

  const go = useCallback(
    (delta: number) => setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
    [count, setIndex]
  );

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(-1);
      if (e.key === 'ArrowLeft') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, go]);

  const current = visible[Math.min(index, Math.max(count - 1, 0))] || '';

  if (!current) {
    return <div className="record-big-hero-fallback">{initial}</div>;
  }

  return (
    <>
      <div
        className="record-slider-track"
        onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1);
          touchStartX.current = null;
        }}
      >
        {visible.map((url, i) => (
          <img
            key={url}
            src={url}
            alt=""
            decoding="async"
            loading={i === 0 ? 'eager' : 'lazy'}
            className={`record-slider-img ${i === index ? 'is-active' : ''}`}
            onError={() => setBroken((prev) => ({ ...prev, [url]: true }))}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="record-slider-nav is-prev" aria-label="الصورة السابقة">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => go(1)} className="record-slider-nav is-next" aria-label="الصورة التالية">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="record-slider-count" dir="ltr">{index + 1} / {count}</span>

          <div className="record-slider-dots">
            {visible.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setIndex(i)}
                className={`record-slider-dot ${i === index ? 'is-active' : ''}`}
                aria-label={`الصورة ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DetailValue({ field }: { field: DetailField }) {
  if (field.empty) return <dd className="is-empty">فارغ</dd>;

  if (field.kind === 'chips') {
    return (
      <dd>
        <span className="record-detail-chips">
          {field.chips.map((chip, i) => (
            <span key={i} className="record-detail-chip">{chip}</span>
          ))}
        </span>
      </dd>
    );
  }

  if (field.kind === 'ltr') {
    return <dd dir="ltr" className="record-detail-ltr">{field.text}</dd>;
  }

  return <dd>{field.text}</dd>;
}

function RecordMultiSelect({
  value,
  fieldName,
  tableName,
  disabled,
  onChange,
}: {
  value: string;
  fieldName: string;
  tableName: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const options = getFieldSelectOptions(fieldName, tableName) ?? [];
  const selected = useMemo(() => new Set(parseChips(value) ?? []), [value]);

  const toggle = (optionValue: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    onChange(JSON.stringify(Array.from(next)));
  };

  return (
    <div className="record-field-multiselect" role="group">
      {options.map((opt) => {
        const active = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={`record-field-multiselect-option ${active ? 'is-active' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function formatDateForInput(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return s;
}

function RecordListEditor({
  value,
  fieldName,
  disabled,
  onChange,
}: {
  value: string;
  fieldName: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const items = useMemo(() => {
    const parsed = parseChips(value);
    if (parsed) return parsed;
    if (!value || !value.trim()) return [];
    return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }, [value]);

  const [inputVal, setInputVal] = useState('');

  const addItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || items.includes(trimmed)) return;
    const next = [...items, trimmed];
    onChange(JSON.stringify(next));
    setInputVal('');
  };

  const removeItem = (index: number) => {
    if (disabled) return;
    const next = items.filter((_, i) => i !== index);
    onChange(JSON.stringify(next));
  };

  const suggestions = useMemo(() => {
    if (fieldName === 'excluded_services') {
      return [
        'مصاريف التطعيم الشخصية',
        'المشتريات والهدايا الخاصة',
        'استخراج الجواز ورسومه',
        'الوجبات غير المذكورة بالبرنامج',
        'الوزن الزائد للأمتعة',
        'تأمين السفر الخاص الاختياري',
      ];
    }
    if (fieldName === 'included_services') {
      return [
        'تأشيرة العمرة الإلكترونية النسك',
        'تذكرة طيران ذهاباً وإياباً',
        'الإقامة الفندقية بمكة والمدينة',
        'تنقلات بحافلات VIP مكيفة',
        'مزارات مكة المكرمة والمدينة المنورة',
        'مرافقة وتأطير مرشد ديني',
        'إعاشة بوفيه مفتوح',
        'حقيبة سفر وهدايا المعتمر',
      ];
    }
    if (fieldName === 'booking_conditions') {
      return [
        'دفع 30% دفعة أولى لتأكيد الحجز',
        'إرفاق نسخة واضحة من جواز السفر',
        'تسديد كامل المبلغ المتبقي قبل 15 يوماً من الرحلة',
        'صلاحية جواز السفر لا تقل عن 6 أشهر',
        'حضور اللقاء التوجيهي قبل موعد السفر',
      ];
    }
    return [];
  }, [fieldName]);

  const availableSuggestions = suggestions.filter((s) => !items.includes(s));

  return (
    <div className="space-y-2 py-1">
      {/* Existing chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[34px] p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
        {items.length === 0 ? (
          <span className="text-xs text-slate-400 py-0.5 px-2">لا توجد عناصر مضافة بعد — يمكنك الإضافة أدناه</span>
        ) : (
          items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
            >
              <span>{item}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="hover:text-red-600 rounded-full p-0.5 cursor-pointer"
                  title="حذف"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Input row */}
      {!disabled && (
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="اكتب عنصراً ثم اضغط إضافة..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem(inputVal);
              }
            }}
            className="luxury-form-input text-xs flex-1"
          />
          <button
            type="button"
            onClick={() => addItem(inputVal)}
            disabled={!inputVal.trim()}
            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </button>
        </div>
      )}

      {/* Suggestions */}
      {!disabled && availableSuggestions.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <p className="text-[11px] text-slate-500 font-medium">اقتراحات سريعة (انقر للإضافة المباشرة):</p>
          <div className="flex flex-wrap gap-1">
            {availableSuggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => addItem(sug)}
                className="text-[11px] px-2 py-0.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 border border-slate-200 rounded-md transition-colors text-right cursor-pointer"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordSelectWithAdd({
  value,
  options,
  disabled,
  placeholder = '— اختر من القائمة —',
  onChange,
}: {
  value: string;
  options: FieldOption[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (val: string) => void;
}) {
  const isCustomInitially = Boolean(value && !options.some((o) => o.value === value || o.label === value));
  const [isCustomMode, setIsCustomMode] = useState(isCustomInitially);
  const [customText, setCustomText] = useState(value);

  useEffect(() => {
    if (!isCustomMode && value) {
      const match = options.some((o) => o.value === value || o.label === value);
      if (!match) {
        setIsCustomMode(true);
        setCustomText(value);
      }
    }
  }, [value, options, isCustomMode]);

  if (isCustomMode) {
    return (
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={customText}
          disabled={disabled}
          placeholder="اكتب القيمة الجديدة هنا..."
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(e.target.value);
          }}
          className="luxury-form-input text-xs flex-1"
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setIsCustomMode(false);
          }}
          className="px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 shrink-0 font-medium cursor-pointer transition-colors"
          title="الرجوع إلى القائمة"
        >
          اختر من القائمة
        </button>
      </div>
    );
  }

  const selectedValue = options.find((o) => o.value === value || o.label === value)?.value || '';

  return (
    <div className="flex gap-1.5 items-center w-full">
      <select
        value={selectedValue}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '__ADD_NEW__') {
            setIsCustomMode(true);
            setCustomText('');
            onChange('');
          } else {
            onChange(val);
          }
        }}
        className="luxury-form-input record-big-select flex-1 disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="__ADD_NEW__" className="font-bold text-emerald-700 bg-emerald-50">
          ➕ إضافة جديدة / كتابة قيمة أخرى...
        </option>
      </select>
    </div>
  );
}

function PendingApprovalActions({
  userId,
  name,
  defaultRole,
  onDone,
}: {
  userId: string;
  name: string;
  defaultRole?: string;
  onDone: () => void;
}) {
  const [role, setRole] = useState(defaultRole && defaultRole !== 'PILGRIM_USER' ? defaultRole : 'AGENCY_AGENT');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const act = async (status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    setMsg('');
    try {
      const token = typeof window !== 'undefined' ? getAuthToken() : '';
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, status, role }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'تعذر تحديث الحساب');
        return;
      }
      onDone();
    } catch {
      setMsg('تعذر الاتصال');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pending-approval-box">
      <h5>طلب انضمام — {name}</h5>
      <p>عيّن الدور وخيارات البوابة ثم اقبل الحساب. العضو لا يدخل قبل الموافقة.</p>
      <label htmlFor="pending-role">تعيين الصلاحية</label>
      <select
        id="pending-role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        {LOGIN_ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="pending-approval-actions">
        <button type="button" className="btn-pro-primary" disabled={busy} onClick={() => act('APPROVED')}>
          {busy ? 'جاري الحفظ...' : 'قبول'}
        </button>
        <button type="button" className="btn-pro-outline" disabled={busy} onClick={() => act('REJECTED')}>
          رفض
        </button>
      </div>
      {msg ? <p className="pending-approval-msg">{msg}</p> : null}
    </section>
  );
}

interface RecordBigCardProps {
  card: RecordCardModel;
  columns: RecordColumn[];
  tableName: string;
  tableLabel: string;
  onClose: () => void;
  onSaved: (closeCard?: boolean) => void;
  isNew?: boolean;
}

const SKIP_ON_INSERT = new Set([
  'status', 'rating', 'review_count', 'createdAt', 'updatedAt', 'updatedBy',
  'passwordHash', 'usernameHash', 'emailHash', 'codeHash', 'qrSecretHash',
  'pcFingerprint', 'lastLoginIp',
]);

export function RecordBigCard({ card, columns, tableName, tableLabel, onClose, onSaved, isNew = false }: RecordBigCardProps) {
  const [editing, setEditing] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');
  const photoCol = useMemo(() => primaryPhotoColumn(columns.map((c) => c.name)), [columns]);
  const isGallery = photoCol?.toLowerCase() === 'images';
  const [heroIndex, setHeroIndex] = useState(0);

  const initialForm = useMemo(() => {
    const form: Record<string, string> = {};
    for (const col of columns) {
      const v = card.row[col.name];
      form[col.name] = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    if (isNew && tableName === 'packages') {
      if (!form.departure_city) form.departure_city = '16 - الجزائر العاصمة';
      if (!form.departure_airport) form.departure_airport = 'مطار هواري بومدين الدولي - الجزائر';
      if (!form.arrival_airport) form.arrival_airport = 'مطار الملك عبدالعزيز الدولي - جدة';
      if (!form.airline) form.airline = 'الخطوط الجوية الجزائرية';
      if (!form.type) form.type = 'STANDARD';
      if (!form.season_name) form.season_name = 'موسم عمرة 2026';
      if (!form.duration_days) form.duration_days = '15';
      if (!form.capacity) form.capacity = '45';
      if (!form.status) form.status = 'PUBLISHED';
      if (!form.makkah_hotel_name) form.makkah_hotel_name = 'فندق سويس أوتيل مكة (Swissôtel Makkah)';
      if (!form.makkah_hotel_dist) form.makkah_hotel_dist = '50م فقط (دخول مباشر لصحن الحرم عبر مجمع الأبراج)';
      if (!form.madinah_hotel_name) form.madinah_hotel_name = 'فندق بولمان زمزم المدينة المنورة';
      if (!form.madinah_hotel_dist) form.madinah_hotel_dist = 'خطوات معدودة عن المسجد النبوي الشريف';
      if (!form.morshid_name) form.morshid_name = 'الشيخ د. عبد الرحمن النوي';
      if (!form.included_services) {
        form.included_services = JSON.stringify([
          'تأشيرة العمرة الإلكترونية النسك',
          'تذكرة طيران ذهاباً وإياباً',
          'الإقامة بالفنادق المذكورة',
          'تنقلات بحافلات VIP مكيفة',
          'مزارات مكة المكرمة والمدينة المنورة',
          'مرافقة وتأطير مرشد ديني',
        ]);
      }
      if (!form.excluded_services) {
        form.excluded_services = JSON.stringify([
          'مصاريف التطعيم الشخصية',
          'المشتريات والهدايا الخاصة',
        ]);
      }
      if (!form.booking_conditions) {
        form.booking_conditions = JSON.stringify([
          'دفع 30% دفعة أولى لتأكيد الحجز وتقديم نسخة جواز السفر',
          'تسديد كامل المبلغ المتبقي قبل 15 يوماً من موعد الرحلة',
        ]);
      }
      if (!form.cancellation_policy) {
        form.cancellation_policy = 'إلغاء مجاني حتى 20 يوماً قبل موعد السفر، وتطبيق الشروط المعتمدة بعد إصدار التأشيرة.';
      }
    }
    return form;
  }, [card, columns, isNew, tableName]);

  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [agencyMorshids, setAgencyMorshids] = useState<{ id: string; name: string; role: string }[]>([]);
  const [agencyHotels, setAgencyHotels] = useState<{ id: string; name: string; city: string; dist?: string }[]>([]);

  useEffect(() => {
    if (tableName === 'packages') {
      fetch('/api/admin/morshids', { headers: jsonAuthHeaders(), cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAgencyMorshids(
              data.map((m: any) => ({
                id: m.morshid_id || m.id,
                name: m.name,
                role: m.roleName || m.category || '',
              }))
            );
          }
        })
        .catch(() => {});

      fetch('/api/admin/hotels', { headers: jsonAuthHeaders(), cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAgencyHotels(
              data.map((h: any) => ({
                id: h.hotel_id || h.id,
                name: h.name,
                city: h.city || '',
                dist: h.distance_from_haram || '',
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [tableName]);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  useEffect(() => {
    setEditing(isNew);
    setShowTechnical(false);
    setError('');
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPreviewUrl('');
  }, [card.key, isNew]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = useCallback((name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const dirtyFields = useMemo(
    () => columns.filter((c) => form[c.name] !== initialForm[c.name]).map((c) => c.name),
    [columns, form, initialForm]
  );

  const applyImageValue = useCallback(
    (columnName: string, url: string) => {
      let next: string;
      if (columnName.toLowerCase() === 'images') {
        if (!url) next = '[]';
        else {
          const existing = extractImageUrls(form[columnName], columnName);
          next = serializeImageList(mergeImageAsMain(existing, url));
        }
      } else {
        next = url;
      }
      setField(columnName, next);
      return next;
    },
    [form, setField]
  );

  const persistImage = async (columnName: string, url: string) => {
    const stored = applyImageValue(columnName, url);
    if (isNew || !card.keyColumn || card.keyValue == null) return;
    setError('');
    try {
      const res = await fetch('/api/admin/db-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_data',
          tableName,
          keyColumn: card.keyColumn,
          keyValue: card.keyValue,
          rowData: { [columnName]: stored },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSaved(false);
      } else {
        setError(data.error || 'تم رفع الصورة لكن تعذر حفظها في السجل');
      }
    } catch {
      setError('تم رفع الصورة لكن تعذر حفظها في السجل');
    }
  };

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || !photoCol) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    previewUrlRef.current = localUrl;
    setPreviewUrl(localUrl);
    setPhotoBusy(true);
    setError('');
    try {
      const url = await uploadImageFile(file);
      applyImageValue(photoCol, url);
      await persistImage(photoCol, url);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setPreviewUrl('');
    } catch (err) {
      setPreviewUrl('');
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setError(err instanceof Error ? err.message : 'تعذر رفع الصورة');
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  /** Every photo the record owns, plus a local preview while a new file is uploading. */
  const photos = useMemo(() => {
    const urls: string[] = [];
    if (previewUrl) urls.push(previewUrl);
    if (card.image) urls.push(card.image);
    for (const col of columns) {
      if (col.name.toLowerCase() !== 'videos' && (isImageColumnName(col.name) || isImagesArrayColumn(col.name))) {
        urls.push(...extractImageUrls(form[col.name], col.name));
      }
    }
    return Array.from(new Set(urls.filter(Boolean)));
  }, [columns, form, previewUrl, card.image]);

  // Built from the pristine row so the grid doesn't reflow while you type
  const layout = useMemo(
    () => buildDetailLayout(editing ? initialForm : card.row, columns, card.keyColumn, editing ? 'edit' : 'view', tableName),
    [editing, initialForm, card.row, card.keyColumn, columns, tableName]
  );

  const renderField = useCallback(
    (field: DetailField) => {
      if (tableName === 'hotels' && field.name === 'status') {
        const on = String(form[field.name] || 'ACTIVE').toUpperCase() !== 'INACTIVE';
        return (
          <div key={field.name} className={`record-big-field ${editing ? 'is-editing' : ''}`}>
            <dt>الظهور</dt>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={!editing}
              className={`hotel-switch ${on ? 'is-on' : ''}`}
              onClick={() => setField(field.name, on ? 'INACTIVE' : 'ACTIVE')}
            >
              <span className="hotel-switch-knob" />
              <span>{on ? 'ظاهر' : 'مخفي'}</span>
            </button>
          </div>
        );
      }

      if (tableName === 'hotels' && field.name === 'services') {
        return (
          <div key={field.name} className={`record-big-field field-full ${editing ? 'is-editing' : ''}`}>
            <dt>الخدمات</dt>
            <HotelServicesField
              value={form[field.name] ?? field.text}
              readOnly={!editing}
              onChange={editing ? (next) => setField(field.name, next) : undefined}
            />
          </div>
        );
      }

      if (field.name === 'videos') {
        return (
          <div key={field.name} className={`record-big-field field-full ${editing ? 'is-editing' : ''}`}>
            <dt>الفيديو</dt>
            <HotelVideosField
              value={form[field.name] ?? field.text}
              readOnly={!editing}
              onChange={editing ? (next) => setField(field.name, next) : undefined}
            />
          </div>
        );
      }

      if (!editing) {
        if (field.name === 'rating') {
          return (
            <div key={field.name} className={`record-big-field ${field.full ? 'field-full' : ''}`}>
              <dt>{field.label}</dt>
              <dd><StarRating value={Number(field.text) || 0} readOnly showValue /></dd>
            </div>
          );
        }
        return (
          <div key={field.name} className={`record-big-field ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <DetailValue field={field} />
          </div>
        );
      }

      const value = form[field.name] ?? '';
      const selectOptions = getFieldSelectOptions(field.name, tableName);

      if (field.name === 'rating') {
        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <div className="space-y-1">
              <StarRating value={Number(value) || 0} readOnly showValue />
              <p className="text-[11px] text-slate-500">يُحسب تلقائياً من تقييمات المعتمرين المعتمدة. لا يُعدّل يدوياً.</p>
            </div>
          </div>
        );
      }

      if (isListTagField(field.name)) {
        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <RecordListEditor
              value={value}
              fieldName={field.name}
              disabled={field.isKey}
              onChange={(next) => setField(field.name, next)}
            />
          </div>
        );
      }

      if (isDateField(field.name)) {
        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <input
              type="date"
              value={formatDateForInput(value)}
              disabled={field.isKey}
              onChange={(e) => setField(field.name, e.target.value)}
              className="luxury-form-input disabled:opacity-60"
            />
          </div>
        );
      }

      if (field.name === 'morshid_name' && tableName === 'packages') {
        const morshidOptions: FieldOption[] = agencyMorshids.length > 0
          ? agencyMorshids.map((m) => ({
              value: m.name,
              label: `${m.name}${m.role ? ` (${m.role})` : ''}`,
            }))
          : [
              { value: 'الشيخ د. عبد الرحمن النوي', label: 'الشيخ د. عبد الرحمن النوي (مرشد ديني أول)' },
              { value: 'الشيخ محمد الطيب', label: 'الشيخ محمد الطيب (مرشد المناسك والمزارات)' },
              { value: 'الأستاذ فاروق بوزيد', label: 'الأستاذ فاروق بوزيد (مرشد ميداني وقائد مجموعات)' },
              { value: 'الشيخ ياسين العلي', label: 'الشيخ ياسين العلي (مرشد التوجيه الروحي)' },
              { value: 'الأستاذة مريم', label: 'الأستاذة مريم (مرشدة شؤون النساء)' },
              { value: 'الأستاذة عائشة الجزائري', label: 'الأستاذة عائشة الجزائري (مرشدة التوجيه)' },
            ];

        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <RecordSelectWithAdd
              value={value}
              options={morshidOptions}
              disabled={field.isKey}
              placeholder="— اختر مرشداً من طاقم الوكالة —"
              onChange={(val) => {
                setField(field.name, val);
                const found = agencyMorshids.find((m) => m.name === val);
                if (found && columns.some((c) => c.name === 'morshid_id')) {
                  setField('morshid_id', found.id);
                }
              }}
            />
          </div>
        );
      }

      if ((field.name === 'makkah_hotel_name' || field.name === 'madinah_hotel_name') && tableName === 'packages') {
        const isMakkah = field.name === 'makkah_hotel_name';
        const cityKey = isMakkah ? 'MAKKAH' : 'MADINAH';
        const staticList = isMakkah ? MAKKAH_HOTEL_OPTIONS : MADINAH_HOTEL_OPTIONS;
        const dynamicList: FieldOption[] = agencyHotels
          .filter((h) => !h.city || h.city.toUpperCase().includes(cityKey))
          .map((h) => ({
            value: h.name,
            label: `${h.name}${h.dist ? ` (${h.dist})` : ''}`,
          }));
        const hotelOptions = [...dynamicList];
        for (const opt of staticList) {
          if (!hotelOptions.some((o) => o.value === opt.value)) {
            hotelOptions.push(opt);
          }
        }

        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <RecordSelectWithAdd
              value={value}
              options={hotelOptions}
              disabled={field.isKey}
              placeholder={isMakkah ? '— اختر فندق مكة المكرمة —' : '— اختر فندق المدينة المنورة —'}
              onChange={(val) => {
                setField(field.name, val);
                const found = agencyHotels.find((h) => h.name === val);
                if (found) {
                  const idCol = isMakkah ? 'makkah_hotel_id' : 'madinah_hotel_id';
                  const distCol = isMakkah ? 'makkah_hotel_dist' : 'madinah_hotel_dist';
                  if (found.id && columns.some((c) => c.name === idCol)) setField(idCol, found.id);
                  if (found.dist && columns.some((c) => c.name === distCol)) setField(distCol, found.dist);
                }
              }}
            />
          </div>
        );
      }

      if ((field.name === 'departure_city' || field.name === 'airline') && tableName === 'packages' && selectOptions) {
        return (
          <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
            <dt>{field.label}</dt>
            <RecordSelectWithAdd
              value={value}
              options={selectOptions}
              disabled={field.isKey}
              placeholder={field.name === 'departure_city' ? '— اختر ولاية المغادرة (69 ولاية) —' : '— اختر شركة الطيران —'}
              onChange={(val) => setField(field.name, val)}
            />
          </div>
        );
      }

      return (
        <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
          <dt>
            {field.label}
            {field.isKey && <span className="record-big-key-tag">معرّف — غير قابل للتعديل</span>}
          </dt>
          {field.kind === 'media' ? (
            field.name.toLowerCase() === 'images' ? (
              <RecordImagesGalleryField value={value} onChange={(json) => setField(field.name, json)} />
            ) : (
              <ImageUploadField
                value={extractImageUrls(value, field.name)[0] || value}
                onChange={(url) => applyImageValue(field.name, url)}
              />
            )
          ) : isMultiSelectField(field.name) ? (
            <RecordMultiSelect
              value={value}
              fieldName={field.name}
              tableName={tableName}
              disabled={field.isKey}
              onChange={(next) => setField(field.name, next)}
            />
          ) : selectOptions ? (
            <select
              value={value}
              disabled={field.isKey}
              onChange={(e) => setField(field.name, e.target.value)}
              className="luxury-form-input record-big-select disabled:opacity-60"
            >
              {!value && <option value="">— اختر —</option>}
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.kind === 'longtext' ? (
            <textarea
              rows={2}
              value={value}
              disabled={field.isKey}
              onChange={(e) => setField(field.name, e.target.value)}
              className="luxury-form-input record-big-textarea resize-none leading-relaxed disabled:opacity-60"
            />
          ) : (
            <input
              type="text"
              value={value}
              disabled={field.isKey}
              dir={field.kind === 'ltr' ? 'ltr' : undefined}
              onChange={(e) => setField(field.name, e.target.value)}
              className="luxury-form-input disabled:opacity-60"
            />
          )}
        </div>
      );
    },
    [editing, form, setField, applyImageValue, tableName, agencyMorshids, agencyHotels, columns]
  );

  const heroMeta = useMemo(() => {
    const pills: { text: string; ltr?: boolean; star?: boolean }[] = [];
    const phone = isNew ? (form.phone || '') : card.phone;
    if (phone) pills.push({ text: phone, ltr: true });
    if (!isNew && card.rating) {
      const n = Number(String(card.rating).replace(/[^\d.]/g, ''));
      pills.push({ text: Number.isFinite(n) ? String(n) : card.rating.replace('★ ', ''), star: true });
    }
    return pills;
  }, [card, form.phone, isNew]);

  const waitingApproval = !isNew && isPendingStatus(card.row.status);
  const displayTitle = isNew
    ? (form.name || form.title_ar || form.packageName || form.agency_name || '').trim() || 'إضافة جديد'
    : card.title;
  const displaySubtitle = isNew
    ? (form.roleName || '').trim() || card.subtitle
    : card.subtitle;

  const save = async () => {
    if (isNew) {
      const payload: Record<string, string> = {};
      for (const col of columns) {
        if (SKIP_ON_INSERT.has(col.name)) continue;
        if (tableName === 'morshids' && col.name === 'status') continue;
        const value = form[col.name];
        if (value == null || String(value).trim() === '') continue;
        payload[col.name] = String(value);
      }
      if (card.keyColumn && card.keyValue != null && !payload[card.keyColumn]) {
        payload[card.keyColumn] = String(card.keyValue);
      }
      if (!payload.name && columns.some((c) => c.name === 'name')) {
        setError('الاسم مطلوب');
        return;
      }
      if (tableName === 'morshids') {
        payload.rating = '0';
        if (columns.some((c) => c.name === 'review_count')) payload.review_count = '0';
      }

      setSaving(true);
      setError('');
      try {
        const res = await fetch('/api/admin/db-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'insert_data',
            tableName,
            rowData: payload,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          onSaved(true);
        } else {
          setError(data.error || 'فشل إضافة السجل');
        }
      } catch {
        setError('تعذر الاتصال بالخادم');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!card.keyColumn || card.keyValue == null) {
      setError('لا يمكن تعديل هذا السطر لعدم وجود معرّف أساسي');
      return;
    }
    if (dirtyFields.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = {};
      dirtyFields.forEach((n) => {
        if (n === 'rating' && tableName === 'morshids') return;
        if (n === 'status' && tableName === 'morshids') return;
        payload[n] = form[n];
      });
      if (Object.keys(payload).length === 0) {
        setEditing(false);
        return;
      }

      const res = await fetch('/api/admin/db-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_data',
          tableName,
          keyColumn: card.keyColumn,
          keyValue: card.keyValue,
          rowData: payload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditing(false);
        onSaved();
      } else {
        setError(data.error || 'فشل حفظ التعديلات');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const visiblePrimary = useMemo(
    () => layout.primary.filter((f) => {
      if (f.name.toLowerCase() === 'images') return false;
      if (editing && f.kind === 'media' && f.name.toLowerCase() !== 'videos') return false;
      if (isNew && (f.name === 'rating' || f.name === 'review_count')) return false;
      return true;
    }),
    [editing, layout.primary, isNew]
  );

  const galleryUrls = useMemo(
    () => (isGallery && photoCol ? extractImageUrls(form[photoCol], photoCol) : []),
    [isGallery, photoCol, form]
  );
  const heroPhotos = isGallery ? galleryUrls : photos;

  return (
    <div className="fixed inset-0 z-[350] luxury-modal-overlay flex items-center justify-center p-3 sm:p-6 font-tajawal">
      <div className={`record-big-card ${editing ? 'is-editing' : ''}`}>
        <div className="record-big-stage">
          <div className="record-big-bg">
            <RecordPhotoSlider
              photos={heroPhotos}
              initial={card.initial}
              index={isGallery ? heroIndex : undefined}
              onIndex={isGallery ? setHeroIndex : undefined}
            />
          </div>

          {isGallery && heroPhotos.length > 0 && heroIndex === 0 ? (
            <span className="record-hero-main-badge">الصورة الرئيسية</span>
          ) : null}

          {photoCol && !editing && !isGallery && (
            <label className={`record-big-photo-btn ${photoBusy ? 'opacity-65' : ''}`}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={photoBusy}
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
              />
              {photoBusy ? 'جاري الرفع...' : photoCol?.toLowerCase() === 'images' ? 'تغيير الرئيسية' : 'تغيير الصورة'}
            </label>
          )}

          <button type="button" onClick={onClose} className="record-big-close" aria-label="رجوع إلى البطاقات" title="رجوع إلى البطاقات">
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="record-big-identity">
            <div className="record-big-identity-text">
              <span className="record-big-eyebrow">{isNew ? 'إضافة جديد' : tableLabel}</span>
              <h3 className="record-big-title">{displayTitle}</h3>
              {displaySubtitle && displaySubtitle !== displayTitle && (
                <p className="record-big-subtitle">{displaySubtitle}</p>
              )}
              {heroMeta.length > 0 && (
                <div className="record-big-metas">
                  {heroMeta.map((pill, i) => (
                    <span key={i} className="record-big-meta-pill" dir={pill.ltr ? 'ltr' : undefined}>
                      {pill.star ? (
                        <StarRating value={Number(pill.text) || 0} readOnly size="sm" showValue />
                      ) : (
                        pill.text
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isGallery ? (
          <aside className="record-big-photo-flyin" aria-hidden={!editing}>
            <div className="record-big-photo-flyin-frame">
              {photos[0] ? (
                <img src={photos[0]} alt="" className="record-big-photo-full" />
              ) : (
                <div className="record-big-photo-empty">{card.initial}</div>
              )}
            </div>
            {photoCol && editing && (
              <label className={`record-big-photo-edit-btn ${photoBusy ? 'is-busy' : ''}`}>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                />
                {photoBusy ? 'جاري الرفع...' : photoCol?.toLowerCase() === 'images' ? 'تغيير الرئيسية' : 'تغيير الصورة'}
              </label>
            )}
          </aside>
          ) : null}
        </div>

        <div className="record-big-sheet">
        <div className="record-big-toolbar">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            {isNew ? (
              <span className="text-emerald-main font-semibold">إضافة عضو جديد — املأ البيانات ثم احفظ</span>
            ) : editing ? (
              <span className="text-emerald-main font-semibold">
                وضع التعديل — {dirtyFields.length > 0 ? `${dirtyFields.length} حقل معدّل` : 'لا تغييرات بعد'}
              </span>
            ) : (
              <button type="button" onClick={onClose} className="hover:text-slate-800 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> رجوع إلى البطاقات
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isNew || editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isNew) {
                      onClose();
                      return;
                    }
                    setForm(initialForm);
                    setEditing(false);
                    setError('');
                  }}
                  className="btn-pro-outline text-[13px] py-1.5 px-3 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> إلغاء
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="btn-pro-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isNew ? <Plus className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {isNew ? 'إضافة جديد' : 'حفظ التعديلات'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-pro-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> تعديل البيانات
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="record-big-error">{error}</div>
        )}

        <div className="record-big-body luxury-table-scroll">
          {isGallery && photoCol ? (
            <div className="record-gallery-panel">
              <RecordImagesGalleryField
                value={String(form[photoCol] ?? '')}
                readOnly={!editing}
                activeIndex={heroIndex}
                onSelect={setHeroIndex}
                onChange={editing ? (json) => setField(photoCol, json) : undefined}
              />
            </div>
          ) : null}
          {waitingApproval && tableName === 'users' && String(card.row.id || card.keyValue || '') && (
            <PendingApprovalActions
              userId={String(card.row.id || card.keyValue)}
              name={card.title}
              defaultRole={String(card.row.role || form.role || '')}
              onDone={() => onSaved(true)}
            />
          )}
          {tableName === 'hotels' ? (
            <HotelLocationField
              latitude={form.latitude || ''}
              longitude={form.longitude || ''}
              city={form.city || ''}
              readOnly={!editing}
              onChange={editing ? (lat, lng) => {
                setField('latitude', lat);
                setField('longitude', lng);
              } : undefined}
            />
          ) : null}
          <div className="record-big-grid">{visiblePrimary.map(renderField)}</div>

          {tableName === 'packages' && (
            <PackageOfferingsPanel packageId={isNew ? null : String(card.keyValue || '')} />
          )}

          {(tableName === 'morshids' || tableName === 'users') && !isNew && !waitingApproval && card.keyValue != null && (
            <LoginCredentialsPanel
              tableName={tableName}
              recordId={String(card.keyValue)}
              personName={card.title}
            />
          )}

          {tableName === 'morshids' && !isNew && card.keyValue != null && (
            <div className="mt-4">
              <ReviewsModerator staffId={String(card.keyValue)} title="تقييمات هذا العضو — موافقة الإدارة قبل النشر" />
            </div>
          )}

          {!isNew && tableName !== 'hotels' && layout.secondary.length > 0 && (
            <section className="record-big-more">
              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                className="record-big-disclosure"
                aria-expanded={showTechnical}
              >
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
                {showTechnical
                  ? 'إخفاء الحقول التقنية'
                  : `حقول تقنية وبيانات فارغة (${layout.secondary.length})`}
              </button>

              {showTechnical && (
                <div className="record-big-grid mt-2.5">{layout.secondary.map(renderField)}</div>
              )}
            </section>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
