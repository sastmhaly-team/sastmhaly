'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { InventoryBalance, InventoryMovement, Product } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { 
  Layers, Search, Plus, Filter, ArrowUpRight, ArrowDownRight, 
  History, AlertTriangle, ShieldCheck, CheckCircle2
} from 'lucide-react';

export default function MerchantInventoryPage() {
  const { tenant, activeBranchId, branches } = useAuth();
  const { lang, t } = useLanguage();

  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'balances' | 'movements'>('balances');
  const [search, setSearch] = useState('');

  // Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjData, setAdjData] = useState({
    product_id: '',
    branch_id: activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || ''),
    adjustment_type: 'adjustment',
    quantity: 0,
    notes: '',
  });

  // Keep branch in sync
  useEffect(() => {
    if (branches && branches.length > 0) {
      setAdjData(prev => {
        const curBranchValid = branches.some(b => b.id === prev.branch_id);
        if (!curBranchValid) {
          const fallback = activeBranchId !== 'all' ? activeBranchId : branches[0].id;
          return { ...prev, branch_id: fallback };
        }
        return prev;
      });
    }
  }, [branches, activeBranchId]);

  const fetchInventory = async () => {
    if (!tenant) return;
    try {
      setLoading(true);
      const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
      const res = await fetch(`/api/merchant/inventory?tenantId=${tenant.id}${branchParam}`);
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances || []);
        setMovements(data.movements || []);
      }

      // Also fetch products for dropdown
      const prodRes = await fetch(`/api/merchant/products?tenantId=${tenant.id}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
        if (prodData.products?.length > 0 && !adjData.product_id) {
          setAdjData(a => ({ ...a, product_id: prodData.products[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [tenant, activeBranchId]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    if (!adjData.product_id) {
      alert(lang === 'ar' ? 'يرجى اختيار الصنف' : 'Please select a product');
      return;
    }

    try {
      const res = await fetch('/api/merchant/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          ...adjData,
        }),
      });

      if (res.ok) {
        setIsAdjustOpen(false);
        fetchInventory();
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'ar' ? 'فشل تعديل المخزون' : 'Failed to adjust stock'));
      }
    } catch {
      alert(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Error updating stock');
    }
  };

  const filteredBalances = balances.filter(b => 
    (b.product_name_en && b.product_name_en.toLowerCase().includes(search.toLowerCase())) ||
    (b.product_name_ar && b.product_name_ar.includes(search)) ||
    (b.sku && b.sku.toLowerCase().includes(search.toLowerCase())) ||
    (b.barcode && b.barcode.includes(search))
  );

  const balanceColumns = [
    { header: 'SKU', key: 'sku' as const },
    { header: 'Product Name (EN)', key: 'product_name_en' as const },
    { header: 'Product Name (AR)', key: 'product_name_ar' as const },
    { header: 'Stock on Hand', key: 'quantity' as const },
    { header: 'Unit Cost', key: 'avg_cost' as const },
    { header: 'Valuation', key: (r: InventoryBalance) => (r.quantity * r.avg_cost).toFixed(2) },
    { header: 'Last Updated', key: 'last_updated' as const },
  ];

  const movementColumns = [
    { header: 'Date', key: 'created_at' as const },
    { header: 'Product', key: 'product_name_en' as const },
    { header: 'Branch', key: 'branch_name_en' as const },
    { header: 'Movement Type', key: 'movement_type' as const },
    { header: 'Quantity Change', key: 'quantity' as const },
    { header: 'Unit Cost', key: 'unit_cost' as const },
    { header: 'Ref Type', key: 'reference_type' as const },
    { header: 'Reference ID', key: 'reference_id' as const },
    { header: 'Notes', key: 'notes' as const },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'إدارة المخزون وحركة الأصناف' : 'Inventory & Auditable Stock Control'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'الأرصدة الفعلية بالفروع، التقييم المالي، ودفتر تدقيق الحركات غير القابل للتلاعب' 
              : 'Real-time stock on hand, weighted average valuation, and immutable movement ledger'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'balances' ? (
            <ExportButton
              filename="sastmhaly_inventory_balances"
              data={filteredBalances}
              columns={balanceColumns}
            />
          ) : (
            <ExportButton
              filename="sastmhaly_inventory_movements"
              data={movements}
              columns={movementColumns}
            />
          )}

          <button
            onClick={() => setIsAdjustOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('inv_adjust_stock')}</span>
          </button>
        </div>
      </div>

      {/* Tabs: Balances vs Movements Ledger */}
      <div className="flex items-center gap-2 border-b border-[#E5EAF2]">
        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'balances' 
              ? 'border-[#246BFD] text-[#246BFD]' 
              : 'border-transparent text-[#687386] hover:text-[#0B1730]'
          }`}
        >
          {lang === 'ar' ? 'أرصدة المخزون بالفروع' : 'Stock Balances & Valuation'}
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'movements' 
              ? 'border-[#246BFD] text-[#246BFD]' 
              : 'border-transparent text-[#687386] hover:text-[#0B1730]'
          }`}
        >
          {t('inv_movement_ledger')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] flex items-center justify-between shadow-2xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث في المخزون والأصناف...' : 'Search product, barcode, SKU...'}
            className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] text-xs text-[#172033] focus:bg-white focus:border-[#246BFD] focus:outline-none pl-9 rtl:pl-3 rtl:pr-9"
          />
          <Search className="w-4 h-4 text-[#687386] absolute left-3 rtl:left-auto rtl:right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Main Table */}
      {activeTab === 'balances' ? (
        <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">#</th>
                  <th className="px-4 py-3.5">{t('inv_product_name')}</th>
                  <th className="px-4 py-3.5">{t('inv_sku')}</th>
                  <th className="px-4 py-3.5 text-center">{t('inv_stock_on_hand')}</th>
                  <th className="px-4 py-3.5 text-right rtl:text-left">{t('inv_avg_cost')}</th>
                  <th className="px-4 py-3.5 text-right rtl:text-left">{t('inv_valuation')}</th>
                  <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'آخر تحديث' : 'Updated'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#687386]">{t('loading')}</td>
                  </tr>
                ) : filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#687386]">{t('no_records')}</td>
                  </tr>
                ) : (
                  filteredBalances.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-[#F7F9FC] transition-colors">
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-[#0B1730]">
                        {lang === 'ar' ? b.product_name_ar : b.product_name_en}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{b.sku}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-bold text-sm text-[#0B1730] font-mono">
                          {b.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono text-[#687386]">
                        {b.avg_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono font-bold text-[#246BFD]">
                        {(b.quantity * b.avg_cost).toLocaleString()} {t('currency')}
                      </td>
                      <td className="px-4 py-3.5 text-center text-[11px] text-[#687386]">
                        {b.last_updated}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movements Ledger Table */
        <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">{t('date')}</th>
                  <th className="px-4 py-3.5">{t('inv_product_name')}</th>
                  <th className="px-4 py-3.5">{lang === 'ar' ? 'الفرع' : 'Branch'}</th>
                  <th className="px-4 py-3.5">{lang === 'ar' ? 'نوع الحركة' : 'Movement Type'}</th>
                  <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'التغير في الكمية' : 'Qty Delta'}</th>
                  <th className="px-4 py-3.5">{lang === 'ar' ? 'المستند المرجعي' : 'Reference Doc'}</th>
                  <th className="px-4 py-3.5">{t('notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {movements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="hover:bg-[#F7F9FC]">
                      <td className="px-4 py-3.5 font-mono text-[#687386] text-[11px]">{m.created_at}</td>
                      <td className="px-4 py-3.5 font-bold text-[#0B1730]">
                        {lang === 'ar' ? m.product_name_ar : m.product_name_en}
                      </td>
                      <td className="px-4 py-3.5 text-[#687386]">{m.branch_name_en}</td>
                      <td className="px-4 py-3.5 font-bold capitalize text-[#0B1730]">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-[#172033] font-mono text-[10px]">
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold">
                        <span className={isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#246BFD]">
                        {m.reference_id}
                      </td>
                      <td className="px-4 py-3.5 text-[#687386] text-[11px]">
                        {m.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title={lang === 'ar' ? 'تسوية مخزنية (جرد / تلف / تصحيح)' : 'Stock Adjustment & Reconciliation'}
        maxWidth="md"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#172033] mb-1">{lang === 'ar' ? 'الفرع *' : 'Branch *'}</label>
            <select
              value={adjData.branch_id}
              onChange={(e) => setAdjData({ ...adjData, branch_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.code} - {lang === 'ar' ? b.name_ar : b.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Product *</label>
            <select
              value={adjData.product_id}
              onChange={(e) => setAdjData({ ...adjData, product_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {lang === 'ar' ? p.name_ar : p.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Adjustment Reason *</label>
            <select
              value={adjData.adjustment_type}
              onChange={(e) => setAdjData({ ...adjData, adjustment_type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
            >
              <option value="adjustment">Physical Inventory Count Correction (تسوية جرد)</option>
              <option value="damage">Damaged Goods Write-off (إتلاف بضاعة تالفة)</option>
              <option value="expiry">Expired Stock Disposal (إعدام منتهي الصلاحية)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Quantity Change (Use + to add, - to deduct) *</label>
            <input
              type="number"
              required
              step="1"
              value={adjData.quantity}
              onChange={(e) => setAdjData({ ...adjData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono font-bold focus:border-[#246BFD] focus:outline-none"
              placeholder="-5 or +10"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Reason / Notes *</label>
            <textarea
              required
              rows={2}
              value={adjData.notes}
              onChange={(e) => setAdjData({ ...adjData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              placeholder="Physical recount revealed 5 units broken in transport."
            />
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdjustOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#246BFD] text-white font-bold"
            >
              Post Adjustment
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
