const fs = require('fs');
const path = require('path');

class StorageManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(this.dataDir, 'sastmhaly_local_data.json');
    this.data = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataDir)) {
      try { fs.mkdirSync(this.dataDir, { recursive: true }); } catch (e) {}
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error loading existing db, creating backup and new db:', err);
        this.data = this.getDefaultSchema();
      }
    } else {
      this.data = this.getDefaultSchema();
      this.save();
    }
  }

  getDefaultSchema() {
    return {
      store_settings: {
        id: 'current_store',
        store_name: '',
        business_type: 'سوبرماركت',
        phone: '',
        address: '',
        city: 'القاهرة',
        tax_number: '',
        commercial_register: '',
        tax_rate: 14.0,
        vat_enabled: 1,
        currency: 'ج.م',
        logo_base64: '',
        receipt_header: 'أهلاً بكم ونتشرف بزيارتكم',
        receipt_footer: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بموجب الفاتورة',
        return_policy: 'يُرجى إحضار أصل الفاتورة عند الاسترجاع أو الاستبدال',
        is_configured: 0,
        created_at: new Date().toISOString()
      },
      categories: [
        { id: 'cat_gen', name: 'أصناف عامة', code: 'GEN', color: '#2563eb', is_active: 1 },
        { id: 'cat_food', name: 'مواد غذائية', code: 'FOOD', color: '#16a34a', is_active: 1 },
        { id: 'cat_bev', name: 'مشروبات وعصائر', code: 'BEV', color: '#d97706', is_active: 1 },
        { id: 'cat_clean', name: 'منظفات وعناية', code: 'CLN', color: '#7c3aed', is_active: 1 }
      ],
      units: [
        { id: 'unit_pcs', name: 'قطعة', code: 'PCS' },
        { id: 'unit_kg', name: 'كيلوجرام', code: 'KG' },
        { id: 'unit_ltr', name: 'لتر', code: 'LTR' },
        { id: 'unit_box', name: 'علبة', code: 'BOX' },
        { id: 'unit_crt', name: 'كرتونة', code: 'CRT' }
      ],
      products: [],
      inventory_movements: [],
      sales: [],
      sale_items: [],
      customers: [],
      customer_payments: [],
      suppliers: [],
      purchase_invoices: [],
      purchase_items: [],
      supplier_payments: [],
      cash_sessions: [],
      cash_movements: [],
      expenses: [],
      employees: [],
      employee_attendance: [],
      employee_adjustments: [],
      employee_payroll: []
    };
  }

  save() {
    try {
      const tempPath = this.dbPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.dbPath);
      return true;
    } catch (err) {
      console.error('Failed to save data:', err);
      return false;
    }
  }

  genId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // 1. Status & Setup
  getStatus() {
    const store = this.data.store_settings;
    const activeSession = this.getActiveSession();
    return {
      success: true,
      configured: store.is_configured === 1,
      store: store,
      active_session: activeSession || null,
      version: '1.0.0'
    };
  }

  setupStore(payload) {
    const s = this.data.store_settings;
    s.store_name = (payload.store_name || '').trim();
    s.business_type = payload.business_type || 'سوبرماركت';
    s.phone = (payload.phone || '').trim();
    s.address = (payload.address || '').trim();
    s.city = (payload.city || 'القاهرة').trim();
    s.tax_number = (payload.tax_number || '').trim();
    s.commercial_register = (payload.commercial_register || '').trim();
    s.tax_rate = Number(payload.tax_rate) || 0;
    s.currency = (payload.currency || 'ج.م').trim();
    s.logo_base64 = payload.logo_base64 || '';
    s.is_configured = 1;
    this.save();
    return { success: true, store: s };
  }

  getSettings() {
    return { success: true, store: this.data.store_settings };
  }

  saveSettings(payload) {
    const s = this.data.store_settings;
    Object.assign(s, payload);
    this.save();
    return { success: true, store: s };
  }

  // Active Cash Session
  getActiveSession() {
    return this.data.cash_sessions.find(cs => cs.status === 'open') || null;
  }

  // 2. Dashboard Stats
  getDashboard() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = todayStr.slice(0, 7);

    const todaySales = this.data.sales.filter(s => (s.created_at || '').slice(0, 10) === todayStr && s.status === 'completed');
    const todaySalesTotal = todaySales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);

    const monthSales = this.data.sales.filter(s => (s.created_at || '').slice(0, 7) === monthStr && s.status === 'completed');
    const monthSalesTotal = monthSales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);

    // COGS for today
    const todaySaleIds = new Set(todaySales.map(s => s.id));
    const todayCost = this.data.sale_items
      .filter(item => todaySaleIds.has(item.sale_id))
      .reduce((acc, it) => acc + (Number(it.quantity) * Number(it.cost_price || 0)), 0);

    const todayExpenses = this.data.expenses
      .filter(e => (e.created_at || '').slice(0, 10) === todayStr)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    const todayProfit = Math.round((todaySalesTotal - todayCost - todayExpenses) * 100) / 100;

    const activeProducts = this.data.products.filter(p => p.is_active !== 0);
    const lowStockCount = activeProducts.filter(p => (Number(p.stock_quantity) || 0) <= (Number(p.min_stock_alert) || 5)).length;

    const custDebts = this.data.customers
      .filter(c => (Number(c.current_balance) || 0) > 0)
      .reduce((acc, c) => acc + Number(c.current_balance), 0);

    const recentSales = this.data.sales.slice(-8).reverse();

    return {
      success: true,
      stats: {
        today_sales: todaySalesTotal,
        today_count: todaySales.length,
        today_profit: todayProfit,
        month_sales: monthSalesTotal,
        month_count: monthSales.length,
        total_products: activeProducts.length,
        low_stock_count: lowStockCount,
        customer_debts: custDebts,
        active_shift: this.getActiveSession()
      },
      recent_sales: recentSales
    };
  }

  // 3. Products
  getProducts(search = '', categoryId = '') {
    let prods = this.data.products.filter(p => p.is_active !== 0);
    if (categoryId) {
      prods = prods.filter(p => p.category_id === categoryId);
    }
    if (search) {
      const q = search.toLowerCase();
      prods = prods.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    }
    return { success: true, products: prods };
  }

  saveProduct(payload) {
    let p;
    if (payload.id) {
      p = this.data.products.find(item => item.id === payload.id);
    }
    const isNew = !p;
    if (isNew) {
      p = { id: this.genId('prd'), created_at: new Date().toLocaleString('ar-EG') };
      this.data.products.push(p);
    }

    p.name = (payload.name || '').trim();
    p.barcode = (payload.barcode || `${Date.now().toString().slice(-8)}`).trim();
    p.sku = (payload.sku || `SKU-${Math.floor(100000 + Math.random() * 900000)}`).trim();
    p.category_id = payload.category_id || '';
    p.unit_id = payload.unit_id || 'unit_pcs';
    p.cost_price = Number(payload.cost_price) || 0;
    p.selling_price = Number(payload.selling_price) || 0;
    p.wholesale_price = Number(payload.wholesale_price) || 0;
    p.min_stock_alert = Number(payload.min_stock_alert) || 5;
    p.tax_rate = Number(payload.tax_rate) || 14;
    p.is_active = 1;

    // Unit & category names
    const cat = this.data.categories.find(c => c.id === p.category_id);
    p.category_name = cat ? cat.name : '';
    const unit = this.data.units.find(u => u.id === p.unit_id);
    p.unit_name = unit ? unit.name : 'قطعة';

    if (isNew) {
      const initStock = Number(payload.initial_stock) || 0;
      p.stock_quantity = initStock;
      if (initStock > 0) {
        this.data.inventory_movements.push({
          id: this.genId('mov'),
          product_id: p.id,
          movement_type: 'initial',
          quantity: initStock,
          unit_cost: p.cost_price,
          reference_number: 'INIT',
          notes: 'رصيد أول المدة',
          created_at: new Date().toLocaleString('ar-EG')
        });
      }
    }

    this.save();
    return { success: true, product: p };
  }

  deleteProduct(id) {
    const p = this.data.products.find(item => item.id === id);
    if (p) p.is_active = 0;
    this.save();
    return { success: true };
  }

  // 4. Categories & Units
  getCategories() {
    return { success: true, categories: this.data.categories.filter(c => c.is_active !== 0) };
  }

  getUnits() {
    return { success: true, units: this.data.units };
  }

  // 5. Inventory Adjustments
  getInventory() {
    const items = this.data.products.filter(p => p.is_active !== 0).map(p => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      min_stock_alert: p.min_stock_alert,
      current_quantity: p.stock_quantity || 0,
      category_name: p.category_name || '',
      unit_name: p.unit_name || 'قطعة'
    }));
    return { success: true, inventory: items };
  }

  adjustInventory(payload) {
    const { product_id, adjustment_type, quantity, notes } = payload;
    const p = this.data.products.find(item => item.id === product_id);
    if (!p) return { success: false, error: 'المنتج غير موجود' };

    const numQty = Number(quantity);
    let delta = 0;
    if (adjustment_type === 'add') {
      p.stock_quantity = (p.stock_quantity || 0) + numQty;
      delta = numQty;
    } else if (adjustment_type === 'subtract') {
      p.stock_quantity = Math.max(0, (p.stock_quantity || 0) - numQty);
      delta = -numQty;
    } else {
      delta = numQty - (p.stock_quantity || 0);
      p.stock_quantity = numQty;
    }

    this.data.inventory_movements.push({
      id: this.genId('mov'),
      product_id: p.id,
      movement_type: 'adjustment',
      quantity: delta,
      unit_cost: p.cost_price,
      reference_number: 'ADJ',
      notes: notes || 'تسوية مخزنية يدوية',
      created_at: new Date().toLocaleString('ar-EG')
    });

    this.save();
    return { success: true, new_quantity: p.stock_quantity };
  }

  // 6. POS Sales
  getSales() {
    return { success: true, sales: this.data.sales.slice(-100).reverse() };
  }

  getSale(id) {
    const sale = this.data.sales.find(s => s.id === id);
    if (!sale) return { success: false, error: 'الفاتورة غير موجودة' };
    const items = this.data.sale_items.filter(it => it.sale_id === id).map(it => {
      const p = this.data.products.find(prod => prod.id === it.product_id);
      return {
        ...it,
        product_name: it.product_name || (p ? p.name : 'صنف')
      };
    });
    return { success: true, sale, items, store: this.data.store_settings };
  }

  commitSale(payload) {
    const { items = [], customer_id = '', customer_name = 'عميل نقدي', payment_method = 'cash', discount_amount = 0, paid_amount = 0, notes = '' } = payload;

    if (!items || items.length === 0) return { success: false, error: 'سلة المشتريات فارغة' };

    const saleId = this.genId('sale');
    const saleCount = this.data.sales.length + 1;
    const saleNumber = `INV-${saleCount.toString().padStart(6, '0')}`;
    const activeSession = this.getActiveSession();
    const currTime = new Date().toLocaleString('ar-EG');

    let subtotal = 0;
    let totalTax = 0;

    items.forEach(it => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.unit_price) || 0;
      const lineTax = Number(it.tax_amount) || 0;
      subtotal += (qty * price);
      totalTax += lineTax;
    });

    const disc = Number(discount_amount) || 0;
    const totalAmount = Math.max(0, subtotal - disc + totalTax);
    let paid = Number(paid_amount);
    if (payment_method === 'credit') {
      paid = 0;
    } else if (paid === 0 || isNaN(paid)) {
      paid = totalAmount;
    }
    const change = payment_method === 'cash' ? Math.max(0, paid - totalAmount) : 0;

    const saleRecord = {
      id: saleId,
      sale_number: saleNumber,
      session_id: activeSession ? activeSession.id : '',
      cashier_name: activeSession ? activeSession.cashier_name : 'المدير',
      customer_id,
      customer_name,
      subtotal,
      discount_amount: disc,
      tax_amount: totalTax,
      total_amount: totalAmount,
      paid_amount: Math.min(paid, totalAmount),
      change_amount: change,
      payment_method,
      status: 'completed',
      notes,
      created_at: currTime
    };

    this.data.sales.push(saleRecord);

    // Save items and decrement stock
    const createdItems = [];
    items.forEach(it => {
      const p = this.data.products.find(prod => prod.id === it.product_id);
      const prodName = it.product_name || (p ? p.name : 'صنف');
      const qty = Number(it.quantity) || 1;
      const unitPrice = Number(it.unit_price) || 0;
      const lineTotal = qty * unitPrice;
      const costPrice = p ? p.cost_price : 0;

      const itemRecord = {
        id: this.genId('si'),
        sale_id: saleId,
        product_id: it.product_id,
        product_name: prodName,
        barcode: p ? p.barcode : (it.barcode || ''),
        quantity: qty,
        unit_price: unitPrice,
        cost_price: costPrice,
        discount_amount: Number(it.discount_amount) || 0,
        tax_amount: Number(it.tax_amount) || 0,
        line_total: lineTotal
      };

      this.data.sale_items.push(itemRecord);
      createdItems.push(itemRecord);

      // Decrement product stock
      if (p) {
        p.stock_quantity = Math.max(0, (p.stock_quantity || 0) - qty);
      }

      this.data.inventory_movements.push({
        id: this.genId('mov'),
        product_id: it.product_id,
        movement_type: 'sale',
        quantity: -qty,
        unit_cost: costPrice,
        reference_number: saleNumber,
        notes: `مبيعات فاتورة ${saleNumber}`,
        created_at: currTime
      });
    });

    // Credit sale customer balance
    if (payment_method === 'credit' && customer_id) {
      const c = this.data.customers.find(cust => cust.id === customer_id);
      if (c) c.current_balance = (Number(c.current_balance) || 0) + totalAmount;
    }

    // Update active shift sales
    if (activeSession) {
      if (payment_method === 'cash') {
        activeSession.total_cash_sales = (activeSession.total_cash_sales || 0) + Math.min(paid, totalAmount);
      } else if (payment_method === 'card') {
        activeSession.total_card_sales = (activeSession.total_card_sales || 0) + totalAmount;
      } else if (payment_method === 'credit') {
        activeSession.total_credit_sales = (activeSession.total_credit_sales || 0) + totalAmount;
      }
    }

    this.save();
    return {
      success: true,
      sale: saleRecord,
      items: createdItems,
      store: this.data.store_settings
    };
  }

  // 7. Customers & Debt
  getCustomers(search = '') {
    let custs = [...this.data.customers];
    if (search) {
      const q = search.toLowerCase();
      custs = custs.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.code || '').toLowerCase().includes(q));
    }
    custs.sort((a, b) => (Number(b.current_balance) || 0) - (Number(a.current_balance) || 0));
    return { success: true, customers: custs };
  }

  saveCustomer(payload) {
    let c;
    if (payload.id) {
      c = this.data.customers.find(item => item.id === payload.id);
    }
    if (!c) {
      c = {
        id: this.genId('cust'),
        code: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        current_balance: 0,
        loyalty_points: 0,
        created_at: new Date().toLocaleString('ar-EG')
      };
      this.data.customers.push(c);
    }

    c.name = (payload.name || '').trim();
    c.phone = (payload.phone || '').trim();
    c.address = (payload.address || '').trim();
    c.credit_limit = Number(payload.credit_limit) || 1000;
    this.save();
    return { success: true, customer: c };
  }

  recordCustomerPayment(payload) {
    const { customer_id, amount, payment_method = 'cash', notes = '' } = payload;
    const c = this.data.customers.find(item => item.id === customer_id);
    if (!c) return { success: false, error: 'العميل غير موجود' };

    const numAmount = Number(amount);
    const payNum = `CPAY-${Date.now().toString().slice(-6)}`;
    const currTime = new Date().toLocaleString('ar-EG');

    this.data.customer_payments.push({
      id: this.genId('cpay'),
      customer_id,
      payment_number: payNum,
      amount: numAmount,
      payment_method,
      notes,
      created_at: currTime
    });

    c.current_balance = Math.max(0, (c.current_balance || 0) - numAmount);

    const activeSession = this.getActiveSession();
    if (activeSession && payment_method === 'cash') {
      activeSession.total_cash_in = (activeSession.total_cash_in || 0) + numAmount;
      this.data.cash_movements.push({
        id: this.genId('cmov'),
        session_id: activeSession.id,
        type: 'in',
        amount: numAmount,
        reason: `سداد مديونية عميل: ${c.name} (${payNum})`,
        created_at: currTime
      });
    }

    this.save();
    return { success: true };
  }

  // 8. Suppliers & Purchases
  getSuppliers() {
    return { success: true, suppliers: this.data.suppliers };
  }

  saveSupplier(payload) {
    let s;
    if (payload.id) {
      s = this.data.suppliers.find(item => item.id === payload.id);
    }
    if (!s) {
      s = {
        id: this.genId('sup'),
        code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
        current_balance: 0,
        created_at: new Date().toLocaleString('ar-EG')
      };
      this.data.suppliers.push(s);
    }

    s.name = (payload.name || '').trim();
    s.contact_person = (payload.contact_person || '').trim();
    s.phone = (payload.phone || '').trim();
    s.address = (payload.address || '').trim();
    this.save();
    return { success: true, supplier: s };
  }

  getPurchases() {
    return { success: true, purchases: this.data.purchase_invoices.slice(-50).reverse() };
  }

  recordPurchaseInvoice(payload) {
    const { supplier_id, supplier_name, items = [], paid_amount = 0, payment_method = 'cash', notes = '' } = payload;
    const poId = this.genId('po');
    const invoiceNum = `PUR-${Date.now().toString().slice(-6)}`;
    const currTime = new Date().toLocaleString('ar-EG');

    let totalAmount = 0;
    items.forEach(it => {
      totalAmount += (Number(it.quantity) * Number(it.unit_cost));
    });

    const numPaid = Number(paid_amount) || 0;
    const remaining = Math.max(0, totalAmount - numPaid);

    this.data.purchase_invoices.push({
      id: poId,
      invoice_number: invoiceNum,
      supplier_id,
      supplier_name,
      total_amount: totalAmount,
      paid_amount: numPaid,
      remaining_amount: remaining,
      payment_method,
      notes,
      created_at: currTime
    });

    items.forEach(it => {
      const qty = Number(it.quantity) || 1;
      const cost = Number(it.unit_cost) || 0;
      const sell = Number(it.selling_price) || 0;

      this.data.purchase_items.push({
        id: this.genId('pi'),
        purchase_id: poId,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: qty,
        unit_cost: cost,
        selling_price: sell,
        line_total: (qty * cost)
      });

      // Update product cost and sell prices & increment stock
      const p = this.data.products.find(prod => prod.id === it.product_id);
      if (p) {
        p.cost_price = cost;
        if (sell > 0) p.selling_price = sell;
        p.stock_quantity = (p.stock_quantity || 0) + qty;
      }

      this.data.inventory_movements.push({
        id: this.genId('mov'),
        product_id: it.product_id,
        movement_type: 'purchase',
        quantity: qty,
        unit_cost: cost,
        reference_number: invoiceNum,
        notes: `توريد فاتورة مشتريات ${invoiceNum}`,
        created_at: currTime
      });
    });

    // Supplier debt balance
    if (remaining > 0) {
      const sup = this.data.suppliers.find(s => s.id === supplier_id);
      if (sup) sup.current_balance = (sup.current_balance || 0) + remaining;
    }

    // Cash session out
    const activeSession = this.getActiveSession();
    if (activeSession && payment_method === 'cash' && numPaid > 0) {
      activeSession.total_cash_out = (activeSession.total_cash_out || 0) + numPaid;
      this.data.cash_movements.push({
        id: this.genId('cmov'),
        session_id: activeSession.id,
        type: 'out',
        amount: numPaid,
        reason: `سداد مشتريات: ${invoiceNum}`,
        created_at: currTime
      });
    }

    this.save();
    return { success: true, invoice_number: invoiceNum };
  }

  // 9. Shifts
  openShift(payload) {
    const existing = this.getActiveSession();
    if (existing) return { success: false, error: 'يوجد وردية مفتوحة بالفعل' };

    const openingFloat = Number(payload.opening_float) || 0;
    const cashierName = (payload.cashier_name || 'المدير').trim();
    const sessionId = this.genId('ses');
    const sessionNum = `SH-${Date.now().toString().slice(-6)}`;
    const currTime = new Date().toLocaleString('ar-EG');

    const session = {
      id: sessionId,
      session_number: sessionNum,
      cashier_name: cashierName,
      opening_float: openingFloat,
      total_cash_sales: 0,
      total_card_sales: 0,
      total_credit_sales: 0,
      total_expenses: 0,
      total_cash_in: 0,
      total_cash_out: 0,
      expected_cash: openingFloat,
      counted_cash: null,
      variance: null,
      notes: '',
      status: 'open',
      opened_at: currTime,
      closed_at: null
    };

    this.data.cash_sessions.push(session);
    this.save();
    return { success: true, session };
  }

  closeShift(payload) {
    const active = this.getActiveSession();
    if (!active) return { success: false, error: 'لا توجد وردية مفتوحة لإغلاقها' };

    const countedCash = Number(payload.counted_cash) || 0;
    const expected = (active.opening_float || 0) + (active.total_cash_sales || 0) + (active.total_cash_in || 0) - (active.total_cash_out || 0) - (active.total_expenses || 0);
    const variance = countedCash - expected;

    active.expected_cash = expected;
    active.counted_cash = countedCash;
    active.variance = variance;
    active.notes = payload.notes || '';
    active.status = 'closed';
    active.closed_at = new Date().toLocaleString('ar-EG');

    this.save();
    return { success: true, session: active };
  }

  addCashMovement(payload) {
    const active = this.getActiveSession();
    if (!active) return { success: false, error: 'لا توجد وردية مفتوحة' };

    const { type, amount, reason } = payload;
    const numAmount = Number(amount);
    if (type === 'in') {
      active.total_cash_in = (active.total_cash_in || 0) + numAmount;
    } else {
      active.total_cash_out = (active.total_cash_out || 0) + numAmount;
    }

    this.data.cash_movements.push({
      id: this.genId('cmov'),
      session_id: active.id,
      type,
      amount: numAmount,
      reason: reason || (type === 'in' ? 'إيداع يدوي' : 'سحب يدوي'),
      created_at: new Date().toLocaleString('ar-EG')
    });

    this.save();
    return { success: true };
  }

  getShiftsHistory() {
    return { success: true, history: this.data.cash_sessions.slice(-30).reverse() };
  }

  // 10. Expenses
  getExpenses() {
    return { success: true, expenses: this.data.expenses.slice(-100).reverse() };
  }

  recordExpense(payload) {
    const { category = 'أخرى', amount, payment_method = 'cash', notes = '' } = payload;
    const numAmount = Number(amount) || 0;
    const expId = this.genId('exp');
    const currTime = new Date().toLocaleString('ar-EG');

    this.data.expenses.push({
      id: expId,
      category,
      amount: numAmount,
      payment_method,
      notes,
      created_by: 'المدير',
      created_at: currTime
    });

    const activeSession = this.getActiveSession();
    if (activeSession && payment_method === 'cash') {
      activeSession.total_expenses = (activeSession.total_expenses || 0) + numAmount;
    }

    this.save();
    return { success: true, id: expId };
  }

  // 11. Employees, Attendance & Payroll
  getEmployees() {
    return { success: true, employees: this.data.employees.filter(e => e.is_active !== 0) };
  }

  saveEmployee(payload) {
    let emp;
    if (payload.id) {
      emp = this.data.employees.find(e => e.id === payload.id);
    }
    if (!emp) {
      emp = {
        id: this.genId('emp'),
        is_active: 1,
        created_at: new Date().toLocaleString('ar-EG')
      };
      this.data.employees.push(emp);
    }

    emp.name = (payload.name || '').trim();
    emp.job_title = payload.job_title || 'كاشير';
    emp.phone = (payload.phone || '').trim();
    emp.base_salary = Number(payload.base_salary) || 3000;
    emp.hire_date = payload.hire_date || '';
    this.save();
    return { success: true, employee: emp };
  }

  recordAdjustment(payload) {
    const { employee_id, type, amount, reason } = payload;
    const numAmount = Number(amount) || 0;
    const currTime = new Date().toLocaleString('ar-EG');

    this.data.employee_adjustments.push({
      id: this.genId('adj'),
      employee_id,
      type,
      amount: numAmount,
      reason: reason || '',
      date: new Date().toISOString().slice(0, 10),
      created_at: currTime
    });

    // Advance cash drawer out
    const activeSession = this.getActiveSession();
    if (type === 'advance' && activeSession) {
      const emp = this.data.employees.find(e => e.id === employee_id);
      activeSession.total_cash_out = (activeSession.total_cash_out || 0) + numAmount;
      this.data.cash_movements.push({
        id: this.genId('cmov'),
        session_id: activeSession.id,
        type: 'out',
        amount: numAmount,
        reason: `سلفة نقدية للموظف: ${emp ? emp.name : ''}`,
        created_at: currTime
      });
    }

    this.save();
    return { success: true };
  }

  getPayroll(month, year) {
    const m = Number(month) || (new Date().getMonth() + 1);
    const y = Number(year) || new Date().getFullYear();
    const payrolls = this.data.employee_payroll.filter(p => p.month === m && p.year === y);
    return { success: true, payrolls, month: m, year: y };
  }

  calculatePayroll(payload) {
    const now = new Date();
    const month = Number(payload.month) || (now.getMonth() + 1);
    const year = Number(payload.year) || now.getFullYear();
    const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

    const activeEmployees = this.data.employees.filter(e => e.is_active !== 0);

    activeEmployees.forEach(emp => {
      // Find adjustments for this month
      const adjs = this.data.employee_adjustments.filter(a => a.employee_id === emp.id && (a.date || '').startsWith(monthPrefix));
      const bonuses = adjs.filter(a => a.type === 'bonus' || a.type === 'overtime').reduce((acc, a) => acc + Number(a.amount), 0);
      const deductions = adjs.filter(a => a.type === 'deduction').reduce((acc, a) => acc + Number(a.amount), 0);
      const advances = adjs.filter(a => a.type === 'advance').reduce((acc, a) => acc + Number(a.amount), 0);

      const netPayable = Math.max(0, emp.base_salary + bonuses - deductions - advances);

      let record = this.data.employee_payroll.find(p => p.employee_id === emp.id && p.month === month && p.year === year);
      if (!record) {
        record = {
          id: this.genId('pay'),
          employee_id: emp.id,
          employee_name: emp.name,
          month,
          year,
          status: 'pending',
          created_at: new Date().toLocaleString('ar-EG')
        };
        this.data.employee_payroll.push(record);
      }

      record.base_salary = emp.base_salary;
      record.total_bonuses = bonuses;
      record.total_deductions = deductions;
      record.total_advances = advances;
      record.net_payable = netPayable;
    });

    this.save();
    return this.getPayroll(month, year);
  }

  paySalary(payrollId) {
    const p = this.data.employee_payroll.find(pay => pay.id === payrollId);
    if (!p) return { success: false, error: 'سجل الراتب غير موجود' };

    p.status = 'paid';
    p.paid_at = new Date().toLocaleString('ar-EG');

    this.data.expenses.push({
      id: this.genId('exp'),
      category: 'رواتب',
      amount: p.net_payable,
      payment_method: 'cash',
      notes: `صرف راتب شهر ${p.month}/${p.year} للموظف: ${p.employee_name}`,
      created_by: 'المدير',
      created_at: new Date().toLocaleString('ar-EG')
    });

    this.save();
    return { success: true };
  }

  // 12. Reports
  getReports(type = 'summary') {
    if (type === 'profit-loss') {
      const completedSales = this.data.sales.filter(s => s.status === 'completed');
      const totalSales = completedSales.reduce((acc, s) => acc + Number(s.total_amount), 0);

      const completedIds = new Set(completedSales.map(s => s.id));
      const totalCost = this.data.sale_items
        .filter(it => completedIds.has(it.sale_id))
        .reduce((acc, it) => acc + (Number(it.quantity) * Number(it.cost_price || 0)), 0);

      const totalExpenses = this.data.expenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const grossProfit = totalSales - totalCost;
      const netProfit = grossProfit - totalExpenses;

      return {
        success: true,
        report: {
          total_sales: totalSales,
          cogs: totalCost,
          gross_profit: grossProfit,
          total_expenses: totalExpenses,
          net_profit: netProfit
        }
      };
    }

    // Top products
    const productSalesMap = {};
    const completedIds = new Set(this.data.sales.filter(s => s.status === 'completed').map(s => s.id));

    this.data.sale_items.filter(it => completedIds.has(it.sale_id)).forEach(it => {
      if (!productSalesMap[it.product_id]) {
        productSalesMap[it.product_id] = { product_name: it.product_name, total_sold: 0, total_revenue: 0 };
      }
      productSalesMap[it.product_id].total_sold += Number(it.quantity);
      productSalesMap[it.product_id].total_revenue += Number(it.line_total);
    });

    const topProducts = Object.values(productSalesMap).sort((a, b) => b.total_sold - a.total_sold).slice(0, 10);
    return { success: true, top_products: topProducts };
  }
}

module.exports = StorageManager;

