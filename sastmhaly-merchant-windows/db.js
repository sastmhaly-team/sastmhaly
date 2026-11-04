const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function getDbPath() {
  const customDir = process.env.LOCAL_DATA_DIR || process.env.APP_DIR || path.join(__dirname, 'data');
  if (!fs.existsSync(customDir)) {
    try {
      fs.mkdirSync(customDir, { recursive: true });
    } catch (e) {
      // fallback
    }
  }
  return path.join(customDir, 'sastmhaly.db');
}

function initDb() {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // High performance and safety settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = OFF');

  // Schema creation
  db.exec(`
    -- 1. Store Settings & First-Run Configuration
    CREATE TABLE IF NOT EXISTS store_settings (
      id TEXT PRIMARY KEY DEFAULT 'current_store',
      store_name TEXT NOT NULL DEFAULT '',
      business_type TEXT NOT NULL DEFAULT 'سوبرماركت',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'القاهرة',
      tax_number TEXT DEFAULT '',
      commercial_register TEXT DEFAULT '',
      tax_rate REAL NOT NULL DEFAULT 14.0,
      vat_enabled INTEGER NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'ج.م',
      logo_base64 TEXT DEFAULT '',
      receipt_header TEXT DEFAULT 'أهلاً بكم ونتشرف بزيارتكم',
      receipt_footer TEXT DEFAULT 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بموجب الفاتورة',
      return_policy TEXT DEFAULT 'يُرجى إحضار أصل الفاتورة عند الاسترجاع أو الاستبدال',
      is_configured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 2. Users / Cashiers
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin', -- admin, cashier
      pin_code TEXT DEFAULT '1234',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 3. Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT DEFAULT 'CAT',
      color TEXT DEFAULT '#2563eb',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 4. Units
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL
    );

    -- 5. Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT DEFAULT '',
      unit_id TEXT DEFAULT '',
      cost_price REAL NOT NULL DEFAULT 0.0,
      selling_price REAL NOT NULL DEFAULT 0.0,
      wholesale_price REAL DEFAULT 0.0,
      tax_rate REAL NOT NULL DEFAULT 14.0,
      min_stock_alert REAL NOT NULL DEFAULT 5.0,
      is_weighted INTEGER NOT NULL DEFAULT 0,
      has_batch_tracking INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 6. Inventory Balances
    CREATE TABLE IF NOT EXISTS inventory_balances (
      product_id TEXT PRIMARY KEY,
      quantity REAL NOT NULL DEFAULT 0.0,
      avg_cost REAL NOT NULL DEFAULT 0.0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 7. Inventory Movements Ledger
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- purchase, sale, return, adjustment, initial
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0.0,
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 8. Sales / Invoices
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      sale_number TEXT UNIQUE NOT NULL,
      session_id TEXT DEFAULT '',
      cashier_name TEXT DEFAULT 'كاشير 1',
      customer_id TEXT DEFAULT '',
      customer_name TEXT DEFAULT 'عميل نقدي',
      subtotal REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      total_amount REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      change_amount REAL NOT NULL DEFAULT 0.0,
      payment_method TEXT NOT NULL DEFAULT 'cash', -- cash, card, credit
      status TEXT NOT NULL DEFAULT 'completed', -- completed, refunded, partial_refund
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 9. Sale Items
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT DEFAULT '',
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      line_total REAL NOT NULL
    );

    -- 10. Customers & Debts
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      credit_limit REAL NOT NULL DEFAULT 1000.0,
      current_balance REAL NOT NULL DEFAULT 0.0,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 11. Customer Debt Payments
    CREATE TABLE IF NOT EXISTS customer_payments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      payment_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 12. Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      current_balance REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 13. Purchase Invoices
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      remaining_amount REAL NOT NULL DEFAULT 0.0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 14. Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      selling_price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    -- 15. Supplier Payments
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      payment_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 16. Cash Register Sessions (الورديات والخزينة)
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      session_number TEXT UNIQUE NOT NULL,
      cashier_name TEXT NOT NULL DEFAULT 'المدير',
      opening_float REAL NOT NULL DEFAULT 0.0,
      total_cash_sales REAL NOT NULL DEFAULT 0.0,
      total_card_sales REAL NOT NULL DEFAULT 0.0,
      total_credit_sales REAL NOT NULL DEFAULT 0.0,
      total_expenses REAL NOT NULL DEFAULT 0.0,
      total_cash_in REAL NOT NULL DEFAULT 0.0,
      total_cash_out REAL NOT NULL DEFAULT 0.0,
      expected_cash REAL NOT NULL DEFAULT 0.0,
      counted_cash REAL DEFAULT NULL,
      variance REAL DEFAULT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open', -- open, closed
      opened_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      closed_at TEXT DEFAULT NULL
    );

    -- 17. Cash In/Out Movements
    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL, -- in (إيداع), out (سحب)
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 18. Daily Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- إيجار، كهرباء، صيانة، بوفيه، نقل، رواتب، أخرى
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      notes TEXT DEFAULT '',
      created_by TEXT DEFAULT 'المدير',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 19. Employees Directory
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      job_title TEXT NOT NULL DEFAULT 'كاشير',
      phone TEXT DEFAULT '',
      national_id TEXT DEFAULT '',
      hire_date TEXT DEFAULT '',
      base_salary REAL NOT NULL DEFAULT 3000.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 20. Employee Attendance Ledger
    CREATE TABLE IF NOT EXISTS employee_attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present', -- present (حضور), absent (غياب), leave (إجازة), late (تأخير)
      check_in TEXT DEFAULT '',
      check_out TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(employee_id, date)
    );

    -- 21. Employee Adjustments (سلف، مكافآت، خصومات)
    CREATE TABLE IF NOT EXISTS employee_adjustments (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      type TEXT NOT NULL, -- advance (سلفة), bonus (مكافأة), deduction (خصم), overtime (إضافي)
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 22. Monthly Payroll (مسير الرواتب)
    CREATE TABLE IF NOT EXISTS employee_payroll (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      base_salary REAL NOT NULL,
      total_bonuses REAL NOT NULL DEFAULT 0.0,
      total_deductions REAL NOT NULL DEFAULT 0.0,
      total_advances REAL NOT NULL DEFAULT 0.0,
      net_payable REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending (معلق), paid (تم الصرف)
      paid_at TEXT DEFAULT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(employee_id, month, year)
    );
  `);

  // Ensure store settings row exists
  const existingSettings = db.prepare("SELECT id FROM store_settings WHERE id = 'current_store'").get();
  if (!existingSettings) {
    db.prepare("INSERT INTO store_settings (id, is_configured) VALUES ('current_store', 0)").run();
  }

  // Ensure default units exist
  const existingUnits = db.prepare('SELECT count(*) as count FROM units').get();
  if (existingUnits.count === 0) {
    db.prepare('INSERT INTO units (id, name, code) VALUES (?, ?, ?)').run('unit_pcs', 'قطعة', 'PCS');
    db.prepare('INSERT INTO units (id, name, code) VALUES (?, ?, ?)').run('unit_kg', 'كيلوجرام', 'KG');
    db.prepare('INSERT INTO units (id, name, code) VALUES (?, ?, ?)').run('unit_ltr', 'لتر', 'LTR');
    db.prepare('INSERT INTO units (id, name, code) VALUES (?, ?, ?)').run('unit_box', 'علبة', 'BOX');
    db.prepare('INSERT INTO units (id, name, code) VALUES (?, ?, ?)').run('unit_crt', 'كرتونة', 'CRT');
  }

  // Ensure default categories exist
  const existingCats = db.prepare('SELECT count(*) as count FROM categories').get();
  if (existingCats.count === 0) {
    db.prepare('INSERT INTO categories (id, name, code, color) VALUES (?, ?, ?, ?)').run('cat_gen', 'أصناف عامة', 'GEN', '#2563eb');
    db.prepare('INSERT INTO categories (id, name, code, color) VALUES (?, ?, ?, ?)').run('cat_food', 'مواد غذائية', 'FOOD', '#16a34a');
    db.prepare('INSERT INTO categories (id, name, code, color) VALUES (?, ?, ?, ?)').run('cat_bev', 'مشروبات وعصائر', 'BEV', '#d97706');
    db.prepare('INSERT INTO categories (id, name, code, color) VALUES (?, ?, ?, ?)').run('cat_clean', 'منظفات وعناية', 'CLN', '#7c3aed');
  }

  dbInstance = db;
  return dbInstance;
}

const db = initDb();

module.exports = {
  db,
  getDbPath,
  initDb
};
