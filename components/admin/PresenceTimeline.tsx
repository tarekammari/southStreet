'use client';

import React from 'react';
import { PRESENCE_LABELS, type Presence } from '@/lib/user-access-view';

const STEPS: Presence[] = ['connected', 'inactive', 'offline'];

export default function PresenceTimeline({
  presence,
  compact = false,
}: {
  presence: Presence;
  compact?: boolean;
}) {
  return (
    <div className={`ts-tl${compact ? ' is-compact' : ''} is-${presence}`} aria-label={PRESENCE_LABELS[presence]}>
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          {i > 0 ? <span className={`ts-tl-wire${STEPS.indexOf(presence) >= i ? ' is-on' : ''}`} /> : null}
          <span className={`ts-tl-step is-${step}${presence === step ? ' is-current' : ''}`}>
            <i />
            {compact ? null : <em>{PRESENCE_LABELS[step]}</em>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
