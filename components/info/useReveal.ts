'use client';

import { useEffect } from 'react';

/**
 * Fades in every `.ip-reveal` element of the page once it scrolls into view,
 * including elements rendered later (data that loads after the page).
 */
export function useReveal() {
  useEffect(() => {
    // No scroll events in a background tab / preview: never leave content invisible.
    if (!('IntersectionObserver' in window) || document.visibilityState === 'hidden') {
      const showAll = () => document.querySelectorAll('.ip-reveal').forEach((el) => el.classList.add('is-in'));
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll('.ip-reveal:not(.is-in)').forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}
