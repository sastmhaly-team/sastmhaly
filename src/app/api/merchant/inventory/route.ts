import { NextRequest, NextResponse } from 'next/server';
import { getInventoryBalances, getInventoryMovements } from '@/lib/db/queries';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const balances = getInventoryBalances(tenantId, branchId);
    const movements = getInventoryMovements(tenantId, { branchId, limit: 100 });
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

    const txn = db.transaction(() => {
      // Update balance
      db.prepare(`
        UPDATE inventory_balances
        SET quantity = quantity + ?, last_updated = datetime('now')
        WHERE branch_id = ? AND product_id = ?
      `).run(adjQty, branch_id, product_id);

      // Audit movement
      db.prepare(`
        INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'stock_adjustment', ?, ?, ?)
      `).run(`mov_${Date.now()}`, tenantId, branch_id, product_id, adjustment_type || 'adjustment', adjQty, unit_cost || 0, `ADJ-${Date.now().toString().slice(-6)}`, notes || 'Manual adjustment', user_id || 'admin');
    });

    txn();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Adjustment failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
