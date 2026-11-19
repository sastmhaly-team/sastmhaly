'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Quotation, QuotationItem, Product, Customer } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { ExportButton } from '@/components/reports/ExportButton';
import { 
  FileText, Plus, Search, Filter, Printer, 
  CheckCircle2, Clock, ArrowRightCircle, Trash2, Edit3,
  Calendar, DollarSign, Layers, User, Phone, Check, X, Sparkles
} from 'lucide-react';

export default function QuotationsPage() {
  const { user, tenant, activeBranchId } = useAuth();
  const { t, isRtl, lang } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || 'tenant_albaraka';
  const currency = tenant?.currency || (isRtl ? 'ج.م' : 'EGP');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    valid_until: '',
    delivery_fee: 0,
    discount_amount: 0,
    notes: '',
    items: [] as {
      product_id?: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      discount_amount: number;
      line_total: number;
    }[]
  });

  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);

  const fetchQuotations = async () => {
    try {
      const res = await fetch(`/api/merchant/quotations?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.quotations) setQuotations(data.quotations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsAndCustomers = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        fetch(`/api/merchant/products?tenantId=${tenantId}`),
        fetch(`/api/merchant/customers?tenantId=${tenantId}`)
      ]);
      const prodData = await prodRes.json();
      const custData = await custRes.json();
      if (prodData.products) setProducts(prodData.products);
      if (custData.customers) setCustomers(custData.customers);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchProductsAndCustomers();
  }, [tenantId]);

  // Totals Calculation for Form
  const formSubtotal = useMemo(() => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [formData.items]);

  const formTotal = useMemo(() => {
    return Math.max(0, formSubtotal - Number(formData.discount_amount || 0) + Number(formData.delivery_fee || 0));
  }, [formSubtotal, formData.discount_amount, formData.delivery_fee]);

  const matchingProducts = useMemo(() => {
    if (!itemSearchTerm.trim()) return [];
    const term = itemSearchTerm.toLowerCase();
    return products.filter(p => 
      (p.name_ar && p.name_ar.toLowerCase().includes(term)) ||
      (p.name_en && p.name_en.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    ).slice(0, 10);
  }, [products, itemSearchTerm]);

  // Filtering
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = 
        q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.customer_name && q.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (q.customer_phone && q.customer_phone.includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchTerm, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = quotations.length;
    const active = quotations.filter(q => q.status === 'sent' || q.status === 'draft').length;
    const converted = quotations.filter(q => q.status === 'converted').length;
    const totalValue = quotations.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);
    return { total, active, converted, totalValue };
  }, [quotations]);

  const handleAddItem = (product?: Product) => {
    if (product) {
      setFormData(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: product.id,
            product_name: lang === 'ar' ? product.name_ar : product.name_en,
            quantity: 1,
            unit_price: product.selling_price,
            discount_amount: 0,
            line_total: product.selling_price
          }
        ]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            product_name: '',
            quantity: 1,
            unit_price: 0,
            discount_amount: 0,
            line_total: 0
          }
        ]
      }));
    }
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const next = [...prev.items];
      const it = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = Number(field === 'quantity' ? value : it.quantity) || 0;
        const price = Number(field === 'unit_price' ? value : it.unit_price) || 0;
        it.line_total = qty * price;
      }
      next[index] = it;
      return { ...prev, items: next };
    });
  };

  const handleOpenCreate = () => {
    setEditingQuotationId(null);
    const validUntilDefault = new Date();
    validUntilDefault.setDate(validUntilDefault.getDate() + 15);
    setFormData({
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      valid_until: validUntilDefault.toISOString().split('T')[0],
      delivery_fee: 0,
      discount_amount: 0,
      notes: isRtl ? 'العرض ساري لمدة 15 يوماً من تاريخه. الأسعار شاملة كافة المواصفات المذكورة.' : 'Valid for 15 days from date of issue.',
      items: [
        {
          product_name: '',
          quantity: 1,
          unit_price: 0,
          discount_amount: 0,
          line_total: 0
        }
      ]
    });
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (q: Quotation) => {
    setEditingQuotationId(q.id);
    setFormData({
      customer_id: q.customer_id || '',
      customer_name: q.customer_name || '',
      customer_phone: q.customer_phone || '',
      valid_until: q.valid_until || '',
      delivery_fee: q.delivery_fee || 0,
      discount_amount: q.discount_amount || 0,
      notes: q.notes || '',
      items: (q.items || []).map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount || 0,
        line_total: it.line_total
      }))
    });
    setCreateModalOpen(true);
  };

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      alert(isRtl ? 'يرجى إضافة بند واحد على الأقل في عرض السعر' : 'Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        branch_id: activeBranchId !== 'all' ? activeBranchId : undefined,
        customer_id: formData.customer_id || undefined,
        customer_name: formData.customer_name || undefined,
        customer_phone: formData.customer_phone || undefined,
        valid_until: formData.valid_until || undefined,
        delivery_fee: Number(formData.delivery_fee) || 0,
        discount_amount: Number(formData.discount_amount) || 0,
        subtotal: formSubtotal,
        total_amount: formTotal,
        notes: formData.notes,
        created_by: user?.full_name || user?.username || 'admin',
        items: formData.items
      };

      let res;
      if (editingQuotationId) {
        res = await fetch('/api/merchant/quotations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingQuotationId, ...payload })
        });
      } else {
        res = await fetch('/api/merchant/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        setCreateModalOpen(false);
        fetchQuotations();
      } else {
        alert(data.error || 'Failed to save quotation');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToSale = async (q: Quotation) => {
    if (!confirm(isRtl ? `هل أنت متأكد من تحويل عرض السعر (${q.quotation_number}) إلى فاتورة مبيعات مباشرة؟` : `Convert quotation ${q.quotation_number} to sale invoice?`)) {
      return;
    }

    setConvertingId(q.id);
    try {
      const res = await fetch('/api/merchant/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert',
          tenant_id: tenantId,
          quotationId: q.id,
          cashierId: user?.id,
          branchId: q.branch_id
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(isRtl ? `✓ تم تحويل عرض السعر بنجاح إلى فاتورة مبيعات رقم: ${data.saleNumber}` : `Successfully converted to sale #${data.saleNumber}`);
        fetchQuotations();
      } else {
        alert(data.error || 'Failed to convert quotation');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConvertingId(null);
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من حذف عرض السعر؟' : 'Are you sure you want to delete this quotation?')) {
      return;
    }
    try {
      const res = await fetch(`/api/merchant/quotations?tenantId=${tenantId}&id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchQuotations();
      } else {
        alert(data.error || 'Failed to delete quotation');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintQuotation = () => {
    const printable = document.getElementById('printable-quotation-a4');
    if (!printable) return;
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert(isRtl ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
      return;
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="${isRtl ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <title>عرض سعر - ${selectedQuotation?.quotation_number || ''}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Cairo', system-ui, -apple-system, sans-serif;
              padding: 12mm 15mm;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            img {
              max-height: 52px !important;
              max-width: 150px !important;
              object-fit: contain !important;
              display: block;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 14px !important;
              margin-bottom: 14px !important;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
              padding: 8px 10px !important;
              font-size: 11px !important;
              text-align: ${isRtl ? 'right' : 'left'} !important;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #1e293b !important;
              font-weight: 700 !important;
            }
            .no-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printable.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'converted':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" />{isRtl ? 'تم التحويل لفاتورة' : 'Converted'}</span>;
      case 'accepted':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><Check className="w-3 h-3" />{isRtl ? 'مقبول' : 'Accepted'}</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200"><X className="w-3 h-3" />{isRtl ? 'مرفوض' : 'Rejected'}</span>;
      case 'sent':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><Clock className="w-3 h-3" />{isRtl ? 'مرسل للعميل' : 'Sent'}</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200"><Clock className="w-3 h-3" />{isRtl ? 'مسودة' : 'Draft'}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0B1730] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#246BFD]" />
            <span>{isRtl ? 'عروض الأسعار الاحترافية' : 'Price Quotations'}</span>
          </h1>
          <p className="text-xs text-[#687386] mt-0.5">
            {isRtl ? 'إنشاء عروض أسعار للعملاء، طباعتها بتصميم احترافي A4، وتحويلها إلى فواتير بنقرة واحدة.' : 'Create, print professional quotations and convert directly to sales invoices.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            filename="quotations"
            data={filteredQuotations}
            headers={[
              { key: 'quotation_number', labelAr: 'رقم العرض', labelEn: 'Quote #' },
              { key: 'customer_name', labelAr: 'العميل', labelEn: 'Customer' },
              { key: 'customer_phone', labelAr: 'الهاتف', labelEn: 'Phone' },
              { key: 'total_amount', labelAr: 'الإجمالي', labelEn: 'Total' },
              { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
              { key: 'created_at', labelAr: 'تاريخ الإنشاء', labelEn: 'Date' },
            ]}
          />
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إنشاء عرض سعر جديد' : 'New Quotation'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
          <div className="text-[11px] text-[#687386] font-semibold">{isRtl ? 'إجمالي العروض' : 'Total Quotations'}</div>
          <div className="text-xl font-black text-[#0B1730] mt-1">{metrics.total}</div>
        </div>
        <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
          <div className="text-[11px] text-purple-700 font-semibold">{isRtl ? 'عروض سارية' : 'Active Offers'}</div>
          <div className="text-xl font-black text-purple-700 mt-1">{metrics.active}</div>
        </div>
        <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
          <div className="text-[11px] text-emerald-700 font-semibold">{isRtl ? 'تم تحويلها لمبيعات' : 'Converted to Sales'}</div>
          <div className="text-xl font-black text-emerald-700 mt-1">{metrics.converted}</div>
        </div>
        <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl">
          <div className="text-[11px] text-[#246BFD] font-semibold">{isRtl ? 'القيمة الإجمالية للعروض' : 'Total Value'}</div>
          <div className="text-xl font-black text-[#246BFD] mt-1">{metrics.totalValue.toFixed(2)} {currency}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-[#E5EAF2] rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#687386] absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث برقم العرض، اسم العميل، أو الهاتف...' : 'Search by quote #, customer, phone...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#687386] font-semibold">{isRtl ? 'الحالة:' : 'Status:'}</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-semibold outline-none focus:bg-white focus:border-[#246BFD] cursor-pointer"
          >
            <option value="all">{isRtl ? 'كافة الحالات' : 'All Statuses'}</option>
            <option value="draft">{isRtl ? 'مسودة' : 'Draft'}</option>
            <option value="sent">{isRtl ? 'مرسل للعميل' : 'Sent'}</option>
            <option value="accepted">{isRtl ? 'مقبول' : 'Accepted'}</option>
            <option value="converted">{isRtl ? 'تم التحويل لفاتورة' : 'Converted'}</option>
            <option value="rejected">{isRtl ? 'مرفوض' : 'Rejected'}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5EAF2] rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-[#687386] flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#246BFD] border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">{isRtl ? 'جاري تحميل عروض الأسعار...' : 'Loading quotations...'}</span>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="py-16 text-center text-[#687386]">
            <FileText className="w-12 h-12 text-[#CBD5E1] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#0B1730]">{isRtl ? 'لا توجد عروض أسعار مطابقة' : 'No quotations found'}</p>
            <p className="text-xs text-[#687386] mt-1">{isRtl ? 'ابدأ بإنشاء أول عرض سعر وتقديمه لعملائك.' : 'Start creating your first price offer.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'رقم العرض' : 'Quote #'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'تاريخ الإنشاء' : 'Date'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'صلاحية العرض' : 'Valid Until'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'بنود العرض' : 'Items'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الإجمالي' : 'Total'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#246BFD]">
                      {q.quotation_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#0B1730]">{q.customer_name || (isRtl ? 'عميل نقدي' : 'Cash Customer')}</div>
                      {q.customer_phone && <div className="text-[11px] text-[#687386] font-mono">{q.customer_phone}</div>}
                    </td>
                    <td className="py-3 px-4 text-[#687386] font-mono">
                      {q.created_at?.split('T')[0] || q.created_at}
                    </td>
                    <td className="py-3 px-4 text-[#687386] font-mono">
                      {q.valid_until || (isRtl ? 'غير محدد' : 'Open')}
                    </td>
                    <td className="py-3 px-4 text-[#0B1730] font-semibold">
                      {q.items?.length || 0} {isRtl ? 'صنف' : 'items'}
                    </td>
                    <td className="py-3 px-4 font-black text-[#0B1730]">
                      {Number(q.total_amount).toFixed(2)} {currency}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View & Print */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuotation(q);
                            setViewModalOpen(true);
                          }}
                          title={isRtl ? 'عرض وطباعة عرض السعر A4' : 'View & Print'}
                          className="p-1.5 rounded-lg text-[#246BFD] hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Convert to Sale */}
                        {q.status !== 'converted' && (
                          <button
                            type="button"
                            disabled={convertingId === q.id}
                            onClick={() => handleConvertToSale(q)}
                            title={isRtl ? 'تحويل مباشر لفاتورة مبيعات' : 'Convert to Sale'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'تحويل لفاتورة' : 'Convert'}</span>
                          </button>
                        )}

                        {/* Edit */}
                        {q.status !== 'converted' && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(q)}
                            title={isRtl ? 'تعديل عرض السعر' : 'Edit'}
                            className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuotation(q.id)}
                          title={isRtl ? 'حذف عرض السعر' : 'Delete'}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Quotation Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingQuotationId ? (isRtl ? 'تعديل عرض السعر' : 'Edit Quotation') : (isRtl ? 'إنشاء عرض سعر جديد' : 'New Quotation')}
        size="xl"
      >
        <form onSubmit={handleSubmitQuotation} className="space-y-4 text-xs">
          {/* Customer & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#F7F9FC] border border-[#E5EAF2] rounded-xl">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'العميل (اختر أو اكتب بالأسفل)' : 'Customer'}
              </label>
              <select
                value={formData.customer_id}
                onChange={(e) => {
                  const custId = e.target.value;
                  const found = customers.find(c => c.id === custId);
                  setFormData(prev => ({
                    ...prev,
                    customer_id: custId,
                    customer_name: found ? found.name : prev.customer_name,
                    customer_phone: found ? found.phone : prev.customer_phone
                  }));
                }}
                className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD]"
              >
                <option value="">{isRtl ? '-- عميل حر أو جديد --' : '-- Direct Customer --'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم العميل / الجهة *' : 'Customer Name *'}
              </label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder={isRtl ? 'شركة / أستاذ...' : 'Client Name'}
                className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'رقم الهاتف' : 'Phone'}
              </label>
              <input
                type="text"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="010XXXXXXXX"
                className="w-full p-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD]"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#0B1730] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#246BFD]" />
                <span>{isRtl ? 'بنود وأصناف عرض السعر' : 'Quotation Line Items'}</span>
              </span>

              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const prod = products.find(p => p.id === e.target.value);
                    if (prod) handleAddItem(prod);
                    e.target.value = '';
                  }}
                  className="px-2.5 py-1 bg-white border border-[#CBD5E1] text-[#0B1730] rounded-lg text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">{isRtl ? 'قائمة المنتجات...' : 'Browse products...'}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : p.name_en} ({p.selling_price} {currency})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="px-3 py-1 bg-[#0B1730] hover:bg-[#172033] text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  {isRtl ? '+ بند حر / خدمة' : '+ Custom Line'}
                </button>
              </div>
            </div>

            {/* Fast Product Search Bar */}
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-[#246BFD] absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  type="text"
                  value={itemSearchTerm}
                  onFocus={() => setShowItemSuggestions(true)}
                  onChange={(e) => {
                    setItemSearchTerm(e.target.value);
                    setShowItemSuggestions(true);
                  }}
                  placeholder={isRtl ? 'ابحث عن صنف بالاسم أو الباركود لإضافته فوراً لعرض السعر...' : 'Type product name or barcode to add instantly...'}
                  className="w-full ps-9 pe-8 py-2 bg-white border border-[#246BFD]/40 rounded-lg text-xs outline-none focus:border-[#246BFD] shadow-2xs"
                />
                {itemSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemSearchTerm('');
                      setShowItemSuggestions(false);
                    }}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showItemSuggestions && matchingProducts.length > 0 && (
                <div className="absolute z-30 start-0 end-0 mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {matchingProducts.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        handleAddItem(p);
                        setItemSearchTerm('');
                        setShowItemSuggestions(false);
                      }}
                      className="p-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-bold text-[#0B1730]">{lang === 'ar' ? p.name_ar : p.name_en}</div>
                        <div className="text-[10px] text-[#687386] font-mono">
                          {p.barcode} {p.sku ? `| SKU: ${p.sku}` : ''}
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="font-black text-[#246BFD] font-mono">
                          {p.selling_price} {currency}
                        </span>
                        <span className="block text-[10px] text-gray-500">
                          {isRtl ? 'المخزون:' : 'Stock:'} {p.current_stock ?? 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[#E5EAF2] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#F7F9FC] text-[#687386] border-b">
                  <tr>
                    <th className="p-2 text-start">{isRtl ? 'اسم الصنف / البيان' : 'Item Description'}</th>
                    <th className="p-2 text-center w-24">{isRtl ? 'الكمية' : 'Qty'}</th>
                    <th className="p-2 text-center w-28">{isRtl ? `السعر (${currency})` : 'Price'}</th>
                    <th className="p-2 text-end w-28">{isRtl ? 'الإجمالي' : 'Total'}</th>
                    <th className="p-2 text-center w-10">#</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {formData.items.map((item, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={item.product_name}
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          placeholder={isRtl ? 'وصف الصنف أو الخدمة...' : 'Item description...'}
                          className="w-full p-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded text-xs outline-none focus:bg-white focus:border-[#246BFD]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full p-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded text-xs text-center font-bold outline-none focus:bg-white focus:border-[#246BFD]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full p-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded text-xs text-center font-bold outline-none focus:bg-white focus:border-[#246BFD]"
                        />
                      </td>
                      <td className="p-2 text-end font-mono font-black text-[#0B1730]">
                        {(item.quantity * item.unit_price).toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary & Valid Until */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {isRtl ? 'تاريخ نهاية صلاحية العرض' : 'Valid Until Date'}
                </label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className="w-full p-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {isRtl ? 'شروط وأحكام العرض / ملاحظات (اضغط Enter لسطر جديد)' : 'Terms & Conditions / Notes'}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
                />
              </div>
            </div>

            <div className="p-4 bg-[#F7F9FC] border border-[#E5EAF2] rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#687386]">{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                <span className="font-mono font-bold">{formSubtotal.toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#687386]">{isRtl ? 'خصم خاص:' : 'Discount:'}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) || 0 })}
                  className="w-24 p-1 bg-white border border-[#E5EAF2] rounded text-end font-mono text-xs"
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#687386]">{isRtl ? 'رسوم التوصيل / النقل:' : 'Delivery / Shipping:'}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.delivery_fee}
                  onChange={(e) => setFormData({ ...formData, delivery_fee: Number(e.target.value) || 0 })}
                  className="w-24 p-1 bg-white border border-[#E5EAF2] rounded text-end font-mono text-xs"
                />
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-black text-sm text-[#0B1730]">{isRtl ? 'الإجمالي النهائي:' : 'Final Total:'}</span>
                <span className="font-black text-lg text-[#246BFD]">{formTotal.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submitting ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ عرض السعر' : 'Save Quotation')}
            </button>
          </div>
        </form>
      </Modal>

      {/* View & Print Professional A4 Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={isRtl ? `عرض سعر: ${selectedQuotation?.quotation_number}` : `Quotation: ${selectedQuotation?.quotation_number}`}
        size="xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePrintQuotation}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRtl ? 'طباعة عرض السعر (A4)' : 'Print (A4)'}</span>
            </button>
          </div>

          {/* Printable A4 Container */}
          <div id="printable-quotation-a4" className="bg-white p-6 border border-gray-200 rounded-xl space-y-4 text-[#0B1730]">
            {/* Store & Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #246BFD', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt="Logo" style={{ maxHeight: '48px', maxWidth: '140px', objectFit: 'contain', marginBottom: '6px' }} />
                ) : (
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#246BFD', marginBottom: '4px' }}>{tenant?.name || 'سستمهالي'}</div>
                )}
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0B1730' }}>{tenant?.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{tenant?.phone || ''}</div>
                {tenant?.tax_id && <div style={{ fontSize: '11px', color: '#64748b' }}>{isRtl ? 'الرقم الضريبي:' : 'Tax ID:'} {tenant.tax_id}</div>}
              </div>

              <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
                <span style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: '#F0F5FF', color: '#246BFD', fontWeight: 900, fontSize: '12px', borderRadius: '6px', marginBottom: '6px' }}>
                  {isRtl ? 'عرض سعر / PRICE QUOTATION' : 'PRICE QUOTATION'}
                </span>
                <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '13px', color: '#0B1730' }}>{selectedQuotation?.quotation_number}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                  {isRtl ? 'تاريخ العرض:' : 'Date:'} {selectedQuotation?.created_at?.split('T')[0]}
                </div>
                {selectedQuotation?.valid_until && (
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 700, fontFamily: 'monospace' }}>
                    {isRtl ? 'صالح حتى:' : 'Valid Until:'} {selectedQuotation.valid_until}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Details Box */}
            <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>{isRtl ? 'مقدم إلى السادة:' : 'Quotation Presented To:'}</span>
                <span style={{ fontWeight: 800, fontSize: '13px', color: '#0B1730' }}>{selectedQuotation?.customer_name || (isRtl ? 'عميل نقدي' : 'Valued Customer')}</span>
              </div>
              {selectedQuotation?.customer_phone && (
                <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block' }}>{isRtl ? 'رقم الهاتف:' : 'Phone:'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0B1730', fontSize: '12px' }}>{selectedQuotation.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: '35px', border: '1px solid #cbd5e1' }}>#</th>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'right' : 'left', border: '1px solid #cbd5e1' }}>{isRtl ? 'الصنف / البيان والمواصفات' : 'Description'}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: '60px', border: '1px solid #cbd5e1' }}>{isRtl ? 'الكمية' : 'Qty'}</th>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', width: '90px', border: '1px solid #cbd5e1' }}>{isRtl ? `سعر الوحدة (${currency})` : 'Unit Price'}</th>
                  <th style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', width: '90px', border: '1px solid #cbd5e1' }}>{isRtl ? `الإجمالي (${currency})` : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {selectedQuotation?.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0B1730', border: '1px solid #e2e8f0' }}>{it.product_name}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, border: '1px solid #e2e8f0' }}>{it.quantity}</td>
                    <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: 'monospace', border: '1px solid #e2e8f0' }}>{Number(it.unit_price).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: isRtl ? 'left' : 'right', fontFamily: 'monospace', fontWeight: 800, border: '1px solid #e2e8f0' }}>{Number(it.line_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Section */}
            <div className="no-break" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <div style={{ width: '240px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>{isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{Number(selectedQuotation?.subtotal).toFixed(2)} {currency}</span>
                </div>
                {Number(selectedQuotation?.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', marginBottom: '4px' }}>
                    <span>{isRtl ? 'الخصم:' : 'Discount:'}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>-{Number(selectedQuotation?.discount_amount).toFixed(2)} {currency}</span>
                  </div>
                )}
                {Number(selectedQuotation?.delivery_fee) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', marginBottom: '4px' }}>
                    <span>{isRtl ? 'رسوم التوصيل:' : 'Delivery Fee:'}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>+{Number(selectedQuotation?.delivery_fee).toFixed(2)} {currency}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '13px' }}>
                  <span>{isRtl ? 'الإجمالي النهائي:' : 'Total Amount:'}</span>
                  <span style={{ color: '#246BFD' }}>{Number(selectedQuotation?.total_amount).toFixed(2)} {currency}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="no-break" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '28px', textAlign: 'center', fontSize: '11px' }}>
              <div style={{ width: '180px' }}>
                <span style={{ fontWeight: 700, display: 'block', marginBottom: '24px' }}>{isRtl ? 'توقيع وختم المتجر' : 'Store Signature & Stamp'}</span>
                <div style={{ width: '130px', borderBottom: '1px solid #94a3b8', margin: '0 auto' }} />
              </div>
              <div style={{ width: '180px' }}>
                <span style={{ fontWeight: 700, display: 'block', marginBottom: '24px' }}>{isRtl ? 'موافقة وتوقيع العميل' : 'Customer Acceptance'}</span>
                <div style={{ width: '130px', borderBottom: '1px solid #94a3b8', margin: '0 auto' }} />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

