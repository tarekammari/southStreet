import { NextResponse } from 'next/server';
import { getBrand } from '@/lib/brand-server';

export const dynamic = 'force-dynamic';

/**
 * Public card of the agency: its brand (name, logo, colour, address, phones…)
 * and social links. Read by the footer, the About page and useAgencyInfo().
 */
export async function GET() {
  try {
    const { configured: _configured, ...brand } = getBrand();
    return NextResponse.json(brand, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
