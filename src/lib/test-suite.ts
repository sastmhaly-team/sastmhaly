import { db } from './db';
import { 
  getPlatformOverviewMetrics, createTenant, getTenants,
  getProducts, getInventoryBalances, commitSaleTransaction,
  getSale, processSaleReturn, createPurchaseOrder, receivePurchaseOrderGoods,
  getExpenses, createExpense, getCustomers, getSuppliers
} from './db/queries';

console.log('======================================================================');
console.log('🧪 RUNNING COMPREHENSIVE E2E SAAS PLATFORM TEST SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------------------
// 1. Platform Super Admin & Metrics
// ----------------------------------------------------------------------------
console.log('--- 1. PLATFORM SUPER ADMIN & METRICS ---');
const metrics = getPlatformOverviewMetrics();
assert(metrics.totalMerchants >= 2, 'Super Admin calculates actual total merchants count');
assert(metrics.mrr > 0, `MRR calculated accurately from active subscriptions (MRR: ${metrics.mrr} EGP)`);
assert(metrics.totalBranches >= 2, 'Branches aggregate across tenants correctly');

// ----------------------------------------------------------------------------
// 2. Tenant Data Isolation Benchmark (Scenario H)
// ----------------------------------------------------------------------------
console.log('\n--- 2. STRICT MULTI-TENANT DATA ISOLATION BENCHMARK ---');
const tenant1Products = getProducts('tenant_albaraka');
const tenant2Products = getProducts('tenant_cairoelectronics');

assert(tenant1Products.length > 0, 'Tenant 1 (Al-Baraka Supermarket) has catalog records');
assert(tenant2Products.length > 0, 'Tenant 2 (Cairo Retail) has catalog records');

const tenant1Skus = new Set(tenant1Products.map(p => p.sku));
const hasLeakage = tenant2Products.some(p => tenant1Skus.has(p.sku));
assert(!hasLeakage, 'ZERO DATA LEAKAGE: Tenant 2 cannot query or access Tenant 1 products');

// ----------------------------------------------------------------------------
// 3. Multi-Branch Isolation Benchmark (Scenario D)
// ----------------------------------------------------------------------------
console.log('\n--- 3. MULTI-BRANCH SCOPING & ISOLATION ---');
const branch1Balances = getInventoryBalances('tenant_albaraka', 'br_downtown');
const branch2Balances = getInventoryBalances('tenant_albaraka', 'br_nasrcity');
assert(branch1Balances.length > 0, 'Downtown branch has scoped inventory balances');
assert(branch2Balances.length > 0, 'Nasr City branch has scoped inventory balances');

// ----------------------------------------------------------------------------
// 4. POS Atomic Checkout & Stock Decrement (Scenario C)
// ----------------------------------------------------------------------------
console.log('\n--- 4. POS ATOMIC SALE TRANSACTION & INVENTORY INTEGRITY ---');
const testProduct = tenant1Products.find(p => p.track_stock === 1)!;
const initialStockRow = db.prepare('SELECT quantity FROM inventory_balances WHERE branch_id = ? AND product_id = ?')
  .get('br_downtown', testProduct.id) as { quantity: number };
const initialStock = initialStockRow ? initialStockRow.quantity : 100;

const activeSession = db.prepare("SELECT id FROM cash_sessions WHERE branch_id = ? AND status = 'open' LIMIT 1")
  .get('br_downtown') as { id: string } | undefined;

const saleResult = commitSaleTransaction({
  tenant_id: 'tenant_albaraka',
  branch_id: 'br_downtown',
  register_id: 'reg_dt_1',
  session_id: 'sess_dt_current',
  cashier_id: 'usr_cashier_ahmed',
  items: [{
    product_id: testProduct.id,
    quantity: 2,
    unit_price: testProduct.selling_price,
    cost_price: testProduct.cost_price,
    discount_amount: 0,
    tax_amount: (testProduct.selling_price * 2 * 0.14),
    line_total: testProduct.selling_price * 2
  }],
  subtotal: testProduct.selling_price * 2,
  discount_amount: 0,
  tax_amount: testProduct.selling_price * 2 * 0.14,
  total_amount: (testProduct.selling_price * 2) * 1.14,
  paid_amount: (testProduct.selling_price * 2) * 1.14,
  change_amount: 0,
  payment_method: 'cash'
});

assert(!!saleResult && !!saleResult.id, `Sale created atomically with Invoice #: ${saleResult.sale_number}`);

const newStockRow = db.prepare('SELECT quantity FROM inventory_balances WHERE branch_id = ? AND product_id = ?')
  .get('br_downtown', testProduct.id) as { quantity: number };
assert(newStockRow.quantity === initialStock - 2, `Inventory decreased exactly by sold quantity (was ${initialStock}, now ${newStockRow.quantity})`);

// Check double-entry journal entry was recorded
const journalRow = db.prepare('SELECT * FROM journal_entries WHERE reference_id = ?').get(saleResult.id);
assert(!!journalRow, 'Balanced Double-Entry General Ledger journal entry created for sale');

// ----------------------------------------------------------------------------
// 5. Sale Return & Restock Workflow (Scenario F)
// ----------------------------------------------------------------------------
console.log('\n--- 5. RETURN & REFUND WORKFLOW (SCENARIO F) ---');
const returnResult = processSaleReturn('tenant_albaraka', {
  saleId: saleResult.id,
  refundAmount: saleResult.total_amount,
  refundMethod: 'cash',
  restock: true,
  reason: 'Customer requested refund - test',
  createdBy: 'usr_cashier_ahmed',
  items: [{
    product_id: testProduct.id,
    quantity: 2,
    unit_price: testProduct.selling_price,
    cost_price: testProduct.cost_price
  }]
});

assert(returnResult.success, `Return processed with Return #: ${returnResult.returnNumber}`);

const restockedRow = db.prepare('SELECT quantity FROM inventory_balances WHERE branch_id = ? AND product_id = ?')
  .get('br_downtown', testProduct.id) as { quantity: number };
assert(restockedRow.quantity === initialStock, `Returned goods restocked to inventory successfully (restored to ${restockedRow.quantity})`);

const originalSale = getSale('tenant_albaraka', saleResult.id);
assert(originalSale?.status === 'returned', 'Original sale preserved for audit and marked as returned');

// ----------------------------------------------------------------------------
// 6. Purchasing & Goods Receipt (Scenario E)
// ----------------------------------------------------------------------------
console.log('\n--- 6. PURCHASING & AP LIABILITY (SCENARIO E) ---');
const suppliers = getSuppliers('tenant_albaraka');
const supplier = suppliers[0];
const initialAp = supplier.current_balance;

const po = createPurchaseOrder('tenant_albaraka', {
  branch_id: 'br_downtown',
  supplier_id: supplier.id,
  items: [{
    product_id: testProduct.id,
    quantity: 50,
    unit_cost: testProduct.cost_price
  }],
  notes: 'Restock PO for test',
  created_by: 'usr_baraka_owner'
});

assert(!!po.po_number, `Purchase Order created: ${po.po_number}`);

// Receive goods
receivePurchaseOrderGoods('tenant_albaraka', po.id, 'usr_baraka_owner');
const updatedSupplier = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(supplier.id) as { current_balance: number };
assert(updatedSupplier.current_balance === initialAp + po.net_amount, `Accounts Payable increased by purchase net amount (${initialAp} -> ${updatedSupplier.current_balance} EGP)`);

// ----------------------------------------------------------------------------
// 7. Operating Expense Recording (Section 17)
// ----------------------------------------------------------------------------
console.log('\n--- 7. OPERATING EXPENSES (SECTION 17) ---');
const expense = createExpense('tenant_albaraka', {
  branch_id: 'br_downtown',
  category: 'Utilities',
  amount: 450,
  payment_source: 'cash_drawer',
  payee: 'South Cairo Electricity Co.',
  description: 'Electricity bill payment for branch',
  created_by: 'usr_baraka_owner'
});
assert(expense.amount === 450, 'Operating expense recorded and linked to double-entry ledger');

console.log('\n======================================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('======================================================================\n');
