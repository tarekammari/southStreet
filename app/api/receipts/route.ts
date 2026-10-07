import { NextRequest, NextResponse } from 'next/server';
import { dbGetReceipts, dbSaveReceipt, dbLogAudit } from '@/lib/db';
import { Receipt } from '@/types';
import { verifyToken } from '@/lib/auth';
import { getTokenFromRequest } from '@/lib/request-auth';
import { normalizeLoginRole } from '@/lib/roles';
import { requireRole, ADMINS, SUPER_ONLY } from '@/lib/staff-gate';

const RECEIPT_ROLES = new Set(['ACCOUNTANT', 'SUPER_ADMIN', 'AGENCY_MANAGER']);

function requireReceiptAccess(req: NextRequest) {
  return requireRole(req, ['ACCOUNTANT', 'SUPER_ADMIN', 'AGENCY_MANAGER']);
}

export async function GET(req: NextRequest) {
  const gate = requireReceiptAccess(req);
  if ('error' in gate) return gate.error;
  const receipts = dbGetReceipts();
  return NextResponse.json(receipts);
}

export async function POST(req: NextRequest) {
  try {
    const gate = requireReceiptAccess(req);
    if ('error' in gate) return gate.error;
    const body: Receipt = await req.json();
    if (!body.id || !body.pilgrimName || !body.totalAmount) {
      return NextResponse.json({ error: 'بيانات السند غير مكتملة' }, { status: 400 });
    }
    const saved = dbSaveReceipt(body);
    dbLogAudit(body.accountantName, 'accountant', 'إصدار سند قبض رقمي', `سند رقم ${body.id} للمعتمر ${body.pilgrimName}`);
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: 'فشل حفظ السند الرقمي' }, { status: 500 });
  }
}
