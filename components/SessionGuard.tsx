'use client';

import { useEffect } from 'react';
import { syncSessionProfile } from '@/lib/client-session';

export default function SessionGuard() {
  useEffect(() => {
    void syncSessionProfile();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'south_street_token' && event.key !== 'south_street_user') return;
      if (!localStorage.getItem('south_street_token')) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}
