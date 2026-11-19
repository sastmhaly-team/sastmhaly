-- ============================================================================
-- Sastmhaly ERP - Merchant Features Upgrade Migration
-- Migration 004: Products Variants, Custom Units, Quotations, Sales Notes & Delivery,
--               Loyalty Points Settings, and Account Statements Support
-- ============================================================================

-- 1. Add variants and custom_unit to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_unit VARCHAR(64);

-- 2. Make supplier phone number optional
ALTER TABLE suppliers ALTER COLUMN phone DROP NOT NULL;

-- 3. Add delivery_fee and ensure notes to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) DEFAULT 0.0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Add loyalty settings and custom currency support to tenant_settings
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled SMALLINT DEFAULT 1;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_spend_rate NUMERIC(12,2) DEFAULT 1.0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_redeem_rate NUMERIC(12,4) DEFAULT 10.0;

-- 5. Create Quotations (عروض الأسعار) Tables
CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
  quotation_number VARCHAR(64) UNIQUE NOT NULL,
  customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(128),
  customer_phone VARCHAR(32),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
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
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  line_total NUMERIC(12,2) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- RLS Policies
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow all access to quotations') THEN
    CREATE POLICY "Allow all access to quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_items' AND policyname = 'Allow all access to quotation_items') THEN
    CREATE POLICY "Allow all access to quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


