import { NextResponse } from 'next/server';
import { getGoogleClientId } from '@/lib/google-auth-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    googleClientId: getGoogleClientId(),
  });
}
