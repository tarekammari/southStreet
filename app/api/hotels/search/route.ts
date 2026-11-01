import { NextRequest, NextResponse } from 'next/server';
import { searchHotels } from '@/lib/hotels/engine';
import { hotelError, noStore, searchFromParams, viewerOf } from '@/lib/hotels/http';

export const dynamic = 'force-dynamic';

/** ?dest=TR|city|name&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&rooms=2-0,2-1:7 */
export async function GET(req: NextRequest) {
  try {
    const { staff } = viewerOf(req);
    const search = searchFromParams(new URL(req.url).searchParams);
    return NextResponse.json({ hotels: searchHotels(search, { staff }), staff }, { headers: noStore });
  } catch (err) {
    return hotelError(err);
  }
}
