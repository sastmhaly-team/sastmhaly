'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { StockTransfer, Product, Branch } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { ArrowLeftRight, Plus, CheckCircle2, Truck, Clock, ShieldCheck } from 'lucide-react';

export default function MerchantTransfersPage() {
  const { tenant, branches } = useAuth();
  const { lang, t } = useLanguage();
  const confirm = useConfirm();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  // New transfer modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState(branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState(branches[1]?.id || branches[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [transferQty, setTransferQty] = useState(10);
  const [notes, setNotes] = useState('');

  // Keep branch selects synced with available branches
  useEffect(() => {
    if (branches && branches.length > 0) {
      if (!fromBranchId || !branches.some(b => b.id === fromBranchId)) {
        setFromBranchId(branches[0].id);
      }
      if (!toBranchId || !branches.some(b => b.id === toBranchId)) {
        setToBranchId(branches.length > 1 ? branches[1].id : branches[0].id);
      }
    }
  }, [branches, fromBranchId, toBranchId]);

  const fetchTransfers = async () => {
    if (!tenant) return;
    try {
      const transferUrl = `/api/merchant/transfers?tenantId=${tenant.id}`;
      const prodUrl = `/api/merchant/products?tenantId=${tenant.id}`;

      const cachedTransfers = getCachedData<any>(transferUrl);
      if (cachedTransfers?.transfers) {
        setTransfers(cachedTransfers.transfers);
        setLoading(false);
      } else if (transfers.length === 0) {
        setLoading(true);
      }

      const cachedProducts = getCachedData<any>(prodUrl);
      if (cachedProducts?.products) {
        setProducts(cachedProducts.products);
        if (cachedProducts.products.length > 0 && !selectedProductId) {
          setSelectedProductId(cachedProducts.products[0].id);
        }
      }

      await Promise.all([
        fetchWithCache<any>(transferUrl, (data) => {
          if (data.transfers) setTransfers(data.transfers);
          setLoading(false);
        }),
        fetchWithCache<any>(prodUrl, (prodData) => {
          if (prodData.products) {
            setProducts(prodData.products);
            if (prodData.products.length > 0 && !selectedProductId) {
              setSelectedProductId(prodData.products[0].id);
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
    fetchTransfers();
  }, [tenant]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    if (!selectedProductId) {
      alert(lang === 'ar' ? 'يرجى اختيار الصنف' : 'Please select a product');
      return;
    }

    if (fromBranchId === toBranchId && branches.length > 1) {
      alert(lang === 'ar' ? 'يجب اختيار فرعين مختلفين للتحويل' : 'Source and destination branches must be different.');
      return;
    }

    try {
      const res = await fetch('/api/merchant/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          notes,
          created_by: 'admin',
          items: [{ 
            product_id: selectedProductId, 
            quantity: transferQty,
            quantity_sent: transferQty
          }],
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchTransfers();
      } else {
        const err = await res.json();
        alert(err.error || (lang === 'ar' ? 'فشل إنشاء التحويل المخزني' : 'Failed to create stock transfer'));
      }
    } catch {
      alert(lang === 'ar' ? 'خطأ في الاتصال بالخادم' : 'Error creating transfer');
    }
  };

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleFinishTransfer = async (transferId: string) => {
    if (!tenant) return;
    const confirmMsg = lang === 'ar' 
      ? 'هل أنت متأكد من إنهاء التحويل وتأكيد نقل البضاعة فعلياً إلى رصيد الفرع المستلم؟' 
      : 'Are you sure you want to finish this transfer and transfer stock to the destination branch?';
    const ok = await confirm({
      title: lang === 'ar' ? 'تأكيد إنهاء التحويل' : 'Confirm Finish Transfer',
      message: confirmMsg,
      type: 'success',
      confirmText: lang === 'ar' ? 'نعم، إنهاء ونقل المخزون' : 'Finish & Move Stock'
    });
    if (!ok) return;

    try {
      setProcessingId(transferId);
      const res = await fetch('/api/merchant/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          action: 'finish',
          transferId,
          receivedBy: 'merchant_owner',
        }),
      });

      if (res.ok) {
        alert(lang === 'ar' ? 'تم إنهاء التحويل بنجاح وتم تحديث أرصدة المخزون للفرعين فوراً!' : 'Transfer finished and inventory successfully moved!');
        fetchTransfers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to finish transfer');
      }
    } catch {
      alert('Error confirming transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    if (!tenant) return;
    const confirmMsg = lang === 'ar' 
      ? 'هل أنت متأكد من إلغاء هذا التحويل؟' 
      : 'Are you sure you want to cancel this transfer?';
    const ok = await confirm({
      title: lang === 'ar' ? 'تأكيد إلغاء التحويل' : 'Cancel Transfer',
      message: confirmMsg,
      type: 'danger',
      confirmText: lang === 'ar' ? 'نعم، إلغاء التحويل' : 'Yes, Cancel'
    });
    if (!ok) return;

    try {
      setProcessingId(transferId);
      const res = await fetch('/api/merchant/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          action: 'cancel',
          transferId,
          receivedBy: 'merchant_owner',
        }),
      });

      if (res.ok) {
        alert(lang === 'ar' ? 'تم إلغاء التحويل.' : 'Transfer canceled.');
        fetchTransfers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to cancel transfer');
      }
    } catch {
      alert('Error canceling transfer');
    } finally {
      setProcessingId(null);
    }
  };

  const exportColumns = [
    { header: 'Transfer Number', key: 'transfer_number' as const },
    { header: 'From Branch', key: 'from_branch_name' as const },
    { header: 'To Branch', key: 'to_branch_name' as const },
    { header: 'Status', key: 'status' as const },
    { header: 'Created Date', key: 'created_at' as const },
    { header: 'Notes', key: 'notes' as const },
  ];

  const filteredTransfers = transfers.filter(tr => {
    if (!startDate && !endDate) return true;
    const trDate = tr.created_at ? tr.created_at.split('T')[0] : '';
    if (startDate && trDate < startDate) return false;
    if (endDate && trDate > endDate) return false;
    return true;
  });

  const visibleTransfers = filteredTransfers.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'التحويلات المخزنية بين الفروع' : 'Inter-Branch Stock Transfers'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'إنشاء طلبات التحويل، مراقبة البضاعة المنقولة (In Transit)، وتأكيد الاستلام بالمقصد مع نقل المخزون الفعلي' 
              : 'Transfer inventory between shops, track transit stages, and reconcile received stock with actual ledger updates'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportButton
            filename="sastmhaly_stock_transfers"
            data={filteredTransfers}
            columns={exportColumns}
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('inv_transfer_goods')}</span>
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

      {/* Transfers List Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'رقم التحويل' : 'Transfer #'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'من فرع (المصدر)' : 'Source Branch'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'إلى فرع (الوجهة)' : 'Destination Branch'}</th>
                <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'عدد الأصناف' : 'Items'}</th>
                <th className="px-4 py-3.5 text-center">{t('status')}</th>
                <th className="px-4 py-3.5">{t('date')}</th>
                <th className="px-4 py-3.5 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#687386]">{t('loading')}</td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#687386]">{t('no_records')}</td>
                </tr>
              ) : (
                visibleTransfers.map((trf, idx) => (
                  <tr key={trf.id} className="hover:bg-[#F7F9FC]">
                    <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-[#246BFD]">
                      {trf.transfer_number}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0B1730]">
                      {trf.from_branch_name}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0B1730]">
                      {trf.to_branch_name}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-[#0B1730]">
                      {trf.items?.length || trf.items_count || 1}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {trf.status === 'received' || trf.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'مكتمل وتم النقل' : 'Received & Done'}</span>
                        </span>
                      ) : trf.status === 'canceled' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]">
                          <span>{lang === 'ar' ? 'ملغي' : 'Canceled'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                          <Truck className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'قيد الشحن (In Transit)' : 'In Transit'}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[#687386] text-[11px] font-mono">
                      {new Date(trf.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {trf.status !== 'received' && trf.status !== 'completed' && trf.status !== 'canceled' && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleFinishTransfer(trf.id)}
                            disabled={processingId === trf.id}
                            className="px-2.5 py-1 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{processingId === trf.id ? t('loading') : (lang === 'ar' ? 'إنهاء واستلام' : 'Finish Transfer')}</span>
                          </button>
                          <button
                            onClick={() => handleCancelTransfer(trf.id)}
                            disabled={processingId === trf.id}
                            className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 text-[11px] font-semibold cursor-pointer"
                          >
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Pagination (20 by 20) */}
        {transfers.length > visibleCount && (
          <div className="p-3 border-t border-[#E5EAF2] bg-[#F7F9FC] flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-4 py-2 bg-white hover:bg-gray-100 border border-[#CBD5E1] text-[#0B1730] text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {lang === 'ar' 
                ? `عرض المزيد (تحميل 20 إضافية) • متبقي ${transfers.length - visibleCount}` 
                : `Load More (20 more) • ${transfers.length - visibleCount} remaining`}
            </button>
          </div>
        )}
      </div>

      {/* New Stock Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={lang === 'ar' ? 'تحويل بضاعة بين الفروع' : 'New Inter-Branch Stock Transfer'}
        maxWidth="md"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#172033] mb-1">Source Branch (من فرع) *</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {lang === 'ar' ? b.name_ar : b.name_en}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#172033] mb-1">Destination Branch (إلى فرع) *</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {lang === 'ar' ? b.name_ar : b.name_en}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Product to Transfer *</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
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
            <label className="block font-semibold text-[#172033] mb-1">Transfer Quantity *</label>
            <input
              type="number"
              required
              min="1"
              value={transferQty}
              onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-mono font-bold focus:border-[#246BFD] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Dispatch Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              placeholder="Driver: Mahmoud, Van Plate #123"
            />
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#246BFD] text-white font-bold"
            >
              Dispatch Transfer
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
