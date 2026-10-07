'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Minus, Plus, Printer } from 'lucide-react';

const MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } } as const;

function isolatePage(fullHtml: string, pageIndex: number): { html: string; orient: 'portrait' | 'landscape' } | null {
  const doc = new DOMParser().parseFromString(fullHtml, 'text/html');
  const pages = [...doc.querySelectorAll('.print-page')];
  const page = pages[pageIndex];
  if (!page) return null;
  const orient = page.getAttribute('data-orient') === 'landscape' ? 'landscape' : 'portrait';
  pages.forEach((node, i) => {
    if (i !== pageIndex) node.remove();
  });
  const style = doc.querySelector('style')?.outerHTML || '';
  const links = [...doc.querySelectorAll('link')].map((l) => l.outerHTML).join('');
  return {
    orient,
    html: `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />${links}${style}</head><body>${page.outerHTML}</body></html>`,
  };
}

export default function DocumentPrintViewer({
  fetchUrl,
  title,
  subtitle,
  onBack,
  autoPrint,
}: {
  fetchUrl: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  autoPrint?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const viewFrame = useRef<HTMLIFrameElement>(null);
  const printFrame = useRef<HTMLIFrameElement>(null);
  const [fullHtml, setFullHtml] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [fitScale, setFitScale] = useState(0.72);
  const [zoom, setZoom] = useState(1);
  const scale = fitScale * zoom;

  const isolated = useMemo(() => (fullHtml ? isolatePage(fullHtml, page - 1) : null), [fullHtml, page]);
  const orient = isolated?.orient || 'portrait';
  const size = MM[orient];

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pad = 36;
    const availW = Math.max(280, stage.clientWidth - pad);
    const availH = Math.max(320, window.innerHeight - 168);
    const pxW = (size.w / 25.4) * 96;
    const pxH = (size.h / 25.4) * 96;
    setFitScale(Math.min(availW / pxW, availH / pxH, 1));
  }, [size.h, size.w]);

  useEffect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(2.8, Math.max(0.75, +(z + (e.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fullHtml]);

  const printHtml = useCallback((html: string) => {
    const frame = printFrame.current;
    if (!frame) return;
    frame.srcdoc = html;
    const onLoad = () => {
      frame.removeEventListener('load', onLoad);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    };
    frame.addEventListener('load', onLoad);
  }, []);

  const printCurrent = () => {
    if (isolated) printHtml(isolated.html);
  };

  const printAll = useCallback(() => {
    if (fullHtml) printHtml(fullHtml);
  }, [fullHtml, printHtml]);

  useEffect(() => {
    setError('');
    setFullHtml('');
    setPage(1);
    fetch(fetchUrl, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'تعذّر تحميل الوثيقة');
        }
        return res.text();
      })
      .then((content) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        setPageCount(Math.max(1, doc.querySelectorAll('.print-page').length));
        setFullHtml(content);
      })
      .catch((err) => setError(err.message || 'تعذّر تحميل الوثيقة'));
  }, [fetchUrl]);

  useEffect(() => {
    if (!fullHtml || !autoPrint) return;
    const t = window.setTimeout(() => printAll(), 500);
    return () => window.clearTimeout(t);
  }, [fullHtml, autoPrint, printAll]);

  if (error) {
    return (
      <div className="print-error" dir="rtl">
        {error}
      </div>
    );
  }

  if (!fullHtml || !isolated) {
    return (
      <div className="print-loading" dir="rtl">
        <Loader2 className="w-5 h-5 animate-spin" />
        جاري تحضير الصفحات…
      </div>
    );
  }

  const pxW = (size.w / 25.4) * 96;
  const pxH = (size.h / 25.4) * 96;

  return (
    <div className="print-viewer print-viewer-pro" dir="rtl">
      <header className="print-toolbar no-print">
        <div className="print-toolbar-start">
          <button type="button" className="print-toolbar-btn" onClick={onBack}>
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
        </div>
        <div className="print-toolbar-center">
          <div className="print-toolbar-title">{title}</div>
          {subtitle ? <div className="print-toolbar-sub">{subtitle}</div> : null}
        </div>
        <div className="print-toolbar-end">
          <div className="print-page-nav" aria-label="تكبير الصفحة">
            <button
              type="button"
              className="print-toolbar-btn print-toolbar-btn-icon"
              onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
              aria-label="تصغير"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="print-toolbar-btn print-toolbar-btn-icon"
              onClick={() => setZoom(1)}
              aria-label="الملاءمة"
            >
              <span className="print-zoom-label tabular-nums">{Math.round(zoom * 100)}%</span>
            </button>
            <button
              type="button"
              className="print-toolbar-btn print-toolbar-btn-icon"
              onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.15).toFixed(2)))}
              aria-label="تكبير"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="print-page-nav">
            <button
              type="button"
              className="print-toolbar-btn print-toolbar-btn-icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="print-page-indicator">
              صفحة {page} / {pageCount}
              <span className="print-orient-tag">{orient === 'landscape' ? 'أفقي' : 'عمودي'}</span>
            </span>
            <button
              type="button"
              className="print-toolbar-btn print-toolbar-btn-icon"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <button type="button" className="print-toolbar-btn" onClick={printCurrent}>
            <Printer className="w-4 h-4" />
            طباعة هذه الصفحة
          </button>
          <button type="button" className="print-toolbar-btn print-toolbar-btn-primary" onClick={printAll}>
            <Printer className="w-4 h-4" />
            طباعة الكل
          </button>
        </div>
      </header>

      <main ref={stageRef} className="print-stage print-stage-pro">
        <div
          className="print-sheet-scale"
          style={{ width: pxW * scale, height: pxH * scale }}
        >
          <iframe
            ref={viewFrame}
            title={`${title} — صفحة ${page}`}
            className="print-sheet-frame print-one-page"
            srcDoc={isolated.html}
            style={{
              width: pxW,
              height: pxH,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </main>
      <iframe ref={printFrame} title="print" className="print-hidden-frame" />
    </div>
  );
}
