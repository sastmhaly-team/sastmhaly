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
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = path.join(dataDir, 'sastmhaly.db');
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
  } catch (err) {
    console.error('Database initialization warning:', err);
  }

  global.__sastmhaly_db = db;
  return db;
}

export const db = getDatabase();

export default db;
