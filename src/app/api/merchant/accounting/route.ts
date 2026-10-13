import { NextRequest, NextResponse } from 'next/server';
import { getChartOfAccounts, getJournalEntries } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

  try {
    const accounts = await getChartOfAccounts(tenantId);
    const journalEntries = await getJournalEntries(tenantId);

    return NextResponse.json({ accounts, journalEntries });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch accounting data' }, { status: 500 });
  }
}
