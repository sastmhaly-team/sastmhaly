'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData, invalidateCache } from '@/lib/cache/client-cache';
import { 
  ShoppingCart, DollarSign, TrendingUp, AlertTriangle, 
  Clock, Package, Building2, Landmark, Users, ArrowRight,
  Radio, Sparkles, RefreshCw
} from 'lucide-react';

import { AnimatedKpiCard } from '@/components/dashboard/AnimatedKpiCard';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { PaymentMethodsCard } from '@/components/dashboard/PaymentMethodsCard';
import { InventoryHealthCard } from '@/components/dashboard/InventoryHealthCard';
import { TopCashierCard } from '@/components/dashboard/TopCashierCard';
import { BranchLeaderboardCard } from '@/components/dashboard/BranchLeaderboardCard';
import { LiveRecentSales } from '@/components/dashboard/LiveRecentSales';
import { SmartInsightsBanner } from '@/components/dashboard/SmartInsightsBanner';
import { QuickActionsHub } from '@/components/dashboard/QuickActionsHub';
import { InvoiceShareModal } from '@/components/invoice/InvoiceShareModal';

interface DashboardKpiData {
  salesToday: number;
  transactionsToday: number;
  grossSales: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: string;
  operatingExpenses: number;
  netOperatingProfit: number;
  inventoryValuation: number;
  inventoryUnits: number;
  nearExpiryCount: number;
  lowStockCount: number;
  outOfStockCount?: number;
  goodStockCount?: number;
  topProducts: Array<{
    name_en: string;
    name_ar: string;
    sku: string;
    total_sold: number;
    revenue: number;
  }>;
  paymentMethods?: Record<'cash' | 'card' | 'mobile_wallet' | 'customer_credit', { count: number; total: number }>;
  dailySalesTrend?: Array<{ date: string; label: string; sales: number; count: number }>;
  recentSales?: Array<{
    id: string;
    sale_number: string;
    customer_name: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
    cashier_name: string;
    branch_name: string;
  }>;
  topCashier?: {
    name: string;
    sales: number;
    transactions: number;
  } | null;
  branchPerformance?: Array<{
    id: string;
    name_ar: string;
    name_en: string;
    totalSales: number;
    salesCount: number;
  }>;
}

export default function MerchantDashboardPage() {
  const { tenant, activeBranchId, branches } = useAuth();
  const { lang, t } = useLanguage();
  const isRtl = lang === 'ar';

  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Invoice WhatsApp Share Modal
  const [shareModalSale, setShareModalSale] = useState<any>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const activeBranchObj = branches.find(b => b.id === activeBranchId);

  const loadData = (showRefreshingState = false) => {
    if (!tenant) return;
    if (showRefreshingState) {
      setRefreshing(true);
      invalidateCache('/api/merchant/dashboard');
    }

    const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
    const dateParam = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`;
    const url = `/api/merchant/dashboard?tenantId=${tenant.id}${branchParam}${dateParam}`;

    // Instant render from cache if available (<1s)
    const cached = getCachedData<DashboardKpiData>(url);
    if (cached && !data) {
      setData(cached);
      setLoading(false);
    } else if (!data) {
      setLoading(true);
    }

    fetchWithCache<DashboardKpiData>(url, (freshData) => {
      setData(freshData);
      setLoading(false);
      setRefreshing(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    loadData();

    // Revalidate live stats when user returns to tab
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [tenant, activeBranchId, startDate, endDate]);

  const handleShareWhatsApp = async (sale: any) => {
    try {
      // Fetch full sale items if not available
      const res = await fetch(`/api/merchant/sales?tenantId=${tenant?.id}&saleId=${sale.id}`);
      if (res.ok) {
        const fullData = await res.json();
        setShareModalSale(fullData.sale || sale);
      } else {
        setShareModalSale(sale);
      }
      setIsShareModalOpen(true);
    } catch {
      setShareModalSale(sale);
      setIsShareModalOpen(true);
    }
  };

  // Sparkline data helpers based on 7-day trend
  const trendSalesPoints = data?.dailySalesTrend?.map(t => t.sales) || [10, 20, 15, 30, 25, 40, 45];
  const trendOrdersPoints = data?.dailySalesTrend?.map(t => t.count) || [5, 8, 6, 12, 10, 15, 18];
  const trendProfitPoints = trendSalesPoints.map(s => Math.round(s * 0.35));

  if (!data && loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-gray-200/80 rounded-2xl w-full"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200/80 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 bg-gray-200/80 rounded-2xl lg:col-span-2"></div>
          <div className="h-72 bg-gray-200/80 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const currency = t('currency') || 'ج.م';
  const topProductName = data?.topProducts && data.topProducts.length > 0 
    ? (isRtl ? data.topProducts[0].name_ar : data.topProducts[0].name_en) 
    : undefined;

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. Header Banner & Live Scope Indicator */}
      <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-[#E5EAF2] shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Live Status */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{isRtl ? 'مبيعات حية ومباشرة' : 'Live Real-time Feed'}</span>
              </span>

              <span className="text-[11px] font-bold text-[#687386]">
                {activeBranchId === 'all' 
                  ? (isRtl ? '🌐 كافة الفروع موحدة' : '🌐 All Branches Consolidated')
                  : (isRtl ? `📍 فرع: ${activeBranchObj?.name_ar}` : `📍 Branch: ${activeBranchObj?.name_en}`)}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#0B1730] tracking-tight">
              {isRtl ? 'لوحة مؤشرات الأداء والعمليات اليومية' : 'Retail Performance & Operations Dashboard'}
            </h2>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-[#E5EAF2] hover:bg-[#F8FAFC] text-[#687386] transition-all cursor-pointer shadow-2xs active:scale-95"
              title={isRtl ? 'تحديث البيانات' : 'Refresh Data'}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <Link
              href="/merchant/pos"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{isRtl ? 'فتح نقطة البيع (POS)' : 'Open POS Terminal'}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Smart Business AI Insights Banner */}
      {data && (
        <SmartInsightsBanner
          salesToday={data.salesToday}
          transactionsToday={data.transactionsToday}
          topProductName={topProductName}
          lowStockCount={data.lowStockCount}
          nearExpiryCount={data.nearExpiryCount}
          currency={currency}
          isRtl={isRtl}
        />
      )}

      {/* 3. Date Range Filter Bar */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      {/* 4. Row 1: 4 Main KPI Summary Cards (Animated + CountUp + Sparkline) */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Sales Today */}
          <AnimatedKpiCard
            title={isRtl ? 'مبيعات اليوم' : "Today's Sales"}
            value={data.salesToday}
            suffix={currency}
            subtitle={`${data.transactionsToday} ${isRtl ? 'عملية بيع مسجلة' : 'transactions closed'}`}
            icon={ShoppingCart}
            badge={{ text: isRtl ? 'اليوم' : 'Today', type: 'info' }}
            sparklineData={trendSalesPoints}
            sparklineColor="#246BFD"
            delayIndex={0}
          />

          {/* Card 2: Gross Sales */}
          <AnimatedKpiCard
            title={isRtl ? 'إجمالي المبيعات' : 'Gross Sales'}
            value={data.grossSales}
            suffix={currency}
            subtitle={isRtl ? 'إجمالي سعر البيع قبل الخصومات' : 'Total gross sales volume'}
            icon={TrendingUp}
            badge={{ text: isRtl ? 'إيرادات' : 'Revenue', type: 'info' }}
            sparklineData={trendOrdersPoints}
            sparklineColor="#10B981"
            delayIndex={1}
          />

          {/* Card 3: Net Profit After Cost */}
          <AnimatedKpiCard
            title={isRtl ? 'صافي الربح (بعد خصم التكلفة)' : 'Net Profit (After Cost)'}
            value={data.grossProfit}
            suffix={currency}
            subtitle={isRtl ? `التكلفة: ${data.cogs.toLocaleString()} ${currency}` : `COGS: ${data.cogs.toLocaleString()}`}
            icon={DollarSign}
            badge={{ text: `${data.grossMarginPct}% ${isRtl ? 'هامش ربح' : 'Margin'}`, type: 'success' }}
            sparklineData={trendProfitPoints}
            sparklineColor="#10B981"
            delayIndex={2}
          />

          {/* Card 4: Net Operating Profit */}
          <AnimatedKpiCard
            title={isRtl ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}
            value={data.netOperatingProfit}
            suffix={currency}
            subtitle={isRtl ? `المصروفات: ${data.operatingExpenses.toLocaleString()} ${currency}` : `Expenses: ${data.operatingExpenses.toLocaleString()}`}
            icon={Landmark}
            badge={{ text: isRtl ? 'صافي التشغيل' : 'Net Operating', type: 'info' }}
            sparklineData={trendProfitPoints}
            sparklineColor="#8B5CF6"
            delayIndex={3}
          />
        </div>
      )}

      {/* 5. Row 2: Sales Trend Line/Area Chart & Payment Methods Breakdown */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: 7-Day Trend Chart (2 cols) */}
          <div className="lg:col-span-2">
            <SalesTrendChart
              data={data.dailySalesTrend || []}
              currency={currency}
              isRtl={isRtl}
            />
          </div>

          {/* Right: Payment Methods Breakdown (1 col) */}
          <div>
            <PaymentMethodsCard
              data={data.paymentMethods}
              currency={currency}
              isRtl={isRtl}
            />
          </div>
        </div>
      )}

      {/* 6. Row 3: Operations & Inventory Health & MVP Cashier */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Inventory Health Meter */}
          <InventoryHealthCard
            goodStockCount={data.goodStockCount || 0}
            lowStockCount={data.lowStockCount || 0}
            outOfStockCount={data.outOfStockCount || 0}
            nearExpiryCount={data.nearExpiryCount || 0}
            totalValuation={data.inventoryValuation || 0}
            currency={currency}
            isRtl={isRtl}
          />

          {/* Top Cashier of the Day */}
          <TopCashierCard
            topCashier={data.topCashier || null}
            currency={currency}
            isRtl={isRtl}
          />

          {/* Quick Actions Hub or Branch Leaderboard */}
          {activeBranchId === 'all' && (data.branchPerformance && data.branchPerformance.length > 1) ? (
            <BranchLeaderboardCard
              branches={data.branchPerformance}
              currency={currency}
              isRtl={isRtl}
            />
          ) : (
            <QuickActionsHub isRtl={isRtl} />
          )}

        </div>
      )}

      {/* 7. Row 4: Live Recent Sales Feed & Top Products */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Live Recent Sales (2 cols) */}
          <div className="lg:col-span-2">
            <LiveRecentSales
              sales={data.recentSales || []}
              currency={currency}
              isRtl={isRtl}
              onShareWhatsApp={handleShareWhatsApp}
            />
          </div>

          {/* Top Selling Products (1 col) */}
          <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#246BFD]">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B1730]">
                    {isRtl ? 'الأعلى مبيعاً بالفرع' : 'Top Selling Products'}
                  </h3>
                  <p className="text-[11px] text-[#687386]">
                    {isRtl ? 'المنتجات الأكثر طلباً وإيراداً' : 'Highest demand products'}
                  </p>
                </div>
              </div>

              <Link href="/merchant/reports" className="text-xs font-bold text-[#246BFD] hover:underline">
                {isRtl ? 'التقرير ←' : 'Report →'}
              </Link>
            </div>

            <div className="space-y-3">
              {data.topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#687386]">
                  {t('no_records')}
                </div>
              ) : (
                data.topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-[#E5EAF2] hover:border-blue-300 bg-[#F8FAFC]/50 hover:bg-white transition-all flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#246BFD] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-[#0B1730] truncate">
                          {isRtl ? p.name_ar : p.name_en}
                        </h4>
                        <span className="font-mono text-[10px] text-[#687386]">
                          {p.sku}
                        </span>
                      </div>
                    </div>

                    <div className="text-right rtl:text-left shrink-0">
                      <span className="font-mono font-black text-xs text-[#0B1730] block">
                        {p.revenue.toLocaleString()} {currency}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                        {p.total_sold} {isRtl ? 'قطعة' : 'sold'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Invoice WhatsApp Share Modal (Photo or Text) */}
      <InvoiceShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sale={shareModalSale}
        tenantName={tenant?.name}
        tenantLogoUrl={tenant?.logo_url}
        branchAddress={activeBranchObj?.address || 'القاهرة، مصر'}
        branchPhone={activeBranchObj?.phone || '01558516263'}
        isRtl={isRtl}
      />

    </div>
  );
}
