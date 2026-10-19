/**
 * Offline Manager for Sastmhaly POS & Merchant SaaS
 * Handles offline storage, transaction queueing, customer queueing,
 * stock adjustments, and idempotent synchronization without duplicate records.
 */

export interface OfflineSale {
  id: string;
  offline_at: string;
  tenant_id: string;
  branch_id: string;
  register_id: string;
  session_id: string;
  cashier_id: string;
  customer_id: string | null;
  customer_name?: string | null;
  items: Array<{
    product_id: string;
    product_name?: string;
    batch_id: string | null;
    quantity: number;
    unit_price: number;
    cost_price: number;
    discount_amount: number;
    tax_rate: number;
    tax_amount: number;
    line_total: number;
  }>;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: string;
  notes?: string;
  sale_number: string;
  synced: boolean;
}

export interface OfflineCustomer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  code: string;
  created_at: string;
}

const OFFLINE_SALES_KEY = 'sastmhaly_offline_sales';
const OFFLINE_CUSTOMERS_KEY = 'sastmhaly_offline_customers';

export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

// --------------------------------------------------------------------------
// Offline Sales Management
// --------------------------------------------------------------------------

export function getPendingOfflineSales(): OfflineSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading offline sales:', err);
    return [];
  }
}

export function saveOfflineSale(payload: any): OfflineSale {
  const pending = getPendingOfflineSales();
  const timestamp = Date.now();
  const offlineSaleNumber = `OFF-${timestamp.toString().slice(-6)}`;

  const offlineSale: OfflineSale = {
    ...payload,
    id: `off_sale_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    sale_number: offlineSaleNumber,
    offline_at: new Date().toISOString(),
    synced: false,
  };

  pending.push(offlineSale);
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(pending));
  } catch (err) {
    console.error('Failed to save offline sale to localStorage', err);
  }

  // Notify UI
  broadcastSyncEvent({
    type: 'offline_sale_added',
    pendingCount: pending.length,
    lastSaleNumber: offlineSaleNumber,
  });

  return offlineSale;
}

export function removeOfflineSale(saleId: string) {
  const pending = getPendingOfflineSales();
  const filtered = pending.filter(s => s.id !== saleId);
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to update offline sales list', err);
  }
  broadcastSyncEvent({
    type: 'offline_sale_synced',
    pendingCount: filtered.length,
  });
}

export function updateOfflineSaleCustomer(saleIdOrNumber: string, customerId: string, customerName: string) {
  const pending = getPendingOfflineSales();
  const updated = pending.map(s => {
    if (s.id === saleIdOrNumber || s.sale_number === saleIdOrNumber) {
      return { ...s, customer_id: customerId, customer_name: customerName };
    }
    return s;
  });
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update offline sale customer', err);
  }
}

// --------------------------------------------------------------------------
// Offline Customers Management
// --------------------------------------------------------------------------

export function getPendingOfflineCustomers(): OfflineCustomer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function saveOfflineCustomer(customer: OfflineCustomer) {
  const pending = getPendingOfflineCustomers();
  // Avoid duplicate by id or phone
  if (!pending.some(c => c.id === customer.id || c.phone === customer.phone)) {
    pending.push(customer);
    try {
      localStorage.setItem(OFFLINE_CUSTOMERS_KEY, JSON.stringify(pending));
    } catch (err) {
      console.error('Failed to save offline customer', err);
    }
  }
}

export function removeOfflineCustomer(customerId: string) {
  const pending = getPendingOfflineCustomers();
  const filtered = pending.filter(c => c.id !== customerId);
  try {
    localStorage.setItem(OFFLINE_CUSTOMERS_KEY, JSON.stringify(filtered));
  } catch (err) {}
}

// --------------------------------------------------------------------------
// Idempotent Auto-Sync Engine (Single Execution Lock)
// --------------------------------------------------------------------------

let isSyncingInProgress = false;

export async function syncPendingSales(): Promise<{ success: number; failed: number }> {
  if (typeof window === 'undefined') return { success: 0, failed: 0 };
  if (!navigator.onLine) return { success: 0, failed: 0 };

  // Concurrency Lock: Prevents duplicate sync requests from firing simultaneously
  if (isSyncingInProgress) {
    console.log('[Sastmhaly Offline] Sync already in progress, ignoring duplicate call.');
    return { success: 0, failed: 0 };
  }

  isSyncingInProgress = true;

  try {
    // 1. Sync pending offline customers first so sales referencing customer_id succeed
    const pendingCustomers = getPendingOfflineCustomers();
    for (const cust of pendingCustomers) {
      try {
        const res = await fetch('/api/merchant/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: cust.id,
            tenant_id: cust.tenant_id,
            name: cust.name,
            phone: cust.phone,
            code: cust.code,
          }),
        });
        if (res.ok) {
          removeOfflineCustomer(cust.id);
        }
      } catch (err) {
        console.warn('Paused customer sync:', err);
        break; // Network not fully ready
      }
    }

    // 2. Sync pending offline sales
    const pending = getPendingOfflineSales();
    if (pending.length === 0) return { success: 0, failed: 0 };

    broadcastSyncEvent({
      type: 'syncing_start',
      pendingCount: pending.length,
    });

    let successCount = 0;
    let failedCount = 0;

    for (const sale of pending) {
      try {
        const res = await fetch('/api/merchant/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sale.id, // Idempotency key
            sale_number: sale.sale_number, // Keeps same exact invoice number
            tenant_id: sale.tenant_id,
            branch_id: sale.branch_id,
            register_id: sale.register_id,
            session_id: sale.session_id,
            cashier_id: sale.cashier_id,
            customer_id: sale.customer_id,
            items: sale.items,
            subtotal: sale.subtotal,
            discount_amount: sale.discount_amount,
            tax_amount: sale.tax_amount,
            total_amount: sale.total_amount,
            paid_amount: sale.paid_amount,
            change_amount: sale.change_amount,
            payment_method: sale.payment_method,
            notes: `${sale.notes ? sale.notes + ' - ' : ''}[Offline sale: ${sale.sale_number} at ${new Date(sale.offline_at).toLocaleTimeString()}]`,
          }),
        });

        if (res.ok) {
          // Immediately remove from queue to prevent duplicate submissions
          removeOfflineSale(sale.id);
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error('Failed syncing offline sale', sale.id, err);
        failedCount++;
        break; // Network dropped again, pause loop
      }
    }

    const remaining = getPendingOfflineSales();
    broadcastSyncEvent({
      type: 'syncing_complete',
      successCount,
      failedCount,
      pendingCount: remaining.length,
    });

    return { success: successCount, failed: failedCount };
  } finally {
    isSyncingInProgress = false;
  }
}

// Broadcast event across components and tabs
export function broadcastSyncEvent(data: any) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sastmhaly_offline_sync', { detail: data }));
}

// Automatic Sync Initializer
let autoSyncInitialized = false;

export function initOfflineSync() {
  if (typeof window === 'undefined' || autoSyncInitialized) return;
  autoSyncInitialized = true;

  // Listen to network restore (Runs only once globally)
  window.addEventListener('online', () => {
    console.log('[Sastmhaly Offline] Network restored! Starting automatic sync...');
    syncPendingSales();
  });

  // Periodic sync check every 25 seconds when online
  setInterval(() => {
    if (navigator.onLine && !isSyncingInProgress) {
      const pending = getPendingOfflineSales();
      if (pending.length > 0) {
        syncPendingSales();
      }
    }
  }, 25000);
}
