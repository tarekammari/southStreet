'use client';

import React, { useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|heic|heif)$/i;

export async function uploadImageFile(file: File): Promise<string> {
  const hasImageType = file.type.startsWith('image/');
  const hasImageExt = IMAGE_EXT.test(file.name || '');
  if (!hasImageType && !hasImageExt) {
    throw new Error('يرجى اختيار ملف صورة');
  }

  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'فشل الرفع');
  }
  return data.url as string;
}

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUploadField({ value, onChange, label }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الصورة');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-[11px] text-slate-500">{label}</p>}

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative block rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-emerald-main bg-emerald-soft/50'
            : 'border-slate-200 bg-slate-50 hover:border-emerald-main/40 hover:bg-white'
        } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-main" />
            <span className="text-xs">جاري الرفع...</span>
          </div>
        ) : value ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={value}
              alt=""
              className="w-24 h-24 rounded-xl object-cover border border-slate-200 shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-xs font-medium text-slate-700">اختيار من الجهاز</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-slate-500">
            <p className="text-xs font-medium text-slate-700">اختيار من الجهاز</p>
            <p className="text-[10px] text-slate-400">PNG · JPG · WebP</p>
          </div>
        )}
      </label>

      {value && !uploading && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(''); }}
          className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1"
        >
          <X className="w-3 h-3" /> إزالة الصورة
        </button>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="أو الصق رابط الصورة..."
        className="luxury-form-input text-[11px] font-mono dir-ltr text-left"
        dir="ltr"
      />
    </div>
  );
}
