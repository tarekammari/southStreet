'use client';

import React from 'react';
import {
  JOURNEY_STEPS,
  journeyIndex,
  type EnrichedUser,
} from '@/lib/user-access-view';

export default function UserJourney({
  user,
  compact = false,
}: {
  user: EnrichedUser;
  compact?: boolean;
}) {
  const current = journeyIndex(user);

  return (
    <div
      className={`inq-track-bar${compact ? ' is-compact' : ''}`}
      aria-label={JOURNEY_STEPS[current]?.label}
    >
      {JOURNEY_STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          {i > 0 ? (
            <span className={`inq-track-wire${current >= i ? ' is-on' : ''}`} />
          ) : null}
          <span
            className={`inq-track-node${i <= current ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
          >
            <i />
            {compact ? null : <em>{step.label}</em>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
