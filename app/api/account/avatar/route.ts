import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/request-auth';
import { getSqliteDb } from '@/lib/sqlite';
import { isImageSource } from '@/lib/user-access-view';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth) {
    return new NextResponse(null, { status: 401 });
  }

  const db = getSqliteDb();
  const row = db.prepare('SELECT avatar FROM users WHERE id = ?').get(auth.id) as { avatar?: string } | undefined;
  const avatar = String(row?.avatar || '').trim();
  if (!isImageSource(avatar)) {
    return new NextResponse(null, { status: 404 });
  }

  if (avatar.startsWith('/')) {
    return NextResponse.redirect(new URL(avatar, req.url));
  }
  if (avatar.startsWith('data:image')) {
    const comma = avatar.indexOf(',');
    if (comma < 0) return new NextResponse(null, { status: 404 });
    const meta = avatar.slice(5, comma);
    const payload = avatar.slice(comma + 1);
    const isBase64 = /;base64/i.test(meta);
    const mime = meta.split(';')[0] || 'image/png';
    const buf = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  try {
    const upstream = await fetch(avatar, {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'SouthStreetAgency/1.0',
      },
      cache: 'force-cache',
    });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
