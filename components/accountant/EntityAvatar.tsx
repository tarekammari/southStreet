'use client';

import type { ReactNode } from 'react';
import { DEFAULT_USER_PHOTO, isImageSource } from '@/lib/user-access-view';
import { initialsFromName, supplierAvatarTone } from '@/lib/entity-avatar-display';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = { xs: 28, sm: 36, md: 44, lg: 56 };

export default function EntityAvatar({
  name,
  imageUrl,
  size = 'sm',
  category,
  variant = 'supplier',
  className = '',
}: {
  name: string;
  imageUrl?: string | null;
  size?: Size;
  category?: string | null;
  variant?: 'supplier' | 'client';
  className?: string;
}) {
  const px = SIZE_PX[size];
  const src = String(imageUrl || '').trim();
  const photoSrc = isImageSource(src) ? src : variant === 'client' ? DEFAULT_USER_PHOTO : '';
  const tone = supplierAvatarTone(category);
  const initials = initialsFromName(name);

  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt=""
        width={px}
        height={px}
        className={`acct-entity-avatar shrink-0 object-cover ${className}`}
        style={{ width: px, height: px }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`acct-entity-avatar acct-entity-avatar-fallback shrink-0 ${className}`}
      style={{ width: px, height: px, background: tone }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function EntityNameCell({
  name,
  imageUrl,
  category,
  meta,
  variant = 'supplier',
}: {
  name: string;
  imageUrl?: string | null;
  category?: string | null;
  meta?: ReactNode;
  variant?: 'supplier' | 'client';
}) {
  return (
    <span className="acct-entity-cell">
      <EntityAvatar name={name} imageUrl={imageUrl} category={category} size="sm" variant={variant} />
      <span className="min-w-0">
        <span className="font-bold truncate block leading-snug">{name}</span>
        {meta ? <span className="block text-[11px] opacity-65 leading-tight mt-0.5">{meta}</span> : null}
      </span>
    </span>
  );
}
