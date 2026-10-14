'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Floating always-on-top call window (Document Picture-in-Picture: Chrome / Edge
 * on Windows, macOS and Linux, including the installed app). The page's styles
 * are copied in so React can render the mini call card there through a portal.
 */
type DocPip = { window: Window | null; requestWindow: (o: { width: number; height: number }) => Promise<Window> };

const docPip = (): DocPip | null =>
  typeof window !== 'undefined' ? ((window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture ?? null) : null;

function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      target.head.appendChild(style);
    } catch {
      // Cross-origin sheet: link it instead.
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
  const base = target.createElement('style');
  base.textContent = 'html,body{margin:0;height:100%;background:#0b1f19;overflow:hidden}';
  target.head.appendChild(base);
}

export function usePipWindow() {
  const [supported, setSupported] = useState(false);
  const [win, setWin] = useState<Window | null>(null);
  const winRef = useRef<Window | null>(null);

  useEffect(() => setSupported(Boolean(docPip())), []);

  /** Must run from a user gesture (or the browser's own auto-PiP action). */
  const open = useCallback(async (): Promise<Window | null> => {
    const api = docPip();
    if (!api) return null;
    if (api.window) return api.window;
    try {
      const w = await api.requestWindow({ width: 360, height: 96 });
      copyStyles(w.document);
      w.document.documentElement.className = document.documentElement.className;
      w.document.documentElement.lang = 'ar';
      w.document.documentElement.dir = 'rtl';
      w.document.body.className = document.body.className;
      w.document.title = 'مكالمة — South Street Connect';
      w.addEventListener('pagehide', () => {
        if (winRef.current === w) {
          winRef.current = null;
          setWin(null);
        }
      });
      winRef.current = w;
      setWin(w);
      return w;
    } catch {
      return null;
    }
  }, []);

  const close = useCallback(() => {
    const w = winRef.current;
    winRef.current = null;
    setWin(null);
    w?.close();
  }, []);

  return { supported, win, open, close };
}
