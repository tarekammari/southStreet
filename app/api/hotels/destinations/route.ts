import { NextRequest, NextResponse } from 'next/server';
import { destinationSuggestions } from '@/lib/hotels/engine';
import { hotelError, noStore, viewerOf } from '@/lib/hotels/http';

export const dynamic = 'force-dynamic';

/** Search-box suggestions: countries, cities and hotel names. */
export async function GET(req: NextRequest) {
  try {
    const q = String(new URL(req.url).searchParams.get('q') || '').slice(0, 60);
    return NextResponse.json({ suggestions: destinationSuggestions(q, { staff: viewerOf(req).staff }) }, { headers: noStore });
  } catch (err) {
    return hotelError(err);
  }
}
