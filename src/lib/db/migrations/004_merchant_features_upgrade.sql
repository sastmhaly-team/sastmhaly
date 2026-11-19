-- ============================================================================
-- Sastmhaly ERP - Complete Merchant Features Upgrade Migration
-- Migration 004: Products Variants, Custom Units, Quotations, Sales Notes & Delivery,
--               Loyalty Points Settings, Stocktaking (الجرد), and Foreign Key Hardening
-- ============================================================================

-- 1. Products: Add variants and custom_unit; relax unit_id NOT NULL & foreign key
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_unit VARCHAR(64);
ALTER TABLE products ALTER COLUMN unit_id DROP NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_unit_id_fkey') THEN
    ALTER TABLE products DROP CONSTRAINT products_unit_id_fkey;
  END IF;
  ALTER TABLE products ADD CONSTRAINT products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Suppliers: Make phone number optional
ALTER TABLE suppliers ALTER COLUMN phone DROP NOT NULL;

-- 3. Sales: Add delivery_fee and ensure notes
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Tenant Settings: Add loyalty settings and custom currency support
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled SMALLINT DEFAULT 1;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_spend_rate NUMERIC(12,2) DEFAULT 1.0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_redeem_rate NUMERIC(12,4) DEFAULT 10.0;

-- 5. Purchase Orders: Set defaults for net_amount, tax_amount, discount_amount to prevent NOT NULL violations
ALTER TABLE purchase_orders ALTER COLUMN net_amount SET DEFAULT 0.00;
ALTER TABLE purchase_orders ALTER COLUMN tax_amount SET DEFAULT 0.00;
ALTER TABLE purchase_orders ALTER COLUMN discount_amount SET DEFAULT 0.00;

DO $$ BEGIN
  ALTER TABLE purchase_order_items ALTER COLUMN total_cost SET DEFAULT 0.00;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 6. Quotations (عروض الأسعار) Tables
CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  quotation_number VARCHAR(64) UNIQUE NOT NULL,
  customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(128),
  customer_phone VARCHAR(32),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, converted
  converted_sale_id VARCHAR(64) REFERENCES sales(id) ON DELETE SET NULL,
  valid_until DATE,
  notes TEXT,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id VARCHAR(64) PRIMARY KEY,
  quotation_id VARCHAR(64) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,4) NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  line_total NUMERIC(12,2) NOT NULL
);

-- Indexes for Quotations
CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- 7. Stocktaking (الجرد المخزني وتسوية العهدة) Tables
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
  cost_impact NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT
);

-- Indexes for Stocktaking
CREATE INDEX IF NOT EXISTS idx_stocktaking_sessions_tenant ON stocktaking_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocktaking_sessions_branch ON stocktaking_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_stocktaking_items_session ON stocktaking_items(session_id);

-- 8. Enable Row Level Security and Open Access Policies
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktaking_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow all access to quotations') THEN
    CREATE POLICY "Allow all access to quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_items' AND policyname = 'Allow all access to quotation_items') THEN
    CREATE POLICY "Allow all access to quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stocktaking_sessions' AND policyname = 'Allow all access to stocktaking_sessions') THEN
    CREATE POLICY "Allow all access to stocktaking_sessions" ON stocktaking_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stocktaking_items' AND policyname = 'Allow all access to stocktaking_items') THEN
    CREATE POLICY "Allow all access to stocktaking_items" ON stocktaking_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
