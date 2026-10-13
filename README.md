# Sastmhaly (سستمهالي) — Multi-Tenant Retail & Supermarket SaaS Platform

A complete, production-ready, multi-tenant SaaS platform engineered for supermarkets, grocery stores, minimarkets, wholesalers, and multi-branch retail enterprises.

---

## 💎 Brand Identity & Visual System

- **Official Brand Mark**: Abstract ribbon/S-shaped logo sampled from the uploaded logo (`/public/logo.png`).
- **Primary Navy**: `#0B1730`
- **Primary Electric Blue**: `#246BFD`
- **Page Background**: `#F7F9FC`
- **Borders & Dividers**: `#E5EAF2`
- **Primary Text**: `#172033`
- **Secondary Text**: `#687386`
- **Bilingual & Bi-directional**: Full Arabic (RTL, `dir="rtl"`) with Cairo typography and English (LTR, `dir="ltr"`) with Inter typography.
- **Default Currency**: Egyptian Pound (`EGP` / `ج.م`) with configurable formatting.

---

## 🏛️ Core Architecture Levels

### Level A: Platform Super Admin (`/super-admin`)
- **Mission**: SaaS Owner central administration console.
- **Features**:
  - Platform overview with live aggregate metrics: Total Merchants, Active Merchants, Suspended, Trial, Total Branches, Total Users.
  - Actual Monthly Recurring Revenue (MRR) calculated from active merchant subscriptions.
  - Merchant lifecycle management: provision new merchants, assign plans, edit status (Active, Suspended, Trial, Archived).
  - Subscription plan configuration: quotas on branches, staff users, products, and features.
  - Platform-wide security audit logs and system health monitoring.

### Level B: Merchant Owner Workspace (`/merchant/dashboard`)
- **Mission**: Consolidated multi-branch retail ERP and financial management.
- **Features**:
  - Executive KPI dashboard: Today's sales, gross sales, markdowns, net sales, COGS, gross profit, gross margin %, operating expenses, net operating profit, inventory valuation, near-expiry alerts (<30 days), and low-stock warnings.
  - Multi-branch consolidation: Instant toggle between All Branches (consolidated view) and single branch scopes.
  - First-login 5-step onboarding wizard (`/merchant/onboarding`).
  - Catalog management (`/merchant/products`): SKU, barcode, unit conversion, fractional/weight-based items, CSV bulk import with duplicate detection and preview, and Excel-compatible export.
  - Auditable inventory ledger (`/merchant/inventory`): Stock on hand, weighted-average cost (WAC), manual adjustment with audit trail.
  - Batch & Expiry management (`/merchant/batches`): FEFO stock tracking, expiration countdowns, and write-off workflows.
  - Inter-branch stock transfers (`/merchant/transfers`): Multi-step dispatch, in-transit tracking, and receiving confirmation.
  - Purchasing & Procurement (`/merchant/purchasing`): Purchase orders and Goods Receiving workflow (Scenario E).
  - Suppliers & Accounts Payable (`/merchant/suppliers`): Supplier ledger, payment terms, and cash outlays.
  - Customers & Accounts Receivable (`/merchant/customers`): Credit sales, credit limits, debt collection, and loyalty points.
  - Operating expenses (`/merchant/expenses`): Categorized expenses (Rent, Utilities, Wages, Packaging) with till vs bank source.
  - Double-entry accounting (`/merchant/accounting`): Chart of Accounts, Trial Balance, balanced Journal Entries for every sale/expense/return.
  - Unified reporting center (`/merchant/reports`): P&L income statements, inventory valuation by cost, and aging reports.
  - Multi-branch management (`/merchant/branches`): Physical branch locations, manager assignments, and isolated till registers.
  - Staff management (`/merchant/employees`): Role assignments (`merchant_owner`, `branch_manager`, `cashier`, `inventory_manager`, `accountant`) with branch scoping.
  - Store settings (`/merchant/settings`): VAT rates (14%), thermal receipt headers/footers, paper width (80mm vs 58mm), and scale barcode prefixes (`21`).

### Level C: Branch Cashier & POS Terminal (`/merchant/pos`)
- **Mission**: High-speed touch-screen and keyboard-friendly checkout terminal.
- **Features**:
  - Barcode scanning with instant audio feedback and auto-cart addition.
  - Scale & variable-weight barcode support (EAN-13 `21...` prefix parsing).
  - Quick-pick fast buttons for popular produce and baked goods.
  - Cart item controls: +/- quantity, fractional weights, line discounts, line removal.
  - Hold and resume multiple sales drafts (`F7`).
  - Cash register drawer management (`/merchant/registers`): Session open, opening float, pay-ins, pay-outs, expected cash calculation, closing reconciliation count, discrepancy alerts, and Z-Reports.
  - Atomic sale completion: Decrements inventory, logs inventory movement, updates cash session, awards loyalty points, creates balanced double-entry journal entries, and issues thermal receipts (`80mm` / `58mm` print stylesheet).
  - Full sales history (`/merchant/sales`): Itemized details, receipt reprint, and Scenario F Return & Restock workflow.

---

## 🔑 Initial Demo Credentials

| Persona | Username | Password | Role | Assigned Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `admin123` | Platform Super Admin | Platform-wide |
| **Merchant Owner 1** | `baraka_owner` | `owner123` | Merchant Owner | Al-Baraka Supermarket (All Branches) |
| **Branch Manager** | `mgr_downtown` | `mgr123` | Branch Manager | Downtown Branch (`br_downtown`) |
| **Cashier (Downtown)** | `cashier_ahmed` | `cashier123` | Cashier | Downtown Branch (`br_downtown`) |
| **Cashier (Nasr City)** | `cashier_sara` | `cashier123` | Cashier | Nasr City Branch (`br_nasrcity`) |
| **Merchant Owner 2** | `elec_owner` | `elec123` | Merchant Owner | Cairo Retail & Electronics (Isolated Tenant) |

*You can also use the 1-click Quick Persona Switcher located at the top of the Home (`/`) and Login (`/login`) pages to instantly test any role.*

---

## 🛡️ Multi-Tenant Data Isolation Guarantee

Every database entity is partitioned by `tenant_id`:
- Products, inventory balances, inventory movements, sales, orders, and journals are strictly scoped.
- Running queries for Tenant 1 returns **0 records** from Tenant 2.
- Branch staff users are restricted to their assigned `branch_id`; changing URL parameters or client requests cannot leak other branches' transactions.

---

## 📊 Excel Compatibility & CSV Security

All data tables and reports feature 1-click CSV export:
- Prefixed with the **UTF-8 Byte Order Mark (`\uFEFF`)**, ensuring Arabic characters open cleanly in Microsoft Excel without character corruption.
- Protected against **CSV Formula Injection**: cells beginning with `=`, `+`, `-`, or `@` are safely sanitized.

---

## 🚀 Running the Platform

### Production Build & Run:
```bash
npm run build
npm run start
```

### Development Mode:
```bash
npm run dev
```

### Automated End-to-End Test Suite:
```bash
npx tsx src/lib/test-suite.ts
```

### Re-seeding the Database:
```bash
npx tsx src/lib/db/seed.ts
```
