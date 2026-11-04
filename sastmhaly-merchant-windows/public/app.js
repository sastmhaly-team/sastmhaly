/**
 * Sastmhaly Desktop Merchant POS - 100% Arabic Client Application
 * Local-First, Zero Cloud Dependency, Zero English Text
 */

const app = {
  state: {
    store: {},
    configured: false,
    activeSession: null,
    currentView: 'dashboard',
    products: [],
    categories: [],
    units: [],
    customers: [],
    suppliers: [],
    cart: [],
    posSelectedCategory: '',
    selectedPaymentMethod: 'cash',
    lastPrintedSale: null
  },

  // 1. Initialization
  async init() {
    this.startClock();
    this.setupEventListeners();
    await this.checkStatus();
  },

  // 2. Clock
  startClock() {
    const update = () => {
      const now = new Date();
      const el = document.getElementById('clock-display');
      if (el) {
        el.textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + now.toLocaleDateString('ar-EG');
      }
    };
    update();
    setInterval(update, 1000);
  },

  // 3. Status & Onboarding
  async checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (!data.success) throw new Error('فشل فحص الحالة');

      this.state.configured = data.configured;
      this.state.store = data.store || {};
      this.state.activeSession = data.active_session;

      this.updateStoreUI();
      this.updateShiftUI();

      if (!this.state.configured) {
        this.openModal('modal-onboarding');
      } else {
        await this.loadAllBaseData();
        this.navigate('dashboard');
      }
    } catch (err) {
      console.error(err);
      this.toast('تعذر الاتصال بقاعدة البيانات المحلية', 'error');
    }
  },

  updateStoreUI() {
    const s = this.state.store;
    if (!s) return;
    const nameEl = document.getElementById('sidebar-store-name');
    if (nameEl && s.store_name) nameEl.textContent = s.store_name;

    const logoEl = document.getElementById('sidebar-logo');
    if (logoEl && s.logo_base64) logoEl.src = s.logo_base64;

    const printLogo = document.getElementById('print-receipt-logo');
    if (printLogo && s.logo_base64) printLogo.src = s.logo_base64;

    const printStore = document.getElementById('print-store-name');
    if (printStore && s.store_name) printStore.textContent = s.store_name;

    const printPhone = document.getElementById('print-store-phone');
    if (printPhone && s.phone) printPhone.textContent = 'هاتف: ' + s.phone;

    const printAddress = document.getElementById('print-store-address');
    if (printAddress && s.address) printAddress.textContent = s.address;

    const printTax = document.getElementById('print-store-tax');
    if (printTax && s.tax_number) printTax.textContent = 'الرقم الضريبي: ' + s.tax_number;

    const printHeader = document.getElementById('print-receipt-header');
    if (printHeader && s.receipt_header) printHeader.textContent = s.receipt_header;

    const printFooter = document.getElementById('print-receipt-footer');
    if (printFooter && s.receipt_footer) printFooter.textContent = s.receipt_footer;
  },

  updateShiftUI() {
    const badge = document.getElementById('header-shift-badge');
    const text = document.getElementById('shift-status-text');
    const ses = this.state.activeSession;
    if (ses) {
      badge.className = 'shift-badge open';
      text.textContent = `وردية مفتوحة (${ses.cashier_name})`;
      const btnOpen = document.getElementById('btn-open-shift');
      const btnClose = document.getElementById('btn-close-shift');
      if (btnOpen) btnOpen.style.display = 'none';
      if (btnClose) btnClose.style.display = 'inline-flex';
    } else {
      badge.className = 'shift-badge closed';
      text.textContent = 'الوردية مغلقة';
      const btnOpen = document.getElementById('btn-open-shift');
      const btnClose = document.getElementById('btn-close-shift');
      if (btnOpen) btnOpen.style.display = 'inline-flex';
      if (btnClose) btnClose.style.display = 'none';
    }
  },

  async loadAllBaseData() {
    await Promise.all([
      this.loadCategories(),
      this.loadUnits(),
      this.loadCustomersList(),
      this.loadSuppliersList()
    ]);
  },

  // 4. Navigation
  setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        this.navigate(view);
      });
    });

    // Barcode scanner auto-listener in POS
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.navigate('pos');
        document.getElementById('pos-barcode-search').focus();
      } else if (e.key === 'F9' && this.state.currentView === 'pos') {
        e.preventDefault();
        this.showCheckoutModal();
      }
    });

    const searchInput = document.getElementById('pos-barcode-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeScan(searchInput.value.trim());
        }
      });
      searchInput.addEventListener('input', () => {
        this.renderPosProducts();
      });
    }
  },

  navigate(viewName) {
    this.state.currentView = viewName;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    document.querySelectorAll('.page-view').forEach(el => {
      el.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    const titles = {
      dashboard: 'لوحة التحكم',
      pos: 'نقطة البيع (الكاشير)',
      sales: 'فواتير المبيعات',
      products: 'دليل المنتجات والأصناف',
      inventory: 'أرصدة المخزون والتسويات',
      customers: 'العملاء وحسابات الديون',
      suppliers: 'الموردين وفواتير الشراء',
      shifts: 'الخزينة وإدارة الورديات',
      expenses: 'المصروفات اليومية',
      employees: 'شؤون الموظفين والرواتب',
      reports: 'التقارير والأرباح',
      settings: 'إعدادات المتجر والنسخ الاحتياطي'
    };

    const titleEl = document.getElementById('current-page-title');
    if (titleEl) titleEl.textContent = titles[viewName] || 'سستمهالي';

    // Refresh view data
    if (viewName === 'dashboard') this.loadDashboardData();
    if (viewName === 'pos') {
      this.loadPosProducts();
      setTimeout(() => document.getElementById('pos-barcode-search')?.focus(), 100);
    }
    if (viewName === 'sales') this.loadSalesList();
    if (viewName === 'products') this.loadProductsList();
    if (viewName === 'inventory') this.loadInventoryList();
    if (viewName === 'customers') this.loadCustomersList();
    if (viewName === 'suppliers') this.loadSuppliersList();
    if (viewName === 'shifts') this.loadShiftsData();
    if (viewName === 'expenses') this.loadExpensesList();
    if (viewName === 'employees') this.loadEmployeesList();
    if (viewName === 'reports') this.loadReportsData();
    if (viewName === 'settings') this.populateSettingsForm();
  },

  // 5. Toast Notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  },

  // 6. Modals
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  // 7. Onboarding Submission
  async submitOnboarding(e) {
    e.preventDefault();
    const payload = {
      store_name: document.getElementById('onboard-store-name').value.trim(),
      business_type: document.getElementById('onboard-business-type').value,
      phone: document.getElementById('onboard-phone').value.trim(),
      city: document.getElementById('onboard-city').value.trim(),
      address: document.getElementById('onboard-address').value.trim(),
      tax_number: document.getElementById('onboard-tax-number').value.trim(),
      tax_rate: Number(document.getElementById('onboard-tax-rate').value) || 0,
      currency: document.getElementById('onboard-currency').value.trim() || 'ج.م',
      pin_code: document.getElementById('onboard-pin').value.trim() || '1234',
      logo_base64: document.getElementById('onboard-logo-preview').getAttribute('data-base64') || ''
    };

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'حدث خطأ أثناء الإعداد');

      this.toast('تم إعداد المتجر بنجاح!', 'success');
      this.closeModal('modal-onboarding');
      this.state.configured = true;
      this.state.store = data.store;
      this.updateStoreUI();
      await this.loadAllBaseData();
      this.navigate('dashboard');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  handleLogoFileChange(e, previewId) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.getElementById(previewId);
      img.src = event.target.result;
      img.setAttribute('data-base64', event.target.result);
    };
    reader.readAsDataURL(file);
  },

  // 8. Dashboard
  async loadDashboardData() {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!data.success) return;

      const st = data.stats;
      const curr = this.state.store.currency || 'ج.م';
      document.getElementById('dash-today-sales').textContent = `${st.today_sales.toFixed(2)} ${curr}`;
      document.getElementById('dash-today-count').textContent = `${st.today_count} فاتورة مكتملة`;
      document.getElementById('dash-today-profit').textContent = `${st.today_profit.toFixed(2)} ${curr}`;
      document.getElementById('dash-month-sales').textContent = `${st.month_sales.toFixed(2)} ${curr}`;
      document.getElementById('dash-month-count').textContent = `${st.month_count} فاتورة`;
      document.getElementById('dash-low-stock').textContent = `${st.low_stock_count} منتج`;
      document.getElementById('dash-cust-debts').textContent = `${st.customer_debts.toFixed(2)} ${curr}`;

      // Render recent sales
      const tbody = document.getElementById('dash-recent-sales-tbody');
      if (data.recent_sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد فواتير صادرة اليوم بعد</td></tr>';
        return;
      }

      tbody.innerHTML = data.recent_sales.map(s => `
        <tr>
          <td><b>${s.sale_number}</b></td>
          <td>${s.created_at}</td>
          <td>${s.customer_name || 'عميل نقدي'}</td>
          <td><span class="badge ${s.payment_method === 'cash' ? 'badge-success' : s.payment_method === 'card' ? 'badge-info' : 'badge-warning'}">${s.payment_method === 'cash' ? 'نقدي' : s.payment_method === 'card' ? 'بطاقة' : 'آجل'}</span></td>
          <td style="font-weight: 700;">${s.total_amount.toFixed(2)} ${curr}</td>
          <td><span class="badge badge-success">مكتملة</span></td>
          <td><button class="btn btn-secondary btn-sm" onclick="app.viewInvoice('${s.id}')">عرض / طباعة 🖨️</button></td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  // 9. Categories & Units
  async loadCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (!data.success) return;
      this.state.categories = data.categories;

      // Update POS category pills
      const pillsContainer = document.getElementById('pos-categories-pills');
      if (pillsContainer) {
        pillsContainer.innerHTML = `
          <div class="cat-pill ${!this.state.posSelectedCategory ? 'active' : ''}" onclick="app.filterPosCategory('')">الكل</div>
          ${data.categories.map(c => `
            <div class="cat-pill ${this.state.posSelectedCategory === c.id ? 'active' : ''}" onclick="app.filterPosCategory('${c.id}')">${c.name}</div>
          `).join('')}
        `;
      }

      // Update Product form selects
      const filterSelect = document.getElementById('products-filter-category');
      const formSelect = document.getElementById('prod-category');
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">جميع التصنيفات</option>' + data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
      if (formSelect) {
        formSelect.innerHTML = data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    } catch (err) {
      console.error(err);
    }
  },

  async loadUnits() {
    try {
      const res = await fetch('/api/units');
      const data = await res.json();
      if (!data.success) return;
      this.state.units = data.units;
      const unitSelect = document.getElementById('prod-unit');
      if (unitSelect) {
        unitSelect.innerHTML = data.units.map(u => `<option value="${u.id}">${u.name} (${u.code})</option>`).join('');
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 10. POS Module
  async loadPosProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.success) return;
      this.state.products = data.products;
      this.renderPosProducts();
    } catch (err) {
      console.error(err);
    }
  },

  filterPosCategory(catId) {
    this.state.posSelectedCategory = catId;
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.classList.remove('active');
    });
    event.target.classList.add('active');
    this.renderPosProducts();
  },

  renderPosProducts() {
    const grid = document.getElementById('pos-products-grid');
    const query = document.getElementById('pos-barcode-search')?.value.trim().toLowerCase() || '';
    const cat = this.state.posSelectedCategory;
    const curr = this.state.store.currency || 'ج.م';

    const filtered = this.state.products.filter(p => {
      const matchCat = !cat || p.category_id === cat;
      const matchQuery = !query || p.name.toLowerCase().includes(query) || p.barcode.includes(query) || p.sku.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">لا توجد منتجات مطابقة للبحث</div>';
      return;
    }

    grid.innerHTML = filtered.map(p => `
      <div class="pos-item-card" onclick="app.addToCart('${p.id}')">
        <div>
          <div class="name">${p.name}</div>
          <div class="stock">المتاح: ${p.stock_quantity} ${p.unit_name || ''}</div>
        </div>
        <div class="price">${p.selling_price.toFixed(2)} ${curr}</div>
      </div>
    `).join('');
  },

  handleBarcodeScan(code) {
    if (!code) return;
    const p = this.state.products.find(item => item.barcode === code || item.sku.toLowerCase() === code.toLowerCase());
    if (p) {
      this.addToCart(p.id);
      document.getElementById('pos-barcode-search').value = '';
      this.renderPosProducts();
    } else {
      this.toast(`لم يتم العثور على منتج بالباركود: ${code}`, 'error');
    }
  },

  addToCart(productId) {
    const p = this.state.products.find(item => item.id === productId);
    if (!p) return;

    const existing = this.state.cart.find(it => it.product_id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.state.cart.push({
        product_id: p.id,
        product_name: p.name,
        barcode: p.barcode,
        unit_price: p.selling_price,
        cost_price: p.cost_price,
        tax_rate: p.tax_rate,
        quantity: 1,
        discount_amount: 0
      });
    }

    this.renderCart();
  },

  updateCartQty(index, delta) {
    const item = this.state.cart[index];
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.state.cart.splice(index, 1);
    }
    this.renderCart();
  },

  removeCartItem(index) {
    this.state.cart.splice(index, 1);
    this.renderCart();
  },

  clearCart() {
    this.state.cart = [];
    this.renderCart();
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    const curr = this.state.store.currency || 'ج.م';

    if (this.state.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">
          السلة فارغة<br><small>قم بمسح الباركود أو النقر على المنتج لإضافته</small>
        </div>
      `;
      this.updateCartSummary();
      return;
    }

    container.innerHTML = this.state.cart.map((item, idx) => {
      const lineTotal = item.quantity * item.unit_price;
      return `
        <div class="cart-row">
          <div class="info">
            <span class="name">${item.product_name}</span>
            <span class="unit-price">${item.unit_price.toFixed(2)} ${curr}</span>
          </div>
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="app.updateCartQty(${idx}, -1)">-</button>
            <span style="font-weight: 700; width: 24px; text-align: center;">${item.quantity}</span>
            <button class="qty-btn" onclick="app.updateCartQty(${idx}, 1)">+</button>
          </div>
          <div class="line-total">${lineTotal.toFixed(2)} ${curr}</div>
          <span class="remove-btn" onclick="app.removeCartItem(${idx})" title="حذف">✕</span>
        </div>
      `;
    }).join('');

    this.updateCartSummary();
  },

  updateCartSummary() {
    const curr = this.state.store.currency || 'ج.م';
    let subtotal = 0;
    let taxTotal = 0;

    this.state.cart.forEach(item => {
      const line = item.quantity * item.unit_price;
      subtotal += line;
      if (this.state.store.vat_enabled && item.tax_rate) {
        taxTotal += (line * (item.tax_rate / 100));
      }
    });

    const discountInput = Number(document.getElementById('pos-discount-input')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discountInput + taxTotal);

    document.getElementById('pos-subtotal').textContent = `${subtotal.toFixed(2)} ${curr}`;
    document.getElementById('pos-tax-total').textContent = `${taxTotal.toFixed(2)} ${curr}`;
    document.getElementById('pos-grand-total').textContent = `${grandTotal.toFixed(2)} ${curr}`;
  },

  showCheckoutModal() {
    if (this.state.cart.length === 0) {
      return this.toast('يرجى إضافة منتجات إلى السلة أولاً', 'error');
    }

    const grandTotalText = document.getElementById('pos-grand-total').textContent;
    document.getElementById('checkout-amount-due').textContent = grandTotalText;

    // Default cash paid input to exact total
    let totalVal = 0;
    let subtotal = 0;
    let taxTotal = 0;
    this.state.cart.forEach(it => {
      const l = it.quantity * it.unit_price;
      subtotal += l;
      if (this.state.store.vat_enabled && it.tax_rate) taxTotal += (l * (it.tax_rate / 100));
    });
    const disc = Number(document.getElementById('pos-discount-input')?.value) || 0;
    totalVal = Math.max(0, subtotal - disc + taxTotal);

    const paidInput = document.getElementById('checkout-paid-input');
    if (paidInput) {
      paidInput.value = totalVal.toFixed(2);
    }
    this.calculateChange();
    this.setPaymentMethod('cash');
    this.openModal('modal-checkout');
  },

  setPaymentMethod(method) {
    this.state.selectedPaymentMethod = method;
    document.querySelectorAll('.pay-method-btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
    const target = document.getElementById(`pay-method-${method}`);
    if (target) {
      target.classList.remove('btn-secondary');
      target.classList.add('btn-primary');
    }

    const cashFields = document.getElementById('cash-payment-fields');
    if (cashFields) {
      cashFields.style.display = method === 'cash' ? 'block' : 'none';
    }
  },

  calculateChange() {
    let subtotal = 0;
    let taxTotal = 0;
    this.state.cart.forEach(it => {
      const l = it.quantity * it.unit_price;
      subtotal += l;
      if (this.state.store.vat_enabled && it.tax_rate) taxTotal += (l * (it.tax_rate / 100));
    });
    const disc = Number(document.getElementById('pos-discount-input')?.value) || 0;
    const totalVal = Math.max(0, subtotal - disc + taxTotal);

    const paid = Number(document.getElementById('checkout-paid-input')?.value) || 0;
    const change = Math.max(0, paid - totalVal);
    const curr = this.state.store.currency || 'ج.م';
    document.getElementById('checkout-change-amount').textContent = `${change.toFixed(2)} ${curr}`;
  },

  async commitSale() {
    const custSelect = document.getElementById('pos-customer-select');
    const customerId = custSelect ? custSelect.value : '';
    const customerName = custSelect && custSelect.value ? custSelect.options[custSelect.selectedIndex].text : 'عميل نقدي';

    const disc = Number(document.getElementById('pos-discount-input')?.value) || 0;
    const paid = Number(document.getElementById('checkout-paid-input')?.value) || 0;
    const notes = document.getElementById('checkout-notes')?.value.trim() || '';

    const payload = {
      items: this.state.cart.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount || 0,
        tax_amount: this.state.store.vat_enabled ? ((it.quantity * it.unit_price) * (it.tax_rate / 100)) : 0
      })),
      customer_id: customerId,
      customer_name: customerName,
      payment_method: this.state.selectedPaymentMethod,
      discount_amount: disc,
      paid_amount: paid,
      notes: notes
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'فشل حفظ الفاتورة');

      this.toast('تم إصدار الفاتورة بنجاح!', 'success');
      this.closeModal('modal-checkout');

      // Setup receipt and print
      this.printInvoiceData(data.sale, data.items, data.store);

      // Reset cart and reload catalog stock
      this.clearCart();
      if (document.getElementById('pos-discount-input')) document.getElementById('pos-discount-input').value = 0;
      await this.loadPosProducts();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  printInvoiceData(sale, items, store) {
    const curr = store.currency || 'ج.م';
    document.getElementById('print-sale-num').textContent = sale.sale_number;
    document.getElementById('print-sale-date').textContent = sale.created_at;
    document.getElementById('print-sale-cashier').textContent = sale.cashier_name || 'المدير';
    document.getElementById('print-sale-customer').textContent = sale.customer_name || 'عميل نقدي';

    document.getElementById('print-subtotal').textContent = `${sale.subtotal.toFixed(2)} ${curr}`;
    document.getElementById('print-discount').textContent = `${sale.discount_amount.toFixed(2)} ${curr}`;
    document.getElementById('print-tax').textContent = `${sale.tax_amount.toFixed(2)} ${curr}`;
    document.getElementById('print-total').textContent = `${sale.total_amount.toFixed(2)} ${curr}`;
    document.getElementById('print-paid').textContent = `${sale.paid_amount.toFixed(2)} ${curr}`;
    document.getElementById('print-change').textContent = `${sale.change_amount.toFixed(2)} ${curr}`;

    const tbody = document.getElementById('print-items-tbody');
    tbody.innerHTML = items.map(it => `
      <tr>
        <td>${it.product_name}</td>
        <td style="text-align: center;">${it.quantity}</td>
        <td style="text-align: left;">${it.line_total.toFixed(2)}</td>
      </tr>
    `).join('');

    // Trigger Print
    setTimeout(() => {
      window.print();
    }, 150);
  },

  // 11. Sales List
  async loadSalesList() {
    try {
      const res = await fetch('/api/sales');
      const data = await res.json();
      if (!data.success) return;

      const search = document.getElementById('sales-search-input')?.value.trim().toLowerCase() || '';
      const curr = this.state.store.currency || 'ج.م';

      const filtered = data.sales.filter(s => {
        return !search || s.sale_number.toLowerCase().includes(search) || (s.customer_name && s.customer_name.toLowerCase().includes(search));
      });

      const tbody = document.getElementById('sales-list-tbody');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">لا توجد فواتير مطابقة</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(s => `
        <tr>
          <td><b>${s.sale_number}</b></td>
          <td>${s.created_at}</td>
          <td>${s.cashier_name || 'المدير'}</td>
          <td>${s.customer_name || 'عميل نقدي'}</td>
          <td style="font-weight: 700;">${s.total_amount.toFixed(2)} ${curr}</td>
          <td>${s.paid_amount.toFixed(2)} ${curr}</td>
          <td><span class="badge ${s.payment_method === 'cash' ? 'badge-success' : s.payment_method === 'card' ? 'badge-info' : 'badge-warning'}">${s.payment_method === 'cash' ? 'نقدي' : s.payment_method === 'card' ? 'بطاقة' : 'آجل'}</span></td>
          <td><span class="badge badge-success">مكتملة</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.viewInvoice('${s.id}')">عرض وطباعة 🖨️</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async viewInvoice(saleId) {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.state.lastPrintedSale = data;
      const s = data.sale;
      const items = data.items;
      const curr = data.store.currency || 'ج.م';

      document.getElementById('inv-modal-title').textContent = `تفاصيل فاتورة ${s.sale_number}`;
      const body = document.getElementById('inv-modal-body');

      body.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;">
          <div><b>التاريخ:</b> ${s.created_at}</div>
          <div><b>العميل:</b> ${s.customer_name || 'عميل نقدي'}</div>
          <div><b>الكاشير:</b> ${s.cashier_name}</div>
        </div>
        <table class="data-table" style="margin-bottom: 16px;">
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td>${it.product_name}</td>
                <td>${it.quantity}</td>
                <td>${it.unit_price.toFixed(2)}</td>
                <td>${it.line_total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between;"><span>المجموع الفرعي:</span> <b>${s.subtotal.toFixed(2)} ${curr}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>الخصم:</span> <b>${s.discount_amount.toFixed(2)} ${curr}</b></div>
          <div style="display: flex; justify-content: space-between;"><span>الضريبة:</span> <b>${s.tax_amount.toFixed(2)} ${curr}</b></div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 6px;">
            <span>الإجمالي:</span> <b style="color: var(--primary);">${s.total_amount.toFixed(2)} ${curr}</b>
          </div>
        </div>
      `;

      this.openModal('modal-invoice-view');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  printCurrentModalInvoice() {
    if (!this.state.lastPrintedSale) return;
    const d = this.state.lastPrintedSale;
    this.printInvoiceData(d.sale, d.items, d.store);
  },

  // 12. Products Management
  async loadProductsList() {
    try {
      const search = document.getElementById('products-search-input')?.value.trim() || '';
      const cat = document.getElementById('products-filter-category')?.value || '';
      const res = await fetch(`/api/products?search=${encodeURIComponent(search)}&category_id=${encodeURIComponent(cat)}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('products-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      if (data.products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">لا توجد منتجات مسجلة</td></tr>';
        return;
      }

      tbody.innerHTML = data.products.map(p => {
        const isLow = p.stock_quantity <= p.min_stock_alert;
        const isOut = p.stock_quantity <= 0;
        const statusBadge = isOut
          ? '<span class="badge badge-danger">نفد المخزون</span>'
          : isLow
          ? '<span class="badge badge-warning">أوشك على النفاد</span>'
          : '<span class="badge badge-success">متوفر</span>';

        return `
          <tr>
            <td><code>${p.barcode}</code></td>
            <td><b>${p.name}</b></td>
            <td>${p.category_name || '-'}</td>
            <td>${p.unit_name || 'قطعة'}</td>
            <td>${p.cost_price.toFixed(2)} ${curr}</td>
            <td style="font-weight: 700; color: var(--primary);">${p.selling_price.toFixed(2)} ${curr}</td>
            <td style="font-weight: 700;">${p.stock_quantity}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="app.editProduct('${p.id}')">تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="app.deleteProduct('${p.id}', '${p.name}')">حذف</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showProductModal(product = null) {
    document.getElementById('product-modal-title').textContent = product ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد';
    document.getElementById('prod-id').value = product ? product.id : '';
    document.getElementById('prod-name').value = product ? product.name : '';
    document.getElementById('prod-barcode').value = product ? product.barcode : '';
    document.getElementById('prod-sku').value = product ? product.sku : '';
    document.getElementById('prod-cost').value = product ? product.cost_price : 0;
    document.getElementById('prod-selling').value = product ? product.selling_price : 0;
    document.getElementById('prod-wholesale').value = product ? product.wholesale_price : 0;
    document.getElementById('prod-min-stock').value = product ? product.min_stock_alert : 5;
    document.getElementById('prod-initial-stock-group').style.display = product ? 'none' : 'block';

    if (product && product.category_id) {
      document.getElementById('prod-category').value = product.category_id;
    }
    if (product && product.unit_id) {
      document.getElementById('prod-unit').value = product.unit_id;
    }

    this.openModal('modal-product');
  },

  generateRandomBarcode() {
    const random = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    document.getElementById('prod-barcode').value = random;
  },

  editProduct(id) {
    const p = this.state.products.find(item => item.id === id);
    if (p) this.showProductModal(p);
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const isEdit = !!id;

    const payload = {
      name: document.getElementById('prod-name').value.trim(),
      barcode: document.getElementById('prod-barcode').value.trim(),
      sku: document.getElementById('prod-sku').value.trim(),
      category_id: document.getElementById('prod-category').value,
      unit_id: document.getElementById('prod-unit').value,
      cost_price: Number(document.getElementById('prod-cost').value) || 0,
      selling_price: Number(document.getElementById('prod-selling').value) || 0,
      wholesale_price: Number(document.getElementById('prod-wholesale').value) || 0,
      min_stock_alert: Number(document.getElementById('prod-min-stock').value) || 5,
      initial_stock: Number(document.getElementById('prod-initial-stock').value) || 0
    };

    try {
      const url = isEdit ? `/api/products/${id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'فشل حفظ المنتج');

      this.toast(isEdit ? 'تم تحديث بيانات المنتج بنجاح' : 'تمت إضافة المنتج بنجاح', 'success');
      this.closeModal('modal-product');
      await this.loadProductsList();
      await this.loadPosProducts();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteProduct(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المنتج "${name}"؟`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      this.toast('تم حذف المنتج بنجاح', 'success');
      await this.loadProductsList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 13. Inventory Management
  async loadInventoryList() {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('inventory-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      // Populate adjustment modal products dropdown
      const adjSelect = document.getElementById('adj-product-id');
      if (adjSelect) {
        adjSelect.innerHTML = data.inventory.map(p => `<option value="${p.id}">${p.name} (الرصيد: ${p.current_quantity})</option>`).join('');
      }

      tbody.innerHTML = data.inventory.map(item => {
        const totalVal = item.current_quantity * item.cost_price;
        const isLow = item.current_quantity <= item.min_stock_alert;
        return `
          <tr>
            <td><code>${item.barcode}</code></td>
            <td><b>${item.name}</b></td>
            <td>${item.category_name || '-'}</td>
            <td style="font-size: 15px; font-weight: 700; color: ${isLow ? 'var(--danger)' : 'var(--text-main)'};">${item.current_quantity} ${item.unit_name || ''}</td>
            <td>${item.cost_price.toFixed(2)} ${curr}</td>
            <td style="font-weight: 700;">${totalVal.toFixed(2)} ${curr}</td>
            <td>${isLow ? '<span class="badge badge-danger">تنبيه نقص</span>' : '<span class="badge badge-success">آمن</span>'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="app.quickAdjustStock('${item.id}')">تسوية فورية</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showInventoryAdjustmentModal() {
    this.openModal('modal-inventory-adj');
  },

  quickAdjustStock(productId) {
    this.showInventoryAdjustmentModal();
    const sel = document.getElementById('adj-product-id');
    if (sel) sel.value = productId;
  },

  async saveInventoryAdjustment(e) {
    e.preventDefault();
    const payload = {
      product_id: document.getElementById('adj-product-id').value,
      adjustment_type: document.getElementById('adj-type').value,
      quantity: Number(document.getElementById('adj-qty').value),
      notes: document.getElementById('adj-notes').value.trim()
    };

    try {
      const res = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تمت التسوية المخزنية بنجاح', 'success');
      this.closeModal('modal-inventory-adj');
      await this.loadInventoryList();
      await this.loadPosProducts();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 14. Customers & Debts
  async loadCustomersList() {
    try {
      const search = document.getElementById('customers-search-input')?.value.trim() || '';
      const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (!data.success) return;
      this.state.customers = data.customers;

      // Update POS customer select
      const posSelect = document.getElementById('pos-customer-select');
      if (posSelect) {
        posSelect.innerHTML = '<option value="">عميل نقدي</option>' + data.customers.map(c => `
          <option value="${c.id}">${c.name} ${c.current_balance > 0 ? `(عليه ${c.current_balance.toFixed(2)})` : ''}</option>
        `).join('');
      }

      const tbody = document.getElementById('customers-list-tbody');
      if (!tbody) return;
      const curr = this.state.store.currency || 'ج.م';

      if (data.customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا يوجد عملاء مسجلين</td></tr>';
        return;
      }

      tbody.innerHTML = data.customers.map(c => `
        <tr>
          <td><code>${c.code}</code></td>
          <td><b>${c.name}</b></td>
          <td>${c.phone || '-'}</td>
          <td>${c.address || '-'}</td>
          <td>${c.credit_limit.toFixed(2)} ${curr}</td>
          <td style="font-weight: 800; font-size: 14px; color: ${c.current_balance > 0 ? 'var(--danger)' : 'var(--success)'};">${c.current_balance.toFixed(2)} ${curr}</td>
          <td>
            ${c.current_balance > 0 ? `<button class="btn btn-success btn-sm" onclick="app.showCustomerPaymentModal('${c.id}', '${c.name}', ${c.current_balance})">سداد مديونية 💵</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showAddCustomerModal() {
    this.openModal('modal-customer');
  },

  async saveCustomer(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('cust-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      credit_limit: Number(document.getElementById('cust-credit-limit').value) || 1000
    };

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تمت إضافة العميل بنجاح', 'success');
      this.closeModal('modal-customer');
      await this.loadCustomersList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showCustomerPaymentModal(id, name, debt) {
    document.getElementById('cpay-customer-id').value = id;
    document.getElementById('cpay-customer-name').textContent = name;
    const curr = this.state.store.currency || 'ج.م';
    document.getElementById('cpay-current-debt').textContent = `${debt.toFixed(2)} ${curr}`;
    document.getElementById('cpay-amount').value = debt;
    this.openModal('modal-customer-payment');
  },

  async saveCustomerPayment(e) {
    e.preventDefault();
    const payload = {
      customer_id: document.getElementById('cpay-customer-id').value,
      amount: Number(document.getElementById('cpay-amount').value),
      notes: document.getElementById('cpay-notes').value.trim()
    };

    try {
      const res = await fetch('/api/customers/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم تسجيل سداد المبلغ وإيداعه في الخزينة بنجاح', 'success');
      this.closeModal('modal-customer-payment');
      await this.loadCustomersList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 15. Suppliers & Purchases
  async loadSuppliersList() {
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (!data.success) return;
      this.state.suppliers = data.suppliers;

      const tbody = document.getElementById('suppliers-list-tbody');
      if (!tbody) return;
      const curr = this.state.store.currency || 'ج.م';

      tbody.innerHTML = data.suppliers.map(s => `
        <tr>
          <td><code>${s.code}</code></td>
          <td><b>${s.name}</b></td>
          <td>${s.contact_person || '-'}</td>
          <td>${s.phone || '-'}</td>
          <td style="font-weight: 700; color: ${s.current_balance > 0 ? 'var(--danger)' : 'var(--text-main)'};">${s.current_balance.toFixed(2)} ${curr}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.showPurchaseInvoiceForSupplier('${s.id}')">فاتورة شراء جديدة</button>
          </td>
        </tr>
      `).join('');

      await this.loadPurchasesList();
    } catch (err) {
      console.error(err);
    }
  },

  async loadPurchasesList() {
    try {
      const res = await fetch('/api/purchases');
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('purchases-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      tbody.innerHTML = data.purchases.map(p => `
        <tr>
          <td><b>${p.invoice_number}</b></td>
          <td>${p.created_at}</td>
          <td>${p.supplier_name}</td>
          <td style="font-weight: 700;">${p.total_amount.toFixed(2)} ${curr}</td>
          <td>${p.paid_amount.toFixed(2)} ${curr}</td>
          <td style="color: ${p.remaining_amount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 700;">${p.remaining_amount.toFixed(2)} ${curr}</td>
          <td>${p.payment_method === 'cash' ? 'نقدي' : 'آجل'}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showAddSupplierModal() {
    this.openModal('modal-supplier');
  },

  async saveSupplier(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('sup-name').value.trim(),
      contact_person: document.getElementById('sup-contact').value.trim(),
      phone: document.getElementById('sup-phone').value.trim(),
      address: document.getElementById('sup-address').value.trim()
    };

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تمت إضافة المورد بنجاح', 'success');
      this.closeModal('modal-supplier');
      await this.loadSuppliersList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showPurchaseInvoiceModal() {
    const sel = document.getElementById('po-supplier-select');
    if (sel) {
      sel.innerHTML = this.state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    const container = document.getElementById('po-items-container');
    container.innerHTML = '';
    this.addPurchaseItemRow();
    this.openModal('modal-purchase');
  },

  showPurchaseInvoiceForSupplier(supId) {
    this.showPurchaseInvoiceModal();
    const sel = document.getElementById('po-supplier-select');
    if (sel) sel.value = supId;
  },

  addPurchaseItemRow() {
    const container = document.getElementById('po-items-container');
    const row = document.createElement('div');
    row.className = 'po-item-row';
    row.style = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; align-items: center; background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border);';

    row.innerHTML = `
      <select class="form-control po-prd-select" onchange="app.updatePoProductRow(this)" required>
        <option value="">اختر المنتج...</option>
        ${this.state.products.map(p => `<option value="${p.id}" data-cost="${p.cost_price}" data-sell="${p.selling_price}">${p.name}</option>`).join('')}
      </select>
      <input type="number" class="form-control po-qty-input" placeholder="الكمية" min="1" value="1" step="1" oninput="app.calculatePoTotal()" required>
      <input type="number" class="form-control po-cost-input" placeholder="سعر الشراء" min="0" value="0" step="0.5" oninput="app.calculatePoTotal()" required>
      <input type="number" class="form-control po-sell-input" placeholder="سعر البيع" min="0" value="0" step="0.5">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); app.calculatePoTotal();">✕</button>
    `;
    container.appendChild(row);
  },

  updatePoProductRow(selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    const cost = opt.getAttribute('data-cost') || 0;
    const sell = opt.getAttribute('data-sell') || 0;
    const row = selectEl.parentElement;
    row.querySelector('.po-cost-input').value = cost;
    row.querySelector('.po-sell-input').value = sell;
    this.calculatePoTotal();
  },

  calculatePoTotal() {
    let total = 0;
    document.querySelectorAll('.po-item-row').forEach(row => {
      const qty = Number(row.querySelector('.po-qty-input').value) || 0;
      const cost = Number(row.querySelector('.po-cost-input').value) || 0;
      total += (qty * cost);
    });

    const curr = this.state.store.currency || 'ج.م';
    document.getElementById('po-total-display').textContent = `${total.toFixed(2)} ${curr}`;
    document.getElementById('po-paid-input').value = total.toFixed(2);
  },

  async savePurchaseInvoice(e) {
    e.preventDefault();
    const supSelect = document.getElementById('po-supplier-select');
    const supId = supSelect.value;
    const supName = supSelect.options[supSelect.selectedIndex].text;
    const paymentMethod = document.getElementById('po-payment-method').value;
    const paid = Number(document.getElementById('po-paid-input').value) || 0;

    const items = [];
    document.querySelectorAll('.po-item-row').forEach(row => {
      const prdSelect = row.querySelector('.po-prd-select');
      const prdId = prdSelect.value;
      if (!prdId) return;
      const prdName = prdSelect.options[prdSelect.selectedIndex].text;
      const qty = Number(row.querySelector('.po-qty-input').value) || 1;
      const cost = Number(row.querySelector('.po-cost-input').value) || 0;
      const sell = Number(row.querySelector('.po-sell-input').value) || 0;
      items.push({
        product_id: prdId,
        product_name: prdName,
        quantity: qty,
        unit_cost: cost,
        selling_price: sell
      });
    });

    if (items.length === 0) return this.toast('يرجى اختيار صنف واحد على الأقل', 'error');

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supId,
          supplier_name: supName,
          items,
          paid_amount: paid,
          payment_method: paymentMethod
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم تسجيل فاتورة الشراء وتحديث المخزون بنجاح!', 'success');
      this.closeModal('modal-purchase');
      await this.loadSuppliersList();
      await this.loadPosProducts();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 16. Shifts & Cash Drawer
  showShiftModal() {
    if (this.state.activeSession) {
      this.showCloseShiftModal();
    } else {
      this.showOpenShiftModal();
    }
  },

  showOpenShiftModal() {
    this.openModal('modal-open-shift');
  },

  async submitOpenShift(e) {
    e.preventDefault();
    const payload = {
      cashier_name: document.getElementById('open-shift-cashier').value.trim(),
      opening_float: Number(document.getElementById('open-shift-float').value) || 0
    };

    try {
      const res = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم فتح وردية العمل بنجاح!', 'success');
      this.closeModal('modal-open-shift');
      this.state.activeSession = data.session;
      this.updateShiftUI();
      if (this.state.currentView === 'shifts') this.loadShiftsData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showCloseShiftModal() {
    const ses = this.state.activeSession;
    if (!ses) return this.toast('لا توجد وردية مفتوحة', 'error');

    const curr = this.state.store.currency || 'ج.م';
    const expected = ses.opening_float + ses.total_cash_sales + ses.total_cash_in - ses.total_cash_out - ses.total_expenses;

    const summary = document.getElementById('close-shift-summary');
    summary.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>رصيد بداية اليوم (العهدة):</span> <b>${ses.opening_float.toFixed(2)} ${curr}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>مبيعات نقدي (كاش):</span> <b>${ses.total_cash_sales.toFixed(2)} ${curr}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>إجمالي الإيداعات بالدرج:</span> <b>${ses.total_cash_in.toFixed(2)} ${curr}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>إجمالي السحوبات من الدرج:</span> <b>${ses.total_cash_out.toFixed(2)} ${curr}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>المصروفات النقدية:</span> <b>${ses.total_expenses.toFixed(2)} ${curr}</b></div>
      <div style="display: flex; justify-content: space-between; font-size: 15px; border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 6px;">
        <span>المبلغ المتوقع بالدرج:</span> <b style="color: var(--primary);">${expected.toFixed(2)} ${curr}</b>
      </div>
    `;

    document.getElementById('close-shift-counted').value = expected.toFixed(2);
    this.calculateShiftVariance();
    this.openModal('modal-close-shift');
  },

  calculateShiftVariance() {
    const ses = this.state.activeSession;
    if (!ses) return;
    const expected = ses.opening_float + ses.total_cash_sales + ses.total_cash_in - ses.total_cash_out - ses.total_expenses;
    const counted = Number(document.getElementById('close-shift-counted').value) || 0;
    const diff = counted - expected;
    const el = document.getElementById('close-shift-variance');
    const curr = this.state.store.currency || 'ج.م';

    if (diff === 0) {
      el.textContent = `متطابق تماماً (0.00 ${curr})`;
      el.style.color = 'var(--success)';
    } else if (diff > 0) {
      el.textContent = `زيادة بالدرج: +${diff.toFixed(2)} ${curr}`;
      el.style.color = 'var(--primary)';
    } else {
      el.textContent = `عجز بالدرج: ${diff.toFixed(2)} ${curr}`;
      el.style.color = 'var(--danger)';
    }
  },

  async submitCloseShift(e) {
    e.preventDefault();
    const payload = {
      counted_cash: Number(document.getElementById('close-shift-counted').value),
      notes: document.getElementById('close-shift-notes').value.trim()
    };

    try {
      const res = await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم إغلاق الوردية وترحيل الحسابات بنجاح!', 'success');
      this.closeModal('modal-close-shift');
      this.state.activeSession = null;
      this.updateShiftUI();
      if (this.state.currentView === 'shifts') this.loadShiftsData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showCashMovementModal() {
    this.openModal('modal-cash-movement');
  },

  async saveCashMovement(e) {
    e.preventDefault();
    const payload = {
      type: document.getElementById('cmov-type').value,
      amount: Number(document.getElementById('cmov-amount').value),
      reason: document.getElementById('cmov-reason').value.trim()
    };

    try {
      const res = await fetch('/api/shifts/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم تسجيل الحركة النقدية في الخزينة بنجاح', 'success');
      this.closeModal('modal-cash-movement');
      await this.checkStatus();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async loadShiftsData() {
    try {
      const res = await fetch('/api/shifts/history');
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('shifts-history-tbody');
      const curr = this.state.store.currency || 'ج.م';

      tbody.innerHTML = data.history.map(s => `
        <tr>
          <td><b>${s.session_number}</b></td>
          <td>${s.cashier_name}</td>
          <td>${s.opened_at}</td>
          <td>${s.closed_at || 'قيد العمل'}</td>
          <td>${s.opening_float.toFixed(2)} ${curr}</td>
          <td>${s.total_cash_sales.toFixed(2)} ${curr}</td>
          <td>${s.total_expenses.toFixed(2)} ${curr}</td>
          <td>${s.counted_cash !== null ? `${s.counted_cash.toFixed(2)} ${curr}` : '-'}</td>
          <td style="font-weight: 700; color: ${s.variance < 0 ? 'var(--danger)' : s.variance > 0 ? 'var(--primary)' : 'var(--success)'};">
            ${s.variance !== null ? `${s.variance > 0 ? '+' : ''}${s.variance.toFixed(2)}` : '-'}
          </td>
          <td><span class="badge ${s.status === 'open' ? 'badge-success' : 'badge-secondary'}">${s.status === 'open' ? 'مفتوحة' : 'مغلقة'}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  // 17. Expenses
  async loadExpensesList() {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('expenses-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      tbody.innerHTML = data.expenses.map(e => `
        <tr>
          <td>${e.created_at}</td>
          <td><b>${e.category}</b></td>
          <td style="font-weight: 700; color: var(--danger);">${e.amount.toFixed(2)} ${curr}</td>
          <td>${e.payment_method === 'cash' ? 'نقداً من الدرج' : 'تحويل / بنك'}</td>
          <td>${e.notes || '-'}</td>
          <td>${e.created_by || 'المدير'}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  showAddExpenseModal() {
    this.openModal('modal-expense');
  },

  async saveExpense(e) {
    e.preventDefault();
    const payload = {
      category: document.getElementById('exp-category').value,
      amount: Number(document.getElementById('exp-amount').value),
      payment_method: document.getElementById('exp-payment').value,
      notes: document.getElementById('exp-notes').value.trim()
    };

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم تسجيل المصروف بنجاح', 'success');
      this.closeModal('modal-expense');
      await this.loadExpensesList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 18. Employees & Payroll
  async loadEmployeesList() {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('employees-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      // Fill adjustments modal employee select
      const adjSelect = document.getElementById('adj-emp-id');
      if (adjSelect) {
        adjSelect.innerHTML = data.employees.map(emp => `<option value="${emp.id}">${emp.name} (${emp.job_title})</option>`).join('');
      }

      tbody.innerHTML = data.employees.map(emp => `
        <tr>
          <td><b>${emp.name}</b></td>
          <td>${emp.job_title}</td>
          <td>${emp.phone || '-'}</td>
          <td style="font-weight: 700;">${emp.base_salary.toFixed(2)} ${curr}</td>
          <td>${emp.hire_date || '-'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.showEmpAdjustmentModal('${emp.id}')">سلفة / مكافأة</button>
          </td>
        </tr>
      `).join('');

      await this.loadPayrollList();
    } catch (err) {
      console.error(err);
    }
  },

  showAddEmployeeModal() {
    this.openModal('modal-employee');
  },

  async saveEmployee(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('emp-name').value.trim(),
      job_title: document.getElementById('emp-title').value.trim(),
      phone: document.getElementById('emp-phone').value.trim(),
      base_salary: Number(document.getElementById('emp-salary').value) || 3000,
      hire_date: document.getElementById('emp-hire-date').value
    };

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تمت إضافة الموظف بنجاح', 'success');
      this.closeModal('modal-employee');
      await this.loadEmployeesList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showAdjustmentModal() {
    this.openModal('modal-adjustment');
  },

  showEmpAdjustmentModal(empId) {
    this.showAdjustmentModal();
    const sel = document.getElementById('adj-emp-id');
    if (sel) sel.value = empId;
  },

  async saveAdjustment(e) {
    e.preventDefault();
    const payload = {
      employee_id: document.getElementById('adj-emp-id').value,
      type: document.getElementById('adj-emp-type').value,
      amount: Number(document.getElementById('adj-emp-amount').value),
      reason: document.getElementById('adj-emp-reason').value.trim()
    };

    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم تسجيل البند وتحديث حساب الموظف بنجاح', 'success');
      this.closeModal('modal-adjustment');
      await this.loadPayrollList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async loadPayrollList() {
    try {
      const month = document.getElementById('payroll-month-select')?.value || (new Date().getMonth() + 1);
      const res = await fetch(`/api/payroll?month=${month}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('payroll-list-tbody');
      const curr = this.state.store.currency || 'ج.م';

      if (data.payrolls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">لم يتم احتساب المسير لهذا الشهر بعد. انقر على "احتساب وتحديث مسير الرواتب"</td></tr>';
        return;
      }

      tbody.innerHTML = data.payrolls.map(p => `
        <tr>
          <td><b>${p.employee_name}</b></td>
          <td>${p.base_salary.toFixed(2)} ${curr}</td>
          <td style="color: var(--success); font-weight: 600;">+${p.total_bonuses.toFixed(2)}</td>
          <td style="color: var(--danger); font-weight: 600;">-${p.total_deductions.toFixed(2)}</td>
          <td style="color: var(--warning); font-weight: 600;">-${p.total_advances.toFixed(2)}</td>
          <td style="font-weight: 800; font-size: 14px; color: var(--primary);">${p.net_payable.toFixed(2)} ${curr}</td>
          <td><span class="badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}">${p.status === 'paid' ? 'تم الصرف' : 'معلق'}</span></td>
          <td>
            ${p.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="app.payEmployeeSalary('${p.id}')">صرف الراتب 💵</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async generatePayroll() {
    const month = document.getElementById('payroll-month-select').value;
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم احتساب وتحديث مسير الرواتب بنجاح', 'success');
      await this.loadPayrollList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async payEmployeeSalary(payrollId) {
    if (!confirm('هل أنت متأكد من صرف الراتب وتسجيله كمصروف في النظام؟')) return;
    try {
      const res = await fetch('/api/payroll/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_id: payrollId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم صرف الراتب وتسجيل المصروف بنجاح!', 'success');
      await this.loadPayrollList();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 19. Reports & P&L
  async loadReportsData() {
    try {
      const curr = this.state.store.currency || 'ج.م';
      const resPl = await fetch('/api/reports?type=profit-loss');
      const dataPl = await resPl.json();
      if (dataPl.success) {
        const r = dataPl.report;
        document.getElementById('rep-total-sales').textContent = `${r.total_sales.toFixed(2)} ${curr}`;
        document.getElementById('rep-cogs').textContent = `${r.cogs.toFixed(2)} ${curr}`;
        document.getElementById('rep-gross-profit').textContent = `${r.gross_profit.toFixed(2)} ${curr}`;
        document.getElementById('rep-total-expenses').textContent = `${r.total_expenses.toFixed(2)} ${curr}`;
        document.getElementById('rep-net-profit').textContent = `${r.net_profit.toFixed(2)} ${curr}`;
      }

      const resTop = await fetch('/api/reports?type=top-products');
      const dataTop = await resTop.json();
      if (dataTop.success) {
        const tbody = document.getElementById('rep-top-products-tbody');
        tbody.innerHTML = dataTop.top_products.map(p => `
          <tr>
            <td><b>${p.product_name}</b></td>
            <td style="font-weight: 700;">${p.total_sold}</td>
            <td style="font-weight: 700; color: var(--primary);">${p.total_revenue.toFixed(2)} ${curr}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error(err);
    }
  },

  // 20. Store Settings
  populateSettingsForm() {
    const s = this.state.store;
    if (!s) return;
    document.getElementById('set-store-name').value = s.store_name || '';
    document.getElementById('set-business-type').value = s.business_type || 'سوبرماركت';
    document.getElementById('set-phone').value = s.phone || '';
    document.getElementById('set-city').value = s.city || 'القاهرة';
    document.getElementById('set-address').value = s.address || '';
    document.getElementById('set-tax-number').value = s.tax_number || '';
    document.getElementById('set-commercial-register').value = s.commercial_register || '';
    document.getElementById('set-currency').value = s.currency || 'ج.م';
    document.getElementById('set-tax-rate').value = s.tax_rate || 14;
    document.getElementById('set-receipt-header').value = s.receipt_header || '';
    document.getElementById('set-receipt-footer').value = s.receipt_footer || '';
    if (s.logo_base64) {
      document.getElementById('set-logo-preview').src = s.logo_base64;
    }
  },

  async saveSettings(e) {
    e.preventDefault();
    const payload = {
      store_name: document.getElementById('set-store-name').value.trim(),
      business_type: document.getElementById('set-business-type').value,
      phone: document.getElementById('set-phone').value.trim(),
      city: document.getElementById('set-city').value.trim(),
      address: document.getElementById('set-address').value.trim(),
      tax_number: document.getElementById('set-tax-number').value.trim(),
      commercial_register: document.getElementById('set-commercial-register').value.trim(),
      currency: document.getElementById('set-currency').value.trim() || 'ج.م',
      tax_rate: Number(document.getElementById('set-tax-rate').value) || 0,
      receipt_header: document.getElementById('set-receipt-header').value.trim(),
      receipt_footer: document.getElementById('set-receipt-footer').value.trim(),
      logo_base64: document.getElementById('set-logo-preview').getAttribute('data-base64') || this.state.store.logo_base64
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      this.toast('تم حفظ إعدادات المتجر بنجاح', 'success');
      this.state.store = data.store;
      this.updateStoreUI();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // 21. Database Backup
  backupDatabase() {
    window.location.href = '/api/backup';
    this.toast('جاري تنزيل النسخة الاحتياطية لقاعدة البيانات...', 'success');
  }
};

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

