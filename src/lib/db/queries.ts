import { db } from './index';
import { 
  Tenant, Branch, User, Category, Unit, Product, 
  InventoryBalance, InventoryMovement, StockTransfer, StockTransferItem,
  Supplier, PurchaseOrder, Customer, CashRegister, CashSession,
  Sale, SaleItem, Expense, Account, JournalEntry, Notification, AuditLog,
  SubscriptionPlan
} from '../types';

// ============================================================================
// TENANTS & PLATFORM ADMIN
// ============================================================================

export function getTenants(): Tenant[] {
  const rows = db.prepare(`
    SELECT t.*,
           s.id as sub_id, s.status as sub_status,
           s.starts_at as sub_starts_at, s.expires_at as sub_expires_at
    FROM tenants t
    LEFT JOIN (
      SELECT * FROM subscriptions
      ORDER BY expires_at DESC
    ) s ON t.id = s.tenant_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all() as any[];

  return rows.map(r => {
    let daysRemaining = 0;
    let isExpired = false;
    if (r.sub_expires_at) {
      const expTime = new Date(r.sub_expires_at).getTime();
      const diffMs = expTime - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = diffMs <= 0 || r.status === 'suspended' || r.sub_status === 'suspended';
    } else {
      isExpired = r.status === 'suspended';
    }

    return {
      ...r,
      days_remaining: daysRemaining,
      is_expired: isExpired,
    };
  });
}

export function getTenant(id: string): Tenant | undefined {
  const r = db.prepare(`
    SELECT t.*,
           s.id as sub_id, s.status as sub_status,
           s.starts_at as sub_starts_at, s.expires_at as sub_expires_at
    FROM tenants t
    LEFT JOIN subscriptions s ON t.id = s.tenant_id
    WHERE t.id = ?
    ORDER BY s.expires_at DESC
    LIMIT 1
  `).get(id) as any;

  if (!r) return undefined;

  let daysRemaining = 0;
  let isExpired = false;
  if (r.sub_expires_at) {
    const expTime = new Date(r.sub_expires_at).getTime();
    const diffMs = expTime - Date.now();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    isExpired = diffMs <= 0 || r.status === 'suspended' || r.sub_status === 'suspended';
  } else {
    isExpired = r.status === 'suspended';
  }

  return {
    ...r,
    days_remaining: daysRemaining,
    is_expired: isExpired,
  };
}

export function getTenantBySlug(slug: string): Tenant | undefined {
  return db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug) as Tenant | undefined;
}

export function createTenant(data: {
  id: string;
  slug: string;
  name: string;
  legal_name?: string;
  phone: string;
  email: string;
  tax_id?: string;
  commercial_reg?: string;
  currency?: string;
  plan_id: string;
  duration_months?: number;
  custom_start_date?: string;
  custom_end_date?: string;
}): Tenant {
  const currency = data.currency || 'EGP';
  
  const txn = db.transaction(() => {
    // 1. Insert Tenant
    db.prepare(`
      INSERT INTO tenants (id, slug, name, legal_name, phone, email, tax_id, commercial_reg, logo_url, currency, status, onboarding_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/logo.png', ?, 'active', 0)
    `).run(data.id, data.slug, data.name, data.legal_name || null, data.phone, data.email, data.tax_id || null, data.commercial_reg || null, currency);

    // 2. Insert Settings
    db.prepare(`
      INSERT INTO tenant_settings (id, tenant_id, default_tax_rate, vat_enabled, receipt_header, receipt_footer, receipt_width, scale_barcode_prefix, valuation_method)
      VALUES (?, ?, 14.0, 1, ?, 'شكراً لتعاملكم معنا', '80mm', '21', 'WAC')
    `).run(`ts_${data.id}`, data.id, `${data.name}\n${data.phone}`);

    // 3. Calculate Subscription Duration
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(data.plan_id) as SubscriptionPlan;
    
    let startsAt = new Date();
    if (data.custom_start_date) {
      const parsedStart = new Date(data.custom_start_date);
      if (!isNaN(parsedStart.getTime())) startsAt = parsedStart;
    }

    let expiresAt = new Date(startsAt);
    if (data.custom_end_date) {
      const parsedEnd = new Date(data.custom_end_date);
      if (!isNaN(parsedEnd.getTime())) {
        expiresAt = parsedEnd;
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
    } else {
      const months = data.duration_months && data.duration_months > 0 ? Number(data.duration_months) : 1;
      expiresAt.setMonth(expiresAt.getMonth() + months);
    }

    db.prepare(`
      INSERT INTO subscriptions (id, tenant_id, plan_id, billing_cycle, status, starts_at, expires_at, auto_renew)
      VALUES (?, ?, ?, 'custom', 'active', ?, ?, 0)
    `).run(`sub_${data.id}`, data.id, data.plan_id, startsAt.toISOString(), expiresAt.toISOString());

    // 4. Initial Invoice
    db.prepare(`
      INSERT INTO subscription_invoices (id, tenant_id, invoice_number, amount, status, due_date, paid_at, payment_method, notes)
      VALUES (?, ?, ?, ?, 'paid', datetime('now'), datetime('now'), 'provisioning', 'Initial Subscription')
    `).run(`inv_${data.id}_01`, data.id, `INV-${Date.now().toString().slice(-6)}`, plan ? plan.price_monthly : 499.0);

    // 5. Default Main Branch
    const branchId = `br_${data.id}_main`;
    db.prepare(`
      INSERT INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, city, is_active, is_main)
      VALUES (?, ?, 'BR-01', 'Main Branch', 'الفرع الرئيسي', ?, 'Cairo Head Office', 'Cairo', 1, 1)
    `).run(branchId, data.id, data.phone);

    // 6. Default Cash Register
    db.prepare(`
      INSERT INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
      VALUES (?, ?, ?, 'POS-01', 'Main Cash Register 1', 1)
    `).run(`reg_${data.id}_01`, data.id, branchId);

    // 7. Default Categories & Units
    db.prepare(`INSERT INTO categories (id, tenant_id, name_en, name_ar, code, is_active) VALUES (?, ?, 'General Products', 'منتجات عامة', 'GEN', 1)`).run(`cat_${data.id}_gen`, data.id);
    db.prepare(`INSERT INTO units (id, tenant_id, code, name_en, name_ar, is_fractional) VALUES (?, ?, 'PCS', 'Piece', 'قطعة', 0)`).run(`unit_${data.id}_pcs`, data.id);
    db.prepare(`INSERT INTO units (id, tenant_id, code, name_en, name_ar, is_fractional) VALUES (?, ?, 'KG', 'Kilogram', 'كيلوجرام', 1)`).run(`unit_${data.id}_kg`, data.id);

    // 8. Default Chart of Accounts
    const defaultAccounts = [
      { code: '1010', en: 'Cash on Hand', ar: 'النقدية بالصندوق والخزينة', type: 'asset' },
      { code: '1020', en: 'Bank Account', ar: 'الحساب البنكي', type: 'asset' },
      { code: '1030', en: 'Accounts Receivable', ar: 'العملاء والمدينون', type: 'asset' },
      { code: '1200', en: 'Inventory Asset', ar: 'المخزون السلعي', type: 'asset' },
      { code: '2010', en: 'Accounts Payable', ar: 'الموردون والدائنون', type: 'liability' },
      { code: '2020', en: 'VAT Output Tax', ar: 'ضريبة القيمة المضافة المحصلة', type: 'liability' },
      { code: '3010', en: 'Owner Equity', ar: 'رأس المال وحقوق الملكية', type: 'equity' },
      { code: '4010', en: 'Sales Revenue', ar: 'إيرادات المبيعات', type: 'revenue' },
      { code: '5010', en: 'Cost of Goods Sold', ar: 'تكلفة المبيعات (COGS)', type: 'cogs' },
      { code: '6010', en: 'Operating Expenses', ar: 'المصروفات التشغيلية', type: 'expense' },
    ];

    const insertAccount = db.prepare(`
      INSERT INTO chart_of_accounts (id, tenant_id, account_code, account_name_en, account_name_ar, account_type, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    for (const acc of defaultAccounts) {
      insertAccount.run(`acc_${data.id}_${acc.code}`, data.id, acc.code, acc.en, acc.ar, acc.type);
    }

    // 9. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, branch_id, user_id, action, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, 'usr_superadmin', 'CREATE_MERCHANT', 'tenant', ?, ?)
    `).run(`aud_${Date.now()}`, data.id, branchId, data.id, JSON.stringify({ name: data.name, email: data.email }));
  });

  txn();
  return getTenant(data.id)!;
}

export function updateTenantStatus(id: string, status: 'active' | 'suspended' | 'trial' | 'archived') {
  db.transaction(() => {
    db.prepare("UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    db.prepare("UPDATE subscriptions SET status = ? WHERE tenant_id = ?").run(status === 'suspended' ? 'suspended' : 'active', id);
  })();
}

export function renewSubscription(tenantId: string, options: {
  duration_months?: number;
  custom_start_date?: string;
  custom_end_date?: string;
  status?: 'active' | 'suspended';
}) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as Tenant;
  if (!tenant) throw new Error('Tenant not found');

  const latestSub = db.prepare('SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY expires_at DESC LIMIT 1').get(tenantId) as any;

  let startsAt = new Date();
  if (options.custom_start_date) {
    const parsedStart = new Date(options.custom_start_date);
    if (!isNaN(parsedStart.getTime())) startsAt = parsedStart;
  } else if (latestSub && new Date(latestSub.expires_at).getTime() > Date.now()) {
    // If current subscription is still active, extend from current expiry
    startsAt = new Date(latestSub.expires_at);
  }

  let expiresAt = new Date(startsAt);
  if (options.custom_end_date) {
    const parsedEnd = new Date(options.custom_end_date);
    if (!isNaN(parsedEnd.getTime())) {
      expiresAt = parsedEnd;
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
  } else {
    const months = options.duration_months && options.duration_months > 0 ? Number(options.duration_months) : 1;
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  const subId = `sub_${Date.now()}`;
  db.transaction(() => {
    // Reactivate tenant
    db.prepare("UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(tenantId);

    // Insert new subscription
    db.prepare(`
      INSERT INTO subscriptions (id, tenant_id, plan_id, billing_cycle, status, starts_at, expires_at, auto_renew)
      VALUES (?, ?, 'plan_all_inclusive', 'custom', 'active', ?, ?, 0)
    `).run(subId, tenantId, startsAt.toISOString(), expiresAt.toISOString());

    // Record invoice
    db.prepare(`
      INSERT INTO subscription_invoices (id, tenant_id, invoice_number, amount, status, due_date, paid_at, payment_method, notes)
      VALUES (?, ?, ?, 499.00, 'paid', datetime('now'), datetime('now'), 'admin_renewal', 'Admin Subscription Renewal')
    `).run(`inv_${Date.now()}`, tenantId, `INV-${Date.now().toString().slice(-6)}`);
  })();

  return getTenant(tenantId);
}

export function getPlatformOverviewMetrics() {
  const totalMerchants = (db.prepare('SELECT COUNT(*) as count FROM tenants').get() as { count: number }).count;
  const activeMerchants = (db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'").get() as { count: number }).count;
  const suspendedMerchants = (db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'suspended'").get() as { count: number }).count;
  const trialMerchants = (db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'trial'").get() as { count: number }).count;
  const totalBranches = (db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number }).count;
  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;

  // Monthly Recurring Revenue calculated from active subscriptions
  const mrrRow = db.prepare(`
    SELECT COALESCE(SUM(p.price_monthly), 0) as mrr
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    JOIN tenants t ON s.tenant_id = t.id
    WHERE t.status = 'active'
  `).get() as { mrr: number };

  const recentActivity = db.prepare(`
    SELECT a.*, u.full_name as user_name, t.name as tenant_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN tenants t ON a.tenant_id = t.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();

  const plans = db.prepare('SELECT * FROM subscription_plans').all() as SubscriptionPlan[];

  return {
    totalMerchants,
    activeMerchants,
    suspendedMerchants,
    trialMerchants,
    totalBranches,
    totalUsers,
    mrr: mrrRow.mrr,
    recentActivity,
    plans
  };
}

// ============================================================================
// BRANCHES & USERS
// ============================================================================

export function getBranches(tenantId: string): Branch[] {
  return db.prepare('SELECT * FROM branches WHERE tenant_id = ? ORDER BY is_main DESC, code ASC').all(tenantId) as Branch[];
}

export function getBranch(tenantId: string, branchId: string): Branch | undefined {
  return db.prepare('SELECT * FROM branches WHERE tenant_id = ? AND id = ?').get(tenantId, branchId) as Branch | undefined;
}

export function createBranch(tenantId: string, data: {
  code: string;
  name_en: string;
  name_ar: string;
  phone: string;
  address: string;
  city?: string;
  opening_hours?: string;
  manager_name?: string;
}): Branch {
  const id = `br_${Date.now()}`;
  db.prepare(`
    INSERT INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, city, opening_hours, manager_name, is_active, is_main)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(id, tenantId, data.code, data.name_en, data.name_ar, data.phone, data.address, data.city || 'Cairo', data.opening_hours || '09:00 - 23:00', data.manager_name || null);

  // Create default cash register for this branch
  db.prepare(`
    INSERT INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
    VALUES (?, ?, ?, 'POS-01', ?, 1)
  `).run(`reg_${id}_01`, tenantId, id, `${data.name_ar} - نقطة بيع 1`);

  return getBranch(tenantId, id)!;
}

export function deleteBranch(tenantId: string, branchId: string): { success: boolean; error?: string } {
  const branch = db.prepare('SELECT * FROM branches WHERE tenant_id = ? AND id = ?').get(tenantId, branchId) as Branch | undefined;
  if (!branch) {
    return { success: false, error: 'الفرع غير موجود' };
  }
  if (branch.is_main === 1) {
    return { success: false, error: 'لا يمكن حذف الفرع الرئيسي للمتجر' };
  }
  const totalBranches = db.prepare('SELECT COUNT(*) as count FROM branches WHERE tenant_id = ?').get(tenantId) as { count: number };
  if (totalBranches.count <= 1) {
    return { success: false, error: 'يجب أن يمتلك المتجر فرعاً واحداً على الأقل' };
  }

  // Check if branch has associated sales
  const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE branch_id = ?').get(branchId) as { count: number };
  if (salesCount.count > 0) {
    return { success: false, error: 'لا يمكن حذف الفرع لوجود عمليات بيع مسجلة به. يمكنك تعديل بياناته بدلاً من الحذف.' };
  }

  const txn = db.transaction(() => {
    // Delete cash registers for this branch
    db.prepare('DELETE FROM cash_registers WHERE branch_id = ?').run(branchId);
    // Delete inventory balances for this branch
    db.prepare('DELETE FROM inventory_balances WHERE branch_id = ?').run(branchId);
    // Delete product batches for this branch
    db.prepare('DELETE FROM product_batches WHERE branch_id = ?').run(branchId);
    // Set users assigned to this branch to have null branch_id
    db.prepare('UPDATE users SET branch_id = NULL WHERE branch_id = ?').run(branchId);
    // Delete the branch itself
    db.prepare('DELETE FROM branches WHERE tenant_id = ? AND id = ?').run(tenantId, branchId);
  });

  txn();
  return { success: true };
}

export function getUsers(tenantId?: string, branchId?: string): User[] {
  if (!tenantId) {
    return db.prepare('SELECT id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at FROM users').all() as User[];
  }
  if (branchId) {
    return db.prepare('SELECT id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at FROM users WHERE tenant_id = ? AND (branch_id = ? OR branch_id IS NULL)').all(tenantId, branchId) as User[];
  }
  return db.prepare('SELECT id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at FROM users WHERE tenant_id = ?').all(tenantId) as User[];
}

export function getUserByUsernameOrEmail(identifier: string): (User & { password_hash: string }) | undefined {
  const cleanId = identifier.trim();
  return db.prepare(`
    SELECT * FROM users WHERE (phone = ? OR username = ? OR email = ?) AND is_active = 1
  `).get(cleanId, cleanId, cleanId) as (User & { password_hash: string }) | undefined;
}

export function createUser(data: {
  tenant_id: string;
  branch_id?: string;
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  role: string;
}): User {
  const id = `usr_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (id, tenant_id, branch_id, email, username, password_hash, full_name, phone, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, data.tenant_id, data.branch_id || null, data.email, data.username, data.password_hash, data.full_name, data.phone || null, data.role);

  return db.prepare('SELECT id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at FROM users WHERE id = ?').get(id) as User;
}

export function updateUser(id: string, tenantId: string, data: {
  full_name?: string;
  phone?: string;
  role?: string;
  branch_id?: string;
  password_hash?: string;
  is_active?: number;
}): User {
  const existing = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(id, tenantId) as (User & { password_hash: string }) | undefined;
  if (!existing) throw new Error('User not found');

  const fullName = data.full_name !== undefined ? data.full_name : existing.full_name;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const role = data.role !== undefined ? data.role : existing.role;
  const branchId = data.branch_id !== undefined ? (data.branch_id || null) : existing.branch_id;
  const isActive = data.is_active !== undefined ? data.is_active : existing.is_active;

  if (data.password_hash) {
    db.prepare(`
      UPDATE users 
      SET full_name = ?, phone = ?, role = ?, branch_id = ?, password_hash = ?, is_active = ?
      WHERE id = ? AND tenant_id = ?
    `).run(fullName, phone, role, branchId, data.password_hash, isActive, id, tenantId);
  } else {
    db.prepare(`
      UPDATE users 
      SET full_name = ?, phone = ?, role = ?, branch_id = ?, is_active = ?
      WHERE id = ? AND tenant_id = ?
    `).run(fullName, phone, role, branchId, isActive, id, tenantId);
  }

  return db.prepare('SELECT id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at FROM users WHERE id = ?').get(id) as User;
}

export function deleteUser(id: string, tenantId: string): boolean {
  const info = db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return info.changes > 0;
}


// ============================================================================
// PRODUCTS & CATALOG
// ============================================================================

export function getCategories(tenantId: string): Category[] {
  return db.prepare('SELECT * FROM categories WHERE tenant_id = ? AND is_active = 1 ORDER BY name_en ASC').all(tenantId) as Category[];
}

export function createCategory(tenantId: string, data: { name_ar: string; name_en?: string; code?: string; color?: string }): Category {
  const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const code = (data.code || `CAT_${Date.now().toString().slice(-4)}`).toUpperCase();
  const nameEn = data.name_en || data.name_ar;
  const color = data.color || '#246BFD';

  db.prepare(`
    INSERT INTO categories (id, tenant_id, name_en, name_ar, code, color, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, tenantId, nameEn, data.name_ar, code, color);

  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category;
}

export function updateCategory(tenantId: string, id: string, data: { name_ar: string; name_en?: string; code?: string; color?: string }): Category {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND tenant_id = ?').get(id, tenantId) as Category;
  if (!existing) throw new Error('Category not found');

  const nameEn = data.name_en || existing.name_en;
  const nameAr = data.name_ar || existing.name_ar;
  const code = (data.code || existing.code).toUpperCase();
  const color = data.color || existing.color;

  db.prepare(`
    UPDATE categories
    SET name_en = ?, name_ar = ?, code = ?, color = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nameEn, nameAr, code, color, id, tenantId);

  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category;
}

export function deleteCategory(tenantId: string, id: string): { success: boolean; error?: string } {
  const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND tenant_id = ?').get(id, tenantId) as { count: number };
  if (productsCount && productsCount.count > 0) {
    return {
      success: false,
      error: `لا يمكن حذف هذا القسم لأن هناك ${productsCount.count} منتجات مسجلة عليه. يرجى نقل المنتجات أولاً.`
    };
  }

  db.prepare('DELETE FROM categories WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  return { success: true };
}

export function getUnits(tenantId: string): Unit[] {
  return db.prepare('SELECT * FROM units WHERE tenant_id = ? ORDER BY name_en ASC').all(tenantId) as Unit[];
}

export function getProducts(tenantId: string, options?: {
  search?: string;
  categoryId?: string;
  branchId?: string;
  lowStockOnly?: boolean;
}): Product[] {
  let query = `
    SELECT p.*, 
           c.name_en as category_name_en, c.name_ar as category_name_ar,
           u.name_en as unit_name_en, u.name_ar as unit_name_ar,
           COALESCE(ib.quantity, 0) as current_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN units u ON p.unit_id = u.id
    LEFT JOIN inventory_balances ib ON (p.id = ib.product_id ${options?.branchId ? 'AND ib.branch_id = @branchId' : ''})
    WHERE p.tenant_id = @tenantId AND p.is_active = 1
  `;

  const params: Record<string, unknown> = { tenantId, branchId: options?.branchId || '' };

  if (options?.search) {
    query += ` AND (p.name_en LIKE @search OR p.name_ar LIKE @search OR p.barcode LIKE @search OR p.sku LIKE @search)`;
    params.search = `%${options.search}%`;
  }

  if (options?.categoryId && options.categoryId !== 'all') {
    query += ` AND p.category_id = @categoryId`;
    params.categoryId = options.categoryId;
  }

  if (options?.lowStockOnly) {
    query += ` AND COALESCE(ib.quantity, 0) <= p.min_stock_alert`;
  }

  query += ` ORDER BY p.name_en ASC`;

  return db.prepare(query).all(params) as Product[];
}

export function getProductByBarcode(tenantId: string, barcode: string): Product | undefined {
  return db.prepare(`
    SELECT p.*, 
           c.name_en as category_name_en, c.name_ar as category_name_ar,
           u.name_en as unit_name_en, u.name_ar as unit_name_ar
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.tenant_id = ? AND (p.barcode = ? OR p.additional_barcodes LIKE ?) AND p.is_active = 1
  `).get(tenantId, barcode, `%${barcode}%`) as Product | undefined;
}

export function createProduct(tenantId: string, data: {
  sku: string;
  barcode: string;
  additional_barcodes?: string;
  name_en: string;
  name_ar: string;
  category_id: string;
  unit_id: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number;
  tax_rate?: number;
  min_stock_alert?: number;
  is_weighted?: number;
  has_batch_tracking?: number;
  initial_stock?: number;
  branch_id?: string;
}): Product {
  const id = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO products (
        id, tenant_id, sku, barcode, additional_barcodes, name_en, name_ar,
        category_id, unit_id, cost_price, selling_price, wholesale_price,
        tax_rate, track_stock, min_stock_alert, is_weighted, has_batch_tracking, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
    `).run(
      id, tenantId, data.sku, data.barcode, data.additional_barcodes || null,
      data.name_en, data.name_ar, data.category_id, data.unit_id,
      data.cost_price, data.selling_price, data.wholesale_price || null,
      data.tax_rate ?? 14.0, data.min_stock_alert ?? 5.0,
      data.is_weighted ? 1 : 0, data.has_batch_tracking ? 1 : 0
    );

    // Initial stock if specified
    if (data.initial_stock && data.initial_stock > 0 && data.branch_id) {
      db.prepare(`
        INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, avg_cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`inv_${id}_${data.branch_id}`, tenantId, data.branch_id, id, data.initial_stock, data.cost_price);

      db.prepare(`
        INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, ?, ?, 'purchase', ?, ?, 'opening_stock', 'INITIAL', 'Initial stock entry', 'system')
      `).run(`mov_${Date.now()}`, tenantId, data.branch_id, id, data.initial_stock, data.cost_price);
    }
  });

  txn();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product;
}

// ============================================================================
// INVENTORY & BATCHES
// ============================================================================

export function getInventoryBalances(tenantId: string, branchId?: string): InventoryBalance[] {
  let query = `
    SELECT ib.*, p.name_en as product_name_en, p.name_ar as product_name_ar, p.sku, p.barcode
    FROM inventory_balances ib
    JOIN products p ON ib.product_id = p.id
    WHERE ib.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND ib.branch_id = ?';
    params.push(branchId);
  }
  query += ' ORDER BY p.name_en ASC';
  return db.prepare(query).all(...params) as InventoryBalance[];
}

export function getInventoryMovements(tenantId: string, options?: { branchId?: string; limit?: number }): InventoryMovement[] {
  let query = `
    SELECT im.*, p.name_en as product_name_en, p.name_ar as product_name_ar,
           b.name_en as branch_name_en, b.name_ar as branch_name_ar
    FROM inventory_movements im
    JOIN products p ON im.product_id = p.id
    JOIN branches b ON im.branch_id = b.id
    WHERE im.tenant_id = ?
  `;
  const params: unknown[] = [tenantId];
  if (options?.branchId) {
    query += ' AND im.branch_id = ?';
    params.push(options.branchId);
  }
  query += ' ORDER BY im.created_at DESC LIMIT ?';
  params.push(options?.limit || 50);
  return db.prepare(query).all(...params) as InventoryMovement[];
}

export function getBatches(tenantId: string, branchId?: string) {
  let query = `
    SELECT pb.*, p.name_en as product_name_en, p.name_ar as product_name_ar, p.barcode,
           b.name_en as branch_name_en, b.name_ar as branch_name_ar,
           CAST((julianday(pb.expiry_date) - julianday('now')) AS INTEGER) as days_until_expiry
    FROM product_batches pb
    JOIN products p ON pb.product_id = p.id
    JOIN branches b ON pb.branch_id = b.id
    WHERE pb.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND pb.branch_id = ?';
    params.push(branchId);
  }
  query += ' ORDER BY pb.expiry_date ASC';
  return db.prepare(query).all(...params);
}

export function getStockTransfers(tenantId: string): StockTransfer[] {
  return db.prepare(`
    SELECT st.*, 
           fb.name_ar as from_branch_name, tb.name_ar as to_branch_name,
           (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = st.id) as items_count
    FROM stock_transfers st
    JOIN branches fb ON st.from_branch_id = fb.id
    JOIN branches tb ON st.to_branch_id = tb.id
    WHERE st.tenant_id = ?
    ORDER BY st.created_at DESC
  `).all(tenantId) as StockTransfer[];
}

export function createStockTransfer(tenantId: string, data: {
  from_branch_id: string;
  to_branch_id: string;
  notes?: string;
  created_by: string;
  items: { product_id: string; quantity: number }[];
}): StockTransfer {
  const transferId = `trf_${Date.now()}`;
  const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_transfers (id, tenant_id, transfer_number, from_branch_id, to_branch_id, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, 'in_transit', ?, ?)
    `).run(transferId, tenantId, transferNumber, data.from_branch_id, data.to_branch_id, data.notes || null, data.created_by);

    const insertItem = db.prepare(`
      INSERT INTO stock_transfer_items (id, transfer_id, product_id, quantity_sent)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of data.items) {
      insertItem.run(`ti_${Date.now()}_${Math.random()}`, transferId, item.product_id, item.quantity);

      // Decrement source branch inventory
      db.prepare(`
        UPDATE inventory_balances 
        SET quantity = quantity - ?, last_updated = datetime('now')
        WHERE branch_id = ? AND product_id = ?
      `).run(item.quantity, data.from_branch_id, item.product_id);

      // Audit movement out
      db.prepare(`
        INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, ?, ?, 'transfer_out', ?, 0, 'stock_transfer', ?, 'Stock transferred to other branch', ?)
      `).run(`mov_${Date.now()}_${Math.random()}`, tenantId, data.from_branch_id, item.product_id, -item.quantity, transferId, data.created_by);
    }
  });

  txn();
  return db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transferId) as StockTransfer;
}

export function receiveStockTransfer(tenantId: string, transferId: string, receivedBy: string) {
  const trf = db.prepare('SELECT * FROM stock_transfers WHERE id = ? AND tenant_id = ?').get(transferId, tenantId) as StockTransfer;
  if (!trf || trf.status !== 'in_transit') return;

  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(transferId) as StockTransferItem[];

  const txn = db.transaction(() => {
    for (const item of items) {
      // Add to destination branch
      db.prepare(`
        INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, avg_cost)
        VALUES (?, ?, ?, ?, ?, 0.0)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity, last_updated = datetime('now')
      `).run(`inv_${trf.to_branch_id}_${item.product_id}`, tenantId, trf.to_branch_id, item.product_id, item.quantity_sent);

      // Record movement in
      db.prepare(`
        INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, ?, ?, 'transfer_in', ?, 0, 'stock_transfer', ?, 'Stock received from transfer', ?)
      `).run(`mov_${Date.now()}_${Math.random()}`, tenantId, trf.to_branch_id, item.product_id, item.quantity_sent, transferId, receivedBy);
    }

    db.prepare(`
      UPDATE stock_transfers 
      SET status = 'received', received_at = datetime('now') 
      WHERE id = ?
    `).run(transferId);
  });

  txn();
}

// ============================================================================
// CASH REGISTERS & SESSIONS
// ============================================================================

export function getCashRegisters(tenantId: string, branchId?: string): CashRegister[] {
  let query = `
    SELECT cr.*, b.name_ar as branch_name
    FROM cash_registers cr
    JOIN branches b ON cr.branch_id = b.id
    WHERE cr.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND cr.branch_id = ?';
    params.push(branchId);
  }
  return db.prepare(query).all(...params) as CashRegister[];
}

export function getCashSessions(tenantId: string, branchId?: string): CashSession[] {
  let query = `
    SELECT cs.*, cr.name as register_name, u.full_name as cashier_name, b.name_ar as branch_name
    FROM cash_sessions cs
    JOIN cash_registers cr ON cs.register_id = cr.id
    JOIN users u ON cs.cashier_id = u.id
    JOIN branches b ON cs.branch_id = b.id
    WHERE cs.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND cs.branch_id = ?';
    params.push(branchId);
  }
  query += ' ORDER BY cs.opened_at DESC LIMIT 50';
  return db.prepare(query).all(...params) as CashSession[];
}

export function getActiveCashSession(tenantId: string, branchId: string, registerId?: string): CashSession | undefined {
  let query = `
    SELECT cs.*, cr.name as register_name, u.full_name as cashier_name
    FROM cash_sessions cs
    JOIN cash_registers cr ON cs.register_id = cr.id
    JOIN users u ON cs.cashier_id = u.id
    WHERE cs.tenant_id = ? AND cs.branch_id = ? AND cs.status = 'open'
  `;
  const params: string[] = [tenantId, branchId];
  if (registerId) {
    query += ' AND cs.register_id = ?';
    params.push(registerId);
  }
  query += ' LIMIT 1';
  return db.prepare(query).get(...params) as CashSession | undefined;
}

export function openCashSession(tenantId: string, data: {
  branch_id: string;
  register_id: string;
  cashier_id: string;
  opening_float: number;
}): CashSession {
  const sessionId = `sess_${Date.now()}`;
  const sessionNumber = `SES-${Date.now().toString().slice(-6)}`;

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO cash_sessions (id, tenant_id, branch_id, register_id, cashier_id, session_number, opened_at, opening_float, status)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, 'open')
    `).run(sessionId, tenantId, data.branch_id, data.register_id, data.cashier_id, sessionNumber, data.opening_float);

    db.prepare(`
      INSERT INTO cash_movements (id, session_id, type, amount, reason, created_by)
      VALUES (?, ?, 'pay_in', ?, 'Opening cash float', ?)
    `).run(`cm_${Date.now()}`, sessionId, data.opening_float, data.cashier_id);
  });

  txn();
  return db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(sessionId) as CashSession;
}

export function closeCashSession(tenantId: string, sessionId: string, countedCash: number, notes?: string): CashSession {
  const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ? AND tenant_id = ?').get(sessionId, tenantId) as CashSession;
  if (!session) throw new Error('Session not found');

  // Calculate actual cash from cash sales + pay-ins - pay-outs
  const cashSalesRow = db.prepare(`
    SELECT COALESCE(SUM(paid_amount - change_amount), 0) as cash_total
    FROM sales
    WHERE session_id = ? AND payment_method = 'cash' AND status = 'completed'
  `).get(sessionId) as { cash_total: number };

  const payInsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_movements
    WHERE session_id = ? AND type = 'pay_in'
  `).get(sessionId) as { total: number };

  const payOutsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_movements
    WHERE session_id = ? AND type IN ('pay_out', 'expense')
  `).get(sessionId) as { total: number };

  const expectedCash = (payInsRow.total + cashSalesRow.cash_total) - payOutsRow.total;
  const difference = countedCash - expectedCash;

  db.prepare(`
    UPDATE cash_sessions
    SET status = 'closed', closed_at = datetime('now'),
        closing_cash_counted = ?, expected_cash = ?, difference = ?, notes = ?
    WHERE id = ?
  `).run(countedCash, expectedCash, difference, notes || null, sessionId);

  return db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(sessionId) as CashSession;
}

// ============================================================================
// POINT OF SALE (POS) & ATOMIC SALE COMMIT
// ============================================================================

export interface CreateSaleInput {
  tenant_id: string;
  branch_id: string;
  register_id: string;
  session_id: string;
  cashier_id: string;
  customer_id?: string;
  items: {
    product_id: string;
    batch_id?: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
    discount_amount: number;
    tax_amount: number;
    line_total: number;
  }[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: 'cash' | 'card' | 'mobile_wallet' | 'customer_credit' | 'mixed';
  notes?: string;
}

export function commitSaleTransaction(input: CreateSaleInput): Sale {
  const saleId = `sale_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // 1. Resolve and validate branch_id
  let branchId = input.branch_id;
  const branchExists = db.prepare('SELECT id, code FROM branches WHERE id = ?').get(branchId) as { id: string; code: string } | undefined;
  if (!branchExists) {
    const defaultBranch = db.prepare('SELECT id, code FROM branches WHERE tenant_id = ? ORDER BY is_main DESC LIMIT 1').get(input.tenant_id) as { id: string; code: string } | undefined;
    if (defaultBranch) {
      branchId = defaultBranch.id;
    } else {
      branchId = `br_${input.tenant_id}_main`;
      db.prepare(`
        INSERT INTO branches (id, tenant_id, code, name_en, name_ar, phone, address, is_active, is_main, created_at)
        VALUES (?, ?, 'MAIN', 'Main Branch', 'الفرع الرئيسي', '01000000000', 'العنوان الرئيسي', 1, 1, datetime('now'))
      `).run(branchId, input.tenant_id);
    }
  }
  const branch = db.prepare('SELECT code FROM branches WHERE id = ?').get(branchId) as { code: string } | undefined;
  const branchCode = branch ? branch.code : 'BR';
  const saleNumber = `INV-${branchCode}-${Date.now().toString().slice(-6)}`;

  // 2. Resolve and validate cashier_id
  let cashierId = input.cashier_id;
  const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(cashierId);
  if (!userExists) {
    const tenantUser = db.prepare('SELECT id FROM users WHERE tenant_id = ? LIMIT 1').get(input.tenant_id) as { id: string } | undefined;
    if (tenantUser) {
      cashierId = tenantUser.id;
    } else {
      const anyUser = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
      cashierId = anyUser ? anyUser.id : 'usr_superadmin_01';
    }
  }

  // 3. Resolve and validate register_id
  let registerId = input.register_id;
  const regExists = db.prepare('SELECT id FROM cash_registers WHERE id = ?').get(registerId);
  if (!regExists) {
    const foundReg = db.prepare('SELECT id FROM cash_registers WHERE tenant_id = ? AND branch_id = ? LIMIT 1').get(input.tenant_id, branchId) as { id: string } | undefined;
    if (foundReg) {
      registerId = foundReg.id;
    } else {
      registerId = `reg_${branchId}_01`;
      db.prepare(`
        INSERT OR IGNORE INTO cash_registers (id, tenant_id, branch_id, code, name, is_active)
        VALUES (?, ?, ?, 'POS-01', 'نقطة البيع الرئيسية', 1)
      `).run(registerId, input.tenant_id, branchId);
    }
  }

  // 4. Resolve and validate session_id
  let sessionId = input.session_id;
  const sessExists = db.prepare('SELECT id FROM cash_sessions WHERE id = ?').get(sessionId);
  if (!sessExists) {
    const activeSess = db.prepare(`
      SELECT id FROM cash_sessions 
      WHERE tenant_id = ? AND branch_id = ? AND status = 'open' 
      ORDER BY opened_at DESC LIMIT 1
    `).get(input.tenant_id, branchId) as { id: string } | undefined;

    if (activeSess) {
      sessionId = activeSess.id;
    } else {
      sessionId = `sess_${branchId}_${Date.now()}`;
      const sessNumber = `SES-${Date.now().toString().slice(-6)}`;
      db.prepare(`
        INSERT INTO cash_sessions (id, tenant_id, branch_id, register_id, cashier_id, session_number, opened_at, opening_float, status)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0, 'open')
      `).run(sessionId, input.tenant_id, branchId, registerId, cashierId, sessNumber);
    }
  }

  // 5. Resolve and validate customer_id
  let customerId: string | null = input.customer_id || null;
  if (customerId) {
    const custExists = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!custExists) {
      customerId = null;
    }
  }

  // 6. Check if VAT is enabled in merchant settings
  const tenantSettings = db.prepare('SELECT vat_enabled FROM tenant_settings WHERE tenant_id = ?').get(input.tenant_id) as { vat_enabled: number } | undefined;
  const isVatEnabled = tenantSettings ? tenantSettings.vat_enabled === 1 : true;
  const finalTaxAmount = isVatEnabled ? input.tax_amount : 0;
  const finalTotalAmount = isVatEnabled ? input.total_amount : Math.max(0, input.subtotal - input.discount_amount);

  const txn = db.transaction(() => {
    // 1. Insert Sale Header
    db.prepare(`
      INSERT INTO sales (
        id, tenant_id, branch_id, register_id, session_id, cashier_id, customer_id,
        sale_number, subtotal, discount_amount, tax_amount, total_amount, paid_amount,
        change_amount, payment_method, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now'))
    `).run(
      saleId, input.tenant_id, branchId, registerId, sessionId,
      cashierId, customerId, saleNumber, input.subtotal,
      input.discount_amount, finalTaxAmount, finalTotalAmount, input.paid_amount,
      input.change_amount, input.payment_method, input.notes || null
    );

    // 2. Insert Sale Items & Deduct Stock Atomically
    let totalCogs = 0;
    const insertItem = db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, batch_id, quantity, unit_price, cost_price, discount_amount, tax_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE inventory_balances
      SET quantity = quantity - ?, last_updated = datetime('now')
      WHERE branch_id = ? AND product_id = ?
    `);

    const recordMovement = db.prepare(`
      INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
      VALUES (?, ?, ?, ?, 'sale', ?, ?, 'sale_invoice', ?, 'POS Checkout sale', ?)
    `);

    for (const item of input.items) {
      const itemId = `si_${Date.now()}_${Math.random()}`;

      // Validate batch_id if provided
      let validBatchId: string | null = null;
      if (item.batch_id) {
        const batchExists = db.prepare('SELECT id FROM product_batches WHERE id = ?').get(item.batch_id);
        if (batchExists) validBatchId = item.batch_id;
      }

      const itemTaxAmount = isVatEnabled ? item.tax_amount : 0;
      const itemLineTotal = isVatEnabled ? item.line_total : (item.unit_price * item.quantity - item.discount_amount);

      insertItem.run(
        itemId, saleId, item.product_id, validBatchId,
        item.quantity, item.unit_price, item.cost_price,
        item.discount_amount, itemTaxAmount, itemLineTotal
      );

      totalCogs += item.cost_price * item.quantity;

      // Ensure inventory_balances row exists, then update
      db.prepare(`
        INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, reserved_qty, avg_cost, last_updated)
        VALUES (?, ?, ?, ?, 0, 0, ?, datetime('now'))
        ON CONFLICT(branch_id, product_id) DO NOTHING
      `).run(`ib_${branchId}_${item.product_id}`, input.tenant_id, branchId, item.product_id, item.cost_price);

      updateStock.run(item.quantity, branchId, item.product_id);

      // Record in auditable ledger
      recordMovement.run(
        `mov_${Date.now()}_${Math.random()}`,
        input.tenant_id, branchId, item.product_id,
        -item.quantity, item.cost_price, saleNumber, cashierId
      );

      // Deduct from batch if tracked
      if (validBatchId) {
        db.prepare('UPDATE product_batches SET quantity = quantity - ? WHERE id = ?').run(item.quantity, validBatchId);
      }
    }

    // 3. Record Payment breakdown
    db.prepare(`
      INSERT INTO sale_payments (id, sale_id, payment_method, amount)
      VALUES (?, ?, ?, ?)
    `).run(`sp_${Date.now()}`, saleId, input.payment_method, input.paid_amount);

    // 4. If customer credit payment, update customer account balance
    if (customerId && input.payment_method === 'customer_credit') {
      db.prepare(`
        UPDATE customers 
        SET current_balance = current_balance + ? 
        WHERE id = ?
      `).run(input.total_amount, customerId);
    }

    // 5. Award loyalty points (1 point per 10 EGP)
    if (customerId) {
      const earnedPoints = Math.floor(input.total_amount / 10);
      db.prepare(`UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?`).run(earnedPoints, customerId);
    }

    // 6. Double-Entry Accounting Journal Entry
    const journalId = `je_${Date.now()}`;
    const journalNumber = `JE-SALE-${Date.now().toString().slice(-6)}`;

    db.prepare(`
      INSERT INTO journal_entries (id, tenant_id, branch_id, entry_number, entry_date, description, reference_type, reference_id)
      VALUES (?, ?, ?, ?, ?, 'POS Sale Revenue and COGS', 'sale', ?)
    `).run(journalId, input.tenant_id, branchId, journalNumber, new Date().toISOString().split('T')[0], saleId);

    const insertJournalLine = db.prepare(`
      INSERT INTO journal_lines (id, entry_id, account_code, debit, credit)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Debit Cash or Receivable
    const paymentAccount = input.payment_method === 'customer_credit' ? '1030' : (input.payment_method === 'card' || input.payment_method === 'mobile_wallet' ? '1020' : '1010');
    insertJournalLine.run(`jl_${Date.now()}_1`, journalId, paymentAccount, input.total_amount, 0);

    // Credit Sales Revenue
    insertJournalLine.run(`jl_${Date.now()}_2`, journalId, '4010', 0, input.subtotal - input.discount_amount);

    // Credit Tax Liability if tax > 0
    if (input.tax_amount > 0) {
      insertJournalLine.run(`jl_${Date.now()}_3`, journalId, '2020', 0, input.tax_amount);
    }

    // Debit COGS & Credit Inventory
    if (totalCogs > 0) {
      insertJournalLine.run(`jl_${Date.now()}_4`, journalId, '5010', totalCogs, 0);
      insertJournalLine.run(`jl_${Date.now()}_5`, journalId, '1200', 0, totalCogs);
    }

    // 7. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, branch_id, user_id, action, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, ?, 'POS_SALE', 'sale', ?, ?)
    `).run(`aud_${Date.now()}`, input.tenant_id, branchId, cashierId, saleId, JSON.stringify({ saleNumber, total: input.total_amount }));
  });

  txn();
  return getSale(input.tenant_id, saleId)!;
}

export function getSales(tenantId: string, options?: {
  branchId?: string;
  limit?: number;
}): Sale[] {
  let query = `
    SELECT s.*, 
           c.name as customer_name, u.full_name as cashier_name, b.name_ar as branch_name,
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.cashier_id = u.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE s.tenant_id = ?
  `;
  const params: unknown[] = [tenantId];
  if (options?.branchId) {
    query += ' AND s.branch_id = ?';
    params.push(options.branchId);
  }
  query += ' ORDER BY s.created_at DESC LIMIT ?';
  params.push(options?.limit || 50);

  return db.prepare(query).all(...params) as Sale[];
}

export function getSale(tenantId: string, saleId: string): (Sale & { items: SaleItem[] }) | undefined {
  const sale = db.prepare(`
    SELECT s.*, 
           c.name as customer_name, c.phone as customer_phone,
           u.full_name as cashier_name, b.name_en as branch_name_en, b.name_ar as branch_name_ar,
           b.address as branch_address, b.phone as branch_phone
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.cashier_id = u.id
    LEFT JOIN branches b ON s.branch_id = b.id
    WHERE s.tenant_id = ? AND s.id = ?
  `).get(tenantId, saleId) as Sale | undefined;

  if (!sale) return undefined;

  const items = db.prepare(`
    SELECT si.*, p.name_en as product_name_en, p.name_ar as product_name_ar, p.sku
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `).all(saleId) as SaleItem[];

  return { ...sale, items };
}

export function processSaleReturn(tenantId: string, data: {
  saleId: string;
  refundAmount: number;
  refundMethod: string;
  restock: boolean;
  reason: string;
  createdBy: string;
  items?: { product_id: string; quantity: number; unit_price: number; cost_price: number }[];
}) {
  const sale = getSale(tenantId, data.saleId);
  if (!sale) throw new Error('Sale not found');

  const returnId = `ret_${Date.now()}`;
  const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

  const txn = db.transaction(() => {
    // 1. Insert into sale_returns
    db.prepare(`
      INSERT INTO sale_returns (id, tenant_id, branch_id, sale_id, return_number, refund_amount, refund_method, restock, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      returnId, tenantId, sale.branch_id, sale.id, returnNumber,
      data.refundAmount, data.refundMethod, data.restock ? 1 : 0, data.reason, data.createdBy
    );

    // 2. Insert returned items
    const returnItems = data.items && data.items.length > 0 ? data.items : sale.items.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      cost_price: i.cost_price || 0
    }));

    const insertReturnItem = db.prepare(`
      INSERT INTO sale_return_items (id, return_id, product_id, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let totalRestockCost = 0;

    for (const item of returnItems) {
      insertReturnItem.run(`sri_${Date.now()}_${Math.random()}`, returnId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price);

      // If restock is true, increment inventory balance & record movement
      if (data.restock) {
        db.prepare(`
          UPDATE inventory_balances 
          SET quantity = quantity + ?, last_updated = datetime('now')
          WHERE branch_id = ? AND product_id = ?
        `).run(item.quantity, sale.branch_id, item.product_id);

        db.prepare(`
          INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
          VALUES (?, ?, ?, ?, 'return', ?, ?, 'sale_return', ?, 'Customer sale return / restock', ?)
        `).run(`mov_${Date.now()}_${Math.random()}`, tenantId, sale.branch_id, item.product_id, item.quantity, item.cost_price, returnNumber, data.createdBy);

        totalRestockCost += (item.cost_price || 0) * item.quantity;
      }
    }

    // 3. Update Sale status
    const isFullRefund = data.refundAmount >= sale.total_amount;
    db.prepare(`
      UPDATE sales SET status = ? WHERE id = ?
    `).run(isFullRefund ? 'returned' : 'partially_returned', sale.id);

    // 4. If customer credit payment and customer exists, reduce customer balance
    if (sale.customer_id && data.refundMethod === 'customer_credit') {
      db.prepare(`UPDATE customers SET current_balance = MAX(0, current_balance - ?) WHERE id = ?`).run(data.refundAmount, sale.customer_id);
    }

    // 5. Journal Entry
    const journalId = `je_${Date.now()}`;
    db.prepare(`
      INSERT INTO journal_entries (id, tenant_id, branch_id, entry_number, entry_date, description, reference_type, reference_id)
      VALUES (?, ?, ?, ?, ?, 'Customer Sale Return and Refund', 'sale_return', ?)
    `).run(journalId, tenantId, sale.branch_id, `JE-RET-${Date.now().toString().slice(-6)}`, new Date().toISOString().split('T')[0], returnId);

    // Debit Sales Revenue (4010)
    db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, '4010', ?, 0)`).run(`jl_${Date.now()}_1`, journalId, data.refundAmount);

    // Credit Cash (1010) or Receivable (1030)
    const refundAccount = data.refundMethod === 'customer_credit' ? '1030' : '1010';
    db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, 0, ?)`).run(`jl_${Date.now()}_2`, journalId, refundAccount, data.refundAmount);

    // Reverse COGS and re-add Inventory if restocked
    if (data.restock && totalRestockCost > 0) {
      db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, '1200', ?, 0)`).run(`jl_${Date.now()}_3`, journalId, totalRestockCost);
      db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, '5010', 0, ?)`).run(`jl_${Date.now()}_4`, journalId, totalRestockCost);
    }

    // 6. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, tenant_id, branch_id, user_id, action, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, ?, 'SALE_RETURN', 'sale_return', ?, ?)
    `).run(`aud_${Date.now()}`, tenantId, sale.branch_id, data.createdBy, returnId, JSON.stringify({ saleId: sale.id, returnNumber, refundAmount: data.refundAmount, restock: data.restock }));
  });

  txn();
  return { success: true, returnNumber };
}

// ============================================================================
// PURCHASING & SUPPLIERS
// ============================================================================

export function getSuppliers(tenantId: string): Supplier[] {
  return db.prepare('SELECT * FROM suppliers WHERE tenant_id = ? ORDER BY name ASC').all(tenantId) as Supplier[];
}

export function createSupplier(tenantId: string, data: {
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  tax_id?: string;
  payment_terms?: string;
  opening_balance?: number;
}): Supplier {
  const id = `sup_${Date.now()}`;
  db.prepare(`
    INSERT INTO suppliers (id, tenant_id, code, name, contact_person, phone, email, tax_id, payment_terms, opening_balance, current_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, data.code, data.name, data.contact_person || null, data.phone, data.email || null, data.tax_id || null, data.payment_terms || '30 Days Net', data.opening_balance || 0, data.opening_balance || 0);

  return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as Supplier;
}

export function getPurchaseOrders(tenantId: string, branchId?: string): PurchaseOrder[] {
  let query = `
    SELECT po.*, s.name as supplier_name, b.name_ar as branch_name
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN branches b ON po.branch_id = b.id
    WHERE po.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND po.branch_id = ?';
    params.push(branchId);
  }
  query += ' ORDER BY po.created_at DESC';
  return db.prepare(query).all(...params) as PurchaseOrder[];
}

export function createPurchaseOrder(tenantId: string, data: {
  branch_id: string;
  supplier_id: string;
  items: { product_id: string; quantity: number; unit_cost: number }[];
  notes?: string;
  created_by: string;
}): PurchaseOrder {
  const poId = `po_${Date.now()}`;
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;
  let totalAmount = 0;

  const txn = db.transaction(() => {
    for (const item of data.items) {
      totalAmount += item.quantity * item.unit_cost;
    }

    db.prepare(`
      INSERT INTO purchase_orders (id, tenant_id, branch_id, supplier_id, po_number, status, total_amount, net_amount, notes, created_by)
      VALUES (?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?)
    `).run(poId, tenantId, data.branch_id, data.supplier_id, poNumber, totalAmount, totalAmount, data.notes || null, data.created_by);

    const insertPoItem = db.prepare(`
      INSERT INTO purchase_order_items (id, po_id, product_id, quantity_ordered, unit_cost, total_cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of data.items) {
      insertPoItem.run(`poi_${Date.now()}_${Math.random()}`, poId, item.product_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost);
    }
  });

  txn();
  return db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as PurchaseOrder;
}

export function receivePurchaseOrderGoods(tenantId: string, poId: string, receivedBy: string) {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?').get(poId, tenantId) as PurchaseOrder;
  if (!po) throw new Error('Purchase order not found');

  const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(poId) as { product_id: string; quantity_ordered: number; unit_cost: number }[];

  const txn = db.transaction(() => {
    for (const item of items) {
      // Add stock to branch
      db.prepare(`
        INSERT INTO inventory_balances (id, tenant_id, branch_id, product_id, quantity, avg_cost)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity, avg_cost = excluded.avg_cost, last_updated = datetime('now')
      `).run(`inv_${po.branch_id}_${item.product_id}`, tenantId, po.branch_id, item.product_id, item.quantity_ordered, item.unit_cost);

      // Audit movement
      db.prepare(`
        INSERT INTO inventory_movements (id, tenant_id, branch_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, ?, ?, 'purchase', ?, ?, 'purchase_order', ?, 'Received PO goods into branch', ?)
      `).run(`mov_${Date.now()}_${Math.random()}`, tenantId, po.branch_id, item.product_id, item.quantity_ordered, item.unit_cost, po.po_number, receivedBy);
    }

    // Update PO status
    db.prepare("UPDATE purchase_orders SET status = 'received' WHERE id = ?").run(poId);

    // Update supplier current balance (Account Payable)
    db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(po.net_amount, po.supplier_id);
  });

  txn();
}

// ============================================================================
// CUSTOMERS & ACCOUNTS RECEIVABLE
// ============================================================================

export function getCustomers(tenantId: string): Customer[] {
  return db.prepare('SELECT * FROM customers WHERE tenant_id = ? ORDER BY name ASC').all(tenantId) as Customer[];
}

export function createCustomer(tenantId: string, data: {
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tax_id?: string;
  credit_limit?: number;
}): Customer {
  const id = `cust_${Date.now()}`;
  db.prepare(`
    INSERT INTO customers (id, tenant_id, code, name, phone, email, address, tax_id, credit_limit, current_balance, loyalty_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 0)
  `).run(id, tenantId, data.code, data.name, data.phone, data.email || null, data.address || null, data.tax_id || null, data.credit_limit || 1000.0);

  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer;
}

// ============================================================================
// EXPENSES & ACCOUNTING
// ============================================================================

export function getExpenses(tenantId: string, branchId?: string): Expense[] {
  let query = `
    SELECT e.*, b.name_ar as branch_name
    FROM expenses e
    JOIN branches b ON e.branch_id = b.id
    WHERE e.tenant_id = ?
  `;
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND e.branch_id = ?';
    params.push(branchId);
  }
  query += ' ORDER BY e.created_at DESC';
  return db.prepare(query).all(...params) as Expense[];
}

export function createExpense(tenantId: string, data: {
  branch_id: string;
  category: string;
  amount: number;
  payment_source: 'cash_drawer' | 'bank_account' | 'petty_cash';
  payee?: string;
  description: string;
  created_by: string;
}): Expense {
  const id = `exp_${Date.now()}`;

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT INTO expenses (id, tenant_id, branch_id, category, amount, payment_source, payee, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, data.branch_id, data.category, data.amount, data.payment_source, data.payee || null, data.description, data.created_by);

    // If paid from cash drawer, also register in current cash session if available
    if (data.payment_source === 'cash_drawer') {
      const activeSession = db.prepare("SELECT id FROM cash_sessions WHERE tenant_id = ? AND branch_id = ? AND status = 'open' LIMIT 1").get(tenantId, data.branch_id) as { id: string } | undefined;
      if (activeSession) {
        db.prepare(`
          INSERT INTO cash_movements (id, session_id, type, amount, reason, created_by)
          VALUES (?, ?, 'expense', ?, ?, ?)
        `).run(`cm_${Date.now()}`, activeSession.id, data.amount, `${data.category}: ${data.description}`, data.created_by);
      }
    }

    // Double-Entry Journal Line
    const journalId = `je_${Date.now()}`;
    db.prepare(`
      INSERT INTO journal_entries (id, tenant_id, branch_id, entry_number, entry_date, description, reference_type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'expense', ?)
    `).run(journalId, tenantId, data.branch_id, `JE-EXP-${Date.now().toString().slice(-6)}`, new Date().toISOString().split('T')[0], `Operating Expense: ${data.category}`, id);

    // Debit Operating Expenses (6010)
    db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, '6010', ?, 0)`).run(`jl_${Date.now()}_1`, journalId, data.amount);

    // Credit Cash (1010) or Bank (1020)
    const creditAccount = data.payment_source === 'bank_account' ? '1020' : '1010';
    db.prepare(`INSERT INTO journal_lines (id, entry_id, account_code, debit, credit) VALUES (?, ?, ?, 0, ?)`).run(`jl_${Date.now()}_2`, journalId, creditAccount, data.amount);
  });

  txn();
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

export function getChartOfAccounts(tenantId: string): Account[] {
  return db.prepare('SELECT * FROM chart_of_accounts WHERE tenant_id = ? ORDER BY account_code ASC').all(tenantId) as Account[];
}

export function getJournalEntries(tenantId: string) {
  const entries = db.prepare(`
    SELECT * FROM journal_entries WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(tenantId) as JournalEntry[];

  for (const entry of entries) {
    entry.lines = db.prepare(`
      SELECT jl.*, coa.account_name_en, coa.account_name_ar
      FROM journal_lines jl
      LEFT JOIN chart_of_accounts coa ON (jl.account_code = coa.account_code AND coa.tenant_id = ?)
      WHERE jl.entry_id = ?
    `).all(tenantId, entry.id) as JournalEntry['lines'];
  }

  return entries;
}

// ============================================================================
// MERCHANT DASHBOARD ANALYTICS & KPIS
// ============================================================================

export function getMerchantDashboardKpis(tenantId: string, branchId?: string) {
  let branchFilter = '';
  const params: string[] = [tenantId];
  if (branchId) {
    branchFilter = ' AND branch_id = ?';
    params.push(branchId);
  }

  // Today's Sales
  const salesTodayRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total,
           COALESCE(SUM(subtotal), 0) as gross_sales,
           COALESCE(SUM(discount_amount), 0) as total_discounts,
           COALESCE(SUM(tax_amount), 0) as total_tax,
           COUNT(*) as count
    FROM sales
    WHERE tenant_id = ? ${branchFilter} AND date(created_at) = date('now') AND status = 'completed'
  `).get(...params) as { total: number; gross_sales: number; total_discounts: number; total_tax: number; count: number };

  // All time / current period sales
  const salesMonthRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total,
           COALESCE(SUM(subtotal), 0) as gross_sales,
           COALESCE(SUM(discount_amount), 0) as total_discounts,
           COUNT(*) as count
    FROM sales
    WHERE tenant_id = ? ${branchFilter} AND status = 'completed'
  `).get(...params) as { total: number; gross_sales: number; total_discounts: number; count: number };

  // Cost of Goods Sold (COGS)
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cogs
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.tenant_id = ? ${branchFilter ? ' AND s.branch_id = ?' : ''} AND s.status = 'completed'
  `).get(...params) as { total_cogs: number };

  // Operating Expenses
  const expensesRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    WHERE tenant_id = ? ${branchFilter}
  `).get(...params) as { total_expenses: number };

  // Inventory valuation
  const inventoryRow = db.prepare(`
    SELECT COALESCE(SUM(quantity * avg_cost), 0) as total_val,
           COALESCE(SUM(quantity), 0) as total_qty
    FROM inventory_balances
    WHERE tenant_id = ? ${branchFilter}
  `).get(...params) as { total_val: number; total_qty: number };

  // Top Selling Products
  const topProducts = db.prepare(`
    SELECT p.name_en, p.name_ar, p.sku, 
           SUM(si.quantity) as total_sold,
           SUM(si.line_total) as revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.tenant_id = ? ${branchFilter ? ' AND s.branch_id = ?' : ''} AND s.status = 'completed'
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 5
  `).all(...params);

  // Near Expiry items count (<30 days)
  const nearExpiryCount = (db.prepare(`
    SELECT COUNT(*) as count
    FROM product_batches
    WHERE tenant_id = ? ${branchFilter} AND julianday(expiry_date) - julianday('now') <= 30
  `).get(...params) as { count: number }).count;

  // Low stock products count
  const lowStockCount = (db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    JOIN inventory_balances ib ON p.id = ib.product_id
    WHERE p.tenant_id = ? ${branchFilter ? ' AND ib.branch_id = ?' : ''} AND ib.quantity <= p.min_stock_alert
  `).get(...params) as { count: number }).count;

  // Exact calculations as mandated by Section 8 & 19
  const netSales = salesMonthRow.gross_sales - salesMonthRow.total_discounts;
  const grossProfit = netSales - cogsRow.total_cogs;
  const grossMarginPct = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';
  const netOperatingProfit = grossProfit - expensesRow.total_expenses;

  return {
    salesToday: salesTodayRow.total,
    transactionsToday: salesTodayRow.count,
    grossSales: salesMonthRow.gross_sales,
    netSales,
    cogs: cogsRow.total_cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses: expensesRow.total_expenses,
    netOperatingProfit,
    inventoryValuation: inventoryRow.total_val,
    inventoryUnits: inventoryRow.total_qty,
    nearExpiryCount,
    lowStockCount,
    topProducts
  };
}

// ============================================================================
// NOTIFICATIONS & AUDIT LOGS
// ============================================================================

export function getNotifications(tenantId: string, branchId?: string): Notification[] {
  let query = 'SELECT * FROM notifications WHERE tenant_id = ?';
  const params: string[] = [tenantId];
  if (branchId) {
    query += ' AND (branch_id = ? OR branch_id IS NULL)';
    params.push(branchId);
  }
  query += ' ORDER BY created_at DESC LIMIT 20';
  return db.prepare(query).all(...params) as Notification[];
}

export function markNotificationRead(id: string) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function getAuditLogs(tenantId?: string, limit: number = 50): AuditLog[] {
  if (tenantId) {
    return db.prepare(`
      SELECT a.*, u.full_name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.tenant_id = ?
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(tenantId, limit) as AuditLog[];
  }
  return db.prepare(`
    SELECT a.*, u.full_name as user_name, t.name as tenant_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN tenants t ON a.tenant_id = t.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit) as AuditLog[];
}

export function getTenantSettings(tenantId: string) {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  const settings = db.prepare('SELECT * FROM tenant_settings WHERE tenant_id = ?').get(tenantId);
  return { tenant, settings };
}

export function updateTenantSettings(tenantId: string, data: {
  name?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  logo_url?: string;
  default_tax_rate?: number;
  vat_enabled?: number;
  receipt_header?: string;
  receipt_footer?: string;
  receipt_width?: '58mm' | '80mm';
  scale_barcode_prefix?: string;
  valuation_method?: 'FIFO' | 'WAC';
  expiry_warning_days?: number;
}) {
  const txn = db.transaction(() => {
    if (data.name || data.phone || data.email || data.tax_id || data.logo_url) {
      db.prepare(`
        UPDATE tenants 
        SET name = COALESCE(?, name),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            tax_id = COALESCE(?, tax_id),
            logo_url = COALESCE(?, logo_url),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(data.name || null, data.phone || null, data.email || null, data.tax_id || null, data.logo_url || null, tenantId);
    }

    db.prepare(`
      UPDATE tenant_settings
      SET default_tax_rate = COALESCE(?, default_tax_rate),
          vat_enabled = COALESCE(?, vat_enabled),
          receipt_header = COALESCE(?, receipt_header),
          receipt_footer = COALESCE(?, receipt_footer),
          receipt_width = COALESCE(?, receipt_width),
          scale_barcode_prefix = COALESCE(?, scale_barcode_prefix),
          valuation_method = COALESCE(?, valuation_method),
          expiry_warning_days = COALESCE(?, expiry_warning_days)
      WHERE tenant_id = ?
    `).run(
      data.default_tax_rate ?? null,
      data.vat_enabled ?? null,
      data.receipt_header ?? null,
      data.receipt_footer ?? null,
      data.receipt_width ?? null,
      data.scale_barcode_prefix ?? null,
      data.valuation_method ?? null,
      data.expiry_warning_days ?? null,
      tenantId
    );
  });

  txn();
  return getTenantSettings(tenantId);
}
