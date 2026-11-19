import { NextRequest, NextResponse } from 'next/server';
import { 
  getQuotations, getQuotation, createQuotation, 
  updateQuotation, deleteQuotation, convertQuotationToSale 
} from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const id = searchParams.get('id');
  const status = searchParams.get('status') || undefined;

  try {
    if (id) {
      const quotation = await getQuotation(tenantId, id);
      return NextResponse.json({ quotation });
    }
    const quotations = await getQuotations(tenantId, status);
    return NextResponse.json({ quotations });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenant_id, quotationId, cashierId, branchId, ...createData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (action === 'convert') {
      const result = await convertQuotationToSale(tenantId, quotationId, cashierId, branchId);
      return NextResponse.json(result);
    }

    const quotation = await createQuotation(tenantId, createData);
    return NextResponse.json({ success: true, quotation });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Quotation operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, id, ...updateData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (!id) {
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    const quotation = await updateQuotation(tenantId, id, updateData);
    return NextResponse.json({ success: true, quotation });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update quotation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    const result = await deleteQuotation(tenantId, id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete quotation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

