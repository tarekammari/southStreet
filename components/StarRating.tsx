'use client';

import React from 'react';
import { Star } from 'lucide-react';

export function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  showValue = false,
}: {
  value: number;
  onChange?: (stars: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const px = size === 'lg' ? 22 : size === 'sm' ? 14 : 18;

  return (
    <div className="star-rating" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, clamped - (star - 1)));
        const button = (
          <span className="star-rating-slot" style={{ width: px, height: px }}>
            <Star className="star-rating-ghost" width={px} height={px} />
            <span className="star-rating-fill" style={{ width: `${fill * 100}%` }}>
              <Star className="star-rating-gold" width={px} height={px} />
            </span>
          </span>
        );

        if (readOnly || !onChange) {
          return <span key={star}>{button}</span>;
        }

        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} نجوم`}
            onClick={() => onChange(star)}
            className={`star-rating-btn ${clamped >= star ? 'is-active' : ''}`}
          >
            {button}
          </button>
        );
      })}
      {showValue && (
        <span className="star-rating-number">{clamped ? clamped.toFixed(1).replace(/\.0$/, '') : '—'}</span>
      )}
    </div>
  );
}
