'use client';

import React from 'react';
import Link from 'next/link';
import { Package, AlertTriangle, AlertCircle, Clock, ArrowRight } from 'lucide-react';

interface InventoryHealthCardProps {
  goodStockCount?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  nearExpiryCount?: number;
  totalValuation?: number;
  currency?: string;
  isRtl?: boolean;
}

export function InventoryHealthCard({
  goodStockCount = 0,
  lowStockCount = 0,
  outOfStockCount = 0,
  nearExpiryCount = 0,
  totalValuation = 0,
  currency = 'ج.م',
  isRtl = true,
}: InventoryHealthCardProps) {
  const totalItems = goodStockCount + lowStockCount + outOfStockCount || 1;
  const goodPct = Math.round((goodStockCount / totalItems) * 100);
  const lowPct = Math.round((lowStockCount / totalItems) * 100);
  const outPct = Math.round((outOfStockCount / totalItems) * 100);

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B1730]">
              {isRtl ? 'مؤشر سلامة وتوازن المخزون' : 'Inventory Health & Balance'}
            </h3>
            <p className="text-[11px] text-[#687386]">
              {isRtl ? `القيمة الإجمالية: ${totalValuation.toLocaleString()} ${currency}` : `Total Stock Value: ${totalValuation.toLocaleString()}`}
            </p>
          </div>
        </div>

        <Link
          href="/merchant/inventory"
          className="text-xs font-bold text-[#246BFD] hover:underline flex items-center gap-1"
        >
          <span>{isRtl ? 'دفتر المخزون' : 'Ledger'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Multi-color Health Meter */}
      <div className="space-y-1.5 mb-4">
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 shadow-inner">
          {goodPct > 0 && (
            <div
              style={{ width: `${goodPct}%` }}
              className="h-full bg-emerald-500 rounded-sm transition-all duration-700"
              title={`متوفر ممتاز: ${goodPct}%`}
            />
          )}
          {lowPct > 0 && (
            <div
              style={{ width: `${lowPct}%` }}
              className="h-full bg-amber-500 rounded-sm transition-all duration-700"
              title={`نواقص حد الطلب: ${lowPct}%`}
            />
          )}
          {outPct > 0 && (
            <div
              style={{ width: `${outPct}%` }}
              className="h-full bg-rose-500 rounded-sm transition-all duration-700"
              title={`نفد المخزون: ${outPct}%`}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-[#687386] font-semibold px-0.5">
          <span className="text-emerald-700 font-bold">{goodPct}% {isRtl ? 'حالة ممتازة' : 'Healthy'}</span>
          {lowStockCount > 0 && (
            <span className="text-amber-700 font-bold">{lowStockCount} {isRtl ? 'صنف منخفض' : 'Low Stock'}</span>
          )}
          {outOfStockCount > 0 && (
            <span className="text-rose-700 font-bold">{outOfStockCount} {isRtl ? 'نفد تماماً' : 'Out of Stock'}</span>
          )}
        </div>
      </div>

      {/* 3 Metric Pills */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col items-center text-center">
          <span className="text-[11px] font-bold text-emerald-800">{isRtl ? 'متوفر جيداً' : 'In Stock'}</span>
          <span className="text-base font-black text-emerald-900 mt-0.5">{goodStockCount}</span>
        </div>

        <Link
          href="/merchant/inventory"
          className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/60 transition-all flex flex-col items-center text-center cursor-pointer group"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>{isRtl ? 'نواقص' : 'Low Stock'}</span>
          </div>
          <span className="text-base font-black text-amber-900 mt-0.5 group-hover:scale-105 transition-transform">
            {lowStockCount}
          </span>
        </Link>

        <Link
          href="/merchant/batches"
          className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 hover:bg-purple-100/60 transition-all flex flex-col items-center text-center cursor-pointer group"
        >
          <div className="flex items-center gap-1 text-[11px] font-bold text-purple-800">
            <Clock className="w-3 h-3 text-purple-600" />
            <span>{isRtl ? 'صلاحية قريبة' : 'Near Expiry'}</span>
          </div>
          <span className="text-base font-black text-purple-900 mt-0.5 group-hover:scale-105 transition-transform">
            {nearExpiryCount}
          </span>
        </Link>
      </div>

    </div>
  );
}
