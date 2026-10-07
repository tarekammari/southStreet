'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';

export default function WishlistHeart({
  packageId,
  className = '',
}: {
  packageId: string;
  className?: string;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isWishlisted(packageId));
    const sync = () => setOn(isWishlisted(packageId));
    window.addEventListener('southstreet:wishlist-updated', sync);
    return () => window.removeEventListener('southstreet:wishlist-updated', sync);
  }, [packageId]);

  return (
    <button
      type="button"
      className={`wishlist-heart${on ? ' is-on' : ''} ${className}`.trim()}
      aria-pressed={on}
      aria-label={on ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = toggleWishlist(packageId);
        setOn(next.includes(packageId));
      }}
    >
      <Heart className="w-4 h-4" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
