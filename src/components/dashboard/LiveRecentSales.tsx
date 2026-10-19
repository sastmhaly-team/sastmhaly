'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt, ArrowRight, MessageCircle, Eye, Clock, CheckCircle2 } from 'lucide-react';

interface RecentSaleItem {
  id: string;
  sale_number: string;
  customer_name: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  cashier_name: string;
  branch_name: string;
}

interface LiveRecentSalesProps {
  sales: RecentSaleItem[];
  currency?: string;
  isRtl?: boolean;
  onShareWhatsApp?: (sale: RecentSaleItem) => void;
}

export function LiveRecentSales({
  sales = [],
  currency = 'ج.م',
  isRtl = true,
  onShareWhatsApp,
}: LiveRecentSalesProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#246BFD]">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0B1730]">
                {isRtl ? 'أحدث الفواتير والعمليات المباشرة' : 'Live Real-time Sales Feed'}
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[11px] text-[#687386]">
              {isRtl ? 'آخر العمليات التي تمت بنجاح عبر نقاط البيع' : 'Latest completed transactions'}
            </p>
          </div>
        </div>

        <Link
          href="/merchant/sales"
          className="text-xs font-bold text-[#246BFD] hover:underline flex items-center gap-1"
        >
          <span>{isRtl ? 'كل الفواتير' : 'All Sales'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left rtl:text-right border-collapse">
          <thead className="bg-[#F8FAFC] border-b border-[#E5EAF2] text-[#687386] font-bold text-[11px]">
            <tr>
              <th className="px-3 py-2.5">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
              <th className="px-3 py-2.5">{isRtl ? 'العميل' : 'Customer'}</th>
              <th className="px-3 py-2.5">{isRtl ? 'الكاشير' : 'Cashier'}</th>
              <th className="px-3 py-2.5">{isRtl ? 'طريقة الدفع' : 'Payment'}</th>
              <th className="px-3 py-2.5 text-right rtl:text-left">{isRtl ? 'المبلغ' : 'Amount'}</th>
              <th className="px-3 py-2.5 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF2]">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#687386]">
                  {isRtl ? 'لا توجد فواتير حديثة حتى الآن' : 'No recent transactions'}
                </td>
              </tr>
            ) : (
              sales.map((sale) => {
                const dateObj = new Date(sale.created_at);
                const timeStr = dateObj.toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const paymentBadge = 
                  sale.payment_method === 'cash' ? { label: isRtl ? 'نقداً' : 'Cash', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' } :
                  sale.payment_method === 'card' ? { label: isRtl ? 'بطاقة' : 'Card', cls: 'bg-blue-50 text-blue-700 border-blue-200' } :
                  sale.payment_method === 'mobile_wallet' ? { label: isRtl ? 'محفظة' : 'Wallet', cls: 'bg-purple-50 text-purple-700 border-purple-200' } :
                  { label: isRtl ? 'آجل' : 'Credit', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

                return (
                  <tr key={sale.id} className="hover:bg-[#F8FAFC] transition-colors group">
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-bold text-[#0B1730] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{sale.sale_number}</span>
                      </div>
                      <span className="text-[10px] text-[#687386] font-normal flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{timeStr}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2.5 font-bold text-[#0B1730]">
                      {sale.customer_name || (isRtl ? 'عميل نقدي عام' : 'Walk-in')}
                    </td>

                    <td className="px-3 py-2.5 text-[#687386]">
                      {sale.cashier_name}
                    </td>

                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${paymentBadge.cls}`}>
                        {paymentBadge.label}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right rtl:text-left font-black text-sm text-[#0B1730]">
                      {sale.total_amount.toLocaleString()} <span className="text-[10px] font-medium text-[#687386]">{currency}</span>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onShareWhatsApp && (
                          <button
                            type="button"
                            onClick={() => onShareWhatsApp(sale)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors cursor-pointer"
                            title={isRtl ? 'مشاركة عبر واتساب (صورة أو نص)' : 'Share on WhatsApp'}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Link
                          href={`/merchant/sales`}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#0B1730] transition-colors"
                          title={isRtl ? 'عرض في سجل المبيعات' : 'View in Sales'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
