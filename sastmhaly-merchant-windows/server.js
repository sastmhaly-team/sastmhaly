const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { db, getDbPath } = require('./db');

const PORT = process.env.PORT || 4567;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Helper: Parse JSON Body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB max (e.g. logos/backups)
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Helper: JSON Response
function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, message, statusCode = 400) {
  sendJson(res, { success: false, error: message }, statusCode);
}

// Generate Unique IDs
function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Helper: Active Cash Session
function getActiveSession() {
  return db.prepare("SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
}

// Helper: Generate Invoice Number
function getNextSaleNumber() {
  const count = db.prepare('SELECT count(*) as total FROM sales').get().total;
  const num = (count + 1).toString().padStart(6, '0');
  return `INV-${num}`;
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ----------------------------------------------------
    // API ROUTES
    // ----------------------------------------------------
    if (pathname.startsWith('/api/')) {
      // 1. Status & First-Run Setup Check
      if (pathname === '/api/status' && method === 'GET') {
        const store = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get() || {};
        const isConfigured = store.is_configured === 1;
        const activeSession = getActiveSession();
        return sendJson(res, {
          success: true,
          configured: isConfigured,
          store,
          active_session: activeSession || null,
          version: '1.0.0'
        });
      }

      // 2. Onboarding Setup Submission
      if (pathname === '/api/setup' && method === 'POST') {
        const body = await parseBody(req);
        const {
          store_name,
          business_type = 'سوبرماركت',
          phone = '',
          address = '',
          city = 'القاهرة',
          tax_number = '',
          commercial_register = '',
          tax_rate = 14,
          vat_enabled = 1,
          currency = 'ج.م',
          logo_base64 = '',
          receipt_header = 'أهلاً بكم ونتشرف بزيارتكم',
          receipt_footer = 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بموجب الفاتورة',
          pin_code = '1234'
        } = body;

        if (!store_name || !store_name.trim()) {
          return sendError(res, 'يرجى إدخال اسم المتجر');
        }

        db.prepare(`
          UPDATE store_settings SET
            store_name = ?,
            business_type = ?,
            phone = ?,
            address = ?,
            city = ?,
            tax_number = ?,
            commercial_register = ?,
            tax_rate = ?,
            vat_enabled = ?,
            currency = ?,
            logo_base64 = ?,
            receipt_header = ?,
            receipt_footer = ?,
            is_configured = 1
          WHERE id = 'current_store'
        `).run(
          store_name.trim(),
          business_type,
          phone.trim(),
          address.trim(),
          city.trim(),
          tax_number.trim(),
          commercial_register.trim(),
          Number(tax_rate) || 0,
          vat_enabled ? 1 : 0,
          currency.trim() || 'ج.م',
          logo_base64 || '',
          receipt_header,
          receipt_footer
        );

        // Ensure default admin user with PIN
        const adminUser = db.prepare('SELECT * FROM users WHERE role = "admin"').get();
        if (adminUser) {
          db.prepare('UPDATE users SET pin_code = ?, phone = ? WHERE id = ?').run(pin_code || '1234', phone, adminUser.id);
        } else {
          db.prepare('INSERT INTO users (id, name, username, phone, role, pin_code) VALUES (?, ?, ?, ?, ?, ?)').run(
            'user_admin',
            'المدير المسؤول',
            'admin',
            phone,
            'admin',
            pin_code || '1234'
          );
        }

        const updatedStore = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get();
        return sendJson(res, { success: true, store: updatedStore });
      }

      // 3. Store Settings
      if (pathname === '/api/settings' && method === 'GET') {
        const store = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get();
        return sendJson(res, { success: true, store });
      }

      if (pathname === '/api/settings' && method === 'POST') {
        const body = await parseBody(req);
        db.prepare(`
          UPDATE store_settings SET
            store_name = COALESCE(?, store_name),
            business_type = COALESCE(?, business_type),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            tax_number = COALESCE(?, tax_number),
            commercial_register = COALESCE(?, commercial_register),
            tax_rate = COALESCE(?, tax_rate),
            vat_enabled = COALESCE(?, vat_enabled),
            currency = COALESCE(?, currency),
            logo_base64 = COALESCE(?, logo_base64),
            receipt_header = COALESCE(?, receipt_header),
            receipt_footer = COALESCE(?, receipt_footer),
            return_policy = COALESCE(?, return_policy)
          WHERE id = 'current_store'
        `).run(
          body.store_name,
          body.business_type,
          body.phone,
          body.address,
          body.city,
          body.tax_number,
          body.commercial_register,
          body.tax_rate !== undefined ? Number(body.tax_rate) : null,
          body.vat_enabled !== undefined ? (body.vat_enabled ? 1 : 0) : null,
          body.currency,
          body.logo_base64,
          body.receipt_header,
          body.receipt_footer,
          body.return_policy
        );
        const store = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get();
        return sendJson(res, { success: true, store });
      }

      // 4. Dashboard Statistics
      if (pathname === '/api/dashboard' && method === 'GET') {
        const today = new Date().toISOString().slice(0, 10);
        const currentMonth = today.slice(0, 7);

        const todaySales = db.prepare(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_amount,
            count(*) as count,
            COALESCE(SUM(paid_amount), 0) as paid_amount
          FROM sales 
          WHERE date(created_at) = ? AND status = 'completed'
        `).get(today);

        const monthSales = db.prepare(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_amount,
            count(*) as count
          FROM sales 
          WHERE strftime('%Y-%m', created_at) = ? AND status = 'completed'
        `).get(currentMonth);

        // Calculate Cost of goods sold for today & month
        const todayCost = db.prepare(`
          SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cost
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE date(s.created_at) = ? AND s.status = 'completed'
        `).get(today).total_cost;

        const todayExpenses = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total_expenses
          FROM expenses
          WHERE date(created_at) = ?
        `).get(today).total_expenses;

        const monthExpenses = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total_expenses
          FROM expenses
          WHERE strftime('%Y-%m', created_at) = ?
        `).get(currentMonth).total_expenses;

        const todayProfit = Math.round((todaySales.total_amount - todayCost - todayExpenses) * 100) / 100;

        const totalProducts = db.prepare('SELECT count(*) as count FROM products WHERE is_active = 1').get().count;

        const lowStockCount = db.prepare(`
          SELECT count(*) as count
          FROM products p
          LEFT JOIN inventory_balances b ON p.id = b.product_id
          WHERE p.is_active = 1 AND COALESCE(b.quantity, 0) <= p.min_stock_alert
        `).get().count;

        const customerDebts = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM customers WHERE current_balance > 0').get().total;
        const supplierDebts = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM suppliers WHERE current_balance > 0').get().total;

        const recentSales = db.prepare(`
          SELECT * FROM sales 
          ORDER BY created_at DESC 
          LIMIT 8
        `).all();

        const activeSession = getActiveSession();

        return sendJson(res, {
          success: true,
          stats: {
            today_sales: todaySales.total_amount,
            today_count: todaySales.count,
            today_profit: todayProfit,
            month_sales: monthSales.total_amount,
            month_count: monthSales.count,
            total_products: totalProducts,
            low_stock_count: lowStockCount,
            customer_debts: customerDebts,
            supplier_debts: supplierDebts,
            active_shift: activeSession
          },
          recent_sales: recentSales
        });
      }

      // 5. Products CRUD & Search
      if (pathname === '/api/products' && method === 'GET') {
        const query = parsedUrl.query.search ? parsedUrl.query.search.trim() : '';
        const categoryId = parsedUrl.query.category_id || '';
        const lowStockOnly = parsedUrl.query.low_stock === '1';

        let sql = `
          SELECT 
            p.*,
            COALESCE(b.quantity, 0) as stock_quantity,
            c.name as category_name,
            u.name as unit_name
          FROM products p
          LEFT JOIN inventory_balances b ON p.id = b.product_id
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN units u ON p.unit_id = u.id
          WHERE p.is_active = 1
        `;
        const params = [];

        if (query) {
          sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)`;
          params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }
        if (categoryId) {
          sql += ` AND p.category_id = ?`;
          params.push(categoryId);
        }
        if (lowStockOnly) {
          sql += ` AND COALESCE(b.quantity, 0) <= p.min_stock_alert`;
        }

        sql += ` ORDER BY p.name ASC`;
        const products = db.prepare(sql).all(...params);
        return sendJson(res, { success: true, products });
      }

      if (pathname === '/api/products' && method === 'POST') {
        const body = await parseBody(req);
        const {
          name,
          barcode,
          sku,
          category_id = '',
          unit_id = 'unit_pcs',
          cost_price = 0,
          selling_price = 0,
          wholesale_price = 0,
          tax_rate = 14,
          min_stock_alert = 5,
          initial_stock = 0
        } = body;

        if (!name || !name.trim()) {
          return sendError(res, 'اسم المنتج مطلوب');
        }

        const id = genId('prd');
        const finalBarcode = barcode && barcode.trim() ? barcode.trim() : `${Date.now().toString().slice(-8)}`;
        const finalSku = sku && sku.trim() ? sku.trim() : `SKU-${Math.floor(100000 + Math.random() * 900000)}`;

        // Check barcode duplicate
        const dup = db.prepare('SELECT id FROM products WHERE barcode = ?').get(finalBarcode);
        if (dup) {
          return sendError(res, 'الباركود مسجل بالفعل لمنتج آخر');
        }

        const insertProduct = db.prepare(`
          INSERT INTO products (
            id, sku, barcode, name, category_id, unit_id,
            cost_price, selling_price, wholesale_price, tax_rate, min_stock_alert, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        insertProduct.run(
          id,
          finalSku,
          finalBarcode,
          name.trim(),
          category_id,
          unit_id,
          Number(cost_price) || 0,
          Number(selling_price) || 0,
          Number(wholesale_price) || 0,
          Number(tax_rate) || 0,
          Number(min_stock_alert) || 5
        );

        const initQty = Number(initial_stock) || 0;
        db.prepare(`
          INSERT OR REPLACE INTO inventory_balances (product_id, quantity, avg_cost, last_updated)
          VALUES (?, ?, ?, datetime('now', 'localtime'))
        `).run(id, initQty, Number(cost_price) || 0);

        if (initQty > 0) {
          db.prepare(`
            INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_number, notes)
            VALUES (?, ?, 'initial', ?, ?, 'INIT', 'رصيد أول المدة')
          `).run(genId('mov'), id, initQty, Number(cost_price) || 0);
        }

        return sendJson(res, { success: true, id, barcode: finalBarcode });
      }

      if (pathname.startsWith('/api/products/') && method === 'PUT') {
        const id = pathname.split('/')[3];
        const body = await parseBody(req);

        db.prepare(`
          UPDATE products SET
            name = COALESCE(?, name),
            barcode = COALESCE(?, barcode),
            sku = COALESCE(?, sku),
            category_id = COALESCE(?, category_id),
            unit_id = COALESCE(?, unit_id),
            cost_price = COALESCE(?, cost_price),
            selling_price = COALESCE(?, selling_price),
            wholesale_price = COALESCE(?, wholesale_price),
            tax_rate = COALESCE(?, tax_rate),
            min_stock_alert = COALESCE(?, min_stock_alert)
          WHERE id = ?
        `).run(
          body.name ? body.name.trim() : null,
          body.barcode ? body.barcode.trim() : null,
          body.sku ? body.sku.trim() : null,
          body.category_id,
          body.unit_id,
          body.cost_price !== undefined ? Number(body.cost_price) : null,
          body.selling_price !== undefined ? Number(body.selling_price) : null,
          body.wholesale_price !== undefined ? Number(body.wholesale_price) : null,
          body.tax_rate !== undefined ? Number(body.tax_rate) : null,
          body.min_stock_alert !== undefined ? Number(body.min_stock_alert) : null,
          id
        );

        return sendJson(res, { success: true });
      }

      if (pathname.startsWith('/api/products/') && method === 'DELETE') {
        const id = pathname.split('/')[3];
        db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
        return sendJson(res, { success: true });
      }

      // 6. Categories & Units
      if (pathname === '/api/categories' && method === 'GET') {
        const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name ASC').all();
        return sendJson(res, { success: true, categories });
      }

      if (pathname === '/api/categories' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendError(res, 'اسم التصنيف مطلوب');
        const id = body.id || genId('cat');
        db.prepare(`
          INSERT INTO categories (id, name, code, color, is_active)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color
        `).run(id, body.name.trim(), body.code || 'CAT', body.color || '#2563eb');
        return sendJson(res, { success: true, id });
      }

      if (pathname === '/api/units' && method === 'GET') {
        const units = db.prepare('SELECT * FROM units ORDER BY name ASC').all();
        return sendJson(res, { success: true, units });
      }

      // 7. Inventory Adjustments & Ledger
      if (pathname === '/api/inventory' && method === 'GET') {
        const items = db.prepare(`
          SELECT 
            p.id, p.name, p.barcode, p.sku, p.cost_price, p.selling_price, p.min_stock_alert,
            COALESCE(b.quantity, 0) as current_quantity,
            c.name as category_name,
            u.name as unit_name
          FROM products p
          LEFT JOIN inventory_balances b ON p.id = b.product_id
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN units u ON p.unit_id = u.id
          WHERE p.is_active = 1
          ORDER BY p.name ASC
        `).all();
        return sendJson(res, { success: true, inventory: items });
      }

      if (pathname === '/api/inventory/adjustment' && method === 'POST') {
        const body = await parseBody(req);
        const { product_id, adjustment_type, quantity, notes = '' } = body; // type: add, subtract, set

        if (!product_id || quantity === undefined) return sendError(res, 'بيانات التسوية غير مكتملة');

        const current = db.prepare('SELECT quantity, avg_cost FROM inventory_balances WHERE product_id = ?').get(product_id) || { quantity: 0, avg_cost: 0 };
        const numQty = Number(quantity);
        let newQty = current.quantity;
        let delta = 0;

        if (adjustment_type === 'add') {
          newQty += numQty;
          delta = numQty;
        } else if (adjustment_type === 'subtract') {
          newQty -= numQty;
          delta = -numQty;
        } else {
          // set
          delta = numQty - current.quantity;
          newQty = numQty;
        }

        db.prepare(`
          INSERT INTO inventory_balances (product_id, quantity, avg_cost, last_updated)
          VALUES (?, ?, ?, datetime('now', 'localtime'))
          ON CONFLICT(product_id) DO UPDATE SET quantity = excluded.quantity, last_updated = excluded.last_updated
        `).run(product_id, newQty, current.avg_cost);

        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_number, notes)
          VALUES (?, ?, 'adjustment', ?, ?, 'ADJ', ?)
        `).run(genId('mov'), product_id, delta, current.avg_cost, notes || 'تسوية مخزنية يدوية');

        return sendJson(res, { success: true, new_quantity: newQty });
      }

      if (pathname === '/api/inventory/ledger' && method === 'GET') {
        const movements = db.prepare(`
          SELECT m.*, p.name as product_name, p.barcode
          FROM inventory_movements m
          JOIN products p ON m.product_id = p.id
          ORDER BY m.created_at DESC
          LIMIT 100
        `).all();
        return sendJson(res, { success: true, movements });
      }

      // 8. Sales / POS Invoices
      if (pathname === '/api/sales' && method === 'GET') {
        const sales = db.prepare(`
          SELECT * FROM sales 
          ORDER BY created_at DESC 
          LIMIT 100
        `).all();
        return sendJson(res, { success: true, sales });
      }

      if (pathname.startsWith('/api/sales/') && method === 'GET') {
        const saleId = pathname.split('/')[3];
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        if (!sale) return sendError(res, 'الفاتورة غير موجودة', 404);
        const items = db.prepare(`
          SELECT si.*, 
                 COALESCE(NULLIF(si.product_name, ''), p.name, 'صنف') as product_name
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ?
        `).all(saleId);
        const store = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get();
        return sendJson(res, { success: true, sale, items, store });
      }

      if (pathname === '/api/sales' && method === 'POST') {
        const body = await parseBody(req);
        const {
          items = [],
          customer_id = '',
          customer_name = 'عميل نقدي',
          payment_method = 'cash', // cash, card, credit
          discount_amount = 0,
          paid_amount = 0,
          notes = ''
        } = body;

        if (!items || items.length === 0) {
          return sendError(res, 'سلة المشتريات فارغة');
        }

        const saleId = genId('sale');
        const saleNumber = getNextSaleNumber();
        const activeSession = getActiveSession();
        const sessionId = activeSession ? activeSession.id : '';

        let subtotal = 0;
        let totalTax = 0;

        // Calculate totals
        items.forEach(it => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.unit_price) || 0;
          const lineTax = Number(it.tax_amount) || 0;
          subtotal += (qty * price);
          totalTax += lineTax;
        });

        const numDiscount = Number(discount_amount) || 0;
        const totalAmount = Math.max(0, subtotal - numDiscount + totalTax);
        let numPaid = Number(paid_amount);
        if (payment_method === 'credit') {
          numPaid = 0;
        } else if (numPaid === 0 || isNaN(numPaid)) {
          numPaid = totalAmount;
        }
        const changeAmount = payment_method === 'cash' ? Math.max(0, numPaid - totalAmount) : 0;

        // Begin transaction
        const tx = db.transaction(() => {
          // 1. Insert Sale record
          db.prepare(`
            INSERT INTO sales (
              id, sale_number, session_id, cashier_name,
              customer_id, customer_name, subtotal, discount_amount,
              tax_amount, total_amount, paid_amount, change_amount,
              payment_method, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
          `).run(
            saleId,
            saleNumber,
            sessionId,
            activeSession ? activeSession.cashier_name : 'المدير',
            customer_id,
            customer_name || 'عميل نقدي',
            subtotal,
            numDiscount,
            totalTax,
            totalAmount,
            Math.min(numPaid, totalAmount),
            changeAmount,
            payment_method,
            notes
          );

          // 2. Insert items and update stock
          const insertItem = db.prepare(`
            INSERT INTO sale_items (
              id, sale_id, product_id, product_name, barcode,
              quantity, unit_price, cost_price, discount_amount, tax_amount, line_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const updateBalance = db.prepare(`
            UPDATE inventory_balances 
            SET quantity = quantity - ?, last_updated = datetime('now', 'localtime')
            WHERE product_id = ?
          `);

          const insertMovement = db.prepare(`
            INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_number, notes)
            VALUES (?, ?, 'sale', ?, ?, ?, ?)
          `);

          items.forEach(it => {
            const qty = Number(it.quantity) || 1;
            const price = Number(it.unit_price) || 0;
            const lineTotal = (qty * price);
            const itemId = genId('si');

            const prd = db.prepare('SELECT name, cost_price, barcode FROM products WHERE id = ?').get(it.product_id) || { name: '', cost_price: 0, barcode: '' };
            const prodName = it.product_name || prd.name || 'صنف';

            insertItem.run(
              itemId,
              saleId,
              it.product_id,
              prodName,
              prd.barcode || it.barcode || '',
              qty,
              price,
              prd.cost_price,
              Number(it.discount_amount) || 0,
              Number(it.tax_amount) || 0,
              lineTotal
            );

            // Deduct stock
            updateBalance.run(qty, it.product_id);

            // Movement log
            insertMovement.run(
              genId('mov'),
              it.product_id,
              -qty,
              prd.cost_price,
              saleNumber,
              `مبيعات فاتورة ${saleNumber}`
            );
          });

          // 3. Update Customer Balance if credit sale
          if (payment_method === 'credit' && customer_id) {
            db.prepare('UPDATE customers SET current_balance = current_balance + ? WHERE id = ?').run(totalAmount, customer_id);
          }

          // 4. Update Shift totals if active
          if (sessionId) {
            if (payment_method === 'cash') {
              db.prepare('UPDATE cash_sessions SET total_cash_sales = total_cash_sales + ? WHERE id = ?').run(Math.min(numPaid, totalAmount), sessionId);
            } else if (payment_method === 'card') {
              db.prepare('UPDATE cash_sessions SET total_card_sales = total_card_sales + ? WHERE id = ?').run(totalAmount, sessionId);
            } else if (payment_method === 'credit') {
              db.prepare('UPDATE cash_sessions SET total_credit_sales = total_credit_sales + ? WHERE id = ?').run(totalAmount, sessionId);
            }
          }
        });

        tx();

        const createdSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
        const store = db.prepare("SELECT * FROM store_settings WHERE id = 'current_store'").get();

        return sendJson(res, {
          success: true,
          sale: createdSale,
          items: saleItems,
          store
        });
      }

      // 9. Customers & Debts
      if (pathname === '/api/customers' && method === 'GET') {
        const query = parsedUrl.query.search ? parsedUrl.query.search.trim() : '';
        let sql = 'SELECT * FROM customers';
        const params = [];
        if (query) {
          sql += ' WHERE name LIKE ? OR phone LIKE ? OR code LIKE ?';
          params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }
        sql += ' ORDER BY current_balance DESC, name ASC';
        const customers = db.prepare(sql).all(...params);
        return sendJson(res, { success: true, customers });
      }

      if (pathname === '/api/customers' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendError(res, 'اسم العميل مطلوب');

        const id = body.id || genId('cust');
        const code = body.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

        db.prepare(`
          INSERT INTO customers (id, code, name, phone, address, credit_limit, current_balance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            address = excluded.address,
            credit_limit = excluded.credit_limit
        `).run(
          id,
          code,
          body.name.trim(),
          body.phone || '',
          body.address || '',
          Number(body.credit_limit) || 1000,
          Number(body.current_balance) || 0
        );

        return sendJson(res, { success: true, id });
      }

      if (pathname === '/api/customers/payment' && method === 'POST') {
        const body = await parseBody(req);
        const { customer_id, amount, payment_method = 'cash', notes = '' } = body;
        const numAmount = Number(amount);
        if (!customer_id || !numAmount || numAmount <= 0) return sendError(res, 'المبلغ غير صحيح');

        const payNum = `CPAY-${Date.now().toString().slice(-6)}`;
        db.prepare(`
          INSERT INTO customer_payments (id, customer_id, payment_number, amount, payment_method, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(genId('cpay'), customer_id, payNum, numAmount, payment_method, notes);

        db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(numAmount, customer_id);

        const activeSession = getActiveSession();
        if (activeSession && payment_method === 'cash') {
          db.prepare('UPDATE cash_sessions SET total_cash_in = total_cash_in + ? WHERE id = ?').run(numAmount, activeSession.id);
          db.prepare(`
            INSERT INTO cash_movements (id, session_id, type, amount, reason)
            VALUES (?, ?, 'in', ?, ?)
          `).run(genId('cmov'), activeSession.id, numAmount, `سداد مديونية عميل: ${payNum}`);
        }

        return sendJson(res, { success: true });
      }

      // 10. Suppliers & Purchases
      if (pathname === '/api/suppliers' && method === 'GET') {
        const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all();
        return sendJson(res, { success: true, suppliers });
      }

      if (pathname === '/api/suppliers' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendError(res, 'اسم المورد مطلوب');

        const id = body.id || genId('sup');
        const code = body.code || `SUP-${Math.floor(1000 + Math.random() * 9000)}`;

        db.prepare(`
          INSERT INTO suppliers (id, code, name, contact_person, phone, address, current_balance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            contact_person = excluded.contact_person,
            phone = excluded.phone,
            address = excluded.address
        `).run(
          id,
          code,
          body.name.trim(),
          body.contact_person || '',
          body.phone || '',
          body.address || '',
          Number(body.current_balance) || 0
        );

        return sendJson(res, { success: true, id });
      }

      if (pathname === '/api/purchases' && method === 'GET') {
        const purchases = db.prepare('SELECT * FROM purchase_invoices ORDER BY created_at DESC LIMIT 50').all();
        return sendJson(res, { success: true, purchases });
      }

      if (pathname === '/api/purchases' && method === 'POST') {
        const body = await parseBody(req);
        const {
          supplier_id,
          supplier_name,
          items = [],
          paid_amount = 0,
          payment_method = 'cash',
          notes = ''
        } = body;

        if (!supplier_id || !items || items.length === 0) {
          return sendError(res, 'بيانات فاتورة الشراء غير مكتملة');
        }

        const purchaseId = genId('po');
        const invoiceNum = `PUR-${Date.now().toString().slice(-6)}`;
        let totalAmount = 0;

        items.forEach(it => {
          totalAmount += (Number(it.quantity) * Number(it.unit_cost));
        });

        const numPaid = Number(paid_amount) || 0;
        const remaining = Math.max(0, totalAmount - numPaid);

        const tx = db.transaction(() => {
          db.prepare(`
            INSERT INTO purchase_invoices (
              id, invoice_number, supplier_id, supplier_name,
              total_amount, paid_amount, remaining_amount, payment_method, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            purchaseId,
            invoiceNum,
            supplier_id,
            supplier_name || 'مورد',
            totalAmount,
            numPaid,
            remaining,
            payment_method,
            notes
          );

          items.forEach(it => {
            const qty = Number(it.quantity) || 1;
            const cost = Number(it.unit_cost) || 0;
            const sell = Number(it.selling_price) || 0;
            const lineTotal = (qty * cost);

            db.prepare(`
              INSERT INTO purchase_items (id, purchase_id, product_id, product_name, quantity, unit_cost, selling_price, line_total)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(genId('pi'), purchaseId, it.product_id, it.product_name, qty, cost, sell, lineTotal);

            // Update product stock balance
            db.prepare(`
              INSERT INTO inventory_balances (product_id, quantity, avg_cost, last_updated)
              VALUES (?, ?, ?, datetime('now', 'localtime'))
              ON CONFLICT(product_id) DO UPDATE SET 
                quantity = quantity + excluded.quantity,
                avg_cost = excluded.avg_cost,
                last_updated = excluded.last_updated
            `).run(it.product_id, qty, cost);

            // Update product cost and sell prices
            db.prepare(`
              UPDATE products SET 
                cost_price = ?,
                selling_price = CASE WHEN ? > 0 THEN ? ELSE selling_price END
              WHERE id = ?
            `).run(cost, sell, sell, it.product_id);

            // Inventory movement
            db.prepare(`
              INSERT INTO inventory_movements (id, product_id, movement_type, quantity, unit_cost, reference_number, notes)
              VALUES (?, ?, 'purchase', ?, ?, ?, ?)
            `).run(genId('mov'), it.product_id, qty, cost, invoiceNum, `توريد فاتورة مشتريات ${invoiceNum}`);
          });

          // Update supplier credit balance
          if (remaining > 0) {
            db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?').run(remaining, supplier_id);
          }

          // If paid from cash drawer
          const activeSession = getActiveSession();
          if (activeSession && payment_method === 'cash' && numPaid > 0) {
            db.prepare('UPDATE cash_sessions SET total_cash_out = total_cash_out + ? WHERE id = ?').run(numPaid, activeSession.id);
            db.prepare(`
              INSERT INTO cash_movements (id, session_id, type, amount, reason)
              VALUES (?, ?, 'out', ?, ?)
            `).run(genId('cmov'), activeSession.id, numPaid, `سداد مشتريات: ${invoiceNum}`);
          }
        });

        tx();
        return sendJson(res, { success: true, invoice_number: invoiceNum });
      }

      // 11. Cash Registers & Shifts (الورديات والخزينة)
      if (pathname === '/api/shifts/current' && method === 'GET') {
        const session = getActiveSession();
        return sendJson(res, { success: true, session: session || null });
      }

      if (pathname === '/api/shifts/open' && method === 'POST') {
        const existing = getActiveSession();
        if (existing) return sendError(res, 'يوجد وردية مفتوحة بالفعل');

        const body = await parseBody(req);
        const openingFloat = Number(body.opening_float) || 0;
        const cashierName = body.cashier_name ? body.cashier_name.trim() : 'المدير';
        const sessionId = genId('ses');
        const sessionNum = `SH-${Date.now().toString().slice(-6)}`;

        db.prepare(`
          INSERT INTO cash_sessions (id, session_number, cashier_name, opening_float, status)
          VALUES (?, ?, ?, ?, 'open')
        `).run(sessionId, sessionNum, cashierName, openingFloat);

        const newSession = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(sessionId);
        return sendJson(res, { success: true, session: newSession });
      }

      if (pathname === '/api/shifts/close' && method === 'POST') {
        const active = getActiveSession();
        if (!active) return sendError(res, 'لا توجد وردية مفتوحة لإغلاقها');

        const body = await parseBody(req);
        const countedCash = Number(body.counted_cash) || 0;
        const expectedCash = active.opening_float + active.total_cash_sales + active.total_cash_in - active.total_cash_out - active.total_expenses;
        const variance = countedCash - expectedCash;

        db.prepare(`
          UPDATE cash_sessions SET
            expected_cash = ?,
            counted_cash = ?,
            variance = ?,
            notes = ?,
            status = 'closed',
            closed_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(expectedCash, countedCash, variance, body.notes || '', active.id);

        const closed = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(active.id);
        return sendJson(res, { success: true, session: closed });
      }

      if (pathname === '/api/shifts/movement' && method === 'POST') {
        const active = getActiveSession();
        if (!active) return sendError(res, 'لا توجد وردية مفتوحة');

        const body = await parseBody(req);
        const { type, amount, reason } = body; // type: in or out
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) return sendError(res, 'المبلغ غير صحيح');

        if (type === 'in') {
          db.prepare('UPDATE cash_sessions SET total_cash_in = total_cash_in + ? WHERE id = ?').run(numAmount, active.id);
        } else {
          db.prepare('UPDATE cash_sessions SET total_cash_out = total_cash_out + ? WHERE id = ?').run(numAmount, active.id);
        }

        db.prepare(`
          INSERT INTO cash_movements (id, session_id, type, amount, reason)
          VALUES (?, ?, ?, ?, ?)
        `).run(genId('cmov'), active.id, type, numAmount, reason || (type === 'in' ? 'إيداع يدوي' : 'سحب يدوي'));

        return sendJson(res, { success: true });
      }

      if (pathname === '/api/shifts/history' && method === 'GET') {
        const history = db.prepare('SELECT * FROM cash_sessions ORDER BY opened_at DESC LIMIT 30').all();
        return sendJson(res, { success: true, history });
      }

      // 12. Expenses (المصروفات اليومية)
      if (pathname === '/api/expenses' && method === 'GET') {
        const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100').all();
        return sendJson(res, { success: true, expenses });
      }

      if (pathname === '/api/expenses' && method === 'POST') {
        const body = await parseBody(req);
        const { category = 'أخرى', amount, payment_method = 'cash', notes = '' } = body;
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) return sendError(res, 'مبلغ المصروف غير صحيح');

        const expId = genId('exp');
        db.prepare(`
          INSERT INTO expenses (id, category, amount, payment_method, notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(expId, category, numAmount, payment_method, notes);

        const activeSession = getActiveSession();
        if (activeSession && payment_method === 'cash') {
          db.prepare('UPDATE cash_sessions SET total_expenses = total_expenses + ? WHERE id = ?').run(numAmount, activeSession.id);
        }

        return sendJson(res, { success: true, id: expId });
      }

      // 13. Employees, Attendance & Payroll (الموظفين، الحضور، ومسير الرواتب)
      if (pathname === '/api/employees' && method === 'GET') {
        const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC').all();
        return sendJson(res, { success: true, employees });
      }

      if (pathname === '/api/employees' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendError(res, 'اسم الموظف مطلوب');

        const id = body.id || genId('emp');
        db.prepare(`
          INSERT INTO employees (id, name, job_title, phone, national_id, hire_date, base_salary, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            job_title = excluded.job_title,
            phone = excluded.phone,
            national_id = excluded.national_id,
            hire_date = excluded.hire_date,
            base_salary = excluded.base_salary
        `).run(
          id,
          body.name.trim(),
          body.job_title || 'كاشير',
          body.phone || '',
          body.national_id || '',
          body.hire_date || '',
          Number(body.base_salary) || 3000
        );

        return sendJson(res, { success: true, id });
      }

      if (pathname.startsWith('/api/employees/') && method === 'DELETE') {
        const id = pathname.split('/')[3];
        db.prepare('UPDATE employees SET is_active = 0 WHERE id = ?').run(id);
        return sendJson(res, { success: true });
      }

      // Attendance
      if (pathname === '/api/attendance' && method === 'GET') {
        const date = parsedUrl.query.date || new Date().toISOString().slice(0, 10);
        const attendance = db.prepare(`
          SELECT a.*, e.name as emp_name, e.job_title
          FROM employee_attendance a
          JOIN employees e ON a.employee_id = e.id
          WHERE a.date = ?
        `).all(date);

        // Also fetch all active employees to see who is missing
        const allEmployees = db.prepare('SELECT id, name, job_title FROM employees WHERE is_active = 1').all();
        return sendJson(res, { success: true, attendance, employees: allEmployees, date });
      }

      if (pathname === '/api/attendance' && method === 'POST') {
        const body = await parseBody(req);
        const { employee_id, date, status = 'present', check_in = '', check_out = '', notes = '' } = body;
        if (!employee_id || !date) return sendError(res, 'بيانات تسجيل الحضور غير مكتملة');

        const emp = db.prepare('SELECT name FROM employees WHERE id = ?').get(employee_id);
        const empName = emp ? emp.name : 'موظف';

        db.prepare(`
          INSERT INTO employee_attendance (id, employee_id, employee_name, date, status, check_in, check_out, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, date) DO UPDATE SET
            status = excluded.status,
            check_in = excluded.check_in,
            check_out = excluded.check_out,
            notes = excluded.notes
        `).run(genId('att'), employee_id, empName, date, status, check_in, check_out, notes);

        return sendJson(res, { success: true });
      }

      // Employee Adjustments (سلف، خصومات، مكافآت)
      if (pathname === '/api/adjustments' && method === 'GET') {
        const empId = parsedUrl.query.employee_id;
        let sql = `
          SELECT a.*, e.name as employee_name
          FROM employee_adjustments a
          JOIN employees e ON a.employee_id = e.id
        `;
        const params = [];
        if (empId) {
          sql += ' WHERE a.employee_id = ?';
          params.push(empId);
        }
        sql += ' ORDER BY a.created_at DESC LIMIT 50';
        const adjustments = db.prepare(sql).all(...params);
        return sendJson(res, { success: true, adjustments });
      }

      if (pathname === '/api/adjustments' && method === 'POST') {
        const body = await parseBody(req);
        const { employee_id, type, amount, reason, date } = body; // type: advance, bonus, deduction, overtime
        const numAmount = Number(amount);
        if (!employee_id || !numAmount || numAmount <= 0) return sendError(res, 'البيانات غير مكتملة');

        const adjDate = date || new Date().toISOString().slice(0, 10);
        db.prepare(`
          INSERT INTO employee_adjustments (id, employee_id, type, amount, reason, date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(genId('adj'), employee_id, type, numAmount, reason || '', adjDate);

        // If advance (سلفة نقداً), register cash out from drawer
        const activeSession = getActiveSession();
        if (type === 'advance' && activeSession) {
          const emp = db.prepare('SELECT name FROM employees WHERE id = ?').get(employee_id);
          db.prepare('UPDATE cash_sessions SET total_cash_out = total_cash_out + ? WHERE id = ?').run(numAmount, activeSession.id);
          db.prepare(`
            INSERT INTO cash_movements (id, session_id, type, amount, reason)
            VALUES (?, ?, 'out', ?, ?)
          `).run(genId('cmov'), activeSession.id, numAmount, `سلفة للموظف: ${emp ? emp.name : ''}`);
        }

        return sendJson(res, { success: true });
      }

      // Monthly Payroll
      if (pathname === '/api/payroll' && method === 'GET') {
        const now = new Date();
        const month = Number(parsedUrl.query.month) || (now.getMonth() + 1);
        const year = Number(parsedUrl.query.year) || now.getFullYear();

        const payrolls = db.prepare(`
          SELECT * FROM employee_payroll
          WHERE month = ? AND year = ?
        `).all(month, year);

        return sendJson(res, { success: true, payrolls, month, year });
      }

      if (pathname === '/api/payroll/calculate' && method === 'POST') {
        const body = await parseBody(req);
        const now = new Date();
        const month = Number(body.month) || (now.getMonth() + 1);
        const year = Number(body.year) || now.getFullYear();

        const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1').all();
        const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

        const tx = db.transaction(() => {
          employees.forEach(emp => {
            // Aggregate adjustments for this month
            const adjustments = db.prepare(`
              SELECT 
                COALESCE(SUM(CASE WHEN type IN ('bonus', 'overtime') THEN amount ELSE 0 END), 0) as bonuses,
                COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as deductions,
                COALESCE(SUM(CASE WHEN type = 'advance' THEN amount ELSE 0 END), 0) as advances
              FROM employee_adjustments
              WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
            `).get(emp.id, monthPrefix);

            const netPayable = Math.max(0, emp.base_salary + adjustments.bonuses - adjustments.deductions - adjustments.advances);

            db.prepare(`
              INSERT INTO employee_payroll (
                id, employee_id, employee_name, month, year,
                base_salary, total_bonuses, total_deductions, total_advances,
                net_payable, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
              ON CONFLICT(employee_id, month, year) DO UPDATE SET
                base_salary = excluded.base_salary,
                total_bonuses = excluded.total_bonuses,
                total_deductions = excluded.total_deductions,
                total_advances = excluded.total_advances,
                net_payable = excluded.net_payable
            `).run(
              genId('pay'),
              emp.id,
              emp.name,
              month,
              year,
              emp.base_salary,
              adjustments.bonuses,
              adjustments.deductions,
              adjustments.advances,
              netPayable
            );
          });
        });

        tx();

        const payrolls = db.prepare('SELECT * FROM employee_payroll WHERE month = ? AND year = ?').all(month, year);
        return sendJson(res, { success: true, payrolls });
      }

      if (pathname === '/api/payroll/pay' && method === 'POST') {
        const body = await parseBody(req);
        const { payroll_id, payment_method = 'cash' } = body;
        const payroll = db.prepare('SELECT * FROM employee_payroll WHERE id = ?').get(payroll_id);
        if (!payroll) return sendError(res, 'سجل الراتب غير موجود');

        db.prepare(`
          UPDATE employee_payroll SET
            status = 'paid',
            paid_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(payroll_id);

        // Record as expense
        db.prepare(`
          INSERT INTO expenses (id, category, amount, payment_method, notes)
          VALUES (?, 'رواتب', ?, ?, ?)
        `).run(genId('exp'), payroll.net_payable, payment_method, `صرف راتب شهر ${payroll.month}/${payroll.year} للموظف: ${payroll.employee_name}`);

        return sendJson(res, { success: true });
      }

      // 14. Reports
      if (pathname === '/api/reports' && method === 'GET') {
        const type = parsedUrl.query.type || 'summary';

        if (type === 'profit-loss') {
          const totalSales = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as s FROM sales WHERE status = "completed"').get().s;
          const totalCost = db.prepare(`
            SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) as c
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status = 'completed'
          `).get().c;
          const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as e FROM expenses').get().e;
          const grossProfit = totalSales - totalCost;
          const netProfit = grossProfit - totalExpenses;

          return sendJson(res, {
            success: true,
            report: {
              total_sales: totalSales,
              cogs: totalCost,
              gross_profit: grossProfit,
              total_expenses: totalExpenses,
              net_profit: netProfit
            }
          });
        }

        // Top products
        const topProducts = db.prepare(`
          SELECT 
            si.product_name,
            SUM(si.quantity) as total_sold,
            SUM(si.line_total) as total_revenue
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE s.status = 'completed'
          GROUP BY si.product_id
          ORDER BY total_sold DESC
          LIMIT 10
        `).all();

        return sendJson(res, { success: true, top_products: topProducts });
      }

      // 15. Local Database Backup & Restore
      if (pathname === '/api/backup' && method === 'GET') {
        const dbPath = getDbPath();
        const stat = fs.statSync(dbPath);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="sastmhaly_backup_${new Date().toISOString().slice(0, 10)}.db"`,
          'Content-Length': stat.size
        });
        const readStream = fs.createReadStream(dbPath);
        return readStream.pipe(res);
      }

      return sendError(res, 'Endpoint not found', 404);
    }

    // ----------------------------------------------------
    // STATIC ASSETS SERVING
    // ----------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Security check against directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access denied');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileContent = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    return res.end(fileContent);

  } catch (err) {
    console.error('Server Error:', err);
    return sendError(res, 'حدث خطأ في الخادم المحلي: ' + err.message, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Sastmhaly Desktop Server] Running on http://127.0.0.1:${PORT}`);
});
