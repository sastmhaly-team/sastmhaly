import { NextRequest, NextResponse } from 'next/server';
import { exportFullStoreBackup, importFullStoreBackup } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

  try {
    const backupData = await exportFullStoreBackup(tenantId);
    return NextResponse.json(backupData);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Backup export failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backup = body.backup || body.data;
    const tenantId = body.tenant_id || 'tenant_albaraka';

    if (!backup) {
      return NextResponse.json({ error: 'Backup data is required' }, { status: 400 });
    }

    const result = await importFullStoreBackup(tenantId, backup);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Backup import failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

