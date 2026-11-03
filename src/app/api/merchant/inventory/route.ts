import { NextRequest, NextResponse } from 'next/server';
import { getInventoryBalances, getInventoryMovements, getBranches, getProducts, getSupabase, isOfflineMode } from '@/lib/db/supabase-queries';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || 'tenant_albaraka';
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  try {
    const balances = await getInventoryBalances(tenantId, branchId);
    const movements = await getInventoryMovements(tenantId, { branchId, limit: 100 });
    return NextResponse.json({ balances, movements });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, branch_id, product_id, adjustment_type, quantity, unit_cost, notes, user_id } = body;

    const tenantId = tenant_id || 'tenant_albaraka';

    let effectiveBranchId = branch_id;
    const tenantBranches = await getBranches(tenantId);
    if (tenantBranches && tenantBranches.length > 0) {
      const validIds = tenantBranches.map(b => b.id);
      if (!effectiveBranchId || effectiveBranchId === 'all' || !validIds.includes(effectiveBranchId)) {
        effectiveBranchId = validIds[0];
      }
    }

    if (body.bulk && Array.isArray(body.items)) {
      let successCount = 0;
      const errors: string[] = [];

      // Fetch all products for tenant to map barcodes/SKUs quickly
      const allProds = await getProducts(tenantId);
      const barcodeMap = new Map((allProds || []).map(p => [String(p.barcode).trim(), p.id]));
      const skuMap = new Map((allProds || []).map(p => [String(p.sku).trim(), p.id]));
      const idSet = new Set((allProds || []).map(p => p.id));

      if (isOfflineMode()) {
        const txn = db.transaction(() => {
          for (let i = 0; i < body.items.length; i++) {
            const item = body.items[i];
            try {
              const barcodeOrSku = String(item.barcode || item.sku || item.product_id || '').trim();
              let targetProductId = '';

              if (idSet.has(barcodeOrSku)) {
                targetProductId = barcodeOrSku;
              } else if (barcodeMap.has(barcodeOrSku)) {
                targetProductId = barcodeMap.get(barcodeOrSku)!;
              } else if (skuMap.has(barcodeOrSku)) {
                targetProductId = skuMap.get(barcodeOrSku)!;
              }

              if (!targetProductId) {
                errors.push(`Row #${i + 1}: Product not found with identifier "${barcodeOrSku}"`);
                continue;
              }

              const targetQty = Number(item.quantity ?? 0);
              const cost = Number(item.unit_cost ?? 0);

              const existing = db.prepare('SELECT id FROM inventory_balances WHERE branch_id = ? AND product_id = ?').get(effectiveBranchId, targetProductId) as any;
              if (existing) {
                db.prepare('UPDATE inventory_balances SET quantity = ?, avg_cost = ?, last_updated = datetime("now") WHERE id = ?').run(targetQty, cost, existing.id);
              } else {
                db.prepare('INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, avg_cost) VALUES (?, ?, ?, ?, ?, ?)')
                  .run(`ib_${effectiveBranchId}_${targetProductId}`, tenantId, effectiveBranchId, targetProductId, targetQty, cost);
              }

              db.prepare('INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(`mov_${Date.now()}_${i}`, tenantId, effectiveBranchId, targetProductId, 'import', targetQty, cost, 'bulk_import', `IMP-${Date.now().toString().slice(-6)}`, item.notes || 'CSV Inventory bulk import', user_id || 'merchant_import');

              successCount++;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Error';
              errors.push(`Row #${i + 1}: ${msg}`);
            }
          }
        });
        txn();

        return NextResponse.json({
          success: true,
          successCount,
          errorCount: errors.length,
          errors,
        });
      }

      const supabase = getSupabase();
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          const barcodeOrSku = String(item.barcode || item.sku || item.product_id || '').trim();
          let targetProductId = '';

          if (idSet.has(barcodeOrSku)) {
            targetProductId = barcodeOrSku;
          } else if (barcodeMap.has(barcodeOrSku)) {
            targetProductId = barcodeMap.get(barcodeOrSku)!;
          } else if (skuMap.has(barcodeOrSku)) {
            targetProductId = skuMap.get(barcodeOrSku)!;
          }

          if (!targetProductId) {
            errors.push(`Row #${i + 1}: Product not found with identifier "${barcodeOrSku}"`);
            continue;
          }

          const targetQty = Number(item.quantity ?? 0);
          const unitCost = Number(item.unit_cost ?? 0);

          await supabase.from('inventory_balances').upsert({
            id: `ib_${effectiveBranchId}_${targetProductId}`,
            tenant_id: tenantId,
            branch_id: effectiveBranchId,
            product_id: targetProductId,
            quantity: targetQty,
            avg_cost: unitCost,
            last_updated: new Date().toISOString()
          }, { onConflict: 'branch_id,product_id' });

          await supabase.from('inventory_movements').insert({
            id: `mov_${Date.now()}_${i}`,
            tenant_id: tenantId,
            branch_id: effectiveBranchId,
            product_id: targetProductId,
            movement_type: 'import',
            quantity: targetQty,
            unit_cost: unitCost,
            reference_type: 'bulk_import',
            reference_id: `IMP-${Date.now().toString().slice(-6)}`,
            notes: item.notes || 'CSV Inventory bulk import',
            created_by: user_id || 'merchant_import'
          });

          successCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error';
          errors.push(`Row #${i + 1}: ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        successCount,
        errorCount: errors.length,
        errors,
      });
    }

    const adjQty = Number(quantity);

    if (isOfflineMode()) {
      const existing = db.prepare('SELECT id, quantity FROM inventory_balances WHERE branch_id = ? AND product_id = ?').get(effectiveBranchId, product_id) as any;
      if (existing) {
        db.prepare('UPDATE inventory_balances SET quantity = ?, last_updated = datetime("now") WHERE id = ?')
          .run((existing.quantity || 0) + adjQty, existing.id);
      } else {
        db.prepare('INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, avg_cost) VALUES (?, ?, ?, ?, ?, ?)')
          .run(`ib_${Date.now()}_${Math.floor(Math.random() * 1000)}`, tenantId, effectiveBranchId, product_id, Math.max(0, adjQty), unit_cost || 0);
      }

      db.prepare('INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(`mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`, tenantId, effectiveBranchId, product_id, adjustment_type || 'adjustment', adjQty, unit_cost || 0, 'stock_adjustment', `ADJ-${Date.now().toString().slice(-6)}`, notes || 'Manual adjustment', user_id || 'admin');

      return NextResponse.json({ success: true, message: 'Stock adjusted successfully (Local Offline)' });
    }

    const supabase = getSupabase();
    const { data: ib } = await supabase
      .from('inventory_balances')
      .select('quantity')
      .eq('branch_id', effectiveBranchId)
      .eq('product_id', product_id)
      .maybeSingle();

    if (ib) {
      await supabase.from('inventory_balances').update({
        quantity: (ib.quantity || 0) + adjQty,
        last_updated: new Date().toISOString()
      }).eq('branch_id', effectiveBranchId).eq('product_id', product_id).throwOnError();
    } else {
      await supabase.from('inventory_balances').insert({
        id: `ib_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        tenant_id: tenantId,
        branch_id: effectiveBranchId,
        product_id,
        quantity: Math.max(0, adjQty),
        avg_cost: unit_cost || 0,
        last_updated: new Date().toISOString()
      }).throwOnError();
    }

    await supabase.from('inventory_movements').insert({
      id: `mov_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: tenantId,
      branch_id: effectiveBranchId,
      product_id,
      movement_type: adjustment_type || 'adjustment',
      quantity: adjQty,
      unit_cost: unit_cost || 0,
      reference_type: 'stock_adjustment',
      reference_id: `ADJ-${Date.now().toString().slice(-6)}`,
      notes: notes || 'Manual adjustment',
      created_by: user_id || 'admin'
    }).throwOnError();

    return NextResponse.json({ success: true, message: 'Stock adjusted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
