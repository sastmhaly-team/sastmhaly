import { NextRequest, NextResponse } from 'next/server';
import { getCashRegisters, getCashSessions, getActiveCashSession, openCashSession, closeCashSession, getBranches } from '@/lib/db/supabase-queries';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ registers: [], sessions: [], activeSession: null });
  }

  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    let registers = await getCashRegisters(tenantId, branchId);

    // If no cash registers exist yet for this tenant, auto-create POS-01
    if (registers.length === 0) {
      const branches = await getBranches(tenantId);
      const targetBranchId = branchId || branches[0]?.id;
      if (targetBranchId) {
        try {
          await supabase.from('cash_registers').upsert({
            id: `reg_${tenantId}_01`,
            tenant_id: tenantId,
            branch_id: targetBranchId,
            code: 'POS-01',
            name: 'كاشير نقطة البيع 1',
            is_active: 1
          }, { onConflict: 'id' });
          registers = await getCashRegisters(tenantId, branchId);
        } catch {
          // ignore
        }
      }
    }

    const sessions = await getCashSessions(tenantId, branchId);
    const activeSession = branchId ? await getActiveCashSession(tenantId, branchId) : undefined;

    return NextResponse.json({ registers, sessions, activeSession });
  } catch {
    return NextResponse.json({ registers: [], sessions: [], activeSession: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, session_id, counted_cash, amount, type, reason, notes, ...openData } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    if (action === 'close') {
      const closed = await closeCashSession(tenant_id, session_id, Number(counted_cash), notes);
      return NextResponse.json({ success: true, session: closed });
    }

    if (action === 'movement') {
      await supabase.from('cash_movements').insert({
        id: `cm_${Date.now()}`,
        session_id,
        type,
        amount: Number(amount),
        reason,
        created_by: 'cashier'
      });
      return NextResponse.json({ success: true });
    }

    // Open session
    const session = await openCashSession(tenant_id, openData);
    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Register operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
