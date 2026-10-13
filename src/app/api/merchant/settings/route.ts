import { NextRequest, NextResponse } from 'next/server';
import { getTenantSettings, updateTenantSettings } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

  try {
    const data = await getTenantSettings(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, ...settingsData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    const updated = await updateTenantSettings(tenantId, settingsData);
    return NextResponse.json({ success: true, ...updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update settings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
