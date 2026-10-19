'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp, AlertTriangle, ArrowRight, Zap } from 'lucide-react';

interface SmartInsightsBannerProps {
  salesToday: number;
  transactionsToday: number;
  topProductName?: string;
  lowStockCount?: number;
  nearExpiryCount?: number;
  currency?: string;
  isRtl?: boolean;
}

export function SmartInsightsBanner({
  salesToday = 0,
  transactionsToday = 0,
  topProductName,
  lowStockCount = 0,
  nearExpiryCount = 0,
  currency = 'ج.م',
  isRtl = true,
}: SmartInsightsBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 sm:p-5 shadow-sm">
      {/* Decorative background circles */}
      <div className="absolute -end-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute end-1/3 -bottom-10 w-32 h-32 rounded-full bg-blue-400/20 blur-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Insight message */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black tracking-wide uppercase">
                {isRtl ? 'رؤية تشغيلية ذكية' : 'Smart Retail Insight'}
              </span>
              <span className="text-white/70 text-[11px]">● {isRtl ? 'تحليل لحظي' : 'Real-time AI'}</span>
            </div>

            <p className="text-sm font-bold leading-relaxed text-white/95">
              {salesToday > 0 ? (
                isRtl ? (
                  <>
                    حقق متجرك اليوم <strong className="text-amber-300 font-black">{salesToday.toLocaleString()} {currency}</strong> من خلال <strong className="text-white font-black">{transactionsToday}</strong> عملية بيع ناجحة.
                    {topProductName && <> أكثر الأصناف إقبالاً اليوم هو <span className="underline decoration-amber-300 font-extrabold">{topProductName}</span>.</>}
                  </>
                ) : (
                  <>
                    Today's store sales reached <strong className="text-amber-300">{salesToday.toLocaleString()} {currency}</strong> across <strong className="text-white">{transactionsToday}</strong> orders.
                    {topProductName && <> Top trending item today is <span className="underline">{topProductName}</span>.</>}
                  </>
                )
              ) : (
                isRtl 
                  ? 'ابدأ جلسة الكاشير الآن في نقطة البيع (POS) لتسجيل أولى مبيعات اليوم ومتابعة الأرباح لحظة بلحظة.'
                  : 'Open your POS session now to ring up today\'s first sales and track profits live.'
              )}
            </p>

            {/* Quick alert reminder if low stock exists */}
            {(lowStockCount > 0 || nearExpiryCount > 0) && (
              <div className="flex items-center gap-2 pt-1 text-xs text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isRtl 
                    ? `تنبيه: يوجد ${lowStockCount} أصناف وصلت لحد إعادة الطلب، و ${nearExpiryCount} تشغيلة قاربت على انتهاء الصلاحية.` 
                    : `Alert: ${lowStockCount} items low in stock, and ${nearExpiryCount} batches near expiry.`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick CTA buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <Link
            href="/merchant/pos"
            className="px-4 py-2 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600 fill-current" />
            <span>{isRtl ? 'نقطة البيع السريعة' : 'Fast Checkout'}</span>
          </Link>

          {lowStockCount > 0 && (
            <Link
              href="/merchant/inventory"
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1 transition-all"
            >
              <span>{isRtl ? 'طلب نواقص' : 'Restock'}</span>
              <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
