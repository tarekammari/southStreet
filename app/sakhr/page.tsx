import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { agencyLabel } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

export function generateMetadata(): Metadata {
  return {
    title: `تحدّث مع ${getBrand().assistant_name || 'صخر'}`,
    description: `${getBrand().assistant_name || 'صخر'}، المساعد الذكي لـ${agencyLabel(getBrand())}: أسئلة البرامج والأسعار والحجز ودليل العمرة، على مدار الساعة.`,
  };
}

/**
 * Short link for the agency's WhatsApp greeting / social bios:
 * /sakhr opens the home page with Sakhr's chat already open.
 * /sakhr?q=… also types the question (sent when the visitor presses send).
 */
export default async function SakhrLink({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const out = new URLSearchParams({ sakhr: '1' });
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && (key === 'q' || key.startsWith('utm_'))) out.set(key, value.slice(0, 500));
  }
  if (!out.has('utm_source')) out.set('utm_source', 'whatsapp');
  redirect(`/?${out.toString()}`);
}
