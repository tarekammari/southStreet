'use client';

import {
  Car,
  Droplets,
  FileCheck,
  Moon,
  Plane,
  Accessibility,
  Shield,
  UserRound,
} from 'lucide-react';
import { authHeaders, getAuthToken } from '@/lib/api-client';

export const STEPS = [
  { id: 1, label: 'الباقة' },
  { id: 2, label: 'اختيارك' },
  { id: 3, label: 'بياناتك' },
  { id: 4, label: 'الفاتورة' },
];

export type ViewId = 'offer' | 'packages' | 'room' | 'extra' | 'details' | 'invoice';

export const EXTRA_ICONS: Record<string, typeof FileCheck> = {
  visa_fast: FileCheck,
  private_transfer: Car,
  zamzam: Droplets,
  insurance: Shield,
  extra_night: Moon,
  wheelchair: Accessibility,
};

export function RoomPeople({ count }: { count: number }) {
  return (
    <span className="book-people" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <UserRound key={i} className="book-person" strokeWidth={2.25} />
      ))}
    </span>
  );
}

export function isAvailablePackage(pkg: { status?: string; published?: boolean }): boolean {
  const status = String(pkg.status || '').toUpperCase();
  if (status === 'UPCOMING' || status === 'DRAFT' || status === 'CLOSED' || status === 'FULL') return false;
  return pkg.published !== false && (status === 'PUBLISHED' || status === 'OPEN' || status === 'CURRENT' || !status);
}

export function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' });
}

export function money(n: number): string {
  return `${n.toLocaleString('ar-DZ')} دج`;
}


export function phaseOf(view: ViewId): number {
  if (view === 'offer' || view === 'packages') return 1;
  if (view === 'room' || view === 'extra') return 2;
  if (view === 'details') return 3;
  return 4;
}

export function PriceFocus({
  amount,
  from,
  extrasCount,
}: {
  amount: number;
  from: boolean;
  extrasCount: number;
}) {
  return (
    <aside className="book-price-focus" aria-live="polite">
      <span className="book-price-label">{from ? 'السعر يبدأ من' : 'سعرك الآن'}</span>
      <strong key={amount} className="book-price-amount book-price-pop">{money(amount)}</strong>
      <span className="book-price-hint">
        {extrasCount > 0 ? `${extrasCount} إضافات ضمن السعر` : 'يتغيّر عند اختيار الغرفة أو إضافة'}
      </span>
    </aside>
  );
}

export function PriceBar({ amount }: { amount: number }) {
  return (
    <aside className="book-price-bar" aria-live="polite">
      <span>سعرك الآن</span>
      <strong key={amount} className="book-price-pop">{money(amount)}</strong>
    </aside>
  );
}

