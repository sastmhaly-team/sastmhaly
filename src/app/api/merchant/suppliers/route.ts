import { NextRequest, NextResponse } from 'next/server';
import { getSuppliers, createSupplier } from '@/lib/db/supabase-queries';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

  try {
    const suppliers = await getSuppliers(tenantId);
    return NextResponse.json({ suppliers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, supplier_id, payment_amount, payment_method, tenant_id, ...supplierData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (action === 'payment') {
      // Record payment against supplier balance
      const payAmount = Number(payment_amount);
      const { data: sup } = await supabase.from('suppliers').select('current_balance').eq('id', supplier_id).single();
      const currentBal = Number(sup?.current_balance) || 0;
      await supabase.from('suppliers').update({ current_balance: currentBal - payAmount }).eq('id', supplier_id);
      await supabase.from('supplier_payments').insert({
        id: `spay_${Date.now()}`,
        tenant_id: tenantId,
        supplier_id,
        payment_number: `PAY-SUP-${Date.now().toString().slice(-6)}`,
        amount: payAmount,
        payment_method: payment_method || 'cash',
        created_by: 'admin'
      });
      return NextResponse.json({ success: true, message: 'Supplier payment recorded and payable balance updated.' });
    }

    const supplier = await createSupplier(tenantId, supplierData);
    return NextResponse.json({ success: true, supplier });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Supplier operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
