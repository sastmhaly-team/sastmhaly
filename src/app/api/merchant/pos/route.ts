import { NextRequest, NextResponse } from 'next/server';
import { commitSaleTransaction, getActiveCashSession, getCustomers, getProducts, getTenantSettings } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') || 'br_downtown';

  try {
    const products = await getProducts(tenantId, { branchId });
    const customers = await getCustomers(tenantId);
    const activeSession = await getActiveCashSession(tenantId, branchId);
    const { tenant, settings } = await getTenantSettings(tenantId);

    return NextResponse.json({
      products,
      customers,
      activeSession,
      tenant,
      settings,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch POS initial state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenant_id,
      branch_id,
      register_id,
      session_id,
      cashier_id,
      customer_id,
      items,
      subtotal,
      discount_amount,
      tax_amount,
      total_amount,
      paid_amount,
      change_amount,
      payment_method,
      notes
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!branch_id || !cashier_id) {
      return NextResponse.json({ error: 'Missing branch or cashier context' }, { status: 400 });
    }

    // Atomic transaction execution
    const sale = await commitSaleTransaction({
      tenant_id: tenant_id || 'tenant_albaraka',
      branch_id,
      register_id: register_id || '',
      session_id: session_id || '',
      cashier_id,
      customer_id,
      items,
      subtotal,
      discount_amount: discount_amount || 0,
      tax_amount: tax_amount || 0,
      total_amount,
      paid_amount,
      change_amount: change_amount || 0,
      payment_method: payment_method || 'cash',
      notes,
    });

    return NextResponse.json({
      success: true,
      sale,
      message: 'Sale finalized atomically with receipt number and ledger updates.'
    });
  } catch (error: unknown) {
    console.error('POS Checkout error', error);
    const msg = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
