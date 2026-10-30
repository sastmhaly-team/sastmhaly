import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getProductByBarcode, createProduct, updateProduct, deleteProduct, getCategories, getUnits } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const barcode = searchParams.get('barcode');
  const search = searchParams.get('search') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

  try {
    if (barcode) {
      const product = await getProductByBarcode(tenantId, barcode);
      return NextResponse.json({ product });
    }

    const products = await getProducts(tenantId, { search, categoryId, branchId, lowStockOnly });
    const categories = await getCategories(tenantId);
    const units = await getUnits(tenantId);

    return NextResponse.json({ products, categories, units });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, bulk, items, ...singleProduct } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (bulk && Array.isArray(items)) {
      // Bulk CSV import with duplicate validation
      let successCount = 0;
      const errors: string[] = [];

      const existingCats = await getCategories(tenantId);
      const defaultCatId = existingCats[0]?.id || 'cat_general';
      const existingUnits = await getUnits(tenantId);
      const defaultUnitId = existingUnits[0]?.id || 'unit_piece';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const nameAr = (item.name_ar || item.name_en || '').trim();
          const nameEn = (item.name_en || item.name_ar || '').trim();
          const barcode = String(item.barcode || '').trim();
          const sellingPrice = Number(item.selling_price);

          if ((!nameAr && !nameEn) || !barcode || isNaN(sellingPrice) || sellingPrice <= 0) {
            errors.push(`Row #${i + 1}: Name, barcode, and valid selling price are required`);
            continue;
          }

          const productPayload = {
            sku: item.sku?.trim() || `SKU-${Date.now().toString().slice(-4)}-${i + 1}`,
            barcode,
            name_en: nameEn,
            name_ar: nameAr,
            category_id: item.category_id || defaultCatId,
            unit_id: item.unit_id || defaultUnitId,
            cost_price: Number(item.cost_price) || 0,
            selling_price: sellingPrice,
            min_stock_alert: item.min_stock_alert ? Number(item.min_stock_alert) : 5,
            initial_stock: item.initial_stock ? Number(item.initial_stock) : 0,
            branch_id: item.branch_id || body.branch_id || undefined,
          };

          await createProduct(tenantId, productPayload);
          successCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          errors.push(`Row #${i + 1} (Barcode ${item.barcode}): ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        successCount,
        errorCount: errors.length,
        errors,
      });
    }

    // Single Product Creation
    const product = await createProduct(tenantId, singleProduct);
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, id, current_stock, branch_id, ...updateData } = body;
    const tenantId = tenant_id || 'tenant_albaraka';

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const product = await updateProduct(tenantId, id, updateData, {
      current_stock: current_stock !== undefined ? Number(current_stock) : undefined,
      branch_id: branch_id || undefined,
    });
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const result = await deleteProduct(tenantId, id);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete product';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

