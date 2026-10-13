import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, createExpense } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const expenses = getExpenses(tenantId, branchId);
    return NextResponse.json({ expenses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, ...expenseData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    const expense = createExpense(tenantId, expenseData);
    return NextResponse.json({ success: true, expense });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Expense operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
