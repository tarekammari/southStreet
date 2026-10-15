import { NextResponse } from 'next/server';
import { NATIVE_RELEASES } from '@/lib/connect/version';

export const dynamic = 'force-dynamic';

/** Public: the newest Android / Windows app (asked by the apps) and the deployed web build. */
export async function GET() {
  return NextResponse.json({ ...NATIVE_RELEASES, web: process.env.APP_VERSION || '' }, { headers: { 'Cache-Control': 'no-store' } });
}
