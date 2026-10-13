'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { KpiCard } from '@/components/reports/KpiCard';
import { 
  ShoppingCart, DollarSign, TrendingUp, AlertTriangle, 
  Clock, Package, Building2, ArrowUpRight, ArrowDownRight,
  Layers, Landmark, Users, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

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
  topProducts: Array<{
    name_en: string;
    name_ar: string;
    sku: string;
    total_sold: number;
    revenue: number;
  }>;
}

export default function MerchantDashboardPage() {
  const { tenant, activeBranchId, branches } = useAuth();
  const { lang, t } = useLanguage();
  const [data, setData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const activeBranchObj = branches.find(b => b.id === activeBranchId);

  useEffect(() => {
    if (!tenant) return;
    const fetchKpis = async () => {
      setLoading(true);
      try {
        const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
        const res = await fetch(`/api/merchant/dashboard?tenantId=${tenant.id}${branchParam}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, [tenant, activeBranchId]);

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-md w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Scope Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
            <span className="text-[11px] font-bold text-[#687386] uppercase tracking-wider">
              {activeBranchId === 'all' 
                ? (lang === 'ar' ? 'عرض موحد لكافة الفروع' : 'Consolidated All-Branches View')
                : (lang === 'ar' ? `نطاق الفرع المحدد: ${activeBranchObj?.name_ar}` : `Branch Scope: ${activeBranchObj?.name_en}`)}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#0B1730] mt-1">
            {lang === 'ar' ? 'لوحة مؤشرات الأداء والعمليات اليومية' : 'Retail Performance & Operations Dashboard'}
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/merchant/pos"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{lang === 'ar' ? 'فتح نقطة البيع (POS)' : 'Open POS Terminal'}</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Sales Today */}
        <KpiCard
          title={lang === 'ar' ? 'مبيعات اليوم' : "Today's Sales"}
          value={`${data.salesToday.toLocaleString()} ${t('currency')}`}
          subtitle={`${data.transactionsToday} ${lang === 'ar' ? 'عملية بيع' : 'transactions'}`}
          icon={ShoppingCart}
          badge={{ text: 'Today', type: 'info' }}
        />

        {/* Net Sales */}
        <KpiCard
          title={lang === 'ar' ? 'صافي المبيعات (Net Sales)' : 'Net Sales'}
          value={`${data.netSales.toLocaleString()} ${t('currency')}`}
          subtitle={lang === 'ar' ? `إجمالي الإيراد بعد الخصومات` : `Gross: ${data.grossSales.toLocaleString()} ${t('currency')}`}
          icon={TrendingUp}
          badge={{ text: 'Revenue', type: 'success' }}
        />

        {/* Gross Profit & Margin */}
        <KpiCard
          title={lang === 'ar' ? 'مجمل الربح (Gross Profit)' : 'Gross Profit'}
          value={`${data.grossProfit.toLocaleString()} ${t('currency')}`}
          subtitle={`Margin: ${data.grossMarginPct}% (COGS: ${data.cogs.toLocaleString()})`}
          icon={DollarSign}
          badge={{ text: `${data.grossMarginPct}% Margin`, type: 'success' }}
        />

        {/* Net Operating Profit */}
        <KpiCard
          title={lang === 'ar' ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}
          value={`${data.netOperatingProfit.toLocaleString()} ${t('currency')}`}
          subtitle={lang === 'ar' ? `بعد خصم المصروفات (${data.operatingExpenses.toLocaleString()})` : `Expenses: ${data.operatingExpenses.toLocaleString()} ${t('currency')}`}
          icon={Landmark}
          badge={{ text: 'Net Operating', type: 'info' }}
        />
      </div>

      {/* Second Row: Stock, Low Stock, Near Expiry Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Inventory Valuation */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#687386] uppercase tracking-wide">
                {lang === 'ar' ? 'قيمة المخزون الحالي' : 'Stock Valuation'}
              </p>
              <h3 className="text-xl font-bold text-[#0B1730] mt-1">
                {data.inventoryValuation.toLocaleString()} {t('currency')}
              </h3>
              <p className="text-xs text-[#687386] mt-1">
                {data.inventoryUnits.toLocaleString()} {lang === 'ar' ? 'وحدة متوفرة بالفرع' : 'units on hand'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#F7F9FC] border border-[#E5EAF2] flex items-center justify-center text-[#246BFD]">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <Link href="/merchant/inventory" className="inline-block mt-3 text-xs font-bold text-[#246BFD] hover:underline">
            {lang === 'ar' ? 'عرض دفتر المخزون ←' : 'View Inventory Ledger →'}
          </Link>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#687386] uppercase tracking-wide">
                {lang === 'ar' ? 'نواقص المخزون' : 'Low Stock Alerts'}
              </p>
              <h3 className="text-xl font-bold text-[#EF4444] mt-1">
                {data.lowStockCount} {lang === 'ar' ? 'أصناف' : 'SKUs'}
              </h3>
              <p className="text-xs text-[#687386] mt-1">
                {lang === 'ar' ? 'وصلت لحد إعادة الطلب' : 'Reached minimum reorder threshold'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#EF4444]">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <Link href="/merchant/inventory" className="inline-block mt-3 text-xs font-bold text-[#EF4444] hover:underline">
            {lang === 'ar' ? 'إصدار أمر شراء مقترح ←' : 'Generate Purchase Order →'}
          </Link>
        </div>

        {/* Near Expiry Batches */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-2xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#687386] uppercase tracking-wide">
                {lang === 'ar' ? 'تنبيهات الصلاحية' : 'Near Expiry Alerts'}
              </p>
              <h3 className="text-xl font-bold text-[#F59E0B] mt-1">
                {data.nearExpiryCount} {lang === 'ar' ? 'تشغيلات' : 'Batches'}
              </h3>
              <p className="text-xs text-[#687386] mt-1">
                {lang === 'ar' ? 'تنتهي خلال أقل من 30 يوماً' : 'Expiring within 30 days'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center text-[#F59E0B]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <Link href="/merchant/batches" className="inline-block mt-3 text-xs font-bold text-[#F59E0B] hover:underline">
            {lang === 'ar' ? 'إدارة تواريخ الصلاحية ←' : 'Manage Batches & FIFO →'}
          </Link>
        </div>

      </div>

      {/* Top Selling Products & Quick Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Products Table */}
        <div className="bg-white rounded-xl border border-[#E5EAF2] p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
              {lang === 'ar' ? 'أعلى الأصناف مبيعاً بالفرع' : 'Top Performing Products'}
            </h3>
            <Link href="/merchant/reports" className="text-xs font-bold text-[#246BFD] hover:underline">
              {lang === 'ar' ? 'تقرير المبيعات التفصيلي ←' : 'Detailed Report →'}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-bold text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">#</th>
                  <th className="px-3.5 py-2.5">{lang === 'ar' ? 'الصنف' : 'Product'}</th>
                  <th className="px-3.5 py-2.5">{lang === 'ar' ? 'الكود' : 'SKU'}</th>
                  <th className="px-3.5 py-2.5 text-center">{lang === 'ar' ? 'الكمية المباعة' : 'Units Sold'}</th>
                  <th className="px-3.5 py-2.5 text-right rtl:text-left">{lang === 'ar' ? 'الإيراد' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {data.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#687386]">
                      {t('no_records')}
                    </td>
                  </tr>
                ) : (
                  data.topProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-[#F7F9FC]">
                      <td className="px-3.5 py-2.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-[#0B1730]">
                        {lang === 'ar' ? p.name_ar : p.name_en}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[#687386]">{p.sku}</td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-[#246BFD]">{p.total_sold}</td>
                      <td className="px-3.5 py-2.5 text-right rtl:text-left font-bold text-[#0B1730]">
                        {p.revenue.toLocaleString()} {t('currency')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="bg-white rounded-xl border border-[#E5EAF2] p-5 shadow-2xs">
          <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider mb-4">
            {lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
          </h3>

          <div className="space-y-2.5">
            <Link
              href="/merchant/pos"
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5EAF2] hover:border-[#246BFD] hover:bg-[#F0F9FF] transition-all text-xs font-bold text-[#0B1730]"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-[#246BFD]" />
                <span>{lang === 'ar' ? 'فتح شاشة الكاشير والبيع' : 'Fast Checkout POS'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#687386] rtl:rotate-180" />
            </Link>

            <Link
              href="/merchant/products"
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5EAF2] hover:border-[#246BFD] hover:bg-[#F0F9FF] transition-all text-xs font-bold text-[#0B1730]"
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-[#246BFD]" />
                <span>{lang === 'ar' ? 'إضافة صنف أو استيراد ملف' : 'Add Product / Import CSV'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#687386] rtl:rotate-180" />
            </Link>

            <Link
              href="/merchant/transfers"
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5EAF2] hover:border-[#246BFD] hover:bg-[#F0F9FF] transition-all text-xs font-bold text-[#0B1730]"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#246BFD]" />
                <span>{lang === 'ar' ? 'تحويل بضاعة بين الفروع' : 'Branch Stock Transfer'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#687386] rtl:rotate-180" />
            </Link>

            <Link
              href="/merchant/expenses"
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5EAF2] hover:border-[#246BFD] hover:bg-[#F0F9FF] transition-all text-xs font-bold text-[#0B1730]"
            >
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-[#246BFD]" />
                <span>{lang === 'ar' ? 'تسجيل مصروف تشغيلي' : 'Record Operating Expense'}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#687386] rtl:rotate-180" />
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
