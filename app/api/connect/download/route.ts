import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { jwtSecret } from '@/lib/auth';
import { connectSession } from '@/lib/connect/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The Connect apps are only for people with an account: the files are served
 * here, to a signed-in session, never publicly (nginx keeps /downloads/ internal).
 *   GET  ?platform=android|windows          download (signed in)
 *   GET  ?platform=…&t=<link token>         download from a link made below (15 min)
 *   POST {platform} (signed in)             such a link — for old apps that download in the browser
 */
const FILES = { android: 'SouthStreetConnect.apk', windows: 'SouthStreetConnect-Setup.exe' } as const;
type Platform = keyof typeof FILES;
const TYPES: Record<Platform, string> = { android: 'application/vnd.android.package-archive', windows: 'application/octet-stream' };
const LINK_ISSUER = 'south-street-download';

const dir = () => process.env.CONNECT_DOWNLOADS_DIR?.trim() || '/var/www/connect-downloads';
const platformOf = (v: unknown): Platform | null => (v === 'android' || v === 'windows' ? v : null);

function validLink(token: string, platform: Platform): boolean {
  try {
    const p = jwt.verify(token, jwtSecret(), { issuer: LINK_ISSUER }) as { dl?: string };
    return p.dl === platform;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const platform = platformOf(req.nextUrl.searchParams.get('platform'));
  if (!platform) return NextResponse.json({ error: 'منصة غير معروفة' }, { status: 400 });
  const token = req.nextUrl.searchParams.get('t');
  if (!(token && validLink(token, platform))) {
    const s = connectSession(req);
    if ('error' in s) {
      // A person in the browser: sign in first, then the download page.
      if ((req.headers.get('accept') || '').includes('text/html')) return NextResponse.redirect(new URL('/app?login=1', req.url));
      return s.error;
    }
  }
  const file = path.join(dir(), FILES[platform]);
  let size = 0;
  try {
    size = fs.statSync(file).size;
  } catch {
    return NextResponse.json({ error: 'الملف غير متوفر حالياً' }, { status: 404 });
  }
  const body = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
  return new Response(body, {
    headers: {
      'Content-Type': TYPES[platform],
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${FILES[platform]}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(req: NextRequest) {
  const s = connectSession(req);
  if ('error' in s) return s.error;
  const body = await req.json().catch(() => ({}));
  const platform = platformOf(body.platform);
  if (!platform) return NextResponse.json({ error: 'منصة غير معروفة' }, { status: 400 });
  const t = jwt.sign({ dl: platform, sub: s.me.id }, jwtSecret(), { expiresIn: '15m', issuer: LINK_ISSUER });
  return NextResponse.json({ url: `/api/connect/download?platform=${platform}&t=${encodeURIComponent(t)}` });
}
