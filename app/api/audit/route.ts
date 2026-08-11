import { NextRequest, NextResponse } from 'next/server';
import { dbGetAuditLogs } from '@/lib/db';

export async function GET(req: NextRequest) {
  const logs = dbGetAuditLogs();
  return NextResponse.json(logs);
}
