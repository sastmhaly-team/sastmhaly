import { NextRequest, NextResponse } from 'next/server';
import { getStockTransfers, createStockTransfer, receiveStockTransfer } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

  try {
    const transfers = await getStockTransfers(tenantId);
    return NextResponse.json({ transfers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, transferId, receivedBy, ...createData } = body;
    const tenantId = createData.tenant_id || 'tenant_albaraka';

    if (action === 'receive') {
      await receiveStockTransfer(tenantId, transferId, receivedBy || 'admin');
      return NextResponse.json({ success: true, message: 'Transfer received and stock added to destination branch.' });
    }

    const transfer = await createStockTransfer(tenantId, createData);
    return NextResponse.json({ success: true, transfer });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Transfer operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
