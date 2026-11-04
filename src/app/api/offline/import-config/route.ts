import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isOfflineMode } from '@/lib/db/supabase-queries';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const configData = body.config || body;

    if (!configData || !configData.tenant_id) {
      return NextResponse.json({ error: 'ملف الإعدادات غير صالح: لم يتم العثور على tenant_id' }, { status: 400 });
    }

    const tenantId = configData.tenant_id;
    const merchantName = configData.merchant_name || 'متجر سستمهالي';
    const phone = configData.phone || '01000000000';
    const password = configData.password || '12345678';
    const slug = configData.slug || `m-${Date.now().toString().slice(-4)}`;

    // 1. Save config to disk in application directory
    try {
      const configPath = path.join(process.cwd(), 'sastmhaly_config.json');
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (e) {
      console.warn('Could not write sastmhaly_config.json to disk:', e);
    }

    // 2. Seed SQLite database
    const txn = db.transaction(() => {
      // Tenant
      db.prepare(`
        INSERT OR REPLACE INTO tenants (id, name, slug, legal_name, phone, deployment_type, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'offline', 'active', datetime('now'))
      `).run(tenantId, merchantName, slug, `[OFFLINE] ${merchantName}`, phone);

      // Subscription (10 years offline)
      db.prepare(`
        INSERT OR REPLACE INTO subscriptions (id, tenant_id, plan_id, status, starts_at, expires_at)
        VALUES (?, ?, 'plan_all_inclusive', 'active', datetime('now'), datetime('now', '+10 years'))
      `).run(`sub_${tenantId}`, tenantId);

      // Main Branch
      const mainBranchId = `br_${tenantId}_main`;
      db.prepare(`
        INSERT OR REPLACE INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, city, opening_hours, is_active, is_main)
        VALUES (?, ?, 'BR-01', 'Main Branch', 'الفرع الرئيسي', ?, 'المقر الرئيسي', 'Cairo', '09:00 - 23:00', 1, 1)
      `).run(mainBranchId, tenantId, phone);

      // Merchant Owner User
      db.prepare(`
        INSERT OR REPLACE INTO users (id, tenant_id, branch_id, email, username, password_hash, full_name, phone, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'merchant_owner', 1)
      `).run(`usr_${tenantId}_owner`, tenantId, mainBranchId, `${phone}@sastmhaly.local`, phone, password, merchantName, phone);

      // Default Categories
      const catGeneralId = `cat_${tenantId}_general`;
      db.prepare(`
        INSERT OR IGNORE INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
        VALUES (?, ?, 'General', 'عام', 'GEN', '#246BFD', 1)
      `).run(catGeneralId, tenantId);

      // Default Units
      const unitPieceId = `unit_${tenantId}_piece`;
      db.prepare(`
        INSERT OR IGNORE INTO units (id, tenant_id, name_en, name_ar, code)
        VALUES (?, ?, 'Piece', 'قطعة', 'PCS')
      `).run(unitPieceId, tenantId);

      // Default Cash Register
      db.prepare(`
        INSERT OR IGNORE INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
        VALUES (?, ?, ?, 'POS-01', 'خزينة الكاشير الرئيسية', 1)
      `).run(`reg_${tenantId}_main`, tenantId, mainBranchId);

      // Tenant Settings
      db.prepare(`
        INSERT OR REPLACE INTO tenant_settings (id, tenant_id, business_type, default_tax_rate, vat_enabled, receipt_width, receipt_header, receipt_footer)
        VALUES (?, ?, 'retail', 14.0, 1, 80, ?, 'شكراً لزيارتكم - سستمهالي لإدارة نقاط البيع')
      `).run(`sett_${tenantId}`, tenantId, merchantName);

      // Import any initial products if provided
      if (configData.initial_data && Array.isArray(configData.initial_data.products)) {
        for (const prod of configData.initial_data.products) {
          if (!prod.id || !prod.name_ar) continue;
          db.prepare(`
            INSERT OR REPLACE INTO products (id, tenant_id, category_id, unit_id, code, barcode, sku, name_en, name_ar, description, cost_price, retail_price, is_active, track_inventory)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            prod.id,
            tenantId,
            prod.category_id || catGeneralId,
            prod.unit_id || unitPieceId,
            prod.code || prod.barcode || `P-${Date.now().toString().slice(-4)}`,
            prod.barcode || null,
            prod.sku || null,
            prod.name_en || prod.name_ar,
            prod.name_ar,
            prod.description || null,
            prod.cost_price || 0,
            prod.retail_price || 0,
            prod.is_active ?? 1,
            prod.track_inventory ?? 1
          );
        }
      }
    });

    txn();

    return NextResponse.json({
      success: true,
      phone,
      password,
      merchant_name: merchantName,
      message: 'تم استيراد بيانات وتفعيل المتجر بنجاح'
    });
  } catch (error: any) {
    console.error('Error importing offline config:', error);
    return NextResponse.json(
      { error: error?.message || 'فشل استيراد بيانات المتجر' },
      { status: 500 }
    );
  }
}

