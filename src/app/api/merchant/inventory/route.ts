import { NextRequest, NextResponse } from 'next/server';
import { getInventoryBalances, getInventoryMovements } from '@/lib/db/supabase-queries';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const balances = await getInventoryBalances(tenantId, branchId);
    const movements = await getInventoryMovements(tenantId, { branchId, limit: 100 });
    return NextResponse.json({ balances, movements });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, branch_id, product_id, adjustment_type, quantity, unit_cost, notes, user_id } = body;

    const tenantId = tenant_id || 'tenant_albaraka';
    const adjQty = Number(quantity);

    const { data: ib } = await supabase.from('inventory_balances').select('quantity').eq('branch_id', branch_id).eq('product_id', product_id).single();
    if (ib) {
      await supabase.from('inventory_balances').update({
        quantity: (ib.quantity || 0) + adjQty,
        last_updated: new Date().toISOString()
      }).eq('branch_id', branch_id).eq('product_id', product_id);
    } else {
      await supabase.from('inventory_balances').insert({
        id: `ib_${Date.now()}`,
        tenant_id: tenantId,
        branch_id,
        product_id,
        quantity: Math.max(0, adjQty),
        avg_cost: unit_cost || 0,
        last_updated: new Date().toISOString()
      });
    }

    await supabase.from('inventory_movements').insert({
      id: `mov_${Date.now()}`,
      tenant_id: tenantId,
      branch_id,
      product_id,
      movement_type: adjustment_type || 'adjustment',
      quantity: adjQty,
      unit_cost: unit_cost || 0,
      reference_type: 'stock_adjustment',
      reference_id: `ADJ-${Date.now().toString().slice(-6)}`,
      notes: notes || 'Manual adjustment',
      created_by: user_id || 'admin'
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Adjustment failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
