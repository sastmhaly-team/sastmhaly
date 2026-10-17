import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceRecords, upsertAttendanceRecord } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const date = searchParams.get('date') || undefined;
  const branchId = searchParams.get('branchId') || undefined;
  const userId = searchParams.get('userId') || undefined;

  if (!tenantId) {
    return NextResponse.json({ attendance: [] });
  }

  try {
    const attendance = await getAttendanceRecords(tenantId, date, branchId, userId);
    return NextResponse.json({ attendance });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, user_id, date, status, branch_id, check_in_time, check_out_time, notes, late_minutes, id } = body;

    if (!tenant_id || !user_id || !date || !status) {
      return NextResponse.json({ error: 'tenant_id, user_id, date, and status are required' }, { status: 400 });
    }

    const record = await upsertAttendanceRecord(tenant_id, {
      id,
      branch_id,
      user_id,
      date,
      status,
      check_in_time,
      check_out_time,
      notes,
      late_minutes,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to record attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
