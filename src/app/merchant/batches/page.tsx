'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { ExportButton } from '@/components/reports/ExportButton';
import { CalendarDays, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface BatchItem {
  id: string;
  product_id: string;
  batch_number: string;
  production_date?: string;
  expiry_date: string;
  quantity: number;
  cost_price: number;
  product_name_en: string;
  product_name_ar: string;
  barcode: string;
  branch_name_en: string;
  branch_name_ar: string;
  days_until_expiry: number;
}

export default function MerchantBatchesPage() {
  const { tenant, activeBranchId } = useAuth();
  const { lang, t } = useLanguage();

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (!tenant) return;
    const fetchBatches = async () => {
      try {
        setLoading(true);
        const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
        const res = await fetch(`/api/merchant/batches?tenantId=${tenant.id}${branchParam}`);
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, [tenant, activeBranchId]);

  const exportColumns = [
    { header: 'Batch Number', key: 'batch_number' as const },
    { header: 'Product (EN)', key: 'product_name_en' as const },
    { header: 'Product (AR)', key: 'product_name_ar' as const },
    { header: 'Expiry Date', key: 'expiry_date' as const },
    { header: 'Days Remaining', key: 'days_until_expiry' as const },
    { header: 'Quantity', key: 'quantity' as const },
    { header: 'Unit Cost', key: 'cost_price' as const },
    { header: 'Branch', key: 'branch_name_en' as const },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'إدارة تواريخ الصلاحية والتشغيلات (FEFO)' : 'Batch & Expiration Date Management'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'متابعة أرقام التشغيلات (Lot #)، الأيام المتبقية، وتنبيهات قرب انتهاء الصلاحية' 
              : 'Track expiry schedules, FIFO/FEFO picking suggestions, and near-expiry discounts'}
          </p>
        </div>

        <ExportButton
          filename="sastmhaly_batches_expiry_report"
          data={batches}
          columns={exportColumns}
        />
      </div>

      {/* Near Expiry Banner */}
      <div className="p-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] flex items-center gap-3">
        <Clock className="w-5 h-5 text-[#D97706] shrink-0" />
        <div className="text-xs text-[#92400E]">
          <p className="font-bold">
            {lang === 'ar' ? 'نظام الاقتراح الذكي للتصريف الأول (FEFO):' : 'First-Expiring-First-Out (FEFO) Recommendation:'}
          </p>
          <p className="text-[11px] mt-0.5">
            {lang === 'ar' 
              ? 'يتم تنبيه الكاشير في نقاط البيع لتصريف التشغيلات التي قاربت على الانتهاء أولاً لحماية المتجر من الهدر.' 
              : 'Products expiring within 30 days are prioritized for checkout picking or clearance promotions to prevent inventory spoilage.'}
          </p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{t('inv_batch_no')}</th>
                <th className="px-4 py-3.5">{t('inv_product_name')}</th>
                <th className="px-4 py-3.5">{t('inv_barcode')}</th>
                <th className="px-4 py-3.5">{t('inv_expiry_date')}</th>
                <th className="px-4 py-3.5 text-center">{t('inv_days_left')}</th>
                <th className="px-4 py-3.5 text-center">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th className="px-4 py-3.5 text-center">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#687386]">{t('loading')}</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#687386]">{t('no_records')}</td>
                </tr>
              ) : (
                batches.slice(0, visibleCount).map((b, idx) => {
                  const isExpired = b.days_until_expiry < 0;
                  const isCritical = b.days_until_expiry >= 0 && b.days_until_expiry <= 15;
                  const isWarning = b.days_until_expiry > 15 && b.days_until_expiry <= 30;

                  return (
                    <tr key={b.id} className="hover:bg-[#F7F9FC]">
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#0B1730]">
                        {b.batch_number}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-[#0B1730]">
                        {lang === 'ar' ? b.product_name_ar : b.product_name_en}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{b.barcode}</td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-[#0B1730]">
                        {b.expiry_date}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-sm">
                        <span className={isExpired ? 'text-[#EF4444]' : isCritical ? 'text-[#DC2626]' : isWarning ? 'text-[#D97706]' : 'text-[#10B981]'}>
                          {isExpired ? 'EXPIRED' : `${b.days_until_expiry} days`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-[#0B1730]">
                        {b.quantity}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isExpired ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]">
                            Expired
                          </span>
                        ) : isCritical ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                            Critical (&lt;15d)
                          </span>
                        ) : isWarning ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                            Near Expiry
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
                            Safe
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {visibleCount < batches.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {lang === 'ar' ? `عرض المزيد (تحميل 20 إضافية - متبقي ${batches.length - visibleCount})` : `Load More (+20 items - ${batches.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
