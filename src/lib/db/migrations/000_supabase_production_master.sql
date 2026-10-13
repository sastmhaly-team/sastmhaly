-- ============================================================================
-- SASTMHALY (سستمهالي) - PRODUCTION MASTER DATABASE SCRIPT FOR SUPABASE
-- Multi-Tenant Retail Management SaaS (نقاط البيع، المخزون، الحسابات، إدارة التجار والفروع)
-- ============================================================================
-- Instructions: Run this script directly in your Supabase SQL Editor.
-- It creates all tables, foreign keys, constraints, indexes, storage buckets,
-- and inserts the initial platform seed data (Super Admin & All-Inclusive Plan).
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE PLATFORM & TENANCY (إدارة المنصة والتجار والاشتراكات)
-- ============================================================================

-- 1. Tenants / Merchants (المتاجر والشركات)
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128) NOT NULL,
  tax_id VARCHAR(64),
  commercial_reg VARCHAR(64),
  logo_url TEXT,
  currency VARCHAR(16) NOT NULL DEFAULT 'EGP',
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, suspended, trial, archived
  onboarding_completed SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tenant Settings (إعدادات المتجر والفواتير والضريبة)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  vat_enabled SMALLINT NOT NULL DEFAULT 1,
  receipt_header TEXT,
  receipt_footer TEXT,
  receipt_width VARCHAR(16) NOT NULL DEFAULT '80mm',
  scale_barcode_prefix VARCHAR(8) NOT NULL DEFAULT '21',
  valuation_method VARCHAR(16) NOT NULL DEFAULT 'WAC', -- WAC, FIFO
  allow_negative_stock SMALLINT NOT NULL DEFAULT 0,
  expiry_warning_days INTEGER NOT NULL DEFAULT 30,
  auto_reorder_enabled SMALLINT NOT NULL DEFAULT 1
);

-- 3. Subscription Plans (خطط الاشتراك)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  name_en VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  price_monthly NUMERIC(12,2) NOT NULL,
  price_annual NUMERIC(12,2) NOT NULL,
  max_branches INTEGER NOT NULL,
  max_users INTEGER NOT NULL,
  max_products INTEGER NOT NULL,
  features JSONB NOT NULL
);

-- 4. Subscriptions (اشتراكات التجار وتواريخ الصلاحية)
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, trial, past_due, expired, canceled
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  auto_renew SMALLINT NOT NULL DEFAULT 1
);

-- 5. Subscription Invoices & Billing (فواتير الاشتراك وإيرادات المنصة)
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'paid', -- paid, pending, failed
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR(64) NOT NULL DEFAULT 'manual_bank',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Branches (فروع المتاجر)
CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(64) NOT NULL DEFAULT 'Cairo',
  opening_hours VARCHAR(64) DEFAULT '09:00 - 23:00',
  manager_name VARCHAR(128),
  is_active SMALLINT NOT NULL DEFAULT 1,
  is_main SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_branch_code UNIQUE (tenant_id, code)
);

-- 7. Users (المستخدمون: مدير المنصة، صاحب المتجر، مدراء الفروع، الكاشير)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  role VARCHAR(32) NOT NULL, -- super_admin, merchant_owner, branch_manager, cashier, inventory_manager, accountant, auditor
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CATALOG & PRODUCTS (التصنيفات والوحدات والمنتجات)
-- ============================================================================

-- 8. Product Categories (أقسام وتصنيفات المنتجات)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name_en VARCHAR(128) NOT NULL,
  name_ar VARCHAR(128) NOT NULL,
  code VARCHAR(32) NOT NULL,
  color VARCHAR(16) DEFAULT '#246BFD',
  is_active SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_tenant_cat_code UNIQUE (tenant_id, code)
);

-- 9. Units of Measurement (وحدات القياس)
CREATE TABLE IF NOT EXISTS units (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en VARCHAR(64) NOT NULL,
  name_ar VARCHAR(64) NOT NULL,
  is_fractional SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_tenant_unit_code UNIQUE (tenant_id, code)
);

-- 10. Products (المنتجات والأسعار والباركود)
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  barcode VARCHAR(64) NOT NULL,
  additional_barcodes TEXT,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) NOT NULL REFERENCES categories(id),
  unit_id VARCHAR(64) NOT NULL REFERENCES units(id),
  cost_price NUMERIC(12,4) NOT NULL,
  selling_price NUMERIC(12,4) NOT NULL,
  wholesale_price NUMERIC(12,4),
  min_selling_price NUMERIC(12,4),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  track_stock SMALLINT NOT NULL DEFAULT 1,
  min_stock_alert NUMERIC(12,2) NOT NULL DEFAULT 5.00,
  max_stock_alert NUMERIC(12,2),
  is_weighted SMALLINT NOT NULL DEFAULT 0,
  has_batch_tracking SMALLINT NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_prod_sku UNIQUE (tenant_id, sku),
  CONSTRAINT uq_tenant_prod_barcode UNIQUE (tenant_id, barcode)
);

-- 11. Product Batches & Expiry (دفعات الإنتاج وتواريخ الصلاحية)
CREATE TABLE IF NOT EXISTS product_batches (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  batch_number VARCHAR(64) NOT NULL,
  production_date DATE,
  expiry_date DATE NOT NULL,
  quantity NUMERIC(12,4) NOT NULL,
  cost_price NUMERIC(12,4) NOT NULL
);

-- ============================================================================
-- INVENTORY & SUPPLY CHAIN (المخزون والتحويلات والمشتريات)
-- ============================================================================

-- 12. Inventory Balances per Branch (أرصدة المخزون لكل فرع)
CREATE TABLE IF NOT EXISTS inventory_balances (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  reserved_qty NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  avg_cost NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_branch_product_stock UNIQUE (branch_id, product_id)
);

-- 13. Inventory Movements Ledger (حركات المخزون القابلة للمراجعة)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(32) NOT NULL, -- purchase, sale, return, adjustment, transfer_in, transfer_out, damage, expiry
  quantity NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  reference_type VARCHAR(64) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Stock Transfers (التحويلات بين الفروع)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_number VARCHAR(64) UNIQUE NOT NULL,
  from_branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  to_branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, in_transit, received, canceled
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  approved_by VARCHAR(64),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id VARCHAR(64) PRIMARY KEY,
  transfer_id VARCHAR(64) NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity_sent NUMERIC(12,4) NOT NULL,
  quantity_received NUMERIC(12,4),
  discrepancy_notes TEXT
);

-- 15. Stocktaking (الجرد الدوري والتسويات)
CREATE TABLE IF NOT EXISTS stocktaking_sessions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  session_number VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, canceled
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocktaking_items (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES stocktaking_sessions(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  expected_qty NUMERIC(12,4) NOT NULL,
  counted_qty NUMERIC(12,4) NOT NULL,
  discrepancy_qty NUMERIC(12,4) NOT NULL,
  cost_impact NUMERIC(12,2) NOT NULL,
  notes TEXT
);

-- 16. Suppliers (الموردون)
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(128),
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  tax_id VARCHAR(64),
  payment_terms VARCHAR(64) DEFAULT '30 Days Net',
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_supplier_code UNIQUE (tenant_id, code)
);

-- 17. Purchase Orders (أوامر الشراء وفواتير المشتريات)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id),
  po_number VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, ordered, partially_received, received, canceled
  total_amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id VARCHAR(64) PRIMARY KEY,
  po_id VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity_ordered NUMERIC(12,4) NOT NULL,
  quantity_received NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
  unit_cost NUMERIC(12,4) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL
);

-- 18. Supplier Payments (مدفوعات وسندات صرف الموردين)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id VARCHAR(64) NOT NULL REFERENCES suppliers(id),
  payment_number VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL, -- cash, bank_transfer, cheque
  reference_doc VARCHAR(128),
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CUSTOMERS & ACCOUNTS RECEIVABLE (العملاء والآجل والديون)
-- ============================================================================

-- 19. Customers (العملاء والحد الائتماني والمديونيات)
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  address TEXT,
  tax_id VARCHAR(64),
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 1000.00,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- الموجب يعني مدين (عليه فلوس للمحل)
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_customer_code UNIQUE (tenant_id, code)
);

-- 20. Customer Payments (سداد ديون العملاء وقبض الآجل)
CREATE TABLE IF NOT EXISTS customer_payments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(id),
  payment_number VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- POS, CASH REGISTERS & SHIFTS (نقاط البيع وجلسات الدرج ووردية الكاشير)
-- ============================================================================

-- 21. Cash Registers / Tills (نقاط البيع وأجهزة الكاشير)
CREATE TABLE IF NOT EXISTS cash_registers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_branch_register_code UNIQUE (branch_id, code)
);

-- 22. Cash Sessions / Shifts (جلسات وورديات الكاشير)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  register_id VARCHAR(64) NOT NULL REFERENCES cash_registers(id),
  cashier_id VARCHAR(64) NOT NULL REFERENCES users(id),
  session_number VARCHAR(64) UNIQUE NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_float NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  closing_cash_counted NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  status VARCHAR(32) NOT NULL DEFAULT 'open', -- open, closed
  notes TEXT
);

-- 23. Cash Drawer Movements (حركات النقدية داخل الوردية: سحب وإيداع ومصروفات)
CREATE TABLE IF NOT EXISTS cash_movements (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL, -- pay_in, pay_out, expense
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SALES & INVOICES (المبيعات والفواتير والمرتجعات)
-- ============================================================================

-- 24. Sales Orders & Invoices (فواتير المبيعات)
CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  register_id VARCHAR(64) NOT NULL REFERENCES cash_registers(id),
  session_id VARCHAR(64) NOT NULL REFERENCES cash_sessions(id),
  cashier_id VARCHAR(64) NOT NULL REFERENCES users(id),
  customer_id VARCHAR(64) REFERENCES customers(id),
  sale_number VARCHAR(64) UNIQUE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL,
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(32) NOT NULL, -- cash, card, mobile_wallet, customer_credit, mixed
  status VARCHAR(32) NOT NULL DEFAULT 'completed', -- completed, returned, partially_returned, voided
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. Sale Items (بنود فاتورة البيع)
CREATE TABLE IF NOT EXISTS sale_items (
  id VARCHAR(64) PRIMARY KEY,
  sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  batch_id VARCHAR(64) REFERENCES product_batches(id),
  quantity NUMERIC(12,4) NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  cost_price NUMERIC(12,4) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12,2) NOT NULL
);

-- 26. Sale Payments (طرق الدفع المتعددة للفاتورة)
CREATE TABLE IF NOT EXISTS sale_payments (
  id VARCHAR(64) PRIMARY KEY,
  sale_id VARCHAR(64) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method VARCHAR(32) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference_code VARCHAR(128)
);

-- 27. Sale Returns (مرتجعات الفواتير)
CREATE TABLE IF NOT EXISTS sale_returns (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  sale_id VARCHAR(64) NOT NULL REFERENCES sales(id),
  return_number VARCHAR(64) UNIQUE NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL,
  refund_method VARCHAR(32) NOT NULL,
  restock SMALLINT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id VARCHAR(64) PRIMARY KEY,
  return_id VARCHAR(64) NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,4) NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

-- ============================================================================
-- EXPENSES & ACCOUNTING (المصروفات ودفتر الأستاذ والحسابات)
-- ============================================================================

-- 28. Operating Expenses (المصروفات التشغيلية)
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  category VARCHAR(64) NOT NULL, -- Rent, Utilities, Staff Salaries, Maintenance, Packaging, Delivery, Marketing
  amount NUMERIC(12,2) NOT NULL,
  payment_source VARCHAR(32) NOT NULL, -- cash_drawer, bank_account, petty_cash
  payee VARCHAR(128),
  description TEXT NOT NULL,
  receipt_attachment TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 29. Chart of Accounts (شجرة الحسابات العامة)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_code VARCHAR(32) NOT NULL,
  account_name_en VARCHAR(128) NOT NULL,
  account_name_ar VARCHAR(128) NOT NULL,
  account_type VARCHAR(32) NOT NULL, -- asset, liability, equity, revenue, expense, cogs
  is_active SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_tenant_coa_code UNIQUE (tenant_id, account_code)
);

-- 30. Journal Entries (قيود اليومية المحاسبية)
CREATE TABLE IF NOT EXISTS journal_entries (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id),
  entry_number VARCHAR(64) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(64),
  reference_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id VARCHAR(64) PRIMARY KEY,
  entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code VARCHAR(32) NOT NULL,
  debit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- ============================================================================
-- NOTIFICATIONS & AUDIT LOGS (التنبيهات وسجل التدقيق الأمني)
-- ============================================================================

-- 31. In-App Notifications (الإشعارات والتنبيهات)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id),
  type VARCHAR(32) NOT NULL, -- low_stock, expiring, drawer_discrepancy, po_pending, subscription
  title_en VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  is_read SMALLINT NOT NULL DEFAULT 0,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 32. Immutable Audit Logs (سجل العمليات والتدقيق غير القابل للتعديل)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  user_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HIGH-PERFORMANCE POSTGRESQL INDEXES (فهارس الأداء العالي)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory_balances(tenant_id, branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_movements_tenant_prod ON inventory_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_branch_date ON sales(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read ON notifications(tenant_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_logs(tenant_id, created_at);

-- ============================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION (حاوية تخزين لوجو المتاجر)
-- ============================================================================

-- Create the public storage bucket for merchant logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant-logos', 'merchant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket access policies
CREATE POLICY "Public Read Access for Merchant Logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-logos');

CREATE POLICY "Allow Authenticated and Anon Upload to Merchant Logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'merchant-logos');

CREATE POLICY "Allow Update to Merchant Logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'merchant-logos');

-- ============================================================================
-- INITIAL PRODUCTION SEED DATA (البيانات الأولية للمنصة)
-- ============================================================================

-- 1. Insert Unified All-Inclusive Subscription Plan
INSERT INTO subscription_plans (
  id, code, name_en, name_ar, price_monthly, price_annual, max_branches, max_users, max_products, features
) VALUES (
  'plan_all_inclusive',
  'all_inclusive',
  'All-Inclusive Enterprise Retail Plan',
  'الخطة الشاملة المتكاملة (كافة المميزات مفتوحة)',
  999.00,
  9990.00,
  999,
  9999,
  999999,
  '["pos_system", "multi_branch", "unlimited_products", "cash_shifts", "inventory_batch_tracking", "stock_transfers", "stocktaking", "purchase_orders", "customer_credit", "expenses", "accounting_general_ledger", "z_reports", "advanced_analytics", "24_7_vip_support"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  features = EXCLUDED.features;

-- 2. Insert Super Admin User (Phone: 01211583961, Password: 12345678)
-- Master credentials ready for login immediately
INSERT INTO users (
  id,
  tenant_id,
  branch_id,
  email,
  username,
  password_hash,
  full_name,
  phone,
  role,
  is_active,
  created_at
) VALUES (
  'usr_superadmin_01',
  NULL,
  NULL,
  'admin@sastmhaly.com',
  '01211583961',
  '12345678',
  'مدير عام منصة سستمهالي',
  '01211583961',
  'super_admin',
  1,
  NOW()
) ON CONFLICT (username) DO UPDATE SET
  phone = '01211583961',
  password_hash = '12345678',
  role = 'super_admin',
  is_active = 1;

-- ============================================================================
-- END OF MASTER SCRIPT
-- ============================================================================
