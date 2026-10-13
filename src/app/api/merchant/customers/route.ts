import { NextRequest, NextResponse } from 'next/server';
import { getCustomers, createCustomer } from '@/lib/db/queries';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ customers: [] });
  }

  try {
    const customers = getCustomers(tenantId);
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

    // 1. Debt collection (Paying off debt)
    if (action === 'collect') {
      const payAmount = Number(payment_amount);
      const txn = db.transaction(() => {
        db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(payAmount, customer_id);
        db.prepare(`
          INSERT INTO customer_payments (id, tenant_id, customer_id, payment_number, amount, payment_method, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`cpay_${Date.now()}`, tenant_id, customer_id, `PAY-CUST-${Date.now().toString().slice(-6)}`, payAmount, payment_method || 'cash', 'cashier');
      });
      txn();
      return NextResponse.json({ success: true, message: 'Customer debt payment recorded and balance updated.' });
    }

    // 2. Add Debt / Charge Client (تسجيل مديونية / يدينه بمبلغ)
    if (action === 'adjust_debt') {
      const debtVal = Number(debt_amount);
      if (isNaN(debtVal) || debtVal <= 0) {
        return NextResponse.json({ error: 'Valid debt amount is required' }, { status: 400 });
      }
      db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?').run(debtVal, customer_id);
      return NextResponse.json({ success: true, message: 'Customer debt charged successfully.' });
    }

    // 3. Update Credit Limit anytime (تعديل الحد الائتماني)
    if (action === 'update_credit_limit') {
      const newLimit = Number(credit_limit);
      if (isNaN(newLimit) || newLimit < 0) {
        return NextResponse.json({ error: 'Valid credit limit amount is required' }, { status: 400 });
      }
      db.prepare('UPDATE customers SET credit_limit = ? WHERE id = ?').run(newLimit, customer_id);
      return NextResponse.json({ success: true, message: 'Credit limit updated successfully.' });
    }

    // 4. Create new customer
    const customer = createCustomer(tenant_id, customerData);
    return NextResponse.json({ success: true, customer });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Customer operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
