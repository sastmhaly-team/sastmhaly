import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseOrders, createPurchaseOrder, receivePurchaseOrderGoods } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const purchaseOrders = await getPurchaseOrders(tenantId, branchId);
    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, poId, receivedBy, ...createData } = body;
    const tenantId = createData.tenant_id || 'tenant_albaraka';

    if (action === 'receive') {
      await receivePurchaseOrderGoods(tenantId, poId, receivedBy || 'admin');
      return NextResponse.json({ success: true, message: 'Goods received, inventory increased, and supplier balance updated.' });
    }

    const po = await createPurchaseOrder(tenantId, createData);
    return NextResponse.json({ success: true, purchaseOrder: po });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Purchasing operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
