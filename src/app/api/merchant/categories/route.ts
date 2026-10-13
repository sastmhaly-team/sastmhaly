import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
    const categories = getCategories(tenantId);
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, name_ar, name_en, code, color } = body;

    if (!name_ar) {
      return NextResponse.json({ error: 'اسم القسم مطلوب' }, { status: 400 });
    }

    const tenantId = tenant_id || 'tenant_albaraka';
    const category = createCategory(tenantId, { name_ar, name_en, code, color });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tenant_id, name_ar, name_en, code, color } = body;

    if (!id || !name_ar) {
      return NextResponse.json({ error: 'معرف القسم واسم القسم مطلوبان' }, { status: 400 });
    }

    const tenantId = tenant_id || 'tenant_albaraka';
    const category = updateCategory(tenantId, id, { name_ar, name_en, code, color });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

    if (!id) {
      return NextResponse.json({ error: 'معرف القسم مطلوب' }, { status: 400 });
    }

    const res = deleteCategory(tenantId, id);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete category' }, { status: 500 });
  }
}
