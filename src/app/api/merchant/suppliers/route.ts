import { NextRequest, NextResponse } from 'next/server';
import { getSuppliers, createSupplier, isOfflineMode } from '@/lib/db/supabase-queries';
import { db } from '@/lib/db';

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
          const supCode = item.code || `SUP-${Date.now().toString().slice(-4)}${i + 1}`;
          await createSupplier(tenantId, {
            code: supCode,
            name: item.name.trim(),
            contact_person: item.contact_person?.trim() || undefined,
            phone: String(item.phone).trim(),
            email: item.email?.trim() || undefined,
            tax_id: item.tax_id?.trim() || undefined,
            payment_terms: item.payment_terms || '30 Days Net',
            opening_balance: item.opening_balance ? Number(item.opening_balance) : 0,
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

    if (action === 'payment') {
      // Record payment against supplier balance
      const payAmount = Number(payment_amount);
      if (isOfflineMode()) {
        const sup = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(supplier_id) as { current_balance: number } | undefined;
        const currentBal = Number(sup?.current_balance) || 0;
        db.prepare('UPDATE suppliers SET current_balance = ? WHERE id = ?').run(currentBal - payAmount, supplier_id);
        db.prepare(`
          INSERT INTO supplier_payments (id, tenant_id, supplier_id, payment_number, amount, payment_method, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`spay_${Date.now()}`, tenantId, supplier_id, `PAY-SUP-${Date.now().toString().slice(-6)}`, payAmount, payment_method || 'cash', 'admin');
      } else {
        const { getSupabase } = await import('@/lib/db/supabase-queries');
        const supabase = getSupabase();
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
      }
      return NextResponse.json({ success: true, message: 'Supplier payment recorded and payable balance updated.' });
    }

    const supplier = await createSupplier(tenantId, supplierData);
    return NextResponse.json({ success: true, supplier });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Supplier operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
