import { NextRequest, NextResponse } from 'next/server';
import { 
  getStocktakingSessions, 
  getStocktakingSession, 
  createStocktakingSession, 
  applyStocktakingAdjustment, 
  cancelStocktakingSession,
  getProducts,
  getBranches
} from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;
  const sessionId = searchParams.get('sessionId');
  const mode = searchParams.get('mode');

  try {
    if (sessionId) {
      const session = await getStocktakingSession(tenantId, sessionId);
      return NextResponse.json({ success: true, session });
    }

    if (mode === 'inventory') {
      const [products, branches] = await Promise.all([
        getProducts(tenantId, { branchId }),
        getBranches(tenantId)
      ]);
      return NextResponse.json({ success: true, products, branches });
    }

    const sessions = await getStocktakingSessions(tenantId, branchId);
    return NextResponse.json({ success: true, sessions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch stocktaking data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, sessionId, approvedBy, ...data } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (action === 'apply') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }
      const updated = await applyStocktakingAdjustment(tenantId, sessionId, approvedBy || 'admin');
      return NextResponse.json({ 
        success: true, 
        session: updated, 
        message: 'تم اعتماد الجرد وتسوية الأرصدة المخزنية بنجاح.' 
      });
    }

    const session = await createStocktakingSession(tenantId, data);
    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stocktaking operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const result = await cancelStocktakingSession(tenantId, sessionId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to cancel stocktaking session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

