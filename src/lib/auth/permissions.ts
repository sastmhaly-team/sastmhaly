export interface SystemPage {
  path: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  groupAr: string;
  groupEn: string;
}

export const ALL_MERCHANT_PAGES: SystemPage[] = [
  // الرئيسية ونقاط البيع
  {
    path: '/merchant/dashboard',
    nameAr: 'الرئيسية ولوحة المؤشرات',
    nameEn: 'Dashboard & KPIs',
    descriptionAr: 'متابعة المبيعات اليومية، الأرباح، والتقارير الحية',
    descriptionEn: 'Daily sales, profit, and real-time operations',
    groupAr: 'الرئيسية ونقاط البيع',
    groupEn: 'Main & POS'
  },
  {
    path: '/merchant/pos',
    nameAr: 'نقطة البيع والكاشير (POS)',
    nameEn: 'Point of Sale (POS)',
    descriptionAr: 'شاشة الكاشير، مسح الباركود، والفواتير السريعة',
    descriptionEn: 'Cashier checkout screen, barcode scanner, fast billing',
    groupAr: 'الرئيسية ونقاط البيع',
    groupEn: 'Main & POS'
  },
  {
    path: '/merchant/registers',
    nameAr: 'جلسات وخزائن الكاشير',
    nameEn: 'Cash Registers',
    descriptionAr: 'فتح وإغلاق الوردية، تسليم وتسلم الخزينة',
    descriptionEn: 'Shift sessions, register opening and closing',
    groupAr: 'الرئيسية ونقاط البيع',
    groupEn: 'Main & POS'
  },

  // الكتالوج والمخزون
  {
    path: '/merchant/products',
    nameAr: 'الأصناف والمنتجات والباركود',
    nameEn: 'Products & Barcodes',
    descriptionAr: 'إدارة المنتجات، الأسعار، وطباعة ملصقات الباركود',
    descriptionEn: 'Product catalog, pricing, and barcode label printing',
    groupAr: 'الكتالوج والمخزون',
    groupEn: 'Catalog & Inventory'
  },
  {
    path: '/merchant/inventory',
    nameAr: 'أرصدة المخزون والجرد',
    nameEn: 'Inventory Balances',
    descriptionAr: 'جرد المستودع، تسوية الكميات، ومتابعة النواقص',
    descriptionEn: 'Stock balances, adjustments, and low stock tracking',
    groupAr: 'الكتالوج والمخزون',
    groupEn: 'Catalog & Inventory'
  },
  {
    path: '/merchant/batches',
    nameAr: 'التشغيلات وتواريخ الصلاحية',
    nameEn: 'Batches & Expiry',
    descriptionAr: 'تتبع تواريخ انتهاء الصلاحية وأرقام الباتش',
    descriptionEn: 'Batch numbers and expiry date alerts',
    groupAr: 'الكتالوج والمخزون',
    groupEn: 'Catalog & Inventory'
  },
  {
    path: '/merchant/transfers',
    nameAr: 'التحويلات بين الفروع',
    nameEn: 'Stock Transfers',
    descriptionAr: 'نقل بضائع ومنتجات بين فروع المتجر',
    descriptionEn: 'Inter-branch stock shipments and transfers',
    groupAr: 'الكتالوج والمخزون',
    groupEn: 'Catalog & Inventory'
  },

  // المشتريات والمبيعات
  {
    path: '/merchant/purchasing',
    nameAr: 'أوامر وفواتير الشراء',
    nameEn: 'Purchase Orders',
    descriptionAr: 'تسجيل فواتير الشراء وتوريدات البضائع',
    descriptionEn: 'Vendor bills, receiving POs, stock intake',
    groupAr: 'المشتريات والمبيعات',
    groupEn: 'Procurement & Sales'
  },
  {
    path: '/merchant/suppliers',
    nameAr: 'الموردون وحساباتهم',
    nameEn: 'Suppliers & Vendors',
    descriptionAr: 'بيانات الموردين ومديونياتهم ومواعيد السداد',
    descriptionEn: 'Supplier directory, payable balances, contacts',
    groupAr: 'المشتريات والمبيعات',
    groupEn: 'Procurement & Sales'
  },
  {
    path: '/merchant/sales',
    nameAr: 'سجل المبيعات والفواتير',
    nameEn: 'Sales & Invoices History',
    descriptionAr: 'استعراض الفواتير المصدرة، المرتجعات، وإعادة الطباعة',
    descriptionEn: 'Completed sales, returns, invoice reprints',
    groupAr: 'المشتريات والمبيعات',
    groupEn: 'Procurement & Sales'
  },
  {
    path: '/merchant/customers',
    nameAr: 'العملاء والديون والآجل',
    nameEn: 'Customers & Credit Ledgers',
    descriptionAr: 'حسابات العملاء، الديون الآجلة، وسجل التحصيلات',
    descriptionEn: 'Customer accounts, credit limits, debt collection',
    groupAr: 'المشتريات والمبيعات',
    groupEn: 'Procurement & Sales'
  },

  // المالية والتقارير
  {
    path: '/merchant/expenses',
    nameAr: 'المصروفات النثرية',
    nameEn: 'Expenses',
    descriptionAr: 'تسجيل بنود المصروفات وفواتير الكهرباء والإيجار',
    descriptionEn: 'Expense vouchers, overheads, operating costs',
    groupAr: 'المالية والتقارير',
    groupEn: 'Finance & Reports'
  },
  {
    path: '/merchant/accounting',
    nameAr: 'الحسابات والقيود اليومية',
    nameEn: 'Accounting & Ledger',
    descriptionAr: 'دليل الحسابات، قيود اليومية، وميزان المراجعة',
    descriptionEn: 'Chart of accounts, journal entries, balance sheet',
    groupAr: 'المالية والتقارير',
    groupEn: 'Finance & Reports'
  },
  {
    path: '/merchant/reports',
    nameAr: 'التقارير التحليلية والمالية',
    nameEn: 'Analytics & Reports',
    descriptionAr: 'تقارير أرباح الأصناف، الضريبة، وحركة الصندوق',
    descriptionEn: 'Sales analytics, profit reports, VAT reports',
    groupAr: 'المالية والتقارير',
    groupEn: 'Finance & Reports'
  },

  // الإدارة والإعدادات
  {
    path: '/merchant/branches',
    nameAr: 'إدارة الفروع والمستودعات',
    nameEn: 'Branches Management',
    descriptionAr: 'إضافة وتعديل بيانات فروع ومخازن المتجر',
    descriptionEn: 'Create and configure store branch locations',
    groupAr: 'الإدارة والإعدادات',
    groupEn: 'Management & Settings'
  },
  {
    path: '/merchant/employees',
    nameAr: 'الموظفون والصلاحيات والرواتب',
    nameEn: 'Employees & Permissions',
    descriptionAr: 'إدارة طاقم العمل، تحديد الصلاحيات، ومسير الرواتب',
    descriptionEn: 'Staff management, custom page permissions, payroll',
    groupAr: 'الإدارة والإعدادات',
    groupEn: 'Management & Settings'
  },
  {
    path: '/merchant/settings',
    nameAr: 'إعدادات المتجر والفاتورة',
    nameEn: 'Store Settings',
    descriptionAr: 'شعار المتجر، إعدادات طابعة الفواتير، ونسبة الضريبة',
    descriptionEn: 'Receipt headers, tax rates, printer configuration',
    groupAr: 'الإدارة والإعدادات',
    groupEn: 'Management & Settings'
  }
];

export const ROLE_DEFAULT_PAGES: Record<string, string[]> = {
  cashier: ['/merchant/pos'],
  inventory_manager: [
    '/merchant/products',
    '/merchant/inventory',
    '/merchant/batches',
    '/merchant/transfers',
    '/merchant/purchasing',
    '/merchant/suppliers'
  ],
  accountant: [
    '/merchant/sales',
    '/merchant/customers',
    '/merchant/expenses',
    '/merchant/accounting',
    '/merchant/reports'
  ],
  branch_manager: [
    '/merchant/dashboard',
    '/merchant/pos',
    '/merchant/registers',
    '/merchant/products',
    '/merchant/inventory',
    '/merchant/sales',
    '/merchant/customers',
    '/merchant/expenses',
    '/merchant/reports'
  ],
  merchant_owner: ALL_MERCHANT_PAGES.map(p => p.path),
  super_admin: ALL_MERCHANT_PAGES.map(p => p.path)
};

/**
 * Parses user allowed_pages from array, JSON string, or comma-separated string,
 * falling back to the role defaults if not configured.
 */
export function parseAllowedPages(raw: unknown, role?: string): string[] {
  if (Array.isArray(raw)) {
    const valid = raw.filter((p): p is string => typeof p === 'string' && p.startsWith('/merchant/'));
    if (valid.length > 0) return valid;
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((p): p is string => typeof p === 'string' && p.startsWith('/merchant/'));
        if (valid.length > 0) return valid;
      }
    } catch {
      if (raw.includes(',')) {
        const parts = raw.split(',').map(s => s.trim()).filter(p => p.startsWith('/merchant/'));
        if (parts.length > 0) return parts;
      }
      if (raw.startsWith('/merchant/')) {
        return [raw.trim()];
      }
    }
  }

  // Fallback to role defaults
  if (role && ROLE_DEFAULT_PAGES[role]) {
    return [...ROLE_DEFAULT_PAGES[role]];
  }

  return ['/merchant/pos'];
}

/**
 * Checks if a specific path is permitted for the given user.
 * Owners and Super Admins always have access to all merchant pages.
 */
export function isPageAllowed(path: string, user: { role: string; allowed_pages?: unknown } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'merchant_owner') return true;

  const allowed = parseAllowedPages(user.allowed_pages, user.role);

  // Exact match or sub-path match
  return allowed.some(allowedPath => {
    if (path === allowedPath) return true;
    if (path.startsWith(allowedPath + '/')) return true;
    return false;
  });
}

/**
 * Returns the first authorized page to redirect an employee to upon login.
 */
export function getFirstAllowedPage(user: { role: string; allowed_pages?: unknown } | null | undefined): string {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'merchant_owner') return '/merchant/dashboard';

  const allowed = parseAllowedPages(user.allowed_pages, user.role);
  if (allowed.length > 0) {
    // If POS is allowed and they are a cashier, prefer POS
    if (allowed.includes('/merchant/pos')) return '/merchant/pos';
    return allowed[0];
  }
  return '/merchant/pos';
}

