-- ============================================================================
-- Sastmhaly Retail ERP - PostgreSQL & Supabase Production Schema Migration 001
-- Multi-Tenant Retail Management SaaS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants (Merchants)
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
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  onboarding_completed SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tenant Settings
CREATE TABLE IF NOT EXISTS tenant_settings (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
  vat_enabled SMALLINT NOT NULL DEFAULT 1,
  receipt_header TEXT,
  receipt_footer TEXT,
  receipt_width VARCHAR(16) NOT NULL DEFAULT '80mm',
  scale_barcode_prefix VARCHAR(8) NOT NULL DEFAULT '21',
  valuation_method VARCHAR(16) NOT NULL DEFAULT 'WAC',
  allow_negative_stock SMALLINT NOT NULL DEFAULT 0,
  expiry_warning_days INTEGER NOT NULL DEFAULT 30,
  auto_reorder_enabled SMALLINT NOT NULL DEFAULT 1
);

-- 3. Subscription Plans
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

-- 4. Merchant Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) NOT NULL REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(16) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  auto_renew SMALLINT NOT NULL DEFAULT 1
);

-- 5. Branches
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

-- 6. Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  role VARCHAR(32) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Categories
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

-- 8. Units
CREATE TABLE IF NOT EXISTS units (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name_en VARCHAR(64) NOT NULL,
  name_ar VARCHAR(64) NOT NULL,
  is_fractional SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_tenant_unit_code UNIQUE (tenant_id, code)
);

-- 9. Products
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

-- 10. Product Batches (Expiry Tracking)
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

-- 11. Inventory Balances
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

-- 12. Auditable Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(32) NOT NULL,
  quantity NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  reference_type VARCHAR(64) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Sales and Checkout
CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  register_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  cashier_id VARCHAR(64) NOT NULL REFERENCES users(id),
  customer_id VARCHAR(64),
  sale_number VARCHAR(64) UNIQUE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL,
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Indexes for scale
CREATE INDEX IF NOT EXISTS idx_pg_prod_tenant ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pg_prod_barcode ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_pg_stock_lookup ON inventory_balances(tenant_id, branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pg_movements ON inventory_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pg_sales ON sales(tenant_id, branch_id, created_at);
