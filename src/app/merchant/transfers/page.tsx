'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { StockTransfer, Product, Branch } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { ArrowLeftRight, Plus, CheckCircle2, Truck, Clock, ShieldCheck } from 'lucide-react';

export default function MerchantTransfersPage() {
  const { tenant, branches } = useAuth();
  const { lang, t } = useLanguage();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      const res = await fetch(`/api/merchant/transfers?tenantId=${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }

      const prodRes = await fetch(`/api/merchant/products?tenantId=${tenant.id}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
        if (prodData.products?.length > 0 && !selectedProductId) {
          setSelectedProductId(prodData.products[0].id);
        }
      }
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

  const handleReceiveTransfer = async (transferId: string) => {
    if (!tenant) return;
    try {
      const res = await fetch('/api/merchant/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          action: 'receive',
          transferId,
          receivedBy: 'branch_manager',
        }),
      });

      if (res.ok) {
        fetchTransfers();
      }
    } catch {
      alert('Error confirming transfer');
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
              ? 'إنشاء طلبات التحويل، مراقبة البضاعة المنقولة (In Transit)، وتأكيد الاستلام بالمقصد' 
              : 'Transfer inventory between shops, track transit stages, and reconcile received stock'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportButton
            filename="sastmhaly_stock_transfers"
            data={transfers}
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
                transfers.map((trf, idx) => (
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
                      {trf.items_count || 1}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {trf.status === 'received' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
                          <CheckCircle2 className="w-3 h-3" />
                          Received
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                          <Truck className="w-3 h-3" />
                          In Transit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[#687386] text-[11px] font-mono">
                      {trf.created_at}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {trf.status === 'in_transit' && (
                        <button
                          onClick={() => handleReceiveTransfer(trf.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-bold shadow-xs cursor-pointer"
                        >
                          {lang === 'ar' ? 'تأكيد الاستلام' : 'Confirm Receipt'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
