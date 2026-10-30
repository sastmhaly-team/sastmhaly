import { NextRequest, NextResponse } from 'next/server';
import { getCustomers, createCustomer } from '@/lib/db/supabase-queries';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const customers = await getCustomers(tenantId);
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, customer_id, payment_amount, payment_method, 
      debt_amount, credit_limit, reason, tenant_id, ...customerData 
    } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    // 0. Bulk Import
    if (body.bulk && Array.isArray(body.items)) {
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          if (!item.name || !item.phone) {
            errors.push(`Row #${i + 1}: Name and phone are required (${JSON.stringify(item)})`);
            continue;
          }
          const cleanedPhone = String(item.phone).replace(/\D/g, '').trim();
          const custCode = item.code || `CUST-${Date.now().toString().slice(-4)}${i + 1}`;
          await createCustomer(tenant_id, {
            code: custCode,
            name: item.name.trim(),
            phone: cleanedPhone || item.phone,
            email: item.email?.trim() || undefined,
            address: item.address?.trim() || undefined,
            tax_id: item.tax_id?.trim() || undefined,
            credit_limit: item.credit_limit ? Number(item.credit_limit) : 1000,
          });
          successCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          errors.push(`Row #${i + 1} (${item.name}): ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        successCount,
        errorCount: errors.length,
        errors,
      });
    }

    // 1. Debt collection (Paying off debt)
    if (action === 'collect') {
      const payAmount = Number(payment_amount);
      const { data: cust } = await supabase.from('customers').select('current_balance').eq('id', customer_id).single();
      const currentBal = Number(cust?.current_balance) || 0;
      await supabase.from('customers').update({ current_balance: currentBal - payAmount }).eq('id', customer_id);
      await supabase.from('customer_payments').insert({
        id: `cpay_${Date.now()}`,
        tenant_id,
        customer_id,
        payment_number: `PAY-CUST-${Date.now().toString().slice(-6)}`,
        amount: payAmount,
        payment_method: payment_method || 'cash',
        created_by: 'cashier'
      });
      return NextResponse.json({ success: true, message: 'Customer debt payment recorded and balance updated.' });
    }

    // 2. Add Debt / Charge Client (تسجيل مديونية / يدينه بمبلغ)
    if (action === 'adjust_debt') {
      const debtVal = Number(debt_amount);
      if (isNaN(debtVal) || debtVal <= 0) {
        return NextResponse.json({ error: 'Valid debt amount is required' }, { status: 400 });
      }
      const { data: cust } = await supabase.from('customers').select('current_balance').eq('id', customer_id).single();
      const currentBal = Number(cust?.current_balance) || 0;
      await supabase.from('customers').update({ current_balance: currentBal + debtVal }).eq('id', customer_id);
      return NextResponse.json({ success: true, message: 'Customer debt charged successfully.' });
    }

    // 3. Update Credit Limit anytime (تعديل الحد الائتماني)
    if (action === 'update_credit_limit') {
      const newLimit = Number(credit_limit);
      if (isNaN(newLimit) || newLimit < 0) {
        return NextResponse.json({ error: 'Valid credit limit amount is required' }, { status: 400 });
      }
      await supabase.from('customers').update({ credit_limit: newLimit }).eq('id', customer_id);
      return NextResponse.json({ success: true, message: 'Credit limit updated successfully.' });
    }

    // 4. Create new customer
    const customer = await createCustomer(tenant_id, customerData);
    return NextResponse.json({ success: true, customer });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Customer operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
