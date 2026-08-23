'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff, Phone, Pencil, Save, RotateCcw, Loader2, ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight, Plus, Briefcase, Landmark, Calculator,
  Users, Ban,
} from 'lucide-react';
import { buildRecordCard, RecordCardModel, RecordColumn } from '@/lib/record-card';
import { extractImageUrls, isImageColumnName, isImagesArrayColumn, primaryPhotoColumn } from '@/lib/table-cell-utils';
import { buildDetailLayout, DetailField, parseChips } from '@/lib/record-detail-layout';
import {
  getFieldSelectOptions,
  isMultiSelectField,
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
import LoginCredentialsPanel from '@/components/LoginCredentialsPanel';
import ReviewsModerator from '@/components/ReviewsModerator';
import { StarRating } from '@/components/StarRating';

const RecordCard = memo(function RecordCard({
  card,
  selected,
  onSelect,
  variant = 'staff',
}: {
  card: RecordCardModel;
  selected: boolean;
  onSelect: (card: RecordCardModel) => void;
  variant?: 'staff' | 'account';
}) {
  const [failed, setFailed] = useState(false);
  const showImage = card.image && !failed;
  const username = String(card.row.username || '');
  const email = String(card.row.email || '');
  const roleName = String(card.row.roleName || card.row.role || '');

  return (
    <button type="button" onClick={() => onSelect(card)} className={`record-card ${variant === 'account' ? 'is-account' : ''} ${selected ? 'is-selected' : ''}`}>
      <div className="record-card-media">
        {isPendingStatus(card.row.status) ? (
          <span className="record-card-pending">بانتظار الموافقة</span>
        ) : isBlockedStatus(card.row.status) ? (
          <span className="record-card-blocked">موقوف أو مرفوض</span>
        ) : null}
        {showImage ? (
          <img
            src={card.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="record-card-initial">{card.initial}</span>
        )}
      </div>

      <div className="record-card-body">
        <h4 className="record-card-title">{card.title}</h4>

        {variant === 'account' ? (
          <>
            {username ? <p className="record-card-meta" dir="ltr">@{username}</p> : null}
            {email ? <p className="record-card-meta" dir="ltr">{email}</p> : null}
            {roleName ? <p className="record-card-meta">{roleName}</p> : null}
          </>
        ) : (
          <>
            {card.phone && (
              <p className="record-card-meta">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span dir="ltr">{card.phone}</span>
              </p>
            )}
            {card.rating && (
              <div className="record-card-rating">
                <StarRating
                  value={Number(String(card.rating).replace(/[^\d.]/g, '')) || 0}
                  readOnly
                  size="sm"
                  showValue
                />
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
});

const STAFF_GROUP_ICON = {
  admin: Briefcase,
  guides: Landmark,
  accountant: Calculator,
  blocked: Ban,
} as const;

const ACCOUNT_GROUP_ICON = {
  pilgrims: Users,
  blocked: Ban,
} as const;

const CHUNK = 36;

interface RecordCardGridProps {
  rows: Record<string, unknown>[];
  columns: RecordColumn[];
  search: string;
  selectedKey: string | null;
  onSelect: (card: RecordCardModel) => void;
  tableName?: string;
}

export function RecordCardGrid({ rows, columns, search, selectedKey, onSelect, tableName }: RecordCardGridProps) {
  const [visible, setVisible] = useState(CHUNK);
  const [openStaffGroup, setOpenStaffGroup] = useState<StaffViewGroupId | null>(null);
  const [openAccountGroup, setOpenAccountGroup] = useState<AccountViewGroupId | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const allCards = useMemo(() => rows.map((row, i) => buildRecordCard(row, columns, i)), [rows, columns]);

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allCards.filter((c) => c.search.includes(q)) : allCards;
  }, [allCards, search]);

  useEffect(() => setVisible(CHUNK), [allCards, search]);
  useEffect(() => {
    setOpenStaffGroup(null);
    setOpenAccountGroup(tableName === 'users' ? 'pilgrims' : null);
  }, [tableName, rows]);

  useEffect(() => {
    if (visible >= cards.length) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => Math.min(v + CHUNK, cards.length));
      },
      { rootMargin: '400px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 gap-3">
        <ImageOff className="w-10 h-10 opacity-50" />
        <p className="text-base">لا توجد نتائج</p>
      </div>
    );
  }

  if (tableName === 'morshids') {
    const groups = STAFF_VIEW_GROUPS.map((group) => ({
      ...group,
      cards: cards.filter((card) => staffViewGroup(card.row) === group.id),
    }));

    return (
      <div className="staff-album-board">
        {groups.map((group) => {
          const Icon = STAFF_GROUP_ICON[group.id];
          const open = openStaffGroup === group.id;
          return (
            <section key={group.id} className={`staff-album ${open ? 'is-open' : ''} ${group.id === 'blocked' ? 'is-blocked' : ''}`}>
              <button
                type="button"
                className="staff-album-cover"
                aria-expanded={open}
                onClick={() => setOpenStaffGroup(open ? null : group.id)}
              >
                <span className="staff-album-icon" aria-hidden>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="staff-album-cover-copy">
                  <h4>{group.label}</h4>
                  <p>{group.hint}</p>
                </div>
                <span className="staff-album-count">
                  {group.cards.length} {group.cards.length === 1 ? 'عضو' : 'أعضاء'}
                </span>
                <ChevronDown className="staff-album-chevron" aria-hidden />
              </button>
              <div className="staff-album-panel">
                <div className="staff-album-panel-inner">
                  <div className="staff-album-list">
                    {group.cards.length === 0 ? (
                      <p className="staff-album-empty">لا يوجد أعضاء في هذا التصنيف بعد</p>
                    ) : (
                      group.cards.map((card) => (
                        <RecordCard
                          key={card.key}
                          card={card}
                          selected={card.key === selectedKey}
                          onSelect={onSelect}
                          variant="staff"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  if (tableName === 'users') {
    const groups = ACCOUNT_VIEW_GROUPS.map((group) => ({
      ...group,
      cards: cards.filter((card) => accountViewGroup(card.row) === group.id),
    }));

    return (
      <div className="staff-album-board is-accounts">
        {groups.map((group) => {
          const Icon = ACCOUNT_GROUP_ICON[group.id];
          const open = openAccountGroup === group.id;
          const unit = group.cards.length === 1 ? 'حساب' : 'حسابات';
          return (
            <section key={group.id} className={`staff-album is-account ${open ? 'is-open' : ''} ${group.id === 'blocked' ? 'is-blocked' : ''}`}>
              <button
                type="button"
                className="staff-album-cover"
                aria-expanded={open}
                onClick={() => setOpenAccountGroup(open ? null : group.id)}
              >
                <span className="staff-album-icon" aria-hidden>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="staff-album-cover-copy">
                  <h4>{group.label}</h4>
                  <p>{group.hint}</p>
                </div>
                <span className="staff-album-count">
                  {group.cards.length} {unit}
                </span>
                <ChevronDown className="staff-album-chevron" aria-hidden />
              </button>
              <div className="staff-album-panel">
                <div className="staff-album-panel-inner">
                  <div className="staff-album-list">
                    {group.cards.length === 0 ? (
                      <p className="staff-album-empty">لا توجد حسابات في هذا التصنيف بعد</p>
                    ) : (
                      group.cards.map((card) => (
                        <RecordCard
                          key={card.key}
                          card={card}
                          selected={card.key === selectedKey}
                          onSelect={onSelect}
                          variant="account"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="record-card-grid-wrap">
      <div className="record-card-grid">
        {cards.slice(0, visible).map((card) => (
          <RecordCard key={card.key} card={card} selected={card.key === selectedKey} onSelect={onSelect} />
        ))}
      </div>

      {visible < cards.length && (
        <div ref={sentinelRef} className="py-5 text-center text-sm text-slate-400">
          {visible} من {cards.length}
        </div>
      )}
    </div>
  );
}

/** Swipeable hero gallery: arrows, dots and a counter, RTL-aware. */
function RecordPhotoSlider({
  photos,
  initial,
}: {
  photos: string[];
  initial: string;
}) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<string, true>>({});
  const touchStartX = useRef<number | null>(null);
  const visible = useMemo(() => photos.filter((url) => url && !broken[url]), [photos, broken]);
  const count = visible.length;

  useEffect(() => setIndex(0), [photos.join('|')]);

  const go = useCallback(
    (delta: number) => setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
    [count]
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
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, role }),
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

  const initialForm = useMemo(() => {
    const form: Record<string, string> = {};
    for (const col of columns) {
      const v = card.row[col.name];
      form[col.name] = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return form;
  }, [card, columns]);

  const [form, setForm] = useState<Record<string, string>>(initialForm);

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

  const applyImageValue = useCallback((columnName: string, url: string) => {
    const next = columnName.toLowerCase() === 'images' ? (url ? JSON.stringify([url]) : '[]') : url;
    setField(columnName, next);
    return next;
  }, [setField]);

  const persistImage = async (columnName: string, url: string) => {
    applyImageValue(columnName, url);
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
          rowData: { [columnName]: applyImageValue(columnName, url) },
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
      if (isImageColumnName(col.name) || isImagesArrayColumn(col.name)) {
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

      return (
        <div key={field.name} className={`record-big-field is-editing ${field.full ? 'field-full' : ''}`}>
          <dt>
            {field.label}
            {field.isKey && <span className="record-big-key-tag">معرّف — غير قابل للتعديل</span>}
          </dt>
          {field.kind === 'media' ? (
            <ImageUploadField
              value={extractImageUrls(value, field.name)[0] || value}
              onChange={(url) => applyImageValue(field.name, url)}
            />
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
    [editing, form, setField, applyImageValue, tableName]
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
      if (editing && f.kind === 'media') return false;
      if (isNew && (f.name === 'rating' || f.name === 'review_count')) return false;
      return true;
    }),
    [editing, layout.primary, isNew]
  );

  return (
    <div className="fixed inset-0 z-[350] luxury-modal-overlay flex items-center justify-center p-3 sm:p-6 font-tajawal">
      <div className={`record-big-card ${editing ? 'is-editing' : ''}`}>
        <div className="record-big-stage">
          <div className="record-big-bg">
            <RecordPhotoSlider photos={photos} initial={card.initial} />
          </div>

          {photoCol && !editing && (
            <label className={`record-big-photo-btn ${photoBusy ? 'opacity-65' : ''}`}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={photoBusy}
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
              />
              {photoBusy ? 'جاري الرفع...' : 'تغيير الصورة'}
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
                {photoBusy ? 'جاري الرفع...' : 'تغيير الصورة'}
              </label>
            )}
          </aside>
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
          {waitingApproval && tableName === 'users' && String(card.row.id || card.keyValue || '') && (
            <PendingApprovalActions
              userId={String(card.row.id || card.keyValue)}
              name={card.title}
              defaultRole={String(card.row.role || form.role || '')}
              onDone={() => onSaved(true)}
            />
          )}
          <div className="record-big-grid">{visiblePrimary.map(renderField)}</div>

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

          {!isNew && layout.secondary.length > 0 && (
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
