'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Product, Branch } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { ExportButton } from '@/components/reports/ExportButton';
import { 
  ClipboardCheck, Search, Filter, Printer, 
  CheckCircle2, AlertTriangle, ArrowRightCircle, Plus, Minus,
  Calendar, DollarSign, Layers, Barcode, RotateCcw,
  Building2, Trash2, Check, FileText, Download, ShieldCheck
} from 'lucide-react';

interface StocktakingSession {
  id: string;
  tenant_id: string;
  branch_id: string;
  session_number: string;
  status: 'in_progress' | 'completed' | 'canceled';
  notes?: string;
  created_by: string;
  completed_at?: string;
  created_at: string;
  branches?: { name_ar: string; name_en: string };
  stocktaking_items?: any[];
}

export default function StocktakingPage() {
  const { user, tenant, activeBranchId } = useAuth();
  const { t, isRtl, lang } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || 'tenant_albaraka';
  const currency = tenant?.currency || (isRtl ? 'ج.م' : 'EGP');

  const [activeTab, setActiveTab] = useState<'count' | 'history'>('count');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [sessions, setSessions] = useState<StocktakingSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false);

  // Active Count State
  const [products, setProducts] = useState<Product[]>([]);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'match' | 'deficit' | 'surplus'>('all');
  const [submittingSession, setSubmittingSession] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // View / Print Past Session Modal
  const [viewModalOpen, setViewModalOpen] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<StocktakingSession | null>(null);
  const [loadingSessionDetails, setLoadingSessionDetails] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessRes, invRes] = await Promise.all([
        fetch(`/api/merchant/stocktaking?tenantId=${tenantId}${selectedBranchId && selectedBranchId !== 'all' ? `&branchId=${selectedBranchId}` : ''}`),
        fetch(`/api/merchant/stocktaking?tenantId=${tenantId}&mode=inventory${selectedBranchId && selectedBranchId !== 'all' ? `&branchId=${selectedBranchId}` : ''}`)
      ]);
      const sessData = await sessRes.json();
      const invData = await invRes.json();

      if (sessData.sessions) setSessions(sessData.sessions);
      if (invData.branches) {
        setBranches(invData.branches);
        if (!selectedBranchId && invData.branches.length > 0) {
          const main = invData.branches.find((b: any) => b.is_main) || invData.branches[0];
          setSelectedBranchId(main.id);
        }
      }
      if (invData.products) {
        setProducts(invData.products);
        // Initialize counted quantities with current stock or empty
        const initialCount: Record<string, number> = {};
        invData.products.forEach((p: Product) => {
          initialCount[p.id] = Number(p.current_stock || 0);
        });
        setCountedQuantities(initialCount);
      }
    } catch (e) {
      console.error('Failed to load stocktaking data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, selectedBranchId]);

  // Handle Barcode Scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matchedProduct = products.find(p => p.barcode === code || p.sku === code || p.additional_barcodes?.includes(code));
    if (matchedProduct) {
      setCountedQuantities(prev => ({
        ...prev,
        [matchedProduct.id]: (prev[matchedProduct.id] ?? Number(matchedProduct.current_stock || 0)) + 1
      }));
      setBarcodeInput('');
    } else {
      alert(isRtl ? 'الباركود غير موجود في قائمة المنتجات' : 'Barcode not found');
    }
    barcodeInputRef.current?.focus();
  };

  // Adjust quantity with + or -
  const handleQuantityAdjust = (productId: string, delta: number) => {
    setCountedQuantities(prev => {
      const current = prev[productId] ?? 0;
      return {
        ...prev,
        [productId]: Math.max(0, current + delta)
      };
    });
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const name = (lang === 'ar' ? p.name_ar : p.name_en) || p.name_ar || p.name_en;
      const matchesSearch = 
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const expected = Number(p.current_stock || 0);
      const counted = countedQuantities[p.id] ?? expected;
      const diff = counted - expected;

      if (varianceFilter === 'match') return diff === 0;
      if (varianceFilter === 'deficit') return diff < 0;
      if (varianceFilter === 'surplus') return diff > 0;
      return true;
    });
  }, [products, searchTerm, varianceFilter, countedQuantities, lang]);

  // Financial & Count Metrics
  const metrics = useMemo(() => {
    let totalItems = products.length;
    let matchedCount = 0;
    let deficitCount = 0;
    let surplusCount = 0;
    let totalDeficitCost = 0;
    let totalSurplusCost = 0;
    let totalStockValuation = 0;

    products.forEach(p => {
      const expected = Number(p.current_stock || 0);
      const counted = countedQuantities[p.id] ?? expected;
      const diff = counted - expected;
      const cost = Number(p.cost_price || 0);

      totalStockValuation += counted * cost;

      if (diff === 0) {
        matchedCount++;
      } else if (diff < 0) {
        deficitCount++;
        totalDeficitCost += Math.abs(diff) * cost;
      } else {
        surplusCount++;
        totalSurplusCost += diff * cost;
      }
    });

    const netVarianceCost = totalSurplusCost - totalDeficitCost;

    return {
      totalItems,
      matchedCount,
      deficitCount,
      surplusCount,
      totalDeficitCost,
      totalSurplusCost,
      netVarianceCost,
      totalStockValuation
    };
  }, [products, countedQuantities]);

  // Save Stocktaking Session
  const handleSaveSession = async (autoApprove: boolean = false) => {
    if (products.length === 0) {
      alert(isRtl ? 'لا توجد أصناف للجرد' : 'No products to count');
      return;
    }

    if (autoApprove) {
      const ok = confirm(isRtl 
        ? 'هل أنت متأكد من اعتماد الجرد وتحديث أرصدة المستودع الفعلية تلقائياً؟ سيتم تسجيل حركات التسوية المخزنية لكافة الفروقات.' 
        : 'Are you sure you want to approve this stocktake and apply balance adjustments?');
      if (!ok) return;
    }

    setSubmittingSession(true);
    try {
      const itemsPayload = products.map(p => {
        const expected = Number(p.current_stock || 0);
        const counted = countedQuantities[p.id] ?? expected;
        const diff = counted - expected;
        const cost = Number(p.cost_price || 0);
        return {
          product_id: p.id,
          expected_qty: expected,
          counted_qty: counted,
          discrepancy_qty: diff,
          cost_impact: Number((diff * cost).toFixed(2)),
          notes: itemNotes[p.id] || null
        };
      });

      const res = await fetch('/api/merchant/stocktaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          branchId: selectedBranchId,
          notes: sessionNotes,
          created_by: user?.full_name || user?.username || 'admin',
          items: itemsPayload
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save session');

      const savedSession = data.session;

      if (autoApprove && savedSession?.id) {
        const applyRes = await fetch('/api/merchant/stocktaking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            action: 'apply',
            sessionId: savedSession.id,
            approvedBy: user?.full_name || 'admin'
          })
        });
        const applyData = await applyRes.json();
        if (!applyRes.ok) throw new Error(applyData.error || 'Failed to apply adjustments');
        alert(isRtl ? '✓ تم اعتماد الجرد وتسوية أرصدة المخزون بنجاح!' : 'Stocktake approved and balances updated!');
      } else {
        alert(isRtl ? '✓ تم حفظ مسودة الجرد بنجاح!' : 'Stocktake draft saved!');
      }

      fetchData();
      setActiveTab('history');
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setSubmittingSession(false);
    }
  };

  // Open past session details
  const handleOpenSessionDetails = async (session: StocktakingSession) => {
    setSelectedSession(session);
    setViewModalOpen(true);
    setLoadingSessionDetails(true);
    try {
      const res = await fetch(`/api/merchant/stocktaking?tenantId=${tenantId}&sessionId=${session.id}`);
      const data = await res.json();
      if (data.session) setSelectedSession(data.session);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessionDetails(false);
    }
  };

  // Print Protocol
  const handlePrintAuditProtocol = (elementId: string) => {
    const printable = document.getElementById(elementId);
    if (!printable) return;
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <html dir="${isRtl ? 'rtl' : 'ltr'}">
          <head>
            <title>محضر جرد مخزني رسمي</title>
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; font-size: 11px; color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: ${isRtl ? 'right' : 'left'}; }
              th { background: #f8fafc; font-weight: bold; }
              .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
              .signatures { margin-top: 35px; display: flex; justify-content: space-between; page-break-inside: avoid; }
              .sig-box { width: 30%; border-top: 1px solid #64748b; padding-top: 5px; text-align: center; }
            </style>
          </head>
          <body>
            ${printable.innerHTML}
            <div class="signatures">
              <div class="sig-box">
                <strong>أمين المخزن / مسؤول العهدة</strong><br/><br/>التوقيع: .....................
              </div>
              <div class="sig-box">
                <strong>رئيس لجنة الجرد</strong><br/><br/>التوقيع: .....................
              </div>
              <div class="sig-box">
                <strong>اعتماد المدير العام / المالي</strong><br/><br/>التوقيع: .....................
              </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 350); };</script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730] flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#246BFD]" />
            <span>{isRtl ? 'الجرد المخزني وتسوية العهدة' : 'Physical Stocktaking & Inventory Audit'}</span>
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'مطابقة الأرصدة الفعلية للمخزون مع الأرصدة الدفترية، واكتشاف العجز والزيادة، واعتماد التسويات' 
              : 'Physical stock count verification, variance auditing, and automatic ledger adjustments'}
          </p>
        </div>

        {/* Branch Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#687386]" />
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 bg-white border border-[#E5EAF2] rounded-lg text-xs font-bold outline-none focus:border-[#246BFD] cursor-pointer"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name_ar || b.name_en}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAF2] text-xs font-bold gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('count')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'count' ? 'border-[#246BFD] text-[#246BFD]' : 'border-transparent text-[#687386] hover:text-[#0B1730]'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>{isRtl ? 'جلسة الجرد النشطة (العد الفعلي)' : 'Active Stocktaking Count'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'history' ? 'border-[#246BFD] text-[#246BFD]' : 'border-transparent text-[#687386] hover:text-[#0B1730]'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isRtl ? 'سجل جلسات الجرد السابقة ومحاضر التسوية' : 'Past Stocktake Sessions & History'}</span>
        </button>
      </div>

      {activeTab === 'count' ? (
        <div className="space-y-4">
          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
              <div className="text-[11px] text-[#687386] font-semibold">{isRtl ? 'إجمالي الأصناف' : 'Total Items'}</div>
              <div className="text-xl font-black text-[#0B1730] mt-1">{metrics.totalItems}</div>
            </div>
            <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
              <div className="text-[11px] text-emerald-700 font-semibold">{isRtl ? 'أصناف مطابقة تماماً' : 'Matched Items'}</div>
              <div className="text-xl font-black text-emerald-700 mt-1">{metrics.matchedCount}</div>
            </div>
            <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
              <div className="text-[11px] text-red-600 font-semibold">{isRtl ? 'أصناف بها عجز (نقص)' : 'Deficit Items'}</div>
              <div className="text-xl font-black text-red-600 mt-1">
                {metrics.deficitCount}
                <span className="text-xs font-normal ms-2">(-{metrics.totalDeficitCost.toFixed(2)} {currency})</span>
              </div>
            </div>
            <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
              <div className="text-[11px] text-amber-600 font-semibold">{isRtl ? 'أصناف بها زيادة' : 'Surplus Items'}</div>
              <div className="text-xl font-black text-amber-600 mt-1">
                {metrics.surplusCount}
                <span className="text-xs font-normal ms-2">(+{metrics.totalSurplusCost.toFixed(2)} {currency})</span>
              </div>
            </div>
          </div>

          {/* Barcode Fast Scan & Search Filter */}
          <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl flex flex-wrap items-center justify-between gap-3">
            {/* Quick Barcode Scanner */}
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-[#246BFD] absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={isRtl ? 'مرر قارئ الباركود أو اكتب الباركود للعد السريع...' : 'Scan barcode for instant count increment...'}
                  className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#246BFD]/40 rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isRtl ? 'إضافة (+1)' : 'Count'}
              </button>
            </form>

            {/* Search Filter */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-[#687386] absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'بحث باسم الصنف أو الباركود...' : 'Search product...'}
                className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            {/* Variance Status Filter */}
            <div className="flex items-center gap-1.5 bg-[#F7F9FC] p-1 border border-[#E5EAF2] rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setVarianceFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors ${varianceFilter === 'all' ? 'bg-white shadow-2xs text-[#246BFD] font-bold' : 'text-[#687386]'}`}
              >
                {isRtl ? 'الكل' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('match')}
                className={`px-2.5 py-1 rounded transition-colors ${varianceFilter === 'match' ? 'bg-white shadow-2xs text-emerald-700 font-bold' : 'text-[#687386]'}`}
              >
                {isRtl ? 'مطابق' : 'Matched'}
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('deficit')}
                className={`px-2.5 py-1 rounded transition-colors ${varianceFilter === 'deficit' ? 'bg-white shadow-2xs text-red-600 font-bold' : 'text-[#687386]'}`}
              >
                {isRtl ? 'عجز' : 'Deficit'}
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('surplus')}
                className={`px-2.5 py-1 rounded transition-colors ${varianceFilter === 'surplus' ? 'bg-white shadow-2xs text-amber-600 font-bold' : 'text-[#687386]'}`}
              >
                {isRtl ? 'زيادة' : 'Surplus'}
              </button>
            </div>
          </div>

          {/* Active Inventory Count Table */}
          <div className="bg-white border border-[#E5EAF2] rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                  <tr>
                    <th className="py-3 px-3 text-start w-12">#</th>
                    <th className="py-3 px-3 text-start">{isRtl ? 'الصنف والباركود' : 'Product & Barcode'}</th>
                    <th className="py-3 px-3 text-start">{isRtl ? 'الوحدة' : 'Unit'}</th>
                    <th className="py-3 px-3 text-center">{isRtl ? 'الرصيد الدفتري (المتوقع)' : 'Expected Qty'}</th>
                    <th className="py-3 px-3 text-center w-48">{isRtl ? 'الرصيد الفعلي (المجرود)' : 'Counted Qty'}</th>
                    <th className="py-3 px-3 text-center">{isRtl ? 'الفرق (الانحراف)' : 'Discrepancy'}</th>
                    <th className="py-3 px-3 text-end">{isRtl ? `التكلفة (${currency})` : 'Cost Price'}</th>
                    <th className="py-3 px-3 text-end">{isRtl ? `الأثر المالي (${currency})` : 'Cost Impact'}</th>
                    <th className="py-3 px-3 text-start min-w-[150px]">{isRtl ? 'ملاحظات الصنف' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#687386]">
                        <div className="w-6 h-6 border-2 border-[#246BFD] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>{isRtl ? 'جاري تحميل قائمة المخزون...' : 'Loading inventory...'}</span>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#687386]">
                        {isRtl ? 'لا توجد أصناف مطابقة لخيارات البحث' : 'No products found'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const expected = Number(p.current_stock || 0);
                      const counted = countedQuantities[p.id] ?? expected;
                      const diff = counted - expected;
                      const cost = Number(p.cost_price || 0);
                      const costImpact = diff * cost;
                      const name = (lang === 'ar' ? p.name_ar : p.name_en) || p.name_ar || p.name_en;

                      return (
                        <tr 
                          key={p.id}
                          className={`hover:bg-[#F7F9FC]/60 transition-colors ${
                            diff < 0 ? 'bg-red-50/30' : diff > 0 ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-[#687386] font-mono">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#0B1730]">{name}</div>
                            <div className="text-[11px] text-[#687386] font-mono">
                              SKU: {p.sku} | {p.barcode}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[#687386]">
                            {p.custom_unit || (p.is_weighted ? (isRtl ? 'كجم' : 'kg') : (isRtl ? 'قطعة' : 'piece'))}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-[#687386]">
                            {expected}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuantityAdjust(p.id, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={countedQuantities[p.id] ?? expected}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setCountedQuantities(prev => ({
                                    ...prev,
                                    [p.id]: isNaN(val) ? 0 : val
                                  }));
                                }}
                                className="w-20 py-1 px-2 bg-white border border-[#CBD5E1] rounded text-center font-mono font-bold text-sm outline-none focus:border-[#246BFD]"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuantityAdjust(p.id, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {diff === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" />
                                {isRtl ? 'مطابق' : 'Match'}
                              </span>
                            ) : diff < 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 font-mono">
                                {diff} ({isRtl ? 'عجز' : 'Deficit'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 font-mono">
                                +{diff} ({isRtl ? 'زيادة' : 'Surplus'})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-end font-mono">
                            {cost.toFixed(2)}
                          </td>
                          <td className={`py-3 px-3 text-end font-mono font-bold ${
                            costImpact < 0 ? 'text-red-600' : costImpact > 0 ? 'text-amber-600' : 'text-[#687386]'
                          }`}>
                            {costImpact.toFixed(2)}
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={itemNotes[p.id] || ''}
                              onChange={(e) => setItemNotes({ ...itemNotes, [p.id]: e.target.value })}
                              placeholder={isRtl ? 'سبب الفارق...' : 'Reason / Note...'}
                              className="w-full py-1 px-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded text-[11px] outline-none focus:bg-white focus:border-[#246BFD]"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar & General Notes */}
          <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2">
              <label className="block text-gray-700 font-semibold mb-1 text-xs">
                {isRtl ? 'ملاحظات عامة على جلسة الجرد / توصيات اللجنة:' : 'Audit Notes & Recommendations:'}
              </label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder={isRtl ? 'مثال: جرد نهاية العام الدوري لمستودع الفرع الرئيسي...' : 'e.g. End of year physical audit...'}
                className="w-full p-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handlePrintAuditProtocol('active-audit-print-preview')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#CBD5E1] text-[#0B1730] hover:bg-gray-50 rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#246BFD]" />
                <span>{isRtl ? 'طباعة محضر الجرد' : 'Print Protocol'}</span>
              </button>

              <button
                type="button"
                disabled={submittingSession}
                onClick={() => handleSaveSession(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#246BFD] text-[#246BFD] hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{isRtl ? 'حفظ كمسودة' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                disabled={submittingSession}
                onClick={() => handleSaveSession(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {submittingSession 
                    ? (isRtl ? 'جاري الاعتماد...' : 'Approving...') 
                    : (isRtl ? 'اعتماد الجرد وتسوية الأرصدة تلقائياً' : 'Approve & Adjust Stock')}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white border border-[#E5EAF2] rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'رقم جلسة الجرد' : 'Session #'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الفرع' : 'Branch'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'تاريخ الجرد' : 'Date'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'مسؤول الجرد' : 'Auditor'}</th>
                  <th className="py-3 px-4 text-center">{isRtl ? 'الأصناف المجرودة' : 'Items'}</th>
                  <th className="py-3 px-4 text-center">{isRtl ? 'حالة الجرد' : 'Status'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#687386]">
                      <div className="w-6 h-6 border-2 border-[#246BFD] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>{isRtl ? 'جاري تحميل سجلات الجرد...' : 'Loading history...'}</span>
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#687386]">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-bold text-[#0B1730]">{isRtl ? 'لا توجد جلسات جرد سابقة' : 'No past stocktaking sessions'}</p>
                      <p className="text-[11px] text-[#687386] mt-1">{isRtl ? 'قم بإجراء أول عملية جرد واعتمادها لتظهر هنا.' : 'Start your first count.'}</p>
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#246BFD]">
                        {s.session_number}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0B1730]">
                        {s.branches?.name_ar || s.branches?.name_en || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#687386]">
                        {s.created_at?.split('T')[0] || s.created_at}
                      </td>
                      <td className="py-3 px-4 text-[#0B1730]">
                        {s.created_by}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {s.stocktaking_items?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isRtl ? 'معتمد ومسوى' : 'Approved'}
                          </span>
                        ) : s.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            {isRtl ? 'مسودة قيد العد' : 'Draft'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-800">
                            {isRtl ? 'ملغي' : 'Canceled'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-end">
                        <button
                          type="button"
                          onClick={() => handleOpenSessionDetails(s)}
                          className="px-3 py-1 bg-white border border-[#CBD5E1] hover:border-[#246BFD] hover:text-[#246BFD] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          {isRtl ? 'عرض ومحضر الجرد' : 'View Protocol'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden Container for Active Stocktake Printing */}
      <div id="active-audit-print-preview" className="hidden">
        <div className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{tenant?.name || 'سستمهالي ERP'}</h2>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>محضر جرد مخزني فعلي وحصر الفروقات</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                الفرع: {branches.find(b => b.id === selectedBranchId)?.name_ar || 'الرئيسي'} | التاريخ: {new Date().toLocaleDateString('ar-EG')}
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold' }}>إجمالي تقييم المخزون المجرود:</p>
              <h3 style={{ margin: '2px 0', fontSize: '15px', color: '#2563eb' }}>{metrics.totalStockValuation.toFixed(2)} {currency}</h3>
              <p style={{ margin: 0, fontSize: '11px', color: metrics.netVarianceCost < 0 ? '#dc2626' : '#16a34a' }}>
                صافي الفارق: {metrics.netVarianceCost > 0 ? '+' : ''}{metrics.netVarianceCost.toFixed(2)} {currency}
              </p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف والباركود</th>
              <th>الوحدة</th>
              <th>الرصيد الدفتري</th>
              <th>الرصيد الفعلي</th>
              <th>الفرق</th>
              <th>سعر التكلفة</th>
              <th>الأثر المالي</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const exp = Number(p.current_stock || 0);
              const cnt = countedQuantities[p.id] ?? exp;
              const diff = cnt - exp;
              const cost = Number(p.cost_price || 0);
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td>{p.name_ar} ({p.barcode})</td>
                  <td>{p.custom_unit || (p.is_weighted ? 'كجم' : 'قطعة')}</td>
                  <td style={{ textAlign: 'center' }}>{exp}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{cnt}</td>
                  <td style={{ textAlign: 'center', color: diff < 0 ? '#dc2626' : diff > 0 ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td style={{ textAlign: 'right' }}>{cost.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(diff * cost).toFixed(2)}</td>
                  <td>{itemNotes[p.id] || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View Past Stocktaking Session Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={isRtl ? `تفاصيل محضر الجرد رقم: ${selectedSession?.session_number || ''}` : `Stocktake Details: ${selectedSession?.session_number || ''}`}
        size="xl"
      >
        {selectedSession && (
          <div className="space-y-4 text-xs">
            {/* Header Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2]">
              <div>
                <span className="font-bold text-[#0B1730] text-sm">
                  {selectedSession.branches?.name_ar || selectedSession.branches?.name_en || 'الفرع'}
                </span>
                <span className="text-[#687386] ms-2">
                  ({selectedSession.created_at?.split('T')[0]})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintAuditProtocol('past-session-print')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'طباعة المحضر الرسمي' : 'Print Protocol'}</span>
                </button>
              </div>
            </div>

            {loadingSessionDetails ? (
              <div className="py-12 text-center text-[#687386]">
                <div className="w-6 h-6 border-2 border-[#246BFD] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>{isRtl ? 'جاري تحميل تفاصيل الجرد...' : 'Loading details...'}</span>
              </div>
            ) : (
              <div id="past-session-print" className="space-y-3 bg-white p-3 border border-[#E5EAF2] rounded-xl">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <h3 className="text-base font-black text-[#0B1730]">
                      محضر جرد رسمي رقم: {selectedSession.session_number}
                    </h3>
                    <p className="text-[11px] text-[#687386]">
                      تاريخ الجرد: {selectedSession.created_at?.split('T')[0]} | المسؤول: {selectedSession.created_by}
                    </p>
                    {selectedSession.notes && (
                      <p className="text-[11px] text-gray-700 mt-1">توصيات وملاحظات: {selectedSession.notes}</p>
                    )}
                  </div>
                  <div className="text-end">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedSession.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {selectedSession.status === 'completed' ? (isRtl ? 'معتمد ومسوى' : 'Approved') : (isRtl ? 'مسودة' : 'Draft')}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs border border-[#E5EAF2]">
                    <thead className="bg-[#F7F9FC] text-[#687386] font-semibold border-b">
                      <tr>
                        <th className="p-2 text-start">#</th>
                        <th className="p-2 text-start">{isRtl ? 'الصنف' : 'Product'}</th>
                        <th className="p-2 text-center">{isRtl ? 'الدفتري' : 'Expected'}</th>
                        <th className="p-2 text-center">{isRtl ? 'الفعلي' : 'Counted'}</th>
                        <th className="p-2 text-center">{isRtl ? 'الفارق' : 'Diff'}</th>
                        <th className="p-2 text-end">{isRtl ? 'الأثر المالي' : 'Cost Impact'}</th>
                        <th className="p-2 text-start">{isRtl ? 'الملاحظات' : 'Notes'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAF2]">
                      {selectedSession.stocktaking_items?.map((it: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2 font-mono text-[#687386]">{i + 1}</td>
                          <td className="p-2 font-bold text-[#0B1730]">
                            {it.products?.name_ar || it.products?.name_en || 'صنف'}
                            <span className="block text-[10px] text-[#687386] font-mono">{it.products?.barcode}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{it.expected_qty}</td>
                          <td className="p-2 text-center font-mono font-bold">{it.counted_qty}</td>
                          <td className={`p-2 text-center font-mono font-bold ${
                            it.discrepancy_qty < 0 ? 'text-red-600' : it.discrepancy_qty > 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {it.discrepancy_qty > 0 ? `+${it.discrepancy_qty}` : it.discrepancy_qty}
                          </td>
                          <td className="p-2 text-end font-mono font-bold">
                            {Number(it.cost_impact || 0).toFixed(2)} {currency}
                          </td>
                          <td className="p-2 text-gray-600">{it.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

