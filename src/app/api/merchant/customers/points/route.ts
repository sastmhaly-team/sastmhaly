import { NextRequest, NextResponse } from 'next/server';
import { updateCustomerLoyaltyPoints } from '@/lib/db/supabase-queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, customerId, pointsDelta, reason } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const delta = Number(pointsDelta);
    if (isNaN(delta) || delta === 0) {
      return NextResponse.json({ error: 'Valid points delta is required' }, { status: 400 });
    }

    const result = await updateCustomerLoyaltyPoints(tenantId, customerId, delta, reason);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update loyalty points';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

