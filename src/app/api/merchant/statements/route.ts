import { NextRequest, NextResponse } from 'next/server';
import { getAccountStatement } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const entityType = (searchParams.get('type') || 'customer') as 'customer' | 'supplier';
  const entityId = searchParams.get('id');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  if (!entityId) {
    return NextResponse.json({ error: 'entity id is required' }, { status: 400 });
  }

  try {
    const statement = await getAccountStatement(tenantId, entityType, entityId, startDate, endDate);
    return NextResponse.json({ success: true, statement });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch statement';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

