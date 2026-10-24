import { NextRequest, NextResponse } from 'next/server';
import { hotelDetail } from '@/lib/hotels/engine';
import { hotelError, noStore, searchFromParams, viewerOf } from '@/lib/hotels/http';

export const dynamic = 'force-dynamic';

/** One hotel with the room offers for the dates and guests in the query. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { staff } = viewerOf(req);
    const search = searchFromParams(new URL(req.url).searchParams);
    return NextResponse.json({ hotel: hotelDetail(decodeURIComponent(id), search, { staff }), staff }, { headers: noStore });
  } catch (err) {
    return hotelError(err);
  }
}
