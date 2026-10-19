'use client';

import React from 'react';
import { Building2, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface BranchPerformanceItem {
  id: string;
  name_ar: string;
  name_en: string;
  totalSales: number;
  salesCount: number;
}

interface BranchLeaderboardCardProps {
  branches: BranchPerformanceItem[];
  currency?: string;
  isRtl?: boolean;
}

export function BranchLeaderboardCard({
  branches = [],
  currency = 'ج.م',
  isRtl = true,
}: BranchLeaderboardCardProps) {
  if (!branches || branches.length <= 1) return null;

  const totalAllBranches = branches.reduce((sum, b) => sum + b.totalSales, 0) || 1;

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B1730]">
              {isRtl ? 'مقارنة أداء وحصة الفروع' : 'Branch Performance Comparison'}
            </h3>
            <p className="text-[11px] text-[#687386]">
              {isRtl ? 'حصة كل فرع من إجمالي المبيعات المحققة' : 'Revenue contribution per branch'}
            </p>
          </div>
        </div>

        <Link
          href="/merchant/branches"
          className="text-xs font-bold text-[#246BFD] hover:underline"
        >
          {isRtl ? 'إدارة الفروع ←' : 'Manage Branches →'}
        </Link>
      </div>

      {/* Branches List */}
      <div className="space-y-3">
        {branches.map((b, idx) => {
          const pct = Math.round((b.totalSales / totalAllBranches) * 100);
          return (
            <div key={b.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-[#0B1730] font-mono font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-[#0B1730]">
                    {isRtl ? b.name_ar : b.name_en}
                  </span>
                  <span className="text-[10px] text-[#687386]">
                    ({b.salesCount} {isRtl ? 'فاتورة' : 'sales'})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-[#0B1730]">
                    {b.totalSales.toLocaleString()} {currency}
                  </span>
                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${pct}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700"
                />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
