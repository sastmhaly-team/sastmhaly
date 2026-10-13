export const DDL_SCHEMA = `
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Tenants (Merchants)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  tax_id TEXT,
  commercial_reg TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, trial, archived
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tenant Settings
CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,
  default_tax_rate REAL NOT NULL DEFAULT 14.0,
  vat_enabled INTEGER NOT NULL DEFAULT 1,
  receipt_header TEXT,
  receipt_footer TEXT,
  receipt_width TEXT NOT NULL DEFAULT '80mm',
  scale_barcode_prefix TEXT NOT NULL DEFAULT '21',
  valuation_method TEXT NOT NULL DEFAULT 'WAC', -- WAC, FIFO
  allow_negative_stock INTEGER NOT NULL DEFAULT 0,
  expiry_warning_days INTEGER NOT NULL DEFAULT 30,
  auto_reorder_enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_monthly REAL NOT NULL,
  price_annual REAL NOT NULL,
  max_branches INTEGER NOT NULL,
  max_users INTEGER NOT NULL,
  max_products INTEGER NOT NULL,
  features TEXT NOT NULL -- JSON string
);

-- Merchant Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active', -- active, trial, past_due, expired, canceled
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  trial_ends_at TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Subscription Invoices & Platform Revenue
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid', -- paid, pending, failed
  due_date TEXT NOT NULL,
  paid_at TEXT,
  payment_method TEXT NOT NULL DEFAULT 'manual_bank',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Cairo',
  opening_hours TEXT DEFAULT '09:00 - 23:00',
  manager_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_main INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, code)
);

-- Users (Super Admin, Merchant Owner, Branch Users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULL for Super Admin
  branch_id TEXT, -- NULL for merchant owner, assigned for branch staff
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL, -- super_admin, merchant_owner, branch_manager, cashier, inventory_manager, accountant, auditor
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

-- Product Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT DEFAULT '#246BFD',
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, code)
);

-- Units of Measurement
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_fractional INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, code)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT NOT NULL,
  additional_barcodes TEXT,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  category_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  cost_price REAL NOT NULL,
  selling_price REAL NOT NULL,
  wholesale_price REAL,
  min_selling_price REAL,
  tax_rate REAL NOT NULL DEFAULT 14.0,
  track_stock INTEGER NOT NULL DEFAULT 1,
  min_stock_alert REAL NOT NULL DEFAULT 5.0,
  max_stock_alert REAL,
  is_weighted INTEGER NOT NULL DEFAULT 0,
  has_batch_tracking INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  UNIQUE(tenant_id, sku),
  UNIQUE(tenant_id, barcode)
);

-- Product Batches (Expiry tracking)
CREATE TABLE IF NOT EXISTS product_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  production_date TEXT,
  expiry_date TEXT NOT NULL,
  quantity REAL NOT NULL,
  cost_price REAL NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- Inventory Balances per Branch
CREATE TABLE IF NOT EXISTS inventory_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0.0,
  reserved_qty REAL NOT NULL DEFAULT 0.0,
  avg_cost REAL NOT NULL DEFAULT 0.0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(branch_id, product_id)
);

-- Auditable Inventory Movement Ledger
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL, -- purchase, sale, return, adjustment, transfer_in, transfer_out, damage, expiry
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Inter-Branch Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  transfer_number TEXT UNIQUE NOT NULL,
  from_branch_id TEXT NOT NULL,
  to_branch_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_transit, received, canceled
  notes TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  sent_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  FOREIGN KEY (to_branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_sent REAL NOT NULL,
  quantity_received REAL,
  discrepancy_notes TEXT,
  FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Physical Inventory Stocktaking
CREATE TABLE IF NOT EXISTS stocktaking_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  session_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, canceled
  notes TEXT,
  created_by TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS stocktaking_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  expected_qty REAL NOT NULL,
  counted_qty REAL NOT NULL,
  discrepancy_qty REAL NOT NULL,
  cost_impact REAL NOT NULL,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES stocktaking_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  tax_id TEXT,
  payment_terms TEXT DEFAULT '30 Days Net',
  opening_balance REAL NOT NULL DEFAULT 0.0,
  current_balance REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, code)
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  po_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, ordered, partially_received, received, canceled
  total_amount REAL NOT NULL,
  tax_amount REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  net_amount REAL NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_ordered REAL NOT NULL,
  quantity_received REAL NOT NULL DEFAULT 0.0,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  payment_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL, -- cash, bank_transfer, cheque
  reference_doc TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  credit_limit REAL NOT NULL DEFAULT 1000.0,
  current_balance REAL NOT NULL DEFAULT 0.0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, code)
);

-- Customer Payments (Accounts Receivable collection)
CREATE TABLE IF NOT EXISTS customer_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Cash Registers & Tills
CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(branch_id, code)
);

-- Cash Register Sessions
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  register_id TEXT NOT NULL,
  cashier_id TEXT NOT NULL,
  session_number TEXT UNIQUE NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  opening_float REAL NOT NULL DEFAULT 0.0,
  closing_cash_counted REAL,
  expected_cash REAL,
  difference REAL,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  notes TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (register_id) REFERENCES cash_registers(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);

-- Cash Movements inside Session (Pay-In, Pay-Out, Drawer Expense)
CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL, -- pay_in, pay_out, expense
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
);

-- Sales Orders / Invoices
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  register_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  cashier_id TEXT NOT NULL,
  customer_id TEXT,
  sale_number TEXT UNIQUE NOT NULL,
  subtotal REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  tax_amount REAL NOT NULL DEFAULT 0.0,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL,
  change_amount REAL NOT NULL DEFAULT 0.0,
  payment_method TEXT NOT NULL, -- cash, card, mobile_wallet, customer_credit, mixed
  status TEXT NOT NULL DEFAULT 'completed', -- completed, returned, partially_returned, voided
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (register_id) REFERENCES cash_registers(id),
  FOREIGN KEY (session_id) REFERENCES cash_sessions(id),
  FOREIGN KEY (cashier_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  batch_id TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  cost_price REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  tax_amount REAL NOT NULL DEFAULT 0.0,
  line_total REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES product_batches(id)
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount REAL NOT NULL,
  reference_code TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- Sale Returns & Refunds
CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  return_number TEXT UNIQUE NOT NULL,
  refund_amount REAL NOT NULL,
  refund_method TEXT NOT NULL,
  restock INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Operating Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  category TEXT NOT NULL, -- Rent, Utilities, Staff Salaries, Maintenance, Packaging, Delivery, Marketing
  amount REAL NOT NULL,
  payment_source TEXT NOT NULL, -- cash_drawer, bank_account, petty_cash
  payee TEXT,
  description TEXT NOT NULL,
  receipt_attachment TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Chart of Accounts & General Ledger
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name_en TEXT NOT NULL,
  account_name_ar TEXT NOT NULL,
  account_type TEXT NOT NULL, -- asset, liability, equity, revenue, expense, cogs
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  entry_number TEXT UNIQUE NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0.0,
  credit REAL NOT NULL DEFAULT 0.0,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

-- In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  type TEXT NOT NULL, -- low_stock, expiring, drawer_discrepancy, po_pending, subscription
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  message_en TEXT NOT NULL,
  message_ar TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  branch_id TEXT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for maximum query performance across large datasets
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory_balances(tenant_id, branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_movements_prod ON inventory_movements(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions ON cash_sessions(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
`;
