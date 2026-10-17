import { NextRequest, NextResponse } from 'next/server';
import { 
  getPayrollRecords, 
  generateMonthlyPayroll, 
  markPayrollPaid 
} from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const month = searchParams.get('month') || undefined;
  const branchId = searchParams.get('branchId') || undefined;

  if (!tenantId) {
    return NextResponse.json({ payroll: [] });
  }

  try {
    const payroll = await getPayrollRecords(tenantId, month, branchId);
    return NextResponse.json({ payroll });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch payroll';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, month, branch_id, id, payment_method, record_expense } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    if (action === 'generate') {
      if (!month) {
        return NextResponse.json({ error: 'month (YYYY-MM) is required to generate payroll' }, { status: 400 });
      }
      const records = await generateMonthlyPayroll(tenant_id, month, branch_id);
      return NextResponse.json({ success: true, payroll: records });
    }

    if (action === 'pay') {
      if (!id) {
        return NextResponse.json({ error: 'payroll id is required to mark paid' }, { status: 400 });
      }
      const updated = await markPayrollPaid(
        id, 
        tenant_id, 
        payment_method || 'cash', 
        record_expense !== false
      );
      return NextResponse.json({ success: true, record: updated });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: generate, pay' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Payroll action failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
