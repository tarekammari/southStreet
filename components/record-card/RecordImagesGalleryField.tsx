'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, ImagePlus, Loader2, Star, Trash2, ChevronRight, ChevronLeft, Replace } from 'lucide-react';
import { extractImageUrls, serializeImageList } from '@/lib/table-cell-utils';
import { uploadImageFile } from '@/components/ImageUploadField';

type Props = {
  value: string;
  onChange?: (json: string) => void;
  readOnly?: boolean;
  activeIndex?: number;
  onSelect?: (index: number) => void;
};

export default function RecordImagesGalleryField({ value, onChange, readOnly = false, activeIndex = 0, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceAt = useRef<number | null>(null);
  const [items, setItems] = useState<string[]>(() => extractImageUrls(value, 'images'));
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(extractImageUrls(value, 'images'));
  }, [value]);

  const commit = useCallback(
    (next: string[]) => {
      setItems(next);
      onChange?.(serializeImageList(next));
    },
    [onChange]
  );

  const uploadFiles = async (files: FileList | File[] | null | undefined) => {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
      if (!list.length) throw new Error('يرجى اختيار ملفات صورة');
      const urls: string[] = [];
      for (const file of list) {
        urls.push(await uploadImageFile(file));
      }
      commit([...items, ...urls.filter((u) => !items.includes(u))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الصور');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const setMain = (index: number) => {
    if (index <= 0 || index >= items.length) return;
    const next = [...items];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    commit(next);
  };

  const removeAt = (index: number) => {
    commit(items.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
  };

  const replaceWithFile = async (file: File | undefined) => {
    const index = replaceAt.current;
    replaceAt.current = null;
    if (!file || index == null || index < 0 || index >= items.length) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      const next = [...items];
      next[index] = url;
      commit(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استبدال الصورة');
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const onDropReorder = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    commit(next);
  };

  return (
    <div className="record-gallery">
      <p className="record-gallery-hint">
        {readOnly
          ? 'الصورة ذات الشارة هي الرئيسية. اختر أي صورة لعرضها في الأعلى.'
          : 'الصورة الأولى هي الرئيسية. يمكنك إضافة صور، استبدال أي صورة، أو سحبها لإعادة الترتيب.'}
      </p>
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void replaceWithFile(e.target.files?.[0])}
      />

      <div className="record-gallery-grid">
        {items.map((url, index) => (
          <article
            key={`${url}-${index}`}
            className={`record-gallery-tile ${index === 0 ? 'is-main' : ''} ${index === activeIndex ? 'is-active' : ''} ${dragIndex === index ? 'is-dragging' : ''}`}
            onClick={() => onSelect?.(index)}
            draggable={!readOnly}
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropReorder(index);
            }}
          >
            <img src={url} alt="" loading="lazy" decoding="async" />
            {index === 0 ? (
              <span className="record-gallery-main-badge">
                <Star className="w-3 h-3 fill-current" aria-hidden />
                رئيسية
              </span>
            ) : !readOnly ? (
              <button type="button" className="record-gallery-set-main" onClick={(e) => { e.stopPropagation(); setMain(index); }}>
                اجعلها رئيسية
              </button>
            ) : null}
            {!readOnly ? (
            <div className="record-gallery-tile-actions">
              <span className="record-gallery-grip" aria-hidden>
                <GripVertical className="w-4 h-4" />
              </span>
              <button type="button" className="record-gallery-icon" onClick={() => move(index, -1)} aria-label="تحريك لليمين">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button type="button" className="record-gallery-icon" onClick={() => move(index, 1)} aria-label="تحريك لليسار">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="record-gallery-icon"
                aria-label="استبدال"
                onClick={(e) => {
                  e.stopPropagation();
                  replaceAt.current = index;
                  replaceRef.current?.click();
                }}
              >
                <Replace className="w-4 h-4" />
              </button>
              <button type="button" className="record-gallery-icon is-danger" onClick={(e) => { e.stopPropagation(); removeAt(index); }} aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            ) : null}
          </article>
        ))}

        {!readOnly ? (
        <label
          className={`record-gallery-add ${dragOver ? 'is-dragover' : ''} ${uploading ? 'is-busy' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin text-emerald-main" />
              <span>جاري الرفع…</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-7 h-7 text-emerald-main" />
              <span>إضافة صور</span>
              <span className="record-gallery-add-sub">اسحب هنا أو اختر عدة ملفات</span>
            </>
          )}
        </label>
        ) : null}
      </div>

      {error ? <p className="record-gallery-error">{error}</p> : null}
      {items.length === 0 && !uploading ? (
        <p className="record-gallery-empty">لا صور بعد — أضف على الأقل صورة رئيسية للفندق.</p>
      ) : null}
    </div>
  );
}
