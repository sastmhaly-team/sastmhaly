import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, createExpense, getSupabase } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const expenses = await getExpenses(tenantId, branchId);
    return NextResponse.json({ expenses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, branch_id, ...expenseData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';
    const supabase = getSupabase();

    let effectiveBranchId = branch_id;
    const { data: tenantBranches } = await supabase.from('branches').select('id').eq('tenant_id', tenantId);
    if (tenantBranches && tenantBranches.length > 0) {
      const validIds = tenantBranches.map(b => b.id);
      if (!effectiveBranchId || effectiveBranchId === 'all' || !validIds.includes(effectiveBranchId)) {
        effectiveBranchId = validIds[0];
      }
    }

    if (body.bulk && Array.isArray(body.items)) {
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          const amount = Number(item.amount);
          if (isNaN(amount) || amount <= 0 || !item.category) {
            errors.push(`Row #${i + 1}: Valid amount and category are required`);
            continue;
          }
          await createExpense(tenantId, {
            branch_id: item.branch_id || effectiveBranchId || 'br_downtown',
            category: item.category,
            amount,
            payment_source: item.payment_source || 'cash_drawer',
            payee: item.payee || undefined,
            description: item.description || item.category,
            created_by: item.created_by || 'merchant_import',
          });
          successCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          errors.push(`Row #${i + 1} (${item.category}): ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        successCount,
        errorCount: errors.length,
        errors,
      });
    }

    const expense = await createExpense(tenantId, { ...expenseData, branch_id: branch_id || expenseData.branch_id || 'br_downtown' });
    return NextResponse.json({ success: true, expense });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Expense operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
