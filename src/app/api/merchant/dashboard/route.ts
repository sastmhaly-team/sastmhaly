import { NextRequest, NextResponse } from 'next/server';
import { getMerchantDashboardKpis } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const kpis = getMerchantDashboardKpis(tenantId, branchId);
    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Failed to get dashboard kpis', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
