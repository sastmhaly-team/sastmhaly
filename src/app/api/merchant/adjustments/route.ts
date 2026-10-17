import { NextRequest, NextResponse } from 'next/server';
import { 
  getEmployeeAdjustments, 
  createEmployeeAdjustment, 
  deleteEmployeeAdjustment 
} from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const month = searchParams.get('month') || undefined;
  const userId = searchParams.get('userId') || undefined;

  if (!tenantId) {
    return NextResponse.json({ adjustments: [] });
  }

  try {
    const adjustments = await getEmployeeAdjustments(tenantId, month, userId);
    return NextResponse.json({ adjustments });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch adjustments';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, branch_id, user_id, type, amount, date, month, reason, status } = body;

    if (!tenant_id || !user_id || !type || !amount || !date || !reason) {
      return NextResponse.json({ 
        error: 'tenant_id, user_id, type, amount, date, and reason are required' 
      }, { status: 400 });
    }

    const calcMonth = month || date.substring(0, 7);

    const adjustment = await createEmployeeAdjustment({
      tenant_id,
      branch_id,
      user_id,
      type,
      amount: Number(amount),
      date,
      month: calcMonth,
      reason,
      status: status || 'approved',
    });

    return NextResponse.json({ success: true, adjustment });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create adjustment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'id and tenantId are required' }, { status: 400 });
    }

    const success = await deleteEmployeeAdjustment(id, tenantId);
    return NextResponse.json({ success });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete adjustment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
