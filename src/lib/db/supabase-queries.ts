/**
 * SUPABASE ASYNC QUERY LAYER
 * Mirrors all functions from queries.ts but uses Supabase PostgreSQL.
 * All functions are async and return Promises.
 */

import { createClient } from '@supabase/supabase-js';
import {
  Tenant, Branch, User, Category, Unit, Product,
  InventoryBalance, InventoryMovement, StockTransfer, StockTransferItem,
  Supplier, PurchaseOrder, Customer, CashRegister, CashSession,
  Sale, SaleItem, Expense, Account, JournalEntry, Notification, AuditLog,
  SubscriptionPlan
} from '../types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unctfxlnmqddykxbxxyt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6e9lQ6kQ5YNEEzQk6GQAjg_v9H2VATD';
  return createClient(url, key);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ============================================================================
// TENANTS & PLATFORM ADMIN
// ============================================================================

export async function getTenants(): Promise<Tenant[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      *,
      subscriptions (
        id, status, starts_at, expires_at,
        subscription_plans (price_monthly)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => {
    const sub = r.subscriptions?.[0];
    let daysRemaining = 0;
    let isExpired = false;
    if (sub?.expires_at) {
      const diffMs = new Date(sub.expires_at).getTime() - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = diffMs <= 0 || r.status === 'suspended' || sub.status === 'suspended';
    } else {
      isExpired = r.status === 'suspended';
    }
    return { ...r, sub_status: sub?.status, sub_expires_at: sub?.expires_at, days_remaining: daysRemaining, is_expired: isExpired };
  });
}

export async function getTenant(id: string): Promise<Tenant | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tenants')
    .select(`*, subscriptions(id, status, starts_at, expires_at)`)
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  const sub = data.subscriptions?.[0];
  let daysRemaining = 0;
  let isExpired = false;
  if (sub?.expires_at) {
    const diffMs = new Date(sub.expires_at).getTime() - Date.now();
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    isExpired = diffMs <= 0 || data.status === 'suspended' || sub.status === 'suspended';
  } else {
    isExpired = data.status === 'suspended';
  }
  return { ...data, days_remaining: daysRemaining, is_expired: isExpired } as Tenant;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase.from('tenants').select('*').eq('slug', slug).single();
  return data as Tenant | undefined;
}

export async function createTenant(data: {
  id: string;
  slug: string;
  name: string;
  legal_name?: string;
  phone: string;
  email: string;
  tax_id?: string;
  commercial_reg?: string;
  currency?: string;
  plan_id: string;
  duration_months?: number;
  custom_start_date?: string;
  custom_end_date?: string;
  owner_full_name?: string;
  owner_username?: string;
  owner_password?: string;
}): Promise<Tenant> {
  const supabase = getSupabase();
  const currency = data.currency || 'EGP';

  // 1. Insert Tenant
  await supabase.from('tenants').insert({
    id: data.id, slug: data.slug, name: data.name,
    legal_name: data.legal_name || null, phone: data.phone,
    email: data.email, tax_id: data.tax_id || null,
    commercial_reg: data.commercial_reg || null,
    logo_url: '/logo.png', currency, status: 'active', onboarding_completed: 0
  }).throwOnError();

  // 2. Insert Settings
  await supabase.from('tenant_settings').insert({
    id: `ts_${data.id}`, tenant_id: data.id,
    default_tax_rate: 14.0, vat_enabled: 1,
    receipt_header: `${data.name}\n${data.phone}`,
    receipt_footer: 'شكراً لتعاملكم معنا',
    receipt_width: '80mm', scale_barcode_prefix: '21', valuation_method: 'WAC'
  }).throwOnError();

  // 3. Calculate Subscription Duration
  const { data: plan } = await supabase.from('subscription_plans').select('*').eq('id', data.plan_id).single();

  let startsAt = new Date();
  if (data.custom_start_date) {
    const p = new Date(data.custom_start_date);
    if (!isNaN(p.getTime())) startsAt = p;
  }
  let expiresAt = new Date(startsAt);
  if (data.custom_end_date) {
    const p = new Date(data.custom_end_date);
    if (!isNaN(p.getTime())) { expiresAt = p; } else { expiresAt.setMonth(expiresAt.getMonth() + 1); }
  } else {
    const months = data.duration_months && data.duration_months > 0 ? Number(data.duration_months) : 1;
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  await supabase.from('subscriptions').insert({
    id: `sub_${data.id}`, tenant_id: data.id, plan_id: data.plan_id,
    billing_cycle: 'custom', status: 'active',
    starts_at: startsAt.toISOString(), expires_at: expiresAt.toISOString(), auto_renew: 0
  }).throwOnError();

  // 4. Initial Invoice
  await supabase.from('subscription_invoices').insert({
    id: `inv_${data.id}_01`, tenant_id: data.id,
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    amount: plan ? plan.price_monthly : 499.0, status: 'paid',
    due_date: new Date().toISOString(), paid_at: new Date().toISOString(),
    payment_method: 'provisioning', notes: 'Initial Subscription'
  }).throwOnError();

  // 5. Default Main Branch
  const branchId = `br_${data.id}_main`;
  await supabase.from('branches').insert({
    id: branchId, tenant_id: data.id, code: 'BR-01',
    name_en: 'Main Branch', name_ar: 'الفرع الرئيسي',
    phone: data.phone, address: 'Cairo Head Office', city: 'Cairo',
    is_active: 1, is_main: 1
  }).throwOnError();

  // 6. Default Cash Register
  await supabase.from('cash_registers').insert({
    id: `reg_${data.id}_01`, tenant_id: data.id, branch_id: branchId,
    code: 'POS-01', name: 'Main Cash Register 1', is_active: 1
  }).throwOnError();

  // 7. Default Categories & Units
  await supabase.from('categories').insert([
    { id: `cat_${data.id}_gen`, tenant_id: data.id, name_en: 'General Products', name_ar: 'منتجات عامة', code: 'GEN', is_active: 1 }
  ]).throwOnError();

  await supabase.from('units').insert([
    { id: `unit_${data.id}_pcs`, tenant_id: data.id, code: 'PCS', name_en: 'Piece', name_ar: 'قطعة', is_fractional: 0 },
    { id: `unit_${data.id}_kg`, tenant_id: data.id, code: 'KG', name_en: 'Kilogram', name_ar: 'كيلوجرام', is_fractional: 1 }
  ]).throwOnError();

  // 8. Default Chart of Accounts
  const defaultAccounts = [
    { code: '1010', en: 'Cash on Hand', ar: 'النقدية بالصندوق والخزينة', type: 'asset' },
    { code: '1020', en: 'Bank Account', ar: 'الحساب البنكي', type: 'asset' },
    { code: '1030', en: 'Accounts Receivable', ar: 'العملاء والمدينون', type: 'asset' },
    { code: '1200', en: 'Inventory Asset', ar: 'المخزون السلعي', type: 'asset' },
    { code: '2010', en: 'Accounts Payable', ar: 'الموردون والدائنون', type: 'liability' },
    { code: '2020', en: 'VAT Output Tax', ar: 'ضريبة القيمة المضافة المحصلة', type: 'liability' },
    { code: '3010', en: 'Owner Equity', ar: 'رأس المال وحقوق الملكية', type: 'equity' },
    { code: '4010', en: 'Sales Revenue', ar: 'إيرادات المبيعات', type: 'revenue' },
    { code: '5010', en: 'Cost of Goods Sold', ar: 'تكلفة المبيعات (COGS)', type: 'cogs' },
    { code: '6010', en: 'Operating Expenses', ar: 'المصروفات التشغيلية', type: 'expense' },
  ];

  await supabase.from('chart_of_accounts').insert(
    defaultAccounts.map(acc => ({
      id: `acc_${data.id}_${acc.code}`, tenant_id: data.id,
      account_code: acc.code, account_name_en: acc.en,
      account_name_ar: acc.ar, account_type: acc.type, is_active: 1
    }))
  ).throwOnError();

  // 9. Create Merchant Owner User account if credentials provided
  if (data.owner_username && data.owner_password) {
    const ownerId = `usr_${data.id}_owner`;
    const ownerEmail = data.email;
    await supabase.from('users').upsert({
      id: ownerId, tenant_id: data.id, branch_id: null,
      email: ownerEmail,
      username: data.owner_username,
      password_hash: data.owner_password,
      full_name: data.owner_full_name || data.name,
      phone: data.phone, role: 'merchant_owner', is_active: 1
    }, { onConflict: 'username' }).throwOnError();
  }

  // 10. Audit Log
  await supabase.from('audit_logs').insert({
    id: `aud_${Date.now()}`, tenant_id: data.id, branch_id: branchId,
    user_id: 'usr_superadmin_01', action: 'CREATE_MERCHANT',
    entity_type: 'tenant', entity_id: data.id,
    new_values: JSON.stringify({ name: data.name, email: data.email })
  });

  return (await getTenant(data.id))!;
}

export async function updateTenantStatus(id: string, status: 'active' | 'suspended' | 'trial' | 'archived') {
  const supabase = getSupabase();
  await supabase.from('tenants').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  await supabase.from('subscriptions').update({ status: status === 'suspended' ? 'suspended' : 'active' }).eq('tenant_id', id);
}

export async function renewSubscription(tenantId: string, options: {
  duration_months?: number;
  custom_start_date?: string;
  custom_end_date?: string;
  status?: 'active' | 'suspended';
}) {
  const supabase = getSupabase();
  let startsAt = new Date();
  if (options.custom_start_date) {
    const p = new Date(options.custom_start_date);
    if (!isNaN(p.getTime())) startsAt = p;
  }
  let expiresAt = new Date(startsAt);
  if (options.custom_end_date) {
    const p = new Date(options.custom_end_date);
    if (!isNaN(p.getTime())) { expiresAt = p; } else { expiresAt.setMonth(expiresAt.getMonth() + 1); }
  } else {
    const months = options.duration_months && options.duration_months > 0 ? Number(options.duration_months) : 1;
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  await supabase.from('subscriptions').update({
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    status: options.status || 'active'
  }).eq('tenant_id', tenantId);

  await supabase.from('tenants').update({
    status: options.status || 'active',
    updated_at: new Date().toISOString()
  }).eq('id', tenantId);
}

export async function getPlatformOverviewMetrics() {
  const supabase = getSupabase();
  const [tenantsRes, branchesRes, usersRes, subsRes, activityRes, plansRes] = await Promise.all([
    supabase.from('tenants').select('status'),
    supabase.from('branches').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('tenant_id, plan_id, subscription_plans(price_monthly), tenants!inner(status)').eq('tenants.status', 'active'),
    supabase.from('audit_logs').select('*, users(full_name), tenants(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('subscription_plans').select('*'),
  ]);

  const tenants = tenantsRes.data || [];
  const totalMerchants = tenants.length;
  const activeMerchants = tenants.filter((t: any) => t.status === 'active').length;
  const suspendedMerchants = tenants.filter((t: any) => t.status === 'suspended').length;
  const trialMerchants = tenants.filter((t: any) => t.status === 'trial').length;
  const mrr = (subsRes.data || []).reduce((sum: number, s: any) => sum + (s.subscription_plans?.price_monthly || 0), 0);

  return {
    totalMerchants, activeMerchants, suspendedMerchants, trialMerchants,
    totalBranches: branchesRes.count || 0,
    totalUsers: usersRes.count || 0,
    mrr,
    recentActivity: activityRes.data || [],
    plans: plansRes.data || []
  };
}

// ============================================================================
// BRANCHES & USERS
// ============================================================================

export async function getBranches(tenantId: string): Promise<Branch[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('branches').select('*').eq('tenant_id', tenantId).order('is_main', { ascending: false }).order('code');
  return (data || []) as Branch[];
}

export async function getBranch(tenantId: string, branchId: string): Promise<Branch | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase.from('branches').select('*').eq('tenant_id', tenantId).eq('id', branchId).single();
  return data as Branch | undefined;
}

export async function createBranch(tenantId: string, data: {
  code: string; name_en: string; name_ar: string; phone: string;
  address: string; city?: string; opening_hours?: string; manager_name?: string;
}): Promise<Branch> {
  const supabase = getSupabase();
  const id = uid('br');
  const { data: branch, error } = await supabase.from('branches').insert({
    id, tenant_id: tenantId, code: data.code.toUpperCase(),
    name_en: data.name_en, name_ar: data.name_ar,
    phone: data.phone, address: data.address,
    city: data.city || 'Cairo',
    opening_hours: data.opening_hours || '09:00 - 23:00',
    manager_name: data.manager_name || null,
    is_active: 1, is_main: 0
  }).select().single();
  if (error) throw new Error(error.message);
  return branch as Branch;
}

export async function deleteBranch(tenantId: string, branchId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('branch_id', branchId);
  if (count && count > 0) return { success: false, error: 'لا يمكن حذف فرع به موظفون' };
  const { error } = await supabase.from('branches').delete().eq('id', branchId).eq('tenant_id', tenantId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getUsers(tenantId?: string, branchId?: string): Promise<User[]> {
  const supabase = getSupabase();
  let query = supabase.from('users').select('id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at');
  if (tenantId) query = query.eq('tenant_id', tenantId);
  if (branchId) query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  const { data } = await query;
  return (data || []) as User[];
}

export async function getUserByUsernameOrEmail(identifier: string): Promise<(User & { password_hash: string }) | undefined> {
  const supabase = getSupabase();
  const clean = identifier.trim();
  const { data } = await supabase.from('users').select('*')
    .or(`phone.eq.${clean},username.eq.${clean},email.eq.${clean}`)
    .eq('is_active', 1)
    .limit(1)
    .single();
  return data as (User & { password_hash: string }) | undefined;
}

export async function createUser(data: {
  tenant_id: string; branch_id?: string; email: string; username: string;
  password_hash: string; full_name: string; phone?: string; role: string;
}): Promise<User> {
  const supabase = getSupabase();
  const id = uid('usr');
  const { data: user, error } = await supabase.from('users').insert({
    id, tenant_id: data.tenant_id, branch_id: data.branch_id || null,
    email: data.email, username: data.username, password_hash: data.password_hash,
    full_name: data.full_name, phone: data.phone || null, role: data.role, is_active: 1
  }).select('id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at').single();
  if (error) throw new Error(error.message);
  return user as User;
}

export async function updateUser(id: string, tenantId: string, data: {
  full_name?: string; phone?: string; role?: string; branch_id?: string;
  password_hash?: string; is_active?: number;
}): Promise<User> {
  const supabase = getSupabase();
  const updates: any = {};
  if (data.full_name !== undefined) updates.full_name = data.full_name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.role !== undefined) updates.role = data.role;
  if (data.branch_id !== undefined) updates.branch_id = data.branch_id || null;
  if (data.password_hash) updates.password_hash = data.password_hash;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  const { data: user, error } = await supabase.from('users').update(updates)
    .eq('id', id).eq('tenant_id', tenantId)
    .select('id, tenant_id, branch_id, email, username, full_name, phone, role, is_active, created_at').single();
  if (error) throw new Error(error.message);
  return user as User;
}

export async function deleteUser(id: string, tenantId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from('users').delete().eq('id', id).eq('tenant_id', tenantId);
  return !error;
}

// ============================================================================
// PRODUCTS & CATALOG
// ============================================================================

export async function getCategories(tenantId: string): Promise<Category[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).eq('is_active', 1).order('name_en');
  return (data || []) as Category[];
}

export async function createCategory(tenantId: string, data: { name_ar: string; name_en?: string; code?: string; color?: string }): Promise<Category> {
  const supabase = getSupabase();
  const id = uid('cat');
  const code = (data.code || `CAT_${Date.now().toString().slice(-4)}`).toUpperCase();
  const { data: cat, error } = await supabase.from('categories').insert({
    id, tenant_id: tenantId, name_en: data.name_en || data.name_ar,
    name_ar: data.name_ar, code, color: data.color || '#246BFD', is_active: 1
  }).select().single();
  if (error) throw new Error(error.message);
  return cat as Category;
}

export async function updateCategory(tenantId: string, id: string, data: { name_ar: string; name_en?: string; code?: string; color?: string }): Promise<Category> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('categories').select('*').eq('id', id).eq('tenant_id', tenantId).single();
  if (!existing) throw new Error('Category not found');

  const { data: cat, error } = await supabase.from('categories').update({
    name_en: data.name_en || existing.name_en,
    name_ar: data.name_ar || existing.name_ar,
    code: (data.code || existing.code).toUpperCase(),
    color: data.color || existing.color
  }).eq('id', id).eq('tenant_id', tenantId).select().single();
  if (error) throw new Error(error.message);
  return cat as Category;
}

export async function deleteCategory(tenantId: string, id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id).eq('tenant_id', tenantId);
  if (count && count > 0) return { success: false, error: `لا يمكن حذف هذا القسم لأن هناك ${count} منتجات مسجلة عليه` };
  await supabase.from('categories').delete().eq('id', id).eq('tenant_id', tenantId);
  return { success: true };
}

export async function getUnits(tenantId: string): Promise<Unit[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('units').select('*').eq('tenant_id', tenantId).order('name_en');
  return (data || []) as Unit[];
}

export async function getProducts(tenantId: string, options?: {
  search?: string; categoryId?: string; branchId?: string; lowStockOnly?: boolean;
}): Promise<Product[]> {
  const supabase = getSupabase();

  let query = supabase.from('products').select(`
    *,
    categories (name_en, name_ar),
    units (name_en, name_ar),
    inventory_balances (quantity, branch_id)
  `).eq('tenant_id', tenantId).eq('is_active', 1);

  if (options?.search) {
    query = query.or(`name_en.ilike.%${options.search}%,name_ar.ilike.%${options.search}%,barcode.ilike.%${options.search}%,sku.ilike.%${options.search}%`);
  }
  if (options?.categoryId && options.categoryId !== 'all') {
    query = query.eq('category_id', options.categoryId);
  }

  const { data, error } = await query.order('name_en');
  if (error) throw new Error(error.message);

  return (data || []).map((p: any) => {
    let stock = 0;
    if (options?.branchId) {
      const ib = p.inventory_balances?.find((b: any) => b.branch_id === options.branchId);
      stock = ib?.quantity || 0;
    } else {
      stock = (p.inventory_balances || []).reduce((s: number, b: any) => s + (b.quantity || 0), 0);
    }
    if (options?.lowStockOnly && stock > (p.min_stock_alert || 5)) return null;
    return {
      ...p,
      category_name_en: p.categories?.name_en,
      category_name_ar: p.categories?.name_ar,
      unit_name_en: p.units?.name_en,
      unit_name_ar: p.units?.name_ar,
      current_stock: stock,
    };
  }).filter(Boolean) as Product[];
}

export async function getProductByBarcode(tenantId: string, barcode: string): Promise<Product | undefined> {
  const supabase = getSupabase();
  const { data } = await supabase.from('products')
    .select(`*, categories(name_en, name_ar), units(name_en, name_ar)`)
    .eq('tenant_id', tenantId).eq('is_active', 1)
    .or(`barcode.eq.${barcode},additional_barcodes.ilike.%${barcode}%`)
    .single();
  if (!data) return undefined;
  return {
    ...data,
    category_name_en: (data as any).categories?.name_en,
    category_name_ar: (data as any).categories?.name_ar,
    unit_name_en: (data as any).units?.name_en,
    unit_name_ar: (data as any).units?.name_ar,
  } as Product;
}

export async function createProduct(tenantId: string, data: {
  sku: string; barcode: string; additional_barcodes?: string;
  name_en: string; name_ar: string; category_id: string; unit_id: string;
  cost_price: number; selling_price: number; wholesale_price?: number;
  tax_rate?: number; min_stock_alert?: number; is_weighted?: number;
  has_batch_tracking?: number; initial_stock?: number; branch_id?: string;
}): Promise<Product> {
  const supabase = getSupabase();
  const id = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const { error: prodError } = await supabase.from('products').insert({
    id, tenant_id: tenantId, sku: data.sku, barcode: data.barcode,
    additional_barcodes: data.additional_barcodes || null,
    name_en: data.name_en, name_ar: data.name_ar,
    category_id: data.category_id, unit_id: data.unit_id,
    cost_price: data.cost_price, selling_price: data.selling_price,
    wholesale_price: data.wholesale_price || null,
    tax_rate: data.tax_rate ?? 14.0,
    track_stock: 1,
    min_stock_alert: data.min_stock_alert ?? 5.0,
    is_weighted: data.is_weighted ? 1 : 0,
    has_batch_tracking: data.has_batch_tracking ? 1 : 0,
    is_active: 1
  });
  if (prodError) throw new Error(prodError.message);

  // Initial stock if specified
  if (data.initial_stock && data.initial_stock > 0 && data.branch_id) {
    await supabase.from('inventory_balances').upsert({
      id: `inv_${id}_${data.branch_id}`, tenant_id: tenantId,
      branch_id: data.branch_id, product_id: id,
      quantity: data.initial_stock, avg_cost: data.cost_price,
      reserved_qty: 0
    }, { onConflict: 'branch_id,product_id' });

    await supabase.from('inventory_movements').insert({
      id: `mov_${Date.now()}`, tenant_id: tenantId,
      branch_id: data.branch_id, product_id: id,
      movement_type: 'purchase', quantity: data.initial_stock,
      unit_cost: data.cost_price, reference_type: 'opening_stock',
      reference_id: 'INITIAL', notes: 'Initial stock entry', created_by: 'system'
    });
  }

  const { data: product } = await supabase.from('products').select('*').eq('id', id).single();
  return product as Product;
}

export async function updateProduct(tenantId: string, id: string, data: Partial<{
  name_en: string; name_ar: string; sku: string; barcode: string; additional_barcodes: string;
  category_id: string; unit_id: string; cost_price: number; selling_price: number;
  wholesale_price: number; min_selling_price: number; tax_rate: number;
  min_stock_alert: number; is_weighted: number; has_batch_tracking: number;
  is_active: number; image_url: string;
}>): Promise<Product> {
  const supabase = getSupabase();
  const { data: product, error } = await supabase.from('products').update(data)
    .eq('id', id).eq('tenant_id', tenantId).select().single();
  if (error) throw new Error(error.message);
  return product as Product;
}

export async function deleteProduct(tenantId: string, id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const { error } = await supabase.from('products').update({ is_active: 0 }).eq('id', id).eq('tenant_id', tenantId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================================
// INVENTORY & BATCHES
// ============================================================================

export async function getInventoryBalances(tenantId: string, branchId?: string): Promise<InventoryBalance[]> {
  const supabase = getSupabase();
  let query = supabase.from('inventory_balances').select('*, products(name_en, name_ar, sku, barcode)').eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, product_name_en: r.products?.name_en, product_name_ar: r.products?.name_ar,
    sku: r.products?.sku, barcode: r.products?.barcode
  })) as InventoryBalance[];
}

export async function getInventoryMovements(tenantId: string, options?: { branchId?: string; limit?: number }): Promise<InventoryMovement[]> {
  const supabase = getSupabase();
  let query = supabase.from('inventory_movements').select('*, products(name_en, name_ar), branches(name_ar)').eq('tenant_id', tenantId);
  if (options?.branchId) query = query.eq('branch_id', options.branchId);
  query = query.order('created_at', { ascending: false }).limit(options?.limit || 100);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, product_name_en: r.products?.name_en, product_name_ar: r.products?.name_ar,
    branch_name: r.branches?.name_ar
  })) as InventoryMovement[];
}

export async function getBatches(tenantId: string, branchId?: string) {
  const supabase = getSupabase();
  let query = supabase.from('product_batches').select('*, products(name_en, name_ar, sku), branches(name_ar)').eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  query = query.order('expiry_date');
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, product_name_en: r.products?.name_en, product_name_ar: r.products?.name_ar,
    product_sku: r.products?.sku, branch_name: r.branches?.name_ar
  }));
}

export async function getStockTransfers(tenantId: string): Promise<StockTransfer[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('stock_transfers')
    .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name_ar), to_branch:branches!stock_transfers_to_branch_id_fkey(name_ar), stock_transfer_items(*)')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false });
  return (data || []).map((r: any) => ({
    ...r,
    from_branch_name: r.from_branch?.name_ar,
    to_branch_name: r.to_branch?.name_ar,
    items: r.stock_transfer_items || []
  })) as StockTransfer[];
}

export async function createStockTransfer(tenantId: string, data: {
  from_branch_id: string; to_branch_id: string; notes?: string;
  created_by: string; items: { product_id: string; quantity_sent: number }[];
}): Promise<StockTransfer> {
  const supabase = getSupabase();
  const id = uid('trn');
  const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

  await supabase.from('stock_transfers').insert({
    id, tenant_id: tenantId, transfer_number: transferNumber,
    from_branch_id: data.from_branch_id, to_branch_id: data.to_branch_id,
    status: 'pending', notes: data.notes || null, created_by: data.created_by
  }).throwOnError();

  await supabase.from('stock_transfer_items').insert(
    data.items.map(item => ({
      id: uid('sti'), transfer_id: id,
      product_id: item.product_id, quantity_sent: item.quantity_sent
    }))
  ).throwOnError();

  const { data: transfer } = await supabase.from('stock_transfers').select('*').eq('id', id).single();
  return transfer as StockTransfer;
}

export async function receiveStockTransfer(tenantId: string, transferId: string, receivedBy: string) {
  const supabase = getSupabase();
  const { data: transfer } = await supabase.from('stock_transfers').select('*, stock_transfer_items(*)').eq('id', transferId).single();
  if (!transfer) throw new Error('Transfer not found');

  for (const item of (transfer as any).stock_transfer_items || []) {
    try {
      await supabase.rpc('adjust_inventory', {
        p_tenant_id: tenantId, p_branch_id: transfer.from_branch_id,
        p_product_id: item.product_id, p_qty_delta: -item.quantity_sent
      });
    } catch {
      // fallback: direct update
    }
    
    await supabase.from('inventory_balances').upsert({
      id: uid('ib'), tenant_id: tenantId,
      branch_id: transfer.to_branch_id, product_id: item.product_id,
      quantity: item.quantity_sent, avg_cost: 0, reserved_qty: 0
    }, { onConflict: 'branch_id,product_id', ignoreDuplicates: false });

    // Record movement
    await supabase.from('inventory_movements').insert([
      {
        id: uid('mov'), tenant_id: tenantId, branch_id: transfer.from_branch_id,
        product_id: item.product_id, movement_type: 'transfer_out',
        quantity: -item.quantity_sent, unit_cost: 0,
        reference_type: 'stock_transfer', reference_id: transferId,
        notes: 'Transfer out', created_by: receivedBy
      },
      {
        id: uid('mov'), tenant_id: tenantId, branch_id: transfer.to_branch_id,
        product_id: item.product_id, movement_type: 'transfer_in',
        quantity: item.quantity_sent, unit_cost: 0,
        reference_type: 'stock_transfer', reference_id: transferId,
        notes: 'Transfer in', created_by: receivedBy
      }
    ]);
  }

  await supabase.from('stock_transfers').update({
    status: 'received', received_at: new Date().toISOString(), approved_by: receivedBy
  }).eq('id', transferId);
}

// ============================================================================
// CASH REGISTERS & SESSIONS
// ============================================================================

export async function getCashRegisters(tenantId: string, branchId?: string): Promise<CashRegister[]> {
  const supabase = getSupabase();
  let query = supabase.from('cash_registers').select('*, branches(name_ar)').eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data } = await query;
  return (data || []).map((r: any) => ({ ...r, branch_name: r.branches?.name_ar })) as CashRegister[];
}

export async function getCashSessions(tenantId: string, branchId?: string): Promise<CashSession[]> {
  const supabase = getSupabase();
  let query = supabase.from('cash_sessions')
    .select('*, cash_registers(name), users(full_name), branches(name_ar)')
    .eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  query = query.order('opened_at', { ascending: false }).limit(50);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, register_name: r.cash_registers?.name,
    cashier_name: r.users?.full_name, branch_name: r.branches?.name_ar
  })) as CashSession[];
}

export async function getActiveCashSession(tenantId: string, branchId: string, registerId?: string): Promise<CashSession | undefined> {
  const supabase = getSupabase();
  let query = supabase.from('cash_sessions')
    .select('*, cash_registers(name), users(full_name)')
    .eq('tenant_id', tenantId).eq('branch_id', branchId).eq('status', 'open');
  if (registerId) query = query.eq('register_id', registerId);
  const { data } = await query.limit(1).single();
  if (!data) return undefined;
  return {
    ...data,
    register_name: (data as any).cash_registers?.name,
    cashier_name: (data as any).users?.full_name
  } as CashSession;
}

export async function openCashSession(tenantId: string, data: {
  branch_id: string; register_id: string; cashier_id: string; opening_float: number;
}): Promise<CashSession> {
  const supabase = getSupabase();
  const sessionId = `sess_${Date.now()}`;
  const sessionNumber = `SES-${Date.now().toString().slice(-6)}`;

  await supabase.from('cash_sessions').insert({
    id: sessionId, tenant_id: tenantId, branch_id: data.branch_id,
    register_id: data.register_id, cashier_id: data.cashier_id,
    session_number: sessionNumber, opened_at: new Date().toISOString(),
    opening_float: data.opening_float, status: 'open'
  }).throwOnError();

  await supabase.from('cash_movements').insert({
    id: `cm_${Date.now()}`, session_id: sessionId,
    type: 'pay_in', amount: data.opening_float,
    reason: 'Opening cash float', created_by: data.cashier_id
  });

  const { data: session } = await supabase.from('cash_sessions').select('*').eq('id', sessionId).single();
  return session as CashSession;
}

export async function closeCashSession(tenantId: string, sessionId: string, countedCash: number, notes?: string): Promise<CashSession> {
  const supabase = getSupabase();

  const [cashSalesRes, payInsRes, payOutsRes] = await Promise.all([
    supabase.from('sales').select('paid_amount, change_amount').eq('session_id', sessionId).eq('payment_method', 'cash').eq('status', 'completed'),
    supabase.from('cash_movements').select('amount').eq('session_id', sessionId).eq('type', 'pay_in'),
    supabase.from('cash_movements').select('amount').eq('session_id', sessionId).in('type', ['pay_out', 'expense']),
  ]);

  const cashSalesTotal = (cashSalesRes.data || []).reduce((s: number, r: any) => s + (r.paid_amount - r.change_amount), 0);
  const payIns = (payInsRes.data || []).reduce((s: number, r: any) => s + r.amount, 0);
  const payOuts = (payOutsRes.data || []).reduce((s: number, r: any) => s + r.amount, 0);
  const expectedCash = payIns + cashSalesTotal - payOuts;
  const difference = countedCash - expectedCash;

  await supabase.from('cash_sessions').update({
    status: 'closed', closed_at: new Date().toISOString(),
    closing_cash_counted: countedCash, expected_cash: expectedCash,
    difference, notes: notes || null
  }).eq('id', sessionId);

  const { data: session } = await supabase.from('cash_sessions').select('*').eq('id', sessionId).single();
  return session as CashSession;
}

// ============================================================================
// POINT OF SALE (POS) - SALE COMMIT
// ============================================================================

export interface CreateSaleInput {
  tenant_id: string; branch_id: string; register_id: string; session_id: string;
  cashier_id: string; customer_id?: string;
  items: {
    product_id: string; batch_id?: string; quantity: number;
    unit_price: number; cost_price: number; discount_amount: number;
    tax_amount: number; line_total: number;
  }[];
  subtotal: number; discount_amount: number; tax_amount: number;
  total_amount: number; paid_amount: number; change_amount: number;
  payment_method: 'cash' | 'card' | 'mobile_wallet' | 'customer_credit' | 'mixed';
  notes?: string;
}

export async function commitSaleTransaction(input: CreateSaleInput): Promise<Sale> {
  const supabase = getSupabase();
  const saleId = `sale_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // 1. Resolve branch
  let branchId = input.branch_id;
  const { data: branchData } = await supabase.from('branches').select('id, code').eq('id', branchId).single();
  if (!branchData) {
    const { data: defaultBranch } = await supabase.from('branches').select('id, code').eq('tenant_id', input.tenant_id).order('is_main', { ascending: false }).limit(1).single();
    if (defaultBranch) {
      branchId = defaultBranch.id;
    } else {
      branchId = `br_${input.tenant_id}_main`;
      await supabase.from('branches').insert({
        id: branchId, tenant_id: input.tenant_id, code: 'MAIN',
        name_en: 'Main Branch', name_ar: 'الفرع الرئيسي',
        phone: '01000000000', address: 'Main Address',
        city: 'Cairo', is_active: 1, is_main: 1
      });
    }
  }
  const { data: branchRow } = await supabase.from('branches').select('code').eq('id', branchId).single();
  const branchCode = branchRow?.code || 'BR';
  const saleNumber = `INV-${branchCode}-${Date.now().toString().slice(-6)}`;

  // 2. Resolve cashier
  let cashierId = input.cashier_id;
  const { data: cashierData } = await supabase.from('users').select('id').eq('id', cashierId).single();
  if (!cashierData) {
    const { data: tenantUser } = await supabase.from('users').select('id').eq('tenant_id', input.tenant_id).limit(1).single();
    cashierId = tenantUser?.id || 'usr_superadmin_01';
  }

  // 3. Resolve register
  let registerId = input.register_id;
  const { data: regData } = await supabase.from('cash_registers').select('id').eq('id', registerId).single();
  if (!regData) {
    const { data: foundReg } = await supabase.from('cash_registers').select('id').eq('tenant_id', input.tenant_id).eq('branch_id', branchId).limit(1).single();
    if (foundReg) {
      registerId = foundReg.id;
    } else {
      registerId = `reg_${branchId}_01`;
      await supabase.from('cash_registers').upsert({
        id: registerId, tenant_id: input.tenant_id, branch_id: branchId,
        code: 'POS-01', name: 'نقطة البيع الرئيسية', is_active: 1
      }, { onConflict: 'id', ignoreDuplicates: true });
    }
  }

  // 4. Resolve session
  let sessionId = input.session_id;
  const { data: sessData } = await supabase.from('cash_sessions').select('id').eq('id', sessionId).single();
  if (!sessData) {
    const { data: activeSess } = await supabase.from('cash_sessions')
      .select('id').eq('tenant_id', input.tenant_id).eq('branch_id', branchId).eq('status', 'open')
      .order('opened_at', { ascending: false }).limit(1).single();
    if (activeSess) {
      sessionId = activeSess.id;
    } else {
      sessionId = `sess_${branchId}_${Date.now()}`;
      await supabase.from('cash_sessions').insert({
        id: sessionId, tenant_id: input.tenant_id, branch_id: branchId,
        register_id: registerId, cashier_id: cashierId,
        session_number: `SES-${Date.now().toString().slice(-6)}`,
        opened_at: new Date().toISOString(), opening_float: 0, status: 'open'
      });
    }
  }

  // 5. Resolve customer
  let customerId: string | null = input.customer_id || null;
  if (customerId) {
    const { data: custData } = await supabase.from('customers').select('id').eq('id', customerId).single();
    if (!custData) customerId = null;
  }

  // 6. Check VAT setting
  const { data: tenantSettings } = await supabase.from('tenant_settings').select('vat_enabled').eq('tenant_id', input.tenant_id).single();
  const isVatEnabled = tenantSettings ? tenantSettings.vat_enabled === 1 : true;
  const finalTaxAmount = isVatEnabled ? input.tax_amount : 0;
  const finalTotalAmount = isVatEnabled ? input.total_amount : Math.max(0, input.subtotal - input.discount_amount);

  // 7. Insert sale header
  await supabase.from('sales').insert({
    id: saleId, tenant_id: input.tenant_id, branch_id: branchId,
    register_id: registerId, session_id: sessionId,
    cashier_id: cashierId, customer_id: customerId,
    sale_number: saleNumber, subtotal: input.subtotal,
    discount_amount: input.discount_amount, tax_amount: finalTaxAmount,
    total_amount: finalTotalAmount, paid_amount: input.paid_amount,
    change_amount: input.change_amount, payment_method: input.payment_method,
    status: 'completed', notes: input.notes || null,
    created_at: new Date().toISOString()
  }).throwOnError();

  // 8. Insert sale items & update inventory
  let totalCogs = 0;
  for (const item of input.items) {
    const itemId = `si_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const itemTaxAmount = isVatEnabled ? item.tax_amount : 0;
    const itemLineTotal = isVatEnabled ? item.line_total : (item.unit_price * item.quantity - item.discount_amount);

    // Validate batch
    let validBatchId: string | null = null;
    if (item.batch_id) {
      const { data: batchData } = await supabase.from('product_batches').select('id').eq('id', item.batch_id).single();
      if (batchData) validBatchId = item.batch_id;
    }

    await supabase.from('sale_items').insert({
      id: itemId, sale_id: saleId, product_id: item.product_id,
      batch_id: validBatchId, quantity: item.quantity, unit_price: item.unit_price,
      cost_price: item.cost_price, discount_amount: item.discount_amount,
      tax_amount: itemTaxAmount, line_total: itemLineTotal
    });

    totalCogs += item.cost_price * item.quantity;

    // Ensure inventory_balances row exists
    await supabase.from('inventory_balances').upsert({
      id: `ib_${branchId}_${item.product_id}`, tenant_id: input.tenant_id,
      branch_id: branchId, product_id: item.product_id,
      quantity: 0, reserved_qty: 0, avg_cost: item.cost_price,
      last_updated: new Date().toISOString()
    }, { onConflict: 'branch_id,product_id', ignoreDuplicates: true });

    // Deduct stock
    try {
      const { error: rpcErr } = await supabase.rpc('decrement_inventory', {
        p_branch_id: branchId, p_product_id: item.product_id, p_qty: item.quantity
      });
      if (rpcErr) {
        const { data: ib } = await supabase.from('inventory_balances').select('quantity').eq('branch_id', branchId).eq('product_id', item.product_id).single();
        if (ib) {
          await supabase.from('inventory_balances').update({
            quantity: Math.max(0, (ib.quantity || 0) - item.quantity),
            last_updated: new Date().toISOString()
          }).eq('branch_id', branchId).eq('product_id', item.product_id);
        }
      }
    } catch {
      const { data: ib } = await supabase.from('inventory_balances').select('quantity').eq('branch_id', branchId).eq('product_id', item.product_id).single();
      if (ib) {
        await supabase.from('inventory_balances').update({
          quantity: Math.max(0, (ib.quantity || 0) - item.quantity),
          last_updated: new Date().toISOString()
        }).eq('branch_id', branchId).eq('product_id', item.product_id);
      }
    }

    // Record movement
    await supabase.from('inventory_movements').insert({
      id: `mov_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tenant_id: input.tenant_id, branch_id: branchId,
      product_id: item.product_id, movement_type: 'sale',
      quantity: -item.quantity, unit_cost: item.cost_price,
      reference_type: 'sale_invoice', reference_id: saleNumber,
      notes: 'POS Checkout sale', created_by: cashierId
    });

    if (validBatchId) {
      const { data: batchRow } = await supabase.from('product_batches').select('quantity').eq('id', validBatchId).single();
      if (batchRow) {
        await supabase.from('product_batches').update({ quantity: Math.max(0, batchRow.quantity - item.quantity) }).eq('id', validBatchId);
      }
    }
  }

  // 9. Payment record
  await supabase.from('sale_payments').insert({
    id: `sp_${Date.now()}`, sale_id: saleId,
    payment_method: input.payment_method, amount: input.paid_amount
  });

  // 10. Customer credit & loyalty
  if (customerId) {
    if (input.payment_method === 'customer_credit') {
      const { data: custRow } = await supabase.from('customers').select('current_balance').eq('id', customerId).single();
      if (custRow) {
        await supabase.from('customers').update({ current_balance: (custRow.current_balance || 0) + finalTotalAmount }).eq('id', customerId);
      }
    }
    const earnedPoints = Math.floor(finalTotalAmount / 10);
    const { data: custRow } = await supabase.from('customers').select('loyalty_points').eq('id', customerId).single();
    if (custRow) {
      await supabase.from('customers').update({ loyalty_points: (custRow.loyalty_points || 0) + earnedPoints }).eq('id', customerId);
    }
  }

  // 11. Journal entry
  const journalId = `je_${Date.now()}`;
  await supabase.from('journal_entries').insert({
    id: journalId, tenant_id: input.tenant_id, branch_id: branchId,
    entry_number: `JE-SALE-${Date.now().toString().slice(-6)}`,
    entry_date: new Date().toISOString().split('T')[0],
    description: 'POS Sale Revenue and COGS',
    reference_type: 'sale', reference_id: saleId
  });

  const paymentAccount = input.payment_method === 'customer_credit' ? '1030' : (input.payment_method === 'card' || input.payment_method === 'mobile_wallet' ? '1020' : '1010');
  const journalLines = [
    { id: `jl_${Date.now()}_1`, entry_id: journalId, account_code: paymentAccount, debit: finalTotalAmount, credit: 0 },
    { id: `jl_${Date.now()}_2`, entry_id: journalId, account_code: '4010', debit: 0, credit: input.subtotal - input.discount_amount },
  ];
  if (finalTaxAmount > 0) journalLines.push({ id: `jl_${Date.now()}_3`, entry_id: journalId, account_code: '2020', debit: 0, credit: finalTaxAmount });
  if (totalCogs > 0) {
    journalLines.push({ id: `jl_${Date.now()}_4`, entry_id: journalId, account_code: '5010', debit: totalCogs, credit: 0 });
    journalLines.push({ id: `jl_${Date.now()}_5`, entry_id: journalId, account_code: '1200', debit: 0, credit: totalCogs });
  }
  await supabase.from('journal_lines').insert(journalLines);

  // 12. Audit log
  await supabase.from('audit_logs').insert({
    id: `aud_${Date.now()}`, tenant_id: input.tenant_id, branch_id: branchId,
    user_id: cashierId, action: 'POS_SALE', entity_type: 'sale',
    entity_id: saleId, new_values: JSON.stringify({ saleNumber, total: finalTotalAmount })
  });

  return (await getSale(input.tenant_id, saleId))!;
}

export async function getSales(tenantId: string, options?: { branchId?: string; limit?: number }): Promise<Sale[]> {
  const supabase = getSupabase();
  let query = supabase.from('sales').select(`
    *, customers(name), users(full_name), branches(name_ar),
    sale_items(id)
  `).eq('tenant_id', tenantId);
  if (options?.branchId) query = query.eq('branch_id', options.branchId);
  query = query.order('created_at', { ascending: false }).limit(options?.limit || 50);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, customer_name: r.customers?.name, cashier_name: r.users?.full_name,
    branch_name: r.branches?.name_ar, items_count: r.sale_items?.length || 0
  })) as Sale[];
}

export async function getSale(tenantId: string, saleId: string): Promise<(Sale & { items: SaleItem[] }) | undefined> {
  const supabase = getSupabase();
  const { data: sale } = await supabase.from('sales').select(`
    *, customers(name, phone), users(full_name), branches(name_en, name_ar, address, phone)
  `).eq('tenant_id', tenantId).eq('id', saleId).single();

  if (!sale) return undefined;

  const { data: items } = await supabase.from('sale_items').select('*, products(name_en, name_ar, sku)').eq('sale_id', saleId);

  return {
    ...sale,
    customer_name: (sale as any).customers?.name,
    customer_phone: (sale as any).customers?.phone,
    cashier_name: (sale as any).users?.full_name,
    branch_name_en: (sale as any).branches?.name_en,
    branch_name_ar: (sale as any).branches?.name_ar,
    branch_address: (sale as any).branches?.address,
    branch_phone: (sale as any).branches?.phone,
    items: (items || []).map((si: any) => ({
      ...si, product_name_en: si.products?.name_en,
      product_name_ar: si.products?.name_ar, sku: si.products?.sku
    })) as SaleItem[]
  } as Sale & { items: SaleItem[] };
}

export async function processSaleReturn(tenantId: string, data: {
  saleId: string; refundAmount: number; refundMethod: string; restock: boolean;
  reason: string; createdBy: string;
  items?: { product_id: string; quantity: number; unit_price: number; cost_price: number }[];
}) {
  const supabase = getSupabase();
  const sale = await getSale(tenantId, data.saleId);
  if (!sale) throw new Error('Sale not found');

  const returnId = `ret_${Date.now()}`;
  const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

  await supabase.from('sale_returns').insert({
    id: returnId, tenant_id: tenantId, branch_id: sale.branch_id,
    sale_id: data.saleId, return_number: returnNumber,
    refund_amount: data.refundAmount, refund_method: data.refundMethod,
    restock: data.restock ? 1 : 0, reason: data.reason, created_by: data.createdBy
  }).throwOnError();

  if (data.restock && data.items) {
    for (const item of data.items) {
      const { data: ib } = await supabase.from('inventory_balances').select('quantity').eq('branch_id', sale.branch_id).eq('product_id', item.product_id).single();
      if (ib) {
        await supabase.from('inventory_balances').update({ quantity: (ib.quantity || 0) + item.quantity, last_updated: new Date().toISOString() }).eq('branch_id', sale.branch_id).eq('product_id', item.product_id);
      }
      await supabase.from('inventory_movements').insert({
        id: uid('mov'), tenant_id: tenantId, branch_id: sale.branch_id,
        product_id: item.product_id, movement_type: 'return',
        quantity: item.quantity, unit_cost: item.cost_price,
        reference_type: 'sale_return', reference_id: returnNumber,
        notes: `Return: ${data.reason}`, created_by: data.createdBy
      });
    }
  }

  await supabase.from('sales').update({ status: 'returned' }).eq('id', data.saleId);
  return { success: true, returnId, returnNumber };
}

// ============================================================================
// SUPPLIERS & PURCHASING
// ============================================================================

export async function getSuppliers(tenantId: string): Promise<Supplier[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId).order('name');
  return (data || []) as Supplier[];
}

export async function createSupplier(tenantId: string, data: {
  code: string; name: string; contact_person?: string; phone: string;
  email?: string; tax_id?: string; payment_terms?: string; opening_balance?: number;
}): Promise<Supplier> {
  const supabase = getSupabase();
  const id = uid('sup');
  const { data: supplier, error } = await supabase.from('suppliers').insert({
    id, tenant_id: tenantId, code: data.code.toUpperCase(), name: data.name,
    contact_person: data.contact_person || null, phone: data.phone,
    email: data.email || null, tax_id: data.tax_id || null,
    payment_terms: data.payment_terms || '30 Days Net',
    opening_balance: data.opening_balance || 0, current_balance: data.opening_balance || 0
  }).select().single();
  if (error) throw new Error(error.message);
  return supplier as Supplier;
}

export async function getPurchaseOrders(tenantId: string, branchId?: string): Promise<PurchaseOrder[]> {
  const supabase = getSupabase();
  let query = supabase.from('purchase_orders').select('*, suppliers(name), branches(name_ar), purchase_order_items(*)').eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  query = query.order('created_at', { ascending: false });
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, supplier_name: r.suppliers?.name, branch_name: r.branches?.name_ar, items: r.purchase_order_items || []
  })) as PurchaseOrder[];
}

export async function createPurchaseOrder(tenantId: string, data: {
  branch_id: string; supplier_id: string; notes?: string; created_by: string;
  items: { product_id: string; quantity_ordered: number; unit_cost: number }[];
}): Promise<PurchaseOrder> {
  const supabase = getSupabase();
  const id = uid('po');
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;
  const totalAmount = data.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);

  await supabase.from('purchase_orders').insert({
    id, tenant_id: tenantId, branch_id: data.branch_id, supplier_id: data.supplier_id,
    po_number: poNumber, status: 'draft', total_amount: totalAmount,
    notes: data.notes || null, created_by: data.created_by
  }).throwOnError();

  await supabase.from('purchase_order_items').insert(
    data.items.map(item => ({
      id: uid('poi'), po_id: id, product_id: item.product_id,
      quantity_ordered: item.quantity_ordered, unit_cost: item.unit_cost,
      quantity_received: 0
    }))
  ).throwOnError();

  const { data: po } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
  return po as PurchaseOrder;
}

export async function receivePurchaseOrderGoods(tenantId: string, poId: string, receivedBy: string) {
  const supabase = getSupabase();
  const { data: po } = await supabase.from('purchase_orders').select('*, purchase_order_items(*)').eq('id', poId).single();
  if (!po) throw new Error('PO not found');

  for (const item of (po as any).purchase_order_items || []) {
    const { data: ib } = await supabase.from('inventory_balances').select('quantity, avg_cost').eq('branch_id', po.branch_id).eq('product_id', item.product_id).single();
    
    if (ib) {
      const newQty = (ib.quantity || 0) + item.quantity_ordered;
      const newAvgCost = ((ib.quantity || 0) * (ib.avg_cost || 0) + item.quantity_ordered * item.unit_cost) / newQty;
      await supabase.from('inventory_balances').update({ quantity: newQty, avg_cost: newAvgCost, last_updated: new Date().toISOString() }).eq('branch_id', po.branch_id).eq('product_id', item.product_id);
    } else {
      await supabase.from('inventory_balances').insert({
        id: uid('ib'), tenant_id: tenantId, branch_id: po.branch_id,
        product_id: item.product_id, quantity: item.quantity_ordered,
        avg_cost: item.unit_cost, reserved_qty: 0
      });
    }

    await supabase.from('inventory_movements').insert({
      id: uid('mov'), tenant_id: tenantId, branch_id: po.branch_id,
      product_id: item.product_id, movement_type: 'purchase',
      quantity: item.quantity_ordered, unit_cost: item.unit_cost,
      reference_type: 'purchase_order', reference_id: po.po_number,
      notes: 'Goods received', created_by: receivedBy
    });

    await supabase.from('purchase_order_items').update({ quantity_received: item.quantity_ordered }).eq('id', item.id);
  }

  await supabase.from('purchase_orders').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', poId);
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export async function getCustomers(tenantId: string): Promise<Customer[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenantId).order('name');
  return (data || []) as Customer[];
}

export async function createCustomer(tenantId: string, data: {
  code: string; name: string; phone: string; email?: string;
  address?: string; tax_id?: string; credit_limit?: number;
}): Promise<Customer> {
  const supabase = getSupabase();
  const id = uid('cust');
  const { data: customer, error } = await supabase.from('customers').insert({
    id, tenant_id: tenantId, code: data.code, name: data.name, phone: data.phone,
    email: data.email || null, address: data.address || null,
    tax_id: data.tax_id || null, credit_limit: data.credit_limit || 1000.0,
    current_balance: 0.0, loyalty_points: 0
  }).select().single();
  if (error) throw new Error(error.message);
  return customer as Customer;
}

// ============================================================================
// EXPENSES & ACCOUNTING
// ============================================================================

export async function getExpenses(tenantId: string, branchId?: string): Promise<Expense[]> {
  const supabase = getSupabase();
  let query = supabase.from('expenses').select('*, branches(name_ar)').eq('tenant_id', tenantId);
  if (branchId) query = query.eq('branch_id', branchId);
  query = query.order('created_at', { ascending: false });
  const { data } = await query;
  return (data || []).map((r: any) => ({ ...r, branch_name: r.branches?.name_ar })) as Expense[];
}

export async function createExpense(tenantId: string, data: {
  branch_id: string; category: string; amount: number;
  payment_source: 'cash_drawer' | 'bank_account' | 'petty_cash';
  payee?: string; description: string; created_by: string;
}): Promise<Expense> {
  const supabase = getSupabase();
  const id = `exp_${Date.now()}`;

  const { error } = await supabase.from('expenses').insert({
    id, tenant_id: tenantId, branch_id: data.branch_id,
    category: data.category, amount: data.amount,
    payment_source: data.payment_source, payee: data.payee || null,
    description: data.description, created_by: data.created_by
  });
  if (error) throw new Error(error.message);

  // Register in cash session if cash drawer
  if (data.payment_source === 'cash_drawer') {
    const { data: activeSession } = await supabase.from('cash_sessions')
      .select('id').eq('tenant_id', tenantId).eq('branch_id', data.branch_id).eq('status', 'open').limit(1).single();
    if (activeSession) {
      await supabase.from('cash_movements').insert({
        id: `cm_${Date.now()}`, session_id: activeSession.id,
        type: 'expense', amount: data.amount,
        reason: `${data.category}: ${data.description}`, created_by: data.created_by
      });
    }
  }

  // Journal entry
  const journalId = `je_${Date.now()}`;
  await supabase.from('journal_entries').insert({
    id: journalId, tenant_id: tenantId, branch_id: data.branch_id,
    entry_number: `JE-EXP-${Date.now().toString().slice(-6)}`,
    entry_date: new Date().toISOString().split('T')[0],
    description: `Operating Expense: ${data.category}`,
    reference_type: 'expense', reference_id: id
  });
  const creditAccount = data.payment_source === 'bank_account' ? '1020' : '1010';
  await supabase.from('journal_lines').insert([
    { id: `jl_${Date.now()}_1`, entry_id: journalId, account_code: '6010', debit: data.amount, credit: 0 },
    { id: `jl_${Date.now()}_2`, entry_id: journalId, account_code: creditAccount, debit: 0, credit: data.amount }
  ]);

  const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single();
  return expense as Expense;
}

export async function getChartOfAccounts(tenantId: string): Promise<Account[]> {
  const supabase = getSupabase();
  const { data } = await supabase.from('chart_of_accounts').select('*').eq('tenant_id', tenantId).order('account_code');
  return (data || []) as Account[];
}

export async function getJournalEntries(tenantId: string): Promise<JournalEntry[]> {
  const supabase = getSupabase();
  const { data: entries } = await supabase.from('journal_entries').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
  if (!entries) return [];

  const result: JournalEntry[] = [];
  for (const entry of entries) {
    const { data: lines } = await supabase.from('journal_lines')
      .select('*, chart_of_accounts!journal_lines_account_code_fkey(account_name_en, account_name_ar)')
      .eq('entry_id', entry.id);
    result.push({
      ...entry,
      lines: (lines || []).map((l: any) => ({
        ...l, account_name_en: l.chart_of_accounts?.account_name_en,
        account_name_ar: l.chart_of_accounts?.account_name_ar
      }))
    } as JournalEntry);
  }
  return result;
}

// ============================================================================
// DASHBOARD ANALYTICS
// ============================================================================

export async function getMerchantDashboardKpis(tenantId: string, branchId?: string) {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  let salesQuery = supabase.from('sales').select('total_amount, subtotal, discount_amount, tax_amount').eq('tenant_id', tenantId).eq('status', 'completed');
  let salesTodayQuery = supabase.from('sales').select('total_amount, subtotal, discount_amount, tax_amount').eq('tenant_id', tenantId).eq('status', 'completed').gte('created_at', `${today}T00:00:00`).lte('created_at', `${today}T23:59:59`);
  let expensesQuery = supabase.from('expenses').select('amount').eq('tenant_id', tenantId);
  let inventoryQuery = supabase.from('inventory_balances').select('quantity, avg_cost').eq('tenant_id', tenantId);

  if (branchId) {
    salesQuery = salesQuery.eq('branch_id', branchId);
    salesTodayQuery = salesTodayQuery.eq('branch_id', branchId);
    expensesQuery = expensesQuery.eq('branch_id', branchId);
    inventoryQuery = inventoryQuery.eq('branch_id', branchId);
  }

  const [salesRes, salesTodayRes, expensesRes, inventoryRes, topProductsRes, lowStockRes] = await Promise.all([
    salesQuery,
    salesTodayQuery,
    expensesQuery,
    inventoryQuery,
    supabase.from('sale_items').select('quantity, line_total, cost_price, product_id, products(name_en, name_ar, sku), sales!inner(tenant_id, branch_id, status)')
      .eq('sales.tenant_id', tenantId).eq('sales.status', 'completed'),
    supabase.from('inventory_balances')
      .select('quantity, products!inner(min_stock_alert)')
      .eq('tenant_id', tenantId),
  ]);

  const sales = salesRes.data || [];
  const salesToday = salesTodayRes.data || [];
  const expenses = expensesRes.data || [];
  const inventory = inventoryRes.data || [];

  const grossSales = sales.reduce((s: number, r: any) => s + (r.subtotal || 0), 0);
  const totalDiscounts = sales.reduce((s: number, r: any) => s + (r.discount_amount || 0), 0);
  const netSales = grossSales - totalDiscounts;
  const salesTodayTotal = salesToday.reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
  const operatingExpenses = expenses.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const inventoryValuation = inventory.reduce((s: number, r: any) => s + (r.quantity || 0) * (r.avg_cost || 0), 0);
  const inventoryUnits = inventory.reduce((s: number, r: any) => s + (r.quantity || 0), 0);

  // Top products
  const productMap = new Map<string, any>();
  for (const si of topProductsRes.data || []) {
    const pid = si.product_id;
    if (!productMap.has(pid)) productMap.set(pid, { name_en: (si as any).products?.name_en, name_ar: (si as any).products?.name_ar, sku: (si as any).products?.sku, total_sold: 0, revenue: 0 });
    const p = productMap.get(pid);
    p.total_sold += si.quantity;
    p.revenue += (si as any).line_total || 0;
  }
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.total_sold - a.total_sold).slice(0, 5);

  const lowStockCount = (lowStockRes.data || []).filter((r: any) => r.quantity <= (r.products?.min_stock_alert || 5)).length;

  const cogs = 0; // Would need join through sale_items
  const grossProfit = netSales - cogs;
  const grossMarginPct = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';
  const netOperatingProfit = grossProfit - operatingExpenses;

  return {
    salesToday: salesTodayTotal, transactionsToday: salesToday.length,
    grossSales, netSales, cogs, grossProfit, grossMarginPct,
    operatingExpenses, netOperatingProfit,
    inventoryValuation, inventoryUnits,
    nearExpiryCount: 0, lowStockCount, topProducts
  };
}

// ============================================================================
// NOTIFICATIONS & AUDIT
// ============================================================================

export async function getNotifications(tenantId: string, branchId?: string): Promise<Notification[]> {
  const supabase = getSupabase();
  let query = supabase.from('notifications').select('*').eq('tenant_id', tenantId);
  if (branchId) query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  query = query.order('created_at', { ascending: false }).limit(20);
  const { data } = await query;
  return (data || []) as Notification[];
}

export async function markNotificationRead(id: string) {
  const supabase = getSupabase();
  await supabase.from('notifications').update({ is_read: 1 }).eq('id', id);
}

export async function getAuditLogs(tenantId?: string, limit: number = 50): Promise<AuditLog[]> {
  const supabase = getSupabase();
  let query = supabase.from('audit_logs').select('*, users(full_name), tenants(name)').order('created_at', { ascending: false }).limit(limit);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    ...r, user_name: r.users?.full_name, tenant_name: r.tenants?.name
  })) as AuditLog[];
}

export async function getTenantSettings(tenantId: string) {
  const supabase = getSupabase();
  const [tenantRes, settingsRes] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single()
  ]);
  return { tenant: tenantRes.data, settings: settingsRes.data };
}

export async function updateTenantSettings(tenantId: string, data: {
  name?: string; phone?: string; email?: string; tax_id?: string; logo_url?: string;
  default_tax_rate?: number; vat_enabled?: number; receipt_header?: string;
  receipt_footer?: string; receipt_width?: '58mm' | '80mm'; scale_barcode_prefix?: string;
  valuation_method?: 'FIFO' | 'WAC'; expiry_warning_days?: number;
}) {
  const supabase = getSupabase();
  const tenantUpdates: any = {};
  if (data.name !== undefined) tenantUpdates.name = data.name;
  if (data.phone !== undefined) tenantUpdates.phone = data.phone;
  if (data.email !== undefined) tenantUpdates.email = data.email;
  if (data.tax_id !== undefined) tenantUpdates.tax_id = data.tax_id;
  if (data.logo_url !== undefined) tenantUpdates.logo_url = data.logo_url;

  if (Object.keys(tenantUpdates).length > 0) {
    tenantUpdates.updated_at = new Date().toISOString();
    await supabase.from('tenants').update(tenantUpdates).eq('id', tenantId);
  }

  const settingsUpdates: any = {};
  if (data.default_tax_rate !== undefined) settingsUpdates.default_tax_rate = data.default_tax_rate;
  if (data.vat_enabled !== undefined) settingsUpdates.vat_enabled = data.vat_enabled;
  if (data.receipt_header !== undefined) settingsUpdates.receipt_header = data.receipt_header;
  if (data.receipt_footer !== undefined) settingsUpdates.receipt_footer = data.receipt_footer;
  if (data.receipt_width !== undefined) settingsUpdates.receipt_width = data.receipt_width;
  if (data.scale_barcode_prefix !== undefined) settingsUpdates.scale_barcode_prefix = data.scale_barcode_prefix;
  if (data.valuation_method !== undefined) settingsUpdates.valuation_method = data.valuation_method;
  if (data.expiry_warning_days !== undefined) settingsUpdates.expiry_warning_days = data.expiry_warning_days;

  if (Object.keys(settingsUpdates).length > 0) {
    await supabase.from('tenant_settings').update(settingsUpdates).eq('tenant_id', tenantId);
  }

  return getTenantSettings(tenantId);
}

export async function getEmployees(tenantId: string, branchId?: string) {
  return getUsers(tenantId, branchId);
}
