'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Branch } from '@/lib/types';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  BarChart3, TrendingUp, Package, Users, Building2, 
  Download, Calendar, Filter, DollarSign, Layers, CheckCircle2
} from 'lucide-react';

export default function ReportsCenterPage() {
  const { user, activeBranchId } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';
  const branchId = user?.branch_id;

  const [activeReport, setActiveReport] = useState<'pnl' | 'sales' | 'inventory' | 'aging'>('pnl');
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId || branchId || 'all');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranch(activeBranchId);
    }
  }, [activeBranchId]);

  // Data states
  const [dashboardKpis, setDashboardKpis] = useState<any>(null);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [suppliersData, setSuppliersData] = useState<any[]>([]);

  const fetchReportData = async () => {
    try {
      const branchParam = selectedBranch !== 'all' ? `&branchId=${selectedBranch}` : '';
      const dateParam = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`;
      const dashUrl = `/api/merchant/dashboard?tenantId=${tenantId}${branchParam}${dateParam}`;
      const prodUrl = `/api/merchant/products?tenantId=${tenantId}${branchParam}`;
      const custUrl = `/api/merchant/customers?tenantId=${tenantId}`;
      const supUrl = `/api/merchant/suppliers?tenantId=${tenantId}`;
      const brUrl = `/api/merchant/branches?tenantId=${tenantId}`;

      const cachedDash = getCachedData<any>(dashUrl);
      if (cachedDash?.kpis) {
        setDashboardKpis(cachedDash.kpis);
        setLoading(false);
      } else if (!dashboardKpis) {
        setLoading(true);
      }

      const [cachedProd, cachedCust, cachedSup, cachedBr] = [
        getCachedData<any>(prodUrl),
        getCachedData<any>(custUrl),
        getCachedData<any>(supUrl),
        getCachedData<any>(brUrl)
      ];
      if (cachedProd?.products) setProductsData(cachedProd.products);
      if (cachedCust?.customers) setCustomersData(cachedCust.customers);
      if (cachedSup?.suppliers) setSuppliersData(cachedSup.suppliers);
      if (cachedBr?.branches) setBranches(cachedBr.branches);

      await Promise.all([
        fetchWithCache<any>(dashUrl, (data) => {
          if (data.kpis) setDashboardKpis(data.kpis);
          setLoading(false);
        }),
        fetchWithCache<any>(prodUrl, (data) => {
          if (data.products) setProductsData(data.products);
        }),
        fetchWithCache<any>(custUrl, (data) => {
          if (data.customers) setCustomersData(data.customers);
        }),
        fetchWithCache<any>(supUrl, (data) => {
          if (data.suppliers) setSuppliersData(data.suppliers);
        }),
        fetchWithCache<any>(brUrl, (data) => {
          if (data.branches) setBranches(data.branches);
        })
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [tenantId, selectedBranch, startDate, endDate]);

  // Exports
  const getActiveExportConfig = () => {
    if (activeReport === 'pnl') {
      const pnlRows = [
        { itemEn: 'Gross Sales', itemAr: 'إجمالي المبيعات', amount: dashboardKpis?.grossSales || 0 },
        { itemEn: 'Sales Discounts', itemAr: 'الخصومات الممنوحة', amount: -(dashboardKpis?.grossSales - dashboardKpis?.netSales || 0) },
        { itemEn: 'Net Sales Revenue', itemAr: 'صافي إيرادات المبيعات', amount: dashboardKpis?.netSales || 0 },
        { itemEn: 'Cost of Goods Sold (COGS)', itemAr: 'تكلفة المبيعات المباشرة', amount: -(dashboardKpis?.cogs || 0) },
        { itemEn: 'Gross Profit', itemAr: 'مجمل الربح التجاري', amount: dashboardKpis?.grossProfit || 0 },
        { itemEn: 'Operating Expenses', itemAr: 'المصروفات التشغيلية', amount: -(dashboardKpis?.operatingExpenses || 0) },
        { itemEn: 'Net Operating Profit', itemAr: 'صافي الربح التشغيلي', amount: dashboardKpis?.netOperatingProfit || 0 }
      ];
      return {
        filename: 'PnL_Report',
        data: pnlRows,
        headers: [
          { key: 'itemAr', labelEn: 'Financial Statement Line', labelAr: 'بند القائمة المالية' },
          { key: 'amount', labelEn: 'Amount (EGP)', labelAr: 'القيمة (ج.م)' }
        ]
      };
    } else if (activeReport === 'inventory') {
      return {
        filename: 'Inventory_Valuation',
        data: productsData,
        headers: [
          { key: 'sku', labelEn: 'SKU', labelAr: 'كود الصنف' },
          { key: 'name_ar', labelEn: 'Product Name', labelAr: 'اسم المنتج' },
          { key: 'current_stock', labelEn: 'Current Stock', labelAr: 'الرصيد الحالي' },
          { key: 'cost_price', labelEn: 'Unit Cost (EGP)', labelAr: 'تكلفة الوحدة (ج.م)' },
          { key: 'selling_price', labelEn: 'Selling Price (EGP)', labelAr: 'سعر البيع (ج.م)' }
        ]
      };
    } else {
      return {
        filename: 'Customer_Receivables',
        data: customersData,
        headers: [
          { key: 'code', labelEn: 'Customer Code', labelAr: 'كود العميل' },
          { key: 'name', labelEn: 'Customer Name', labelAr: 'اسم العميل' },
          { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
          { key: 'current_balance', labelEn: 'Receivable Balance (EGP)', labelAr: 'الرصيد المدين المستحق (ج.م)' },
          { key: 'credit_limit', labelEn: 'Credit Limit (EGP)', labelAr: 'الحد الائتماني (ج.م)' }
        ]
      };
    }
  };

  const activeConfig = getActiveExportConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'مركز التقارير والذكاء المالي' : 'Reporting & Business Intelligence'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'تقارير الأرباح والخسائر، تقييم المخزون، أعمار الديون، ومؤشرات الأداء المستخرجة من قيود النظام الحقيقية'
              : 'Audited P&L statements, inventory valuations, receivables & payables aging reports'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 bg-white border border-[#E5EAF2] rounded-lg text-xs font-semibold text-[#172033] outline-none shadow-xs"
          >
            <option value="all">{isRtl ? 'جميع الفروع (تقرير مجمع)' : 'All Branches (Consolidated)'}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{isRtl ? b.name_ar : b.name_en}</option>
            ))}
          </select>

          <ExportButton
            key={activeReport}
            filename={activeConfig.filename}
            data={activeConfig.data}
            headers={activeConfig.headers}
            label={isRtl ? 'تصدير التقرير (Excel / CSV)' : 'Export Report (CSV)'}
          />
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

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveReport('pnl')}
          className={`p-4 rounded-xl border text-start transition-all ${
            activeReport === 'pnl'
              ? 'bg-[#0B1730] text-white border-[#0B1730] shadow-sm'
              : 'bg-white text-[#172033] border-[#E5EAF2] hover:bg-[#F7F9FC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{isRtl ? 'المالية' : 'Finance'}</span>
            <DollarSign className={`w-4 h-4 ${activeReport === 'pnl' ? 'text-[#246BFD]' : 'text-gray-400'}`} />
          </div>
          <p className="font-black text-sm mt-2">{isRtl ? 'قائمة الأرباح والخسائر (P&L)' : 'Income Statement (P&L)'}</p>
        </button>

        <button
          onClick={() => setActiveReport('inventory')}
          className={`p-4 rounded-xl border text-start transition-all ${
            activeReport === 'inventory'
              ? 'bg-[#0B1730] text-white border-[#0B1730] shadow-sm'
              : 'bg-white text-[#172033] border-[#E5EAF2] hover:bg-[#F7F9FC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{isRtl ? 'المخازن' : 'Warehouse'}</span>
            <Package className={`w-4 h-4 ${activeReport === 'inventory' ? 'text-[#246BFD]' : 'text-gray-400'}`} />
          </div>
          <p className="font-black text-sm mt-2">{isRtl ? 'تقييم المخزون وركود السلع' : 'Inventory Valuation & Velocity'}</p>
        </button>

        <button
          onClick={() => setActiveReport('aging')}
          className={`p-4 rounded-xl border text-start transition-all ${
            activeReport === 'aging'
              ? 'bg-[#0B1730] text-white border-[#0B1730] shadow-sm'
              : 'bg-white text-[#172033] border-[#E5EAF2] hover:bg-[#F7F9FC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{isRtl ? 'الديون' : 'Balances'}</span>
            <Users className={`w-4 h-4 ${activeReport === 'aging' ? 'text-[#246BFD]' : 'text-gray-400'}`} />
          </div>
          <p className="font-black text-sm mt-2">{isRtl ? 'أرصدة العملاء والموردين (AR/AP)' : 'Receivables & Payables'}</p>
        </button>
      </div>

      {/* Report 1: P&L Statement */}
      {activeReport === 'pnl' && (
        <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs p-6 space-y-6">
          <div className="border-b border-[#E5EAF2] pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-[#0B1730]">
                {isRtl ? 'قائمة الدخل والأرباح والخسائر الرسمية' : 'Income Statement (P&L)'}
              </h2>
              <p className="text-xs text-[#687386] mt-0.5">
                {isRtl 
                  ? 'محسوبة بدقة من فواتير البيع وتكلفة البضاعة المباعة والمصروفات التشغيلية'
                  : 'Derived mathematically from confirmed sales, actual historical COGS, and operating expenses'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-[#F0F9FF] text-[#246BFD] rounded-lg">
              {selectedBranch === 'all' ? (isRtl ? 'تقرير مجمع لكافة الفروع' : 'Consolidated') : (isRtl ? 'فرع محدد' : 'Single Branch')}
            </span>
          </div>

          <div className="max-w-2xl mx-auto divide-y divide-[#E5EAF2] text-xs">
            {/* Revenue */}
            <div className="py-3 flex justify-between items-center">
              <span className="font-semibold text-[#172033]">{isRtl ? 'إجمالي المبيعات (Gross Sales)' : 'Gross Sales'}</span>
              <span className="font-bold text-[#0B1730]">{(dashboardKpis?.grossSales || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>

            <div className="py-3 flex justify-between items-center text-amber-600">
              <span className="font-medium">(-) {isRtl ? 'الخصومات الممنوحة للعملاء' : 'Discounts & Markdowns'}</span>
              <span>-{(dashboardKpis?.grossSales - dashboardKpis?.netSales || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>

            <div className="py-3 flex justify-between items-center font-bold text-sm text-[#0B1730] bg-[#F7F9FC] px-2 rounded">
              <span>{isRtl ? 'صافي إيراد المبيعات (Net Sales)' : 'Net Sales Revenue'}</span>
              <span>{(dashboardKpis?.netSales || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>

            {/* COGS */}
            <div className="py-3 flex justify-between items-center text-rose-600">
              <span className="font-medium">(-) {isRtl ? 'تكلفة البضاعة المباعة (COGS)' : 'Cost of Goods Sold (COGS)'}</span>
              <span>-{(dashboardKpis?.cogs || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>

            {/* Gross Profit */}
            <div className="py-3 flex justify-between items-center font-black text-sm text-emerald-700 bg-emerald-50/60 px-2 rounded">
              <span>{isRtl ? 'مجمل الربح (Gross Profit)' : 'Gross Profit'}</span>
              <div className="text-end">
                <div>{(dashboardKpis?.grossProfit || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</div>
                <div className="text-[10px] text-emerald-600 font-semibold">{dashboardKpis?.grossMarginPct}% {isRtl ? 'هامش ربح' : 'Margin'}</div>
              </div>
            </div>

            {/* Expenses */}
            <div className="py-3 flex justify-between items-center text-red-600">
              <span className="font-medium">(-) {isRtl ? 'المصروفات التشغيلية (إيجار، كهرباء، رواتب)' : 'Operating Expenses (Rent, Utilities, Wages)'}</span>
              <span>-{(dashboardKpis?.operatingExpenses || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>

            {/* Net Operating Profit */}
            <div className="py-4 flex justify-between items-center font-black text-base text-[#0B1730] bg-[#F0F9FF] border border-[#BAE6FD] px-3 rounded-lg">
              <span>{isRtl ? 'صافي الربح التشغيلي (Net Operating Profit)' : 'Net Operating Profit'}</span>
              <span className={dashboardKpis?.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                {(dashboardKpis?.netOperatingProfit || 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Inventory Valuation */}
      {activeReport === 'inventory' && (
        <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E5EAF2] flex justify-between items-center">
            <h2 className="text-sm font-bold text-[#0B1730]">
              {isRtl ? 'تقرير تقييم المخزون المتبقي بالتكلفة ومتوسط المبيعات' : 'Inventory Valuation by Item'}
            </h2>
            <span className="text-xs font-bold text-[#687386]">
              {isRtl ? 'إجمالي الأصناف:' : 'Total Items:'} {productsData.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الكود (SKU)' : 'SKU'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'اسم المنتج' : 'Product Name'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الرصيد المتاح' : 'Stock'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'سعر التكلفة' : 'Cost Price'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'سعر البيع' : 'Retail Price'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'إجمالي قيمة المخزون (بالتكلفة)' : 'Valuation'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {productsData.map((prod) => {
                  const stock = prod.current_stock || 0;
                  const val = stock * prod.cost_price;
                  return (
                    <tr key={prod.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">{prod.sku}</td>
                      <td className="py-3 px-4 text-[#172033] font-medium">{isRtl ? prod.name_ar : prod.name_en}</td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${stock <= prod.min_stock_alert ? 'text-red-600' : 'text-[#172033]'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#687386]">{prod.cost_price.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</td>
                      <td className="py-3 px-4 text-[#172033] font-semibold">{prod.selling_price.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</td>
                      <td className="py-3 px-4 text-end font-black text-[#0B1730]">
                        {val.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report 3: Receivables & Payables */}
      {activeReport === 'aging' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customers Receivables */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E5EAF2] flex justify-between items-center bg-[#F7F9FC]">
              <span className="font-bold text-xs text-[#0B1730]">{isRtl ? 'العملاء المدينون (مستحقات للمتجر)' : 'Accounts Receivable (Customers)'}</span>
              <span className="text-xs font-bold text-amber-600">
                {customersData.reduce((a, c) => a + c.current_balance, 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
              </span>
            </div>
            <div className="divide-y divide-[#E5EAF2] max-h-96 overflow-y-auto text-xs">
              {customersData.map(c => (
                <div key={c.id} className="p-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-[#172033]">{c.name} ({c.code})</div>
                    <div className="text-[10px] text-gray-500">{c.phone}</div>
                  </div>
                  <div className="text-end">
                    <div className="font-black text-amber-600">{c.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</div>
                    <div className="text-[10px] text-gray-400">{isRtl ? 'حد الائتمان:' : 'Limit:'} {c.credit_limit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suppliers Payables */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E5EAF2] flex justify-between items-center bg-[#F7F9FC]">
              <span className="font-bold text-xs text-[#0B1730]">{isRtl ? 'الموردون الدائنون (التزامات على المتجر)' : 'Accounts Payable (Suppliers)'}</span>
              <span className="text-xs font-bold text-red-600">
                {suppliersData.reduce((a, s) => a + s.current_balance, 0).toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
              </span>
            </div>
            <div className="divide-y divide-[#E5EAF2] max-h-96 overflow-y-auto text-xs">
              {suppliersData.map(s => (
                <div key={s.id} className="p-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-[#172033]">{s.name} ({s.code})</div>
                    <div className="text-[10px] text-gray-500">{s.phone} • {s.payment_terms}</div>
                  </div>
                  <div className="text-end">
                    <div className="font-black text-red-600">{s.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
