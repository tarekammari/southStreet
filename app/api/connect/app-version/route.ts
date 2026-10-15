import { NextResponse } from 'next/server';
import { NATIVE_RELEASES } from '@/lib/connect/version';

export const dynamic = 'force-dynamic';

/** Public: the newest Android / Windows app, asked by the apps when they open. */
export async function GET() {
  return NextResponse.json(NATIVE_RELEASES, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
