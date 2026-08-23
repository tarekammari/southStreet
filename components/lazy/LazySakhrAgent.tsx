'use client';

import dynamic from 'next/dynamic';

/**
 * Sakhar is a floating widget that is never part of the first paint, so it is
 * split out of the page bundle and fetched after hydration.
 */
const LazySakhrAgent = dynamic(() => import('@/components/SakhrAgent'), { ssr: false });

export default LazySakhrAgent;
