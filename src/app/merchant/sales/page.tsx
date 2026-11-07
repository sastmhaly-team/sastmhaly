'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Sale, SaleItem } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { getPendingOfflineSales } from '@/lib/offline/offline-manager';
import { 
  Receipt, Search, Filter, Printer, RotateCcw, 
  Eye, CheckCircle2, AlertTriangle, Download, Calendar, DollarSign, MessageCircle,
  Usb, Cable, RefreshCw
} from 'lucide-react';
import { InvoiceShareModal } from '@/components/invoice/InvoiceShareModal';
import { ThermalPrinterSelector } from '@/components/printer/ThermalPrinterSelector';
import { printReceiptUnified, getSavedPrinterConfig, PrinterConfig } from '@/lib/hardware/thermal-printer';

export default function SalesManagementPage() {
  const { user, tenant, activeBranchId } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || 'tenant_albaraka';
  const effectiveBranchId = activeBranchId && activeBranchId !== 'all' ? activeBranchId : user?.branch_id;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Modal
  const [selectedSale, setSelectedSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Return Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [restock, setRestock] = useState(true);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [liveTenant, setLiveTenant] = useState<{ id: string; name: string; logo_url?: string } | null>(null);
  const [receiptFooter, setReceiptFooter] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [sharingSaleId, setSharingSaleId] = useState<string | null>(null);
  const [shareModalSale, setShareModalSale] = useState<(Sale & { items?: SaleItem[] }) | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Printer configuration and state
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({ mode: 'system', name: 'طابعة النظام' });
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  useEffect(() => {
    setPrinterConfig(getSavedPrinterConfig());
  }, []);

  const handleShareWhatsApp = async (sale: Sale | (Sale & { items?: SaleItem[] })) => {
    setSharingSaleId(sale.id);
    try {
      let items = (sale as any).items as SaleItem[] | undefined;
      if (!items || items.length === 0) {
        try {
          const res = await fetch(`/api/merchant/sales?tenantId=${tenantId}&saleId=${sale.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.sale?.items) {
              items = data.sale.items;
            }
          }
        } catch (err) {
          console.warn('Could not fetch items for whatsapp share', err);
        }
      }

      setShareModalSale({ ...sale, items });
      setIsShareModalOpen(true);
    } catch (err) {
      console.error('Error opening share modal', err);
    } finally {
      setSharingSaleId(null);
    }
  };

  const handlePrintReceipt = async () => {
    setIsPrinting(true);
    try {
      const receipt = document.getElementById('printable-receipt');
      const itemCount = receipt?.querySelectorAll('tbody tr, .flex.justify-between.items-start').length || 0;
      const isCompact = itemCount > 5;
      const extraCompact = itemCount > 10;

      await printReceiptUnified('printable-receipt', { isCompact, extraCompact });
    } catch (err) {
      console.error('Print sales receipt failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const mergeWithOfflineSales = (serverSales: Sale[]): Sale[] => {
    const offline = getPendingOfflineSales();
    const serverSaleNumbers = new Set(serverSales.map(s => s.sale_number));
    const serverIds = new Set(serverSales.map(s => s.id));

    // Only include offline sales that are NOT yet recorded on the server
    const uniqueOffline: Sale[] = offline
      .filter(os => !serverSaleNumbers.has(os.sale_number) && !serverIds.has(os.id))
      .map(os => ({
        id: os.id,
        tenant_id: os.tenant_id,
        branch_id: os.branch_id,
        register_id: os.register_id,
        session_id: os.session_id,
        cashier_id: os.cashier_id,
        customer_id: os.customer_id || undefined,
        customer_name: os.customer_name || undefined,
        sale_number: os.sale_number,
        subtotal: os.subtotal,
        discount_amount: os.discount_amount,
        tax_amount: os.tax_amount,
        total_amount: os.total_amount,
        paid_amount: os.paid_amount,
        change_amount: os.change_amount,
        payment_method: os.payment_method as any,
        status: 'completed' as const,
        created_at: os.offline_at,
        cashier_name: user?.full_name || user?.username || 'كاشير (أوفلاين)',
        branch_name: 'الفرع الحالي (أوفلاين)',
      }));

    return [...uniqueOffline, ...serverSales];
  };

  const fetchSales = async () => {
    try {
      const branchParam = effectiveBranchId && effectiveBranchId !== 'all' ? `&branchId=${effectiveBranchId}` : '';
      const url = `/api/merchant/sales?tenantId=${tenantId}${branchParam}`;
      
      const cached = getCachedData<any>(url);
      if (cached) {
        if (cached.sales) setSales(mergeWithOfflineSales(cached.sales));
        if (cached.tenant) setLiveTenant(cached.tenant);
        if (cached.settings?.receipt_footer) setReceiptFooter(cached.settings.receipt_footer);
        setLoading(false);
      } else if (sales.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.sales) setSales(mergeWithOfflineSales(data.sales));
        if (data.tenant) setLiveTenant(data.tenant);
        if (data.settings?.receipt_footer) setReceiptFooter(data.settings.receipt_footer);
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
      // Even if network fails, show local offline sales
      setSales(prev => mergeWithOfflineSales(prev));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();

    const handleSync = () => {
      fetchSales();
    };

    window.addEventListener('sastmhaly_offline_sync', handleSync);
    return () => {
      window.removeEventListener('sastmhaly_offline_sync', handleSync);
    };
  }, [tenantId, effectiveBranchId]);

  const handleViewDetail = async (saleId: string) => {
    setLoadingDetail(true);
    try {
      // 1. Check if it's an offline sale locally first
      const offline = getPendingOfflineSales();
      const offlineMatch = offline.find(s => s.id === saleId || s.sale_number === saleId);
      if (offlineMatch) {
        setSelectedSale({
          ...offlineMatch,
          created_at: offlineMatch.offline_at,
          status: 'completed',
          branch_name: 'الفرع الحالي (أوفلاين)',
          cashier_name: user?.full_name || user?.username || 'كاشير (أوفلاين)',
          customer_name: offlineMatch.customer_name || 'عميل نقدي عام',
          items: (offlineMatch.items || []).map((it: any) => ({
            ...it,
            product_name_ar: it.product_name_ar || it.product_name || it.name_ar || it.name || 'صنف',
            product_name_en: it.product_name_en || it.product_name || it.name_en || it.name || 'Item',
            product_name: it.product_name || it.product_name_ar || it.product_name_en || it.name || 'صنف',
            line_total: it.line_total ?? (it.quantity * it.unit_price),
          })),
        } as any);
        setLoadingDetail(false);
        return;
      }

      const res = await fetch(`/api/merchant/sales?tenantId=${tenantId}&saleId=${saleId}`);
      const data = await res.json();
      if (data.sale) {
        setSelectedSale(data.sale);
      }
      if (data.tenant) {
        setLiveTenant(data.tenant);
      }
      if (data.settings?.receipt_footer) {
        setReceiptFooter(data.settings.receipt_footer);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenReturn = (sale: Sale) => {
    setSaleToReturn(sale);
    setReturnReason('');
    setRefundMethod(sale.payment_method === 'customer_credit' ? 'customer_credit' : 'cash');
    setRestock(true);
    setReturnModalOpen(true);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToReturn) return;
    setSubmittingReturn(true);
    try {
      const res = await fetch('/api/merchant/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return',
          tenant_id: tenantId,
          saleId: saleToReturn.id,
          refundAmount: saleToReturn.total_amount,
          refundMethod,
          restock,
          reason: returnReason,
          createdBy: user?.id || 'cashier'
        })
      });
      const data = await res.json();
      if (data.success) {
        setReturnModalOpen(false);
        fetchSales();
        if (selectedSale?.id === saleToReturn.id) {
          handleViewDetail(saleToReturn.id);
        }
      } else {
        alert(data.error || 'Failed to process return');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while processing return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || s.payment_method === paymentFilter;
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      const saleDate = s.created_at ? s.created_at.split('T')[0] : '';
      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;
      return true;
    })();
    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });

  const salesExportHeaders = [
    { key: 'sale_number', labelEn: 'Invoice Number', labelAr: 'رقم الفاتورة' },
    { key: 'created_at', labelEn: 'Date & Time', labelAr: 'التاريخ والوقت' },
    { key: 'branch_name', labelEn: 'Branch', labelAr: 'الفرع' },
    { key: 'cashier_name', labelEn: 'Cashier', labelAr: 'الكاشير' },
    { key: 'customer_name', labelEn: 'Customer', labelAr: 'العميل' },
    { key: 'payment_method', labelEn: 'Payment Method', labelAr: 'طريقة الدفع' },
    { key: 'total_amount', labelEn: 'Total (EGP)', labelAr: 'الإجمالي (ج.م)' },
    { key: 'status', labelEn: 'Status', labelAr: 'الحالة' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{isRtl ? 'مكتملة' : 'Completed'}</span>;
      case 'returned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">{isRtl ? 'مسترجعة' : 'Returned'}</span>;
      case 'partially_returned':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">{isRtl ? 'مسترجعة جزئياً' : 'Partially Returned'}</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-50 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'سجل المبيعات والفواتير' : 'Sales & Invoices History'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'متابعة جميع عمليات البيع، الفواتير الضريبية، المرتجعات، وإعادة طباعة الإيصالات'
              : 'Audit all completed sales, tax receipts, return workflows, and reprint invoices'}
          </p>
        </div>

        <ExportButton
          filename="Sales_Report"
          data={sales}
          headers={salesExportHeaders}
          label={isRtl ? 'تصدير إلى Excel (CSV)' : 'Export to Excel (CSV)'}
        />
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRtl ? 'بحث برقم الفاتورة، العميل، أو الكاشير...' : 'Search by invoice #, customer, or cashier...'}
              className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs text-[#172033] outline-none"
          >
            <option value="all">{isRtl ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="completed">{isRtl ? 'مكتملة' : 'Completed'}</option>
            <option value="returned">{isRtl ? 'مسترجعة' : 'Returned'}</option>
            <option value="partially_returned">{isRtl ? 'مسترجعة جزئياً' : 'Partially Returned'}</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs text-[#172033] outline-none"
          >
            <option value="all">{isRtl ? 'جميع طرق الدفع' : 'All Payment Methods'}</option>
            <option value="cash">{isRtl ? 'نقداً (كاش)' : 'Cash'}</option>
            <option value="card">{isRtl ? 'بطاقة بنكية' : 'Card'}</option>
            <option value="mobile_wallet">{isRtl ? 'محفظة إلكترونية' : 'Mobile Wallet'}</option>
            <option value="customer_credit">{isRtl ? 'آجل (حساب عميل)' : 'Customer Credit'}</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل المبيعات...' : 'Loading sales records...'}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
            <p className="text-sm font-semibold text-[#172033]">
              {isRtl ? 'لا توجد عمليات بيع مسجلة' : 'No sales records found'}
            </p>
            <p className="text-xs text-[#687386]">
              {isRtl ? 'قم بإجراء عمليات بيع من شاشة الكاشير (POS)' : 'Process sales through the POS checkout screen'}
            </p>
          </div>
        ) : (
          <div>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-[#E5EAF2]">
              {filteredSales.slice(0, visibleCount).map((sale) => (
                <div key={sale.id} className="p-3.5 space-y-2.5 bg-white hover:bg-[#F8FAFC] transition-colors">
                  {/* Row 1: Invoice # + Status + Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-sm text-[#0B1730]">
                        {sale.sale_number}
                      </span>
                      <p className="text-[11px] text-[#687386] mt-0.5">
                        {new Date(sale.created_at).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>
                    <div>
                      {getStatusBadge(sale.status)}
                    </div>
                  </div>

                  {/* Row 2: Customer & Branch info */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#172033]">
                    <span className="font-medium text-[#0B1730]">
                      👤 {sale.customer_name || (isRtl ? 'عميل نقدي عام' : 'Walk-in Customer')}
                    </span>
                    <span className="text-[#687386]">•</span>
                    <span className="text-[#687386]">
                      📍 {sale.branch_name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}
                    </span>
                  </div>

                  {/* Row 3: Total + Payment Method + Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#E5EAF2]">
                    <div className="flex items-baseline gap-2">
                      <span className="font-black text-sm text-[#0B1730]">
                        {sale.total_amount.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-[#172033]">
                        {sale.payment_method === 'cash' ? (isRtl ? 'كاش' : 'Cash') :
                         sale.payment_method === 'card' ? (isRtl ? 'بطاقة' : 'Card') :
                         sale.payment_method === 'mobile_wallet' ? (isRtl ? 'محفظة' : 'Wallet') :
                         sale.payment_method === 'customer_credit' ? (isRtl ? 'آجل' : 'Credit') : sale.payment_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleShareWhatsApp(sale)}
                        disabled={sharingSaleId === sale.id}
                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        title={isRtl ? 'مشاركة الفاتورة عبر واتساب' : 'Share invoice via WhatsApp'}
                      >
                        {sharingSaleId === sale.id ? (
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleViewDetail(sale.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#246BFD] bg-[#EEF4FF] hover:bg-[#DCE7FE] rounded-lg transition-colors"
                        title={isRtl ? 'عرض الفاتورة والإيصال' : 'View invoice & receipt'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'عرض' : 'View'}</span>
                      </button>

                      {sale.status === 'completed' && (
                        <button
                          onClick={() => handleOpenReturn(sale)}
                          className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                          title={isRtl ? 'إرجاع / استرداد' : 'Return / Refund'}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden on mobile < md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{isRtl ? 'رقم الفاتورة' : 'Invoice #'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'الفرع' : 'Branch'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'الكاشير' : 'Cashier'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'طريقة الدفع' : 'Payment'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'الإجمالي' : 'Total'}</th>
                    <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {filteredSales.slice(0, visibleCount).map((sale) => (
                    <tr key={sale.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0B1730]">
                        {sale.sale_number}
                      </td>
                      <td className="py-3 px-4 text-[#687386]">
                        {new Date(sale.created_at).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-3 px-4 text-[#172033]">
                        {sale.branch_name || 'الفرع الرئيسي'}
                      </td>
                      <td className="py-3 px-4 text-[#687386]">
                        {sale.cashier_name || 'كاشير'}
                      </td>
                      <td className="py-3 px-4 text-[#172033]">
                        {sale.customer_name || (isRtl ? 'عميل نقدي عام' : 'Walk-in Customer')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize text-[#172033] font-medium">
                          {sale.payment_method === 'cash' ? (isRtl ? 'كاش' : 'Cash') :
                           sale.payment_method === 'card' ? (isRtl ? 'فيزا/بطاقة' : 'Card') :
                           sale.payment_method === 'mobile_wallet' ? (isRtl ? 'محفظة' : 'Wallet') :
                           sale.payment_method === 'customer_credit' ? (isRtl ? 'آجل' : 'Credit') : sale.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-[#0B1730]">
                        {sale.total_amount.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(sale.status)}
                      </td>
                      <td className="py-3 px-4 text-end space-x-1 rtl:space-x-reverse">
                        {/* WhatsApp Share Button */}
                        <button
                          onClick={() => handleShareWhatsApp(sale)}
                          disabled={sharingSaleId === sale.id}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'مشاركة الفاتورة عبر واتساب' : 'Share invoice via WhatsApp'}
                        >
                          {sharingSaleId === sale.id ? (
                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => handleViewDetail(sale.id)}
                          className="p-1.5 text-[#246BFD] hover:bg-[#F0F9FF] rounded-lg transition-colors"
                          title={isRtl ? 'عرض الفاتورة والإيصال' : 'View invoice & receipt'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleOpenReturn(sale)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={isRtl ? 'إرجاع / استرداد' : 'Return / Refund'}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Pagination (20 by 20) */}
            {filteredSales.length > visibleCount && (
              <div className="p-3 border-t border-[#E5EAF2] bg-[#F7F9FC] flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border border-[#CBD5E1] text-[#0B1730] text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  {isRtl 
                    ? `عرض المزيد (تحميل 20 إضافية) • متبقي ${filteredSales.length - visibleCount}` 
                    : `Load More (20 more) • ${filteredSales.length - visibleCount} remaining`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Detail & Thermal Receipt Modal */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title={isRtl ? `تفاصيل الفاتورة ${selectedSale?.sale_number}` : `Invoice Details ${selectedSale?.sale_number}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF2]">
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedSale.status)}
                <span className="text-xs text-[#687386]">
                  {new Date(selectedSale.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShareWhatsApp(selectedSale)}
                  disabled={sharingSaleId === selectedSale.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  title={isRtl ? 'مشاركة الفاتورة عبر واتساب' : 'Share invoice via WhatsApp'}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مشاركة واتساب' : 'WhatsApp'}</span>
                </button>

                <ThermalPrinterSelector onPrinterChange={setPrinterConfig} />

                <button
                  disabled={isPrinting}
                  onClick={handlePrintReceipt}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
                    printerConfig.mode === 'usb'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : printerConfig.mode === 'serial'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-[#0B1730] hover:bg-[#172033]'
                  }`}
                  title={
                    printerConfig.mode === 'usb'
                      ? 'طباعة فورية مباشرة عبر USB'
                      : printerConfig.mode === 'serial'
                      ? 'طباعة فورية مباشرة عبر Serial / COM'
                      : 'طباعة معزولة عبر طابعة النظام'
                  }
                >
                  {isPrinting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : printerConfig.mode === 'usb' ? (
                    <Usb className="w-3.5 h-3.5 text-emerald-200" />
                  ) : printerConfig.mode === 'serial' ? (
                    <Cable className="w-3.5 h-3.5 text-purple-200" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-[#246BFD]" />
                  )}
                  <span>
                    {isPrinting
                      ? (isRtl ? 'جاري الطباعة...' : 'Printing...')
                      : printerConfig.mode === 'usb'
                      ? (isRtl ? 'طباعة USB فورية' : 'Direct USB')
                      : printerConfig.mode === 'serial'
                      ? (isRtl ? 'طباعة Serial فورية' : 'Direct Serial')
                      : (isRtl ? 'طباعة الإيصال (80mm)' : 'Print Receipt')}
                  </span>
                </button>
              </div>
            </div>

            {/* Receipt Preview Container */}
            <div className="bg-[#F7F9FC] p-4 rounded-xl border border-[#E5EAF2]">
              <div 
                id="printable-receipt"
                dir="rtl"
                className="max-w-[340px] mx-auto bg-white p-4 rounded-lg shadow-sm font-mono text-[11px] text-[#172033] space-y-3 text-right"
              >
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-300">
                  {/* Merchant Logo */}
                  <div className="flex items-center justify-center mb-1.5">
                    {(liveTenant?.logo_url || tenant?.logo_url) ? (
                      <img
                        src={liveTenant?.logo_url || tenant?.logo_url}
                        alt={liveTenant?.name || tenant?.name || 'Merchant Logo'}
                        className="max-h-12 max-w-[130px] object-contain"
                      />
                    ) : (
                      <img
                        src="/logo.png"
                        alt="Merchant Logo"
                        width={48}
                        height={48}
                        className="object-contain max-h-12 mx-auto"
                      />
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-[#0B1730]">
                    {liveTenant?.name || tenant?.name || selectedSale.branch_name_ar || 'سستمهالي'}
                  </h3>
                  <p className="text-[10px] text-gray-500">{selectedSale.branch_address || 'القاهرة، مصر'}</p>
                  <p className="text-[10px] text-gray-500">{selectedSale.branch_phone || '01203356780'}</p>
                  <div className="font-bold pt-1 text-xs">{selectedSale.sale_number}</div>
                </div>

                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">التاريخ:</span>
                    <span className="font-sans">{new Date(selectedSale.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">الكاشير:</span>
                    <span>{selectedSale.cashier_name || 'الكاشير'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">العميل:</span>
                    <span>{selectedSale.customer_name || 'عميل نقدي'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">طريقة الدفع:</span>
                    <span>
                      {selectedSale.payment_method === 'card' ? 'بطاقة بنكية' :
                       selectedSale.payment_method === 'mobile_wallet' ? 'محفظة إلكترونية' :
                       selectedSale.payment_method === 'customer_credit' ? 'آجل (على الحساب)' : 'نقدي'}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="pt-2 border-t border-dashed border-gray-300">
                  <table className="w-full text-[10px] text-right border-collapse">
                    <thead>
                      <tr className="border-b border-black font-bold text-gray-600">
                        <th className="py-1 text-right">الصنف</th>
                        <th className="py-1 text-center">الكمية</th>
                        <th className="py-1 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-gray-300">
                      {selectedSale.items?.map((item: any, idx) => {
                        const productName = item.product_name_ar || item.product_name_en || item.product_name || item.name_ar || item.name_en || item.name || item.product?.name_ar || item.product?.name_en || 'صنف';
                        return (
                          <tr key={idx}>
                            <td className="py-1 font-semibold">
                              <div>{productName}</div>
                              <div className="text-[9px] text-gray-500 font-normal">
                                {item.quantity} × {Number(item.unit_price).toFixed(2)} ج.م
                              </div>
                            </td>
                            <td className="py-1 text-center align-top">{item.quantity}</td>
                            <td className="py-1 text-left font-bold align-top">{Number(item.line_total).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="pt-2 border-t border-dashed border-gray-300 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">المجموع الفرعي:</span>
                    <span className="font-bold">{selectedSale.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedSale.discount_amount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span>الخصم:</span>
                      <span>-{selectedSale.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSale.tax_amount > 0 && (
                    <div className="flex justify-between items-center text-gray-500">
                      <span>ضريبة القيمة المضافة (14%):</span>
                      <span>{selectedSale.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-sm text-[#0B1730] pt-1 border-t">
                    <span>الإجمالي النهائي:</span>
                    <span>{selectedSale.total_amount.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1">
                    <span>المدفوع:</span>
                    <span>{selectedSale.paid_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500">
                    <span>الباقي:</span>
                    <span>{selectedSale.change_amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="receipt-footer text-center pt-2 mt-2 text-[10px] text-gray-700 space-y-1 border-none">
                  <p>{receiptFooter || 'شكراً لتعاملكم معنا'}</p>
                  <div className="flex flex-col items-center justify-center pt-1 space-y-0.5 border-none">
                    <img src="/logo.png" alt="Sastmhaly Logo" width={26} height={26} className="object-contain max-h-6 mx-auto" />
                    <p className="font-bold text-[9px] tracking-wider text-gray-600">Powered by Sastmhaly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Return & Refund Workflow Modal (Scenario F) */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={isRtl ? `طلب إرجاع واسترداد للفاتورة ${saleToReturn?.sale_number}` : `Process Return & Refund for ${saleToReturn?.sale_number}`}
        size="md"
      >
        {saleToReturn && (
          <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{isRtl ? 'تنبيه تدقيق المرتجعات (Scenario F)' : 'Auditable Return Workflow (Scenario F)'}</p>
                <p className="text-[11px] mt-0.5">
                  {isRtl 
                    ? 'لا يتم حذف الفاتورة الأصلية أبداً؛ يتم إنشاء مستند إرجاع مستقل وقيد محاسبي عكسي مع استرجاع المخزون تلقائياً.'
                    : 'The original sale is never deleted. An auditable return record and reversal journal entry are recorded.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'مبلغ الاسترداد' : 'Refund Amount'}
              </label>
              <div className="p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg font-black text-sm text-[#0B1730]">
                {saleToReturn.total_amount.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'طريقة الاسترداد' : 'Refund Method'}
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cash">{isRtl ? 'نقداً من الصندوق (Cash)' : 'Cash Refund'}</option>
                <option value="card">{isRtl ? 'إرجاع للبطاقة (Card)' : 'Card Reversal'}</option>
                <option value="customer_credit">{isRtl ? 'رصيد دائن بحساب العميل (Store Credit)' : 'Customer Account Credit'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2 p-3 bg-[#F7F9FC] rounded-lg border border-[#E5EAF2]">
              <input
                type="checkbox"
                id="restockCheck"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                className="w-4 h-4 text-[#246BFD] rounded"
              />
              <label htmlFor="restockCheck" className="text-xs font-semibold text-[#172033] cursor-pointer">
                {isRtl ? 'إعادة المنتجات إلى المخزون كبضاعة صالحة (Restock)' : 'Return items to inventory balance (Restock)'}
              </label>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'سبب الإرجاع *' : 'Return Reason *'}
              </label>
              <textarea
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={isRtl ? 'مثال: طلب العميل استرجاع السلعة، تاريخ صلاحية قريب، تلف في التغليف...' : 'e.g. Customer change of mind, packaging damaged, etc.'}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingReturn}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {submittingReturn 
                  ? (isRtl ? 'جاري التنفيذ...' : 'Processing...') 
                  : (isRtl ? 'تأكيد الإرجاع والاسترداد' : 'Confirm Return & Refund')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Invoice WhatsApp Share Modal (Photo or Text) */}
      <InvoiceShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sale={shareModalSale}
        tenantName={liveTenant?.name || tenant?.name}
        tenantLogoUrl={liveTenant?.logo_url || tenant?.logo_url}
        receiptFooter={receiptFooter}
        branchAddress="القاهرة، مصر"
        branchPhone="01558516263"
        isRtl={isRtl}
      />
    </div>
  );
}
