import { NextRequest, NextResponse } from 'next/server';
import { getCashRegisters, getCashSessions, getActiveCashSession, openCashSession, closeCashSession, getBranches } from '@/lib/db/queries';
import { db } from '@/lib/db';

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
    let registers = getCashRegisters(tenantId, branchId);

    // If no cash registers exist yet for this tenant, auto-create POS-01
    if (registers.length === 0) {
      const branches = getBranches(tenantId);
      const targetBranchId = branchId || branches[0]?.id;
      if (targetBranchId) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
            VALUES (?, ?, ?, 'POS-01', 'كاشير نقطة البيع 1', 1)
          `).run(`reg_${tenantId}_01`, tenantId, targetBranchId);
          registers = getCashRegisters(tenantId, branchId);
        } catch {
          // ignore
        }
      }
    }

    const sessions = getCashSessions(tenantId, branchId);
    const activeSession = branchId ? getActiveCashSession(tenantId, branchId) : undefined;

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
      const closed = closeCashSession(tenant_id, session_id, Number(counted_cash), notes);
      return NextResponse.json({ success: true, session: closed });
    }

    if (action === 'movement') {
      db.prepare(`
        INSERT INTO cash_movements (id, session_id, type, amount, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`cm_${Date.now()}`, session_id, type, Number(amount), reason, 'cashier');
      return NextResponse.json({ success: true });
    }

    // Open session
    const session = openCashSession(tenant_id, openData);
    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Register operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
