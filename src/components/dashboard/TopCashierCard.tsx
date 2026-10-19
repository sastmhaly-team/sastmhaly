'use client';

import React from 'react';
import Link from 'next/link';
import { Award, ShoppingCart, User, Sparkles, TrendingUp } from 'lucide-react';

interface TopCashierCardProps {
  topCashier: {
    name: string;
    sales: number;
    transactions: number;
  } | null;
  currency?: string;
  isRtl?: boolean;
}

export function TopCashierCard({
  topCashier,
  currency = 'ج.م',
  isRtl = true,
}: TopCashierCardProps) {
  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-2xl border border-amber-200/80 p-5 shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden">
      
      {/* Background soft glow decoration */}
      <div className="absolute top-0 end-0 w-28 h-28 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3.5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-amber-950">
                {isRtl ? 'بطل مبيعات اليوم' : 'Top Cashier of the Day'}
              </h3>
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-amber-900/70 font-semibold">
              {isRtl ? 'الأعلى تحقيقاً للمبيعات بالفرع' : 'Highest sales performer today'}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300/60 shadow-2xs">
          ⭐ {isRtl ? 'المتصدر' : '#1 MVP'}
        </span>
      </div>

      {topCashier && topCashier.sales > 0 ? (
        <div className="relative z-10 space-y-3 pt-1">
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-amber-100 shadow-2xs">
            <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              {topCashier.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-sm text-[#0B1730] truncate">
                {topCashier.name}
              </h4>
              <p className="text-xs text-[#687386] font-medium flex items-center gap-1">
                <span>{topCashier.transactions} {isRtl ? 'عملية بيع ناجحة' : 'sales closed'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-amber-500/10 px-3.5 py-2.5 rounded-xl border border-amber-200/50">
            <span className="text-xs font-bold text-amber-950">
              {isRtl ? 'إجمالي المبيعات المحققة:' : 'Total Sales Generated:'}
            </span>
            <span className="text-base font-black text-amber-900 font-mono">
              {topCashier.sales.toLocaleString()} <span className="text-xs font-bold">{currency}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="relative z-10 py-5 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <User className="w-5 h-5" />
          </div>
          <p className="text-xs text-amber-900 font-bold">
            {isRtl ? 'لم تسجل عمليات بيع اليوم حتى الآن' : 'No sales registered yet today'}
          </p>
          <Link
            href="/merchant/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{isRtl ? 'فتح الكاشير وبدء البيع' : 'Start Selling on POS'}</span>
          </Link>
        </div>
      )}

    </div>
  );
}
