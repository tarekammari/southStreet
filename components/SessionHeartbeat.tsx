'use client';

import { useEffect } from 'react';

/**
 * Reports presence for the signed-in user so the admin dashboard can tell who is
 * actually connected instead of guessing from the last login timestamp.
 */
export default function SessionHeartbeat({ intervalMs = 45000 }: { intervalMs?: number }) {
  useEffect(() => {
    const beat = () => {
      const token = localStorage.getItem('south_street_token');
      if (!token) return;
      fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };

    beat();
    const id = window.setInterval(beat, intervalMs);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return null;
}
