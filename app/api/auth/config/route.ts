import { NextResponse } from 'next/server';
import { getGoogleClientId } from '@/lib/google-auth-config';
import { onlineCardPayEnabled, requireAdminApprovalForNewUsers } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    googleClientId: getGoogleClientId(),
    onlineCardPayEnabled: onlineCardPayEnabled(),
    requireAdminApprovalForNewUsers: requireAdminApprovalForNewUsers(),
  });
}
