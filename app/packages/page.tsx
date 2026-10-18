'use client';

import ProgramCatalog from '@/components/catalog/ProgramCatalog';

/** Umrah and Hajj programs; tourist trips live on /trips (same catalog component). */
export default function PackagesPage() {
  return <ProgramCatalog kind="religious" />;
}
