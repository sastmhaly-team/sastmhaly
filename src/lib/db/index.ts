import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DDL_SCHEMA } from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __sastmhaly_db: Database.Database | undefined;
}

function getDatabase(): Database.Database {
  if (global.__sastmhaly_db) {
    return global.__sastmhaly_db;
  }

  let dbPath: string;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    // Vercel serverless execution environment: only /tmp is writable
    dbPath = path.join('/tmp', 'sastmhaly.db');
    const sourceDbPath = path.join(process.cwd(), 'data', 'sastmhaly.db');

    if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
      if (fs.existsSync(sourceDbPath)) {
        try {
          fs.copyFileSync(sourceDbPath, dbPath);
        } catch (e) {
          console.error('Failed to copy bundled db to /tmp, will initialize fresh:', e);
        }
      }
    }
  } else {
    // Determine the data directory robustly across all execution contexts
    const candidateDirs = [
      process.env.APP_DIR ? path.join(process.env.APP_DIR, 'data') : null,
      process.env.SASTMHALY_DIR ? path.join(process.env.SASTMHALY_DIR, 'data') : null,
      path.join(process.cwd(), 'data'),
      'C:\\SastmhalyPOS\\data',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'SastmhalyPOS', 'data') : null,
      path.join(__dirname, '..', '..', '..', 'data'),
      path.join(path.dirname(process.execPath), 'data'),
    ].filter(Boolean) as string[];

    let chosenDir = '';
    // First, check if an existing database file exists in any candidate directory
    for (const d of candidateDirs) {
      if (fs.existsSync(path.join(d, 'sastmhaly.db'))) {
        chosenDir = d;
        break;
      }
    }

    // If no existing db file found, pick the first writable candidate directory
    if (!chosenDir) {
      for (const d of candidateDirs) {
        try {
          if (!fs.existsSync(d)) {
            fs.mkdirSync(d, { recursive: true });
          }
          chosenDir = d;
          break;
        } catch {}
      }
    }

    if (!chosenDir) {
      chosenDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(chosenDir)) {
        fs.mkdirSync(chosenDir, { recursive: true });
      }
    }

    dbPath = path.join(chosenDir, 'sastmhaly.db');
  }

  const db = new Database(dbPath);

  try {
    // Enable WAL mode for high concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    // Execute DDL schema
    db.exec(DDL_SCHEMA);

    // Ensure Super Admin & Initial Plan always exist upon initialization
    try {
      const adminExists = db.prepare('SELECT id FROM users WHERE phone = ? OR username = ?').get('01211583961', '01211583961');
      if (!adminExists) {
        db.prepare(`
          INSERT OR IGNORE INTO subscription_plans (id, code, name_en, name_ar, price_monthly, price_annual, max_branches, max_users, max_products, features)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'plan_all_inclusive',
          'all_inclusive',
          'All-Inclusive Enterprise Plan',
          'الخطة الشاملة - كافة المميزات مفعلة',
          0.0,
          0.0,
          999999,
          999999,
          999999,
          JSON.stringify(['all_features'])
        );

        db.prepare(`
          INSERT OR REPLACE INTO users (id, tenant_id, branch_id, email, username, password_hash, full_name, phone, role, is_active)
          VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, 'super_admin', 1)
        `).run(
          'usr_superadmin',
          'admin@sastmhaly.com',
          '01211583961',
          '12345678',
          'مدير المنصة (Super Admin)',
          '01211583961'
        );
      }
    } catch (e) {
      console.error('Failed to seed super admin:', e);
    }

    // Ensure Merchant from sastmhaly_config.json is auto-seeded if present
    try {
      const configPaths = [
        process.env.APP_DIR ? path.join(process.env.APP_DIR, 'sastmhaly_config.json') : null,
        path.join(process.cwd(), 'sastmhaly_config.json'),
        path.join(process.cwd(), '..', 'sastmhaly_config.json'),
        'C:\\SastmhalyPOS\\sastmhaly_config.json',
        path.join(__dirname, '..', '..', '..', 'sastmhaly_config.json')
      ].filter(Boolean) as string[];
      let configData: any = null;
      for (const cp of configPaths) {
        if (fs.existsSync(cp)) {
          try {
            configData = JSON.parse(fs.readFileSync(cp, 'utf8'));
            break;
          } catch (e) {
            // ignore
          }
        }
      }

      if (configData && configData.tenant_id) {
        const tenantId = configData.tenant_id;
        const merchantName = configData.merchant_name || 'متجر سستمهالي';
        const phone = configData.phone || '01000000000';
        const password = configData.password || '12345678';
        const slug = configData.slug || `m-${Date.now().toString().slice(-4)}`;

        // 1. Insert or update tenant
        db.prepare(`
          INSERT OR IGNORE INTO tenants (id, name, slug, legal_name, phone, deployment_type, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'offline', 'active', datetime('now'))
        `).run(tenantId, merchantName, slug, `[OFFLINE] ${merchantName}`, phone);

        // 2. Active Subscription
        db.prepare(`
          INSERT OR IGNORE INTO subscriptions (id, tenant_id, plan_id, status, starts_at, expires_at)
          VALUES (?, ?, 'plan_all_inclusive', 'active', datetime('now'), datetime('now', '+10 years'))
        `).run(`sub_${tenantId}`, tenantId);

        // 3. Main Branch
        const mainBranchId = `br_${tenantId}_main`;
        db.prepare(`
          INSERT OR IGNORE INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, city, opening_hours, is_active, is_main)
          VALUES (?, ?, 'BR-01', 'Main Branch', 'الفرع الرئيسي', ?, 'المقر الرئيسي', 'Cairo', '09:00 - 23:00', 1, 1)
        `).run(mainBranchId, tenantId, phone);

        // 4. Merchant Owner User
        db.prepare(`
          INSERT OR REPLACE INTO users (id, tenant_id, branch_id, email, username, password_hash, full_name, phone, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'merchant_owner', 1)
        `).run(`usr_${tenantId}_owner`, tenantId, mainBranchId, `${phone}@sastmhaly.local`, phone, password, merchantName, phone);

        // 5. Default Categories
        const catGeneralId = `cat_${tenantId}_general`;
        db.prepare(`
          INSERT OR IGNORE INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
          VALUES (?, ?, 'General', 'عام', 'GEN', '#246BFD', 1)
        `).run(catGeneralId, tenantId);

        db.prepare(`
          INSERT OR IGNORE INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
          VALUES (?, ?, 'Stationery', 'أدوات مكتبية ومدرسية', 'STAT', '#10B981', 1)
        `).run(`cat_${tenantId}_stationery`, tenantId);

        db.prepare(`
          INSERT OR IGNORE INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
          VALUES (?, ?, 'Books', 'كتب وروايات', 'BOOK', '#F59E0B', 1)
        `).run(`cat_${tenantId}_books`, tenantId);

        // 6. Default Units
        const unitPieceId = `unit_${tenantId}_piece`;
        db.prepare(`
          INSERT OR IGNORE INTO units (id, tenant_id, name_en, name_ar, code)
          VALUES (?, ?, 'Piece', 'قطعة', 'PCS')
        `).run(unitPieceId, tenantId);

        db.prepare(`
          INSERT OR IGNORE INTO units (id, tenant_id, name_en, name_ar, code)
          VALUES (?, ?, 'Box', 'علبة', 'BOX')
        `).run(`unit_${tenantId}_box`, tenantId);

        // 7. Default Cash Register
        db.prepare(`
          INSERT OR IGNORE INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
          VALUES (?, ?, ?, 'POS-01', 'خزينة الكاشير الرئيسية', 1)
        `).run(`reg_${tenantId}_main`, tenantId, mainBranchId);

        // 8. Tenant Settings
        db.prepare(`
          INSERT OR IGNORE INTO tenant_settings (id, tenant_id, business_type, default_tax_rate, vat_enabled, receipt_width, receipt_header, receipt_footer)
          VALUES (?, ?, 'retail', 14.0, 1, 80, ?, 'شكراً لزيارتكم - سستمهالي لإدارة نقاط البيع')
        `).run(`sett_${tenantId}`, tenantId, merchantName);

        // 9. If initial_data exists in config, import branches, categories, units, and products
        if (configData.initial_data) {
          const init = configData.initial_data;

          if (Array.isArray(init.branches)) {
            for (const b of init.branches) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, city, opening_hours, is_active, is_main)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(b.id, tenantId, b.code || 'BR', b.name_en || 'Branch', b.name_ar || 'فرع', b.phone || phone, b.address || '', b.city || 'Cairo', b.opening_hours || '09:00 - 23:00', b.is_active ?? 1, b.is_main ?? 0);
              } catch (e) {}
            }
          }

          if (Array.isArray(init.categories)) {
            for (const c of init.categories) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(c.id, tenantId, c.name_en || c.name_ar, c.name_ar, c.code || 'CAT', c.color || '#246BFD', c.is_active ?? 1);
              } catch (e) {}
            }
          }

          if (Array.isArray(init.units)) {
            for (const u of init.units) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO units (id, tenant_id, name_en, name_ar, code)
                  VALUES (?, ?, ?, ?, ?)
                `).run(u.id, tenantId, u.name_en || u.name_ar, u.name_ar, u.code || 'UNIT');
              } catch (e) {}
            }
          }

          if (Array.isArray(init.products)) {
            for (const p of init.products) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO products (
                    id, tenant_id, sku, barcode, additional_barcodes, name_en, name_ar,
                    category_id, unit_id, cost_price, selling_price, wholesale_price,
                    tax_rate, track_stock, min_stock_alert, is_weighted, has_batch_tracking, is_active
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                `).run(
                  p.id, tenantId, p.sku || `SKU-${p.id}`, p.barcode || `BAR-${p.id}`, p.additional_barcodes || null,
                  p.name_en || p.name_ar, p.name_ar, p.category_id || catGeneralId, p.unit_id || unitPieceId,
                  Number(p.cost_price || 0), Number(p.selling_price || 0), Number(p.wholesale_price || 0),
                  Number(p.tax_rate ?? 14.0), Number(p.min_stock_alert ?? 5.0),
                  p.is_weighted ? 1 : 0, p.has_batch_tracking ? 1 : 0, p.is_active ?? 1
                );
              } catch (e) {}
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to auto-seed merchant config:', e);
    }
  } catch (err) {
    console.error('Database initialization warning:', err);
  }

  global.__sastmhaly_db = db;
  return db;
}

export const db = getDatabase();

export default db;
