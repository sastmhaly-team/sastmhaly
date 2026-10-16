'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { PurchaseOrder, Supplier, Product, Branch } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Truck, Plus, Search, Filter, Download, 
  CheckCircle, Clock, PackageCheck, AlertCircle, Trash2
} from 'lucide-react';

export default function PurchasingManagementPage() {
  const { user, activeBranchId } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';
  const effectiveBranchId = activeBranchId && activeBranchId !== 'all' ? activeBranchId : user?.branch_id;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, statusFilter]);

  // Create PO Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(effectiveBranchId || '');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<{ productId: string; quantity: number; unitCost: number }[]>([]);
  const [submittingPo, setSubmittingPo] = useState(false);

  // Receiving status
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const poUrl = `/api/merchant/purchasing?tenantId=${tenantId}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`;
      const supUrl = `/api/merchant/suppliers?tenantId=${tenantId}`;
      const prodUrl = `/api/merchant/products?tenantId=${tenantId}`;
      const brUrl = `/api/merchant/branches?tenantId=${tenantId}`;

      const cachedPo = getCachedData<any>(poUrl);
      if (cachedPo?.purchaseOrders) {
        setOrders(cachedPo.purchaseOrders);
        setLoading(false);
      } else if (orders.length === 0) {
        setLoading(true);
      }

      const cachedSup = getCachedData<any>(supUrl);
      if (cachedSup?.suppliers) setSuppliers(cachedSup.suppliers);

      const cachedProd = getCachedData<any>(prodUrl);
      if (cachedProd?.products) setProducts(cachedProd.products);

      const cachedBr = getCachedData<any>(brUrl);
      if (cachedBr?.branches) {
        setBranches(cachedBr.branches);
        if (!selectedBranch && cachedBr.branches.length > 0) {
          setSelectedBranch(effectiveBranchId || cachedBr.branches[0].id);
        }
      }

      await Promise.all([
        fetchWithCache<any>(poUrl, (data) => {
          if (data.purchaseOrders) setOrders(data.purchaseOrders);
          setLoading(false);
        }),
        fetchWithCache<any>(supUrl, (data) => {
          if (data.suppliers) setSuppliers(data.suppliers);
        }),
        fetchWithCache<any>(prodUrl, (data) => {
          if (data.products) setProducts(data.products);
        }),
        fetchWithCache<any>(brUrl, (data) => {
          if (data.branches) {
            setBranches(data.branches);
            if (!selectedBranch && data.branches.length > 0) {
              setSelectedBranch(effectiveBranchId || data.branches[0].id);
            }
          }
        })
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, effectiveBranchId]);

  const handleAddItemLine = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setPoItems(prev => [...prev, { productId: firstProd.id, quantity: 10, unitCost: firstProd.cost_price }]);
  };

  const handleUpdateItemLine = (index: number, field: string, value: any) => {
    setPoItems(prev => {
      const copy = [...prev];
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        copy[index] = { ...copy[index], productId: value, unitCost: prod ? prod.cost_price : copy[index].unitCost };
      } else {
        copy[index] = { ...copy[index], [field]: Number(value) };
      }
      return copy;
    });
  };

  const handleRemoveItemLine = (index: number) => {
    setPoItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || poItems.length === 0) {
      alert(isRtl ? 'يرجى اختيار المورد وإضافة بند واحد على الأقل' : 'Please select supplier and add at least one item');
      return;
    }

    setSubmittingPo(true);
    try {
      const res = await fetch('/api/merchant/purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          branch_id: selectedBranch || branches[0]?.id,
          supplier_id: selectedSupplier,
          items: poItems.map(i => ({
            product_id: i.productId,
            quantity: i.quantity,
            quantity_ordered: i.quantity,
            unit_cost: i.unitCost
          })),
          notes: poNotes,
          created_by: user?.id || 'admin'
        })
      });

      const data = await res.json();
      if (data.success) {
        setCreateModalOpen(false);
        setPoItems([]);
        setPoNotes('');
        fetchData();
      } else {
        alert(data.error || 'Failed to create PO');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving purchase order');
    } finally {
      setSubmittingPo(false);
    }
  };

  const handleReceiveGoods = async (poId: string) => {
    if (!confirm(isRtl ? 'تأكيد استلام بضاعة أمر الشراء وزيادة المخزون في الفرع؟' : 'Confirm receiving goods and updating branch inventory?')) return;
    setReceivingPoId(poId);
    try {
      const res = await fetch('/api/merchant/purchasing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          tenant_id: tenantId,
          poId,
          receivedBy: user?.id || 'admin'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to receive goods');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReceivingPoId(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.supplier_name && o.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      const poDate = o.created_at ? o.created_at.split('T')[0] : '';
      if (startDate && poDate < startDate) return false;
      if (endDate && poDate > endDate) return false;
      return true;
    })();
    return matchesSearch && matchesStatus && matchesDate;
  });

  const purchasingExportHeaders = [
    { key: 'po_number', labelEn: 'PO Number', labelAr: 'رقم أمر الشراء' },
    { key: 'supplier_name', labelEn: 'Supplier', labelAr: 'المورد' },
    { key: 'branch_name', labelEn: 'Branch', labelAr: 'الفرع' },
    { key: 'total_amount', labelEn: 'Total Amount (EGP)', labelAr: 'الإجمالي (ج.م)' },
    { key: 'status', labelEn: 'Status', labelAr: 'الحالة' },
    { key: 'created_at', labelEn: 'Date', labelAr: 'التاريخ' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'المشتريات وأوامر التوريد' : 'Purchasing & Procurement'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'إنشاء أوامر الشراء، استلام البضائع، وتحديث ديون الموردين ومخزون الفروع تلقائياً (Scenario E)'
              : 'Create purchase orders, receive incoming goods, and update inventory & AP balances'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            filename="Purchase_Orders"
            data={orders}
            headers={purchasingExportHeaders}
            label={isRtl ? 'تصدير (CSV)' : 'Export CSV'}
          />

          <button
            onClick={() => {
              handleAddItemLine();
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إنشاء أمر شراء جديد' : 'New Purchase Order'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث برقم أمر الشراء أو اسم المورد...' : 'Search by PO number or supplier name...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs text-[#172033] outline-none"
        >
          <option value="all">{isRtl ? 'جميع الحالات' : 'All Statuses'}</option>
          <option value="ordered">{isRtl ? 'تم الطلب (بانتظار الاستلام)' : 'Ordered (Pending)'}</option>
          <option value="received">{isRtl ? 'تم الاستلام وإضافة الرصيد' : 'Received'}</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل أوامر الشراء...' : 'Loading purchase orders...'}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Truck className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
            <p className="text-sm font-semibold text-[#172033]">
              {isRtl ? 'لا توجد أوامر شراء مسجلة' : 'No purchase orders found'}
            </p>
            <p className="text-xs text-[#687386]">
              {isRtl ? 'اضغط على "إنشاء أمر شراء جديد" لإصدار طلب توريد' : 'Click "New Purchase Order" to issue an order'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'رقم الأمر' : 'PO #'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'المورد' : 'Supplier'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'فرع الاستلام' : 'Receiving Branch'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الإجمالي' : 'Total'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredOrders.slice(0, visibleCount).map((po) => (
                  <tr key={po.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#0B1730]">
                      {po.po_number}
                    </td>
                    <td className="py-3 px-4 text-[#172033] font-medium">
                      {po.supplier_name}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {po.branch_name || 'الفرع الرئيسي'}
                    </td>
                    <td className="py-3 px-4 font-black text-[#0B1730]">
                      {po.total_amount.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {new Date(po.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {po.status === 'received' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          <span>{isRtl ? 'مستلم بالمخزن' : 'Received'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[#246BFD] border border-blue-200">
                          <Clock className="w-3 h-3" />
                          <span>{isRtl ? 'بانتظار الاستلام' : 'Ordered'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-end">
                      {po.status === 'ordered' && (
                        <button
                          onClick={() => handleReceiveGoods(po.id)}
                          disabled={receivingPoId === po.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>{receivingPoId === po.id ? (isRtl ? 'جاري الاستلام...' : 'Receiving...') : (isRtl ? 'استلام البضاعة' : 'Receive Goods')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCount < filteredOrders.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isRtl ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filteredOrders.length - visibleCount})` : `Load More (+20 items - ${filteredOrders.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={isRtl ? 'إنشاء أمر شراء وتوريد جديد' : 'New Purchase Order'}
        size="lg"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المورد *' : 'Supplier *'}
              </label>
              <select
                required
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="">{isRtl ? '-- اختر المورد --' : '-- Select Supplier --'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'فرع الاستلام *' : 'Destination Branch *'}
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{isRtl ? b.name_ar : b.name_en} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0B1730]">{isRtl ? 'أصناف التوريد' : 'Order Items'}</span>
              <button
                type="button"
                onClick={handleAddItemLine}
                className="inline-flex items-center gap-1 text-[#246BFD] hover:underline text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRtl ? 'إضافة بند' : 'Add Item'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
              {poItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-[#F7F9FC] rounded-lg border border-[#E5EAF2]">
                  <select
                    value={item.productId}
                    onChange={(e) => handleUpdateItemLine(index, 'productId', e.target.value)}
                    className="flex-1 p-2 bg-white border border-[#E5EAF2] rounded text-xs outline-none"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {isRtl ? p.name_ar : p.name_en} ({p.sku})
                      </option>
                    ))}
                  </select>

                  <div className="w-24">
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItemLine(index, 'quantity', e.target.value)}
                      placeholder={isRtl ? 'الكمية' : 'Qty'}
                      className="w-full p-2 bg-white border border-[#E5EAF2] rounded text-xs text-center outline-none"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={item.unitCost}
                      onChange={(e) => handleUpdateItemLine(index, 'unitCost', e.target.value)}
                      placeholder={isRtl ? 'سعر التكلفة' : 'Cost'}
                      className="w-full p-2 bg-white border border-[#E5EAF2] rounded text-xs text-center outline-none"
                    />
                  </div>

                  <div className="w-24 text-end font-black text-[#0B1730] text-xs">
                    {(item.quantity * item.unitCost).toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItemLine(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center p-3 bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg font-bold">
              <span>{isRtl ? 'إجمالي أمر الشراء التقديري:' : 'Total Estimated Cost:'}</span>
              <span className="text-sm text-[#246BFD]">
                {poItems.reduce((acc, i) => acc + (i.quantity * i.unitCost), 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'ملاحظات أمر الشراء' : 'Order Notes'}
            </label>
            <input
              type="text"
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder={isRtl ? 'مثال: توريد دفعة الصباح، تسليم مخزن رقم 2...' : 'Optional notes...'}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submittingPo}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submittingPo ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'اعتماد أمر الشراء' : 'Save Purchase Order')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
