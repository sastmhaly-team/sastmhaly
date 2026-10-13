import { db } from './index';

export function seedDatabase(forceClean = false) {
  const existingPlans = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get() as { count: number };
  const existingAdmin = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('super_admin') as { count: number };

  if (!forceClean && existingPlans.count > 0 && existingAdmin.count > 0) {
    return;
  }

  console.log('Seeding Sastmhaly production database (Clean state, unified plan, super admin)...');

  const txn = db.transaction(() => {
    if (forceClean) {
      // Clear all existing mock and transaction records
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM cash_movements').run();
      db.prepare('DELETE FROM cash_sessions').run();
      db.prepare('DELETE FROM cash_registers').run();
      db.prepare('DELETE FROM expenses').run();
      db.prepare('DELETE FROM audit_logs').run();
      db.prepare('DELETE FROM notifications').run();
      db.prepare('DELETE FROM journal_entries').run();
      db.prepare('DELETE FROM accounts').run();
      db.prepare('DELETE FROM purchase_order_items').run();
      db.prepare('DELETE FROM purchase_orders').run();
      db.prepare('DELETE FROM stock_transfer_items').run();
      db.prepare('DELETE FROM stock_transfers').run();
      db.prepare('DELETE FROM inventory_movements').run();
      db.prepare('DELETE FROM inventory_balances').run();
      db.prepare('DELETE FROM product_batches').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM units').run();
      db.prepare('DELETE FROM suppliers').run();
      db.prepare('DELETE FROM customers').run();
      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM branches').run();
      db.prepare('DELETE FROM subscriptions').run();
      db.prepare('DELETE FROM tenant_settings').run();
      db.prepare('DELETE FROM tenants').run();
      db.prepare('DELETE FROM subscription_plans').run();
    }

    // 1. One Unified All-Inclusive Plan (All features unlocked, no tiered restrictions)
    db.prepare(`
      INSERT OR REPLACE INTO subscription_plans (id, code, name_en, name_ar, price_monthly, price_annual, max_branches, max_users, max_products, features)
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
      JSON.stringify([
        'all_features',
        'pos',
        'inventory',
        'batches_expiry',
        'multi_branch',
        'transfers',
        'purchasing',
        'accounting',
        'advanced_reports',
        'scale_barcode',
        'e_invoice',
        'cash_registers'
      ])
    );

    // 2. Production Platform Super Admin (Phone: 01211583961, Password: 12345678)
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
  });

  txn();
  console.log('Production database initialized successfully.');
}
