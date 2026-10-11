'use client';

import { useEffect, useState } from 'react';
import { EMPTY_SOCIAL, type SocialLinks } from '@/lib/social';

export type AgencyInfo = Partial<Record<
  'agency_name' | 'legal_name' | 'description' | 'address' | 'city' | 'country' | 'phone' | 'whatsapp' | 'email' | 'website' | 'opening_hours',
  string
>> & { social: SocialLinks };

let cache: Promise<AgencyInfo> | null = null;

/** Public agency contact card + social links, fetched once per page load. */
export function loadAgencyInfo(): Promise<AgencyInfo> {
  cache ||= fetch('/api/agency-info', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => ({ ...d, social: { ...EMPTY_SOCIAL, ...(d?.social || {}) } }))
    .catch(() => ({ social: EMPTY_SOCIAL }));
  return cache;
}

export function useAgencyInfo(): AgencyInfo | null {
  const [info, setInfo] = useState<AgencyInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void loadAgencyInfo().then((d) => alive && setInfo(d));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}
