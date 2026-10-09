'use client';

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';

type Health = { version?: string; commit?: string; deployedAt?: string };

/** "الإصدار 2.1.0 · a1b2c3d · نُشر 8 أكتوبر" — what is running right now. */
export default function AppVersionBadge() {
  const [info, setInfo] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  if (!info?.version) return null;
  const deployed = info.deployedAt
    ? new Date(info.deployedAt).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return (
    <p
      className="inn-side-label"
      style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 12px 4px', fontSize: 11.5, color: 'var(--inn-text-muted)' }}
      title={info.commit ? `commit ${info.commit}` : undefined}
    >
      <Tag className="w-3.5 h-3.5" />
      <span>
        الإصدار <b dir="ltr" style={{ color: 'var(--inn-text-secondary)' }}>v{info.version}</b>
        {info.commit ? <span dir="ltr"> · {info.commit}</span> : null}
        {deployed ? ` · نُشر ${deployed}` : ''}
      </span>
    </p>
  );
}
