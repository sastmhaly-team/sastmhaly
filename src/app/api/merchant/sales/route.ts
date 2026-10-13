import { NextRequest, NextResponse } from 'next/server';
import { getSales, getSale, processSaleReturn, getTenantSettings } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const saleId = searchParams.get('saleId');
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const { tenant, settings } = getTenantSettings(tenantId);

    if (saleId) {
      const sale = getSale(tenantId, saleId);
      return NextResponse.json({ sale, tenant, settings });
    }

    const sales = getSales(tenantId, { branchId, limit: 100 });
    return NextResponse.json({ sales, tenant, settings });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, saleId, refundAmount, refundMethod, restock, reason, createdBy, items } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (action === 'return') {
      const result = processSaleReturn(tenantId, {
        saleId,
        refundAmount: Number(refundAmount),
        refundMethod: refundMethod || 'cash',
        restock: Boolean(restock),
        reason: reason || 'Customer requested return',
        createdBy: createdBy || 'cashier',
        items
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Sale operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
