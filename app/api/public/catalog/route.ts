import { NextRequest, NextResponse } from 'next/server';
import { GET as packagesGET } from '@/app/api/admin/packages/route';
import { GET as hotelsGET } from '@/app/api/admin/hotels/route';
import { GET as staffGET } from '@/app/api/admin/morshids/route';
import { GET as contentGET } from '@/app/api/admin/content/route';
import { GET as agencyGET } from '@/app/api/agency-info/route';
import { GET as reviewsGET } from '@/app/api/reviews/route';

export const dynamic = 'force-dynamic';

/**
 * Everything the public pages show, in one response that Vercel's edge caches
 * (CDN-Cache-Control): visitors get it from a server near them in milliseconds,
 * without a cold start or a database round trip. Refreshed every 60 s in the
 * background (a visitor never waits: an old copy, up to a day, is served while
 * the new one is prepared). Each part comes from the same handler as before, called as an
 * anonymous visitor, so nothing private can end up here.
 * Admins viewing the site add ?t=… to bypass the cache and see edits at once.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const anon = (path: string) => new NextRequest(new URL(path, origin), { headers: { 'user-agent': 'south-street-catalog' } });
  const json = async (res: Response | Promise<Response>) => {
    try {
      const r = await res;
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };

  const [packages, hotels, staff, content, agency, reviews] = await Promise.all([
    json((packagesGET as (r: Request) => Promise<Response>)(anon('/api/admin/packages'))),
    json(hotelsGET(anon('/api/admin/hotels?site=1'))),
    json(staffGET(anon('/api/admin/morshids'))),
    json(contentGET(anon('/api/admin/content'))),
    json((agencyGET as () => Promise<Response>)()),
    json(reviewsGET(anon('/api/reviews?targetType=agency&targetId=main&limit=8'))),
  ]);

  const body = {
    packages: Array.isArray(packages) ? packages : [],
    hotels: Array.isArray(hotels) ? hotels : [],
    staff: Array.isArray(staff) ? staff : [],
    content: Array.isArray(content) ? content : [],
    agency: agency && typeof agency === 'object' ? agency : {},
    reviews: reviews && typeof reviews === 'object' ? reviews : { summary: null, reviews: [] },
    generatedAt: new Date().toISOString(),
  };

  const complete = [packages, hotels, staff, content].every(Array.isArray);
  return NextResponse.json(body, {
    headers: complete
      ? {
          // Browsers always ask again; the CDN answers from its copy.
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=86400',
        }
      : { 'Cache-Control': 'no-store' }, // a partial answer must never be cached
  });
}
