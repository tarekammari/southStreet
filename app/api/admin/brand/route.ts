import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireRole, SUPER_ONLY } from '@/lib/staff-gate';
import { readBrandFromDb, saveBrand } from '@/lib/brand-server';

export const dynamic = 'force-dynamic';

/** «هوية الوكالة»: the agency's brand, edited by the Super Admin only. */

export async function GET(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    return NextResponse.json(readBrandFromDb(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Fields of the brand (only those sent change), `social`, and `knowledge` from an imported profile. */
export async function PUT(req: NextRequest) {
  const gate = requireRole(req, SUPER_ONLY);
  if ('error' in gate) return gate.error;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const brand = saveBrand(body);
    return NextResponse.json({ success: true, brand, message: 'تم حفظ هوية الوكالة' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
