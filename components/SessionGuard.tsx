'use client';

import { useEffect } from 'react';
import { syncSessionProfile } from '@/lib/client-session';
import { authHeaders, getAuthToken, apiFetch, jsonAuthHeaders } from '@/lib/api-client';

export default function SessionGuard() {
  useEffect(() => {
    void syncSessionProfile();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'south_street_token' && event.key !== 'south_street_user') return;
      if (!getAuthToken()) {
        window.location.reload();
      }
    };
    // A tab left open for hours may outlive its session; re-check on return.
    let lastCheck = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      void syncSessionProfile();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
