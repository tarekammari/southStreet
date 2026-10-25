import type { Metadata } from 'next';
import { destinationOf } from '@/lib/tour';
import { brandPageMeta } from '@/lib/brand-meta';
import { getBrand } from '@/lib/brand-server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const dest = destinationOf(String(id).toUpperCase());
  if (!dest) return { title: 'الوجهات' };
  return brandPageMeta(getBrand(), {
    title: `${dest.label} — رحلات وفنادق`,
    description: `رحلات الوكالة المنظّمة إلى ${dest.label}، مدنها (${dest.cities.slice(0, 4).join('، ')}) وفنادقها مع الغرف والأسعار بالدينار.`,
    path: `/destinations/${dest.id}`,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
