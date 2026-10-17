export type TenantStatus = 'active' | 'suspended' | 'trial' | 'archived';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'expired' | 'canceled';
export type UserRole = 
  | 'super_admin' 
  | 'merchant_owner' 
  | 'branch_manager' 
  | 'cashier' 
  | 'inventory_manager' 
  | 'accountant' 
  | 'auditor';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  legal_name?: string;
  phone: string;
  email: string;
  tax_id?: string;
  commercial_reg?: string;
  logo_url?: string;
  currency: string;
  status: TenantStatus;
  onboarding_completed: number; // 0 or 1
  created_at: string;
  updated_at: string;
  sub_id?: string;
  sub_status?: string;
  sub_starts_at?: string;
  sub_expires_at?: string;
  days_remaining?: number;
  is_expired?: boolean;
}

export interface TenantSettings {
  id: string;
  tenant_id: string;
  default_tax_rate: number;
  vat_enabled: number;
  receipt_header?: string;
  receipt_footer?: string;
  receipt_width: '58mm' | '80mm';
  scale_barcode_prefix: string;
  valuation_method: 'FIFO' | 'WAC';
  allow_negative_stock: number;
  expiry_warning_days: number;
  auto_reorder_enabled: number;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  price_monthly: number;
  price_annual: number;
  max_branches: number;
  max_users: number;
  max_products: number;
  features: string[];
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'annual';
  status: SubscriptionStatus;
  starts_at: string;
  expires_at: string;
  trial_ends_at?: string;
  auto_renew: number;
}

export interface Branch {
  id: string;
  tenant_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  phone: string;
  address: string;
  city: string;
  opening_hours?: string;
  manager_name?: string;
  is_active: number;
  is_main: number;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  branch_id?: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  // HR & Payroll fields
  job_title?: string;
  base_salary?: number;
  salary_type?: 'monthly' | 'weekly' | 'daily' | 'hourly';
  daily_hours?: number;
  national_id?: string;
  hire_date?: string;
  shift_name?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'half_day';

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  branch_id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  check_in_time?: string; // e.g. 09:15
  check_out_time?: string; // e.g. 17:30
  total_hours?: number;
  late_minutes?: number;
  notes?: string;
  user_name?: string;
  user_phone?: string;
  branch_name?: string;
  created_at: string;
}

export type AdjustmentType = 'advance' | 'bonus' | 'deduction' | 'allowance';

export interface EmployeeAdjustment {
  id: string;
  tenant_id: string;
  branch_id?: string;
  user_id: string;
  type: AdjustmentType;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  reason: string;
  status: 'pending' | 'approved' | 'settled';
  created_at: string;
  user_name?: string;
  user_phone?: string;
}

export interface PayrollRecord {
  id: string;
  tenant_id: string;
  branch_id?: string;
  user_id: string;
  month: string; // YYYY-MM
  base_salary: number;
  working_days?: number;
  attended_days: number;
  absent_days: number;
  total_bonuses: number;
  total_deductions: number;
  total_advances: number;
  net_salary: number;
  status: 'draft' | 'calculated' | 'paid';
  paid_at?: string;
  payment_method?: 'cash' | 'bank' | 'wallet';
  notes?: string;
  user_name?: string;
  user_phone?: string;
  job_title?: string;
  created_at: string;
}


export interface Category {
  id: string;
  tenant_id: string;
  name_en: string;
  name_ar: string;
  code: string;
  color?: string;
  is_active: number;
}

export interface Unit {
  id: string;
  tenant_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_fractional: number;
}

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  barcode: string;
  additional_barcodes?: string;
  name_en: string;
  name_ar: string;
  category_id: string;
  unit_id: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number;
  min_selling_price?: number;
  tax_rate: number;
  track_stock: number;
  min_stock_alert: number;
  max_stock_alert?: number;
  is_weighted: number;
  has_batch_tracking: number;
  image_url?: string;
  is_active: number;
  created_at: string;
  // Joins
  category_name_en?: string;
  category_name_ar?: string;
  unit_name_en?: string;
  unit_name_ar?: string;
  current_stock?: number;
}

export interface ProductBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  branch_id: string;
  batch_number: string;
  production_date?: string;
  expiry_date: string;
  quantity: number;
  cost_price: number;
}

export interface InventoryBalance {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reserved_qty: number;
  avg_cost: number;
  last_updated: string;
  product_name_en?: string;
  product_name_ar?: string;
  sku?: string;
  barcode?: string;
}

export type MovementType = 
  | 'purchase' 
  | 'sale' 
  | 'return' 
  | 'adjustment' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'damage' 
  | 'expiry';

export interface InventoryMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number;
  reference_type: string;
  reference_id: string;
  notes?: string;
  created_by: string;
  created_at: string;
  product_name_en?: string;
  product_name_ar?: string;
  branch_name_en?: string;
  branch_name_ar?: string;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'pending' | 'in_transit' | 'received' | 'completed' | 'canceled';
  notes?: string;
  created_by: string;
  approved_by?: string;
  sent_at?: string;
  received_at?: string;
  created_at: string;
  from_branch_name?: string;
  to_branch_name?: string;
  items_count?: number;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity_sent: number;
  quantity_received?: number;
  discrepancy_notes?: string;
  product_name_en?: string;
  product_name_ar?: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  tax_id?: string;
  payment_terms?: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  supplier_id: string;
  po_number: string;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'canceled';
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  supplier_name?: string;
  branch_name?: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  product_name_en?: string;
  product_name_ar?: string;
}

export interface SupplierPayment {
  id: string;
  tenant_id: string;
  supplier_id: string;
  payment_number: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'cheque';
  reference_doc?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  supplier_name?: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tax_id?: string;
  credit_limit: number;
  current_balance: number;
  loyalty_points: number;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  tenant_id: string;
  customer_id: string;
  payment_number: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'mobile_wallet';
  notes?: string;
  created_by: string;
  created_at: string;
  customer_name?: string;
}

export interface CashRegister {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  is_active: number;
  branch_name?: string;
}

export interface CashSession {
  id: string;
  tenant_id: string;
  branch_id: string;
  register_id: string;
  cashier_id: string;
  session_number: string;
  opened_at: string;
  closed_at?: string;
  opening_float: number;
  closing_cash_counted?: number;
  expected_cash?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
  register_name?: string;
  cashier_name?: string;
  branch_name?: string;
}

export interface CashMovement {
  id: string;
  session_id: string;
  type: 'pay_in' | 'pay_out' | 'expense';
  amount: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export type PaymentMethod = 
  | 'cash' 
  | 'card' 
  | 'mobile_wallet' 
  | 'bank_transfer' 
  | 'customer_credit' 
  | 'mixed';

export interface Sale {
  id: string;
  tenant_id: string;
  branch_id: string;
  register_id: string;
  session_id: string;
  cashier_id: string;
  customer_id?: string;
  sale_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method: PaymentMethod;
  status: 'completed' | 'returned' | 'partially_returned' | 'voided';
  notes?: string;
  created_at: string;
  customer_name?: string;
  cashier_name?: string;
  branch_name?: string;
  branch_name_en?: string;
  branch_name_ar?: string;
  branch_address?: string;
  branch_phone?: string;
  items_count?: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  batch_id?: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  product_name_en?: string;
  product_name_ar?: string;
  sku?: string;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference_code?: string;
}

export interface SaleReturn {
  id: string;
  tenant_id: string;
  branch_id: string;
  sale_id: string;
  return_number: string;
  refund_amount: number;
  refund_method: string;
  restock: number;
  reason: string;
  created_by: string;
  created_at: string;
  sale_number?: string;
}

export interface Expense {
  id: string;
  tenant_id: string;
  branch_id: string;
  category: string;
  amount: number;
  payment_source: 'cash_drawer' | 'bank_account' | 'petty_cash';
  payee?: string;
  description: string;
  receipt_attachment?: string;
  created_by: string;
  created_at: string;
  branch_name?: string;
}

export interface Account {
  id: string;
  tenant_id: string;
  account_code: string;
  account_name_en: string;
  account_name_ar: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs';
  is_active: number;
  balance?: number;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  branch_id?: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  entry_id: string;
  account_code: string;
  debit: number;
  credit: number;
  account_name_en?: string;
  account_name_ar?: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  branch_id?: string;
  type: 'low_stock' | 'expiring' | 'drawer_discrepancy' | 'po_pending' | 'subscription';
  title_en: string;
  title_ar: string;
  message_en: string;
  message_ar: string;
  is_read: number;
  link?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  branch_id?: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: string;
  new_values?: string;
  created_at: string;
  user_name?: string;
}

export interface PosCartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  tax_rate: number;
  batch_id?: string;
  weight?: number; // for weighted products
  notes?: string;
}

export interface PosHeldSale {
  id: string;
  timestamp: string;
  customer?: Customer;
  items: PosCartItem[];
  subtotal: number;
  total: number;
  notes?: string;
}
