'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Supplier } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { ImportButton } from '@/components/ui/ImportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Building2, Plus, Search, Download, 
  CreditCard, Phone, Mail, FileText, CheckCircle2,
  Printer, Calendar, Layers, RefreshCw
} from 'lucide-react';

export default function SuppliersManagementPage() {
  const { user, tenant } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || 'tenant_albaraka';
  const currency = tenant?.currency || (isRtl ? 'ج.م' : 'EGP');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm]);

  // Add Supplier Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    tax_id: '',
    payment_terms: '30 Days Net',
    opening_balance: 0
  });
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Pay Supplier Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Statement Modal State
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementMode, setStatementMode] = useState<'all' | 'custom'>('all');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const fetchStatement = async (supplierId: string, from?: string, to?: string) => {
    setLoadingStatement(true);
    try {
      let url = `/api/merchant/statements?tenantId=${tenantId}&type=supplier&id=${supplierId}`;
      if (from) url += `&startDate=${from}`;
      if (to) url += `&endDate=${to}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStatementData(data.statement);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleOpenStatement = (sup: Supplier) => {
    setStatementSupplier(sup);
    setStatementMode('all');
    setStatementFromDate('');
    setStatementToDate('');
    setStatementData(null);
    setStatementModalOpen(true);
    fetchStatement(sup.id);
  };

  const fetchSuppliers = async () => {
    try {
      const url = `/api/merchant/suppliers?tenantId=${tenantId}`;
      const cached = getCachedData<any>(url);
      if (cached?.suppliers) {
        setSuppliers(cached.suppliers);
        setLoading(false);
      } else if (suppliers.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.suppliers) setSuppliers(data.suppliers);
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [tenantId]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = newSupplier.phone.trim();
    setSubmittingSupplier(true);
    try {
      const res = await fetch('/api/merchant/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...newSupplier,
          phone: cleanedPhone,
          opening_balance: Number(newSupplier.opening_balance) || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddModalOpen(false);
        setNewSupplier({
          code: '',
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          tax_id: '',
          payment_terms: '30 Days Net',
          opening_balance: 0
        });
        fetchSuppliers();
      } else {
        alert(data.error || 'Failed to create supplier');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !paymentAmount) return;
    setSubmittingPayment(true);
    try {
      const res = await fetch('/api/merchant/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payment',
          tenant_id: tenantId,
          supplier_id: selectedSupplier.id,
          payment_amount: Number(paymentAmount),
          payment_method: paymentMethod
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayModalOpen(false);
        setPaymentAmount('');
        fetchSuppliers();
      } else {
        alert(data.error || 'Failed to record payment');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm);
    const dateStr = (s as any).created_at ? (s as any).created_at.split('T')[0] : '';
    const matchesDate = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
    return matchesSearch && matchesDate;
  });

  const supplierExportHeaders = [
    { key: 'code', labelEn: 'Code', labelAr: 'الكود' },
    { key: 'name', labelEn: 'Supplier Name', labelAr: 'اسم المورد' },
    { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
    { key: 'payment_terms', labelEn: 'Payment Terms', labelAr: 'شروط السداد' },
    { key: 'current_balance', labelEn: 'Payable Balance (EGP)', labelAr: 'الرصيد المستحق (ج.م)' }
  ];

  const supplierImportColumns = [
    { key: 'name', labelAr: 'اسم المورد / الشركة', labelEn: 'Supplier Name', required: true, example: 'شركة الأهرام للتجارة' },
    { key: 'phone', labelAr: 'رقم الهاتف', labelEn: 'Phone Number', example: '01099887766' },
    { key: 'contact_person', labelAr: 'المسؤول / مندوب المبيعات', labelEn: 'Contact Person', example: 'أ / حسام الدين' },
    { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email', example: 'ahram@supply.com' },
    { key: 'tax_id', labelAr: 'السجل / البطاقة الضريبية', labelEn: 'Tax ID', example: '554-332-119' },
    { key: 'payment_terms', labelAr: 'شروط السداد', labelEn: 'Payment Terms', example: '30 Days Net' },
    { key: 'opening_balance', labelAr: 'رصيد أول المدة', labelEn: 'Opening Balance', example: '0' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'دليل الموردين والحسابات الدائنة' : 'Suppliers & Accounts Payable'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'إدارة حسابات الموردين، الأرصدة المستحقة، وشروط الدفع وسداد الالتزامات المالية'
              : 'Manage supplier directories, payable balances, payment terms, and cash outlays'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ImportButton
            entityNameAr="الموردين"
            entityNameEn="Suppliers"
            columns={supplierImportColumns}
            apiEndpoint="/api/merchant/suppliers"
            extraPayload={{ tenant_id: tenantId }}
            onSuccess={fetchSuppliers}
            sampleRows={[
              { name: 'شركة النيل للصناعات الغذائية', phone: '01234567890', contact_person: 'م / شريف', email: 'nile@foods.com', tax_id: '998-776-554', payment_terms: 'Cash on Delivery', opening_balance: 0 }
            ]}
          />

          <ExportButton
            filename="Suppliers"
            data={suppliers}
            headers={supplierExportHeaders}
            label={isRtl ? 'تصدير (CSV)' : 'Export CSV'}
          />

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إضافة مورد جديد' : 'Add Supplier'}</span>
          </button>
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث باسم المورد، الكود، أو رقم الهاتف...' : 'Search by name, code, or phone...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل الموردين...' : 'Loading suppliers...'}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
            <p className="text-sm font-semibold text-[#172033]">
              {isRtl ? 'لا يوجد موردون مسجلون' : 'No suppliers registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'اسم المورد' : 'Supplier Name'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الهاتف' : 'Phone'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'مسؤول الاتصال' : 'Contact Person'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'شروط السداد' : 'Terms'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الرصيد المستحق (دائن)' : 'Payable Balance'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredSuppliers.slice(0, visibleCount).map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#0B1730]">
                      {supplier.code}
                    </td>
                    <td className="py-3 px-4 text-[#172033] font-medium">
                      {supplier.name}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {supplier.phone}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {supplier.contact_person || '-'}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {supplier.payment_terms}
                    </td>
                    <td className="py-3 px-4 font-black">
                      <span className={supplier.current_balance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {supplier.current_balance.toFixed(2)} {currency}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStatement(supplier)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F0F5FF] text-[#246BFD] hover:bg-[#D0E2FF] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'كشف حساب' : 'Statement'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setPaymentAmount(supplier.current_balance > 0 ? String(supplier.current_balance) : '');
                            setPayModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B1730] hover:bg-[#172033] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-[#246BFD]" />
                          <span>{isRtl ? 'سداد دفعة' : 'Pay'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCount < filteredSuppliers.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isRtl ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filteredSuppliers.length - visibleCount})` : `Load More (+20 items - ${filteredSuppliers.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={isRtl ? 'إضافة مورد جديد' : 'Add New Supplier'}
        size="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'كود المورد *' : 'Supplier Code *'}
              </label>
              <input
                type="text"
                required
                placeholder="SUP-03"
                value={newSupplier.code}
                onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم المورد أو الشركة *' : 'Supplier Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={isRtl ? 'شركة جهينة للصناعات الغذائية' : 'Juhayna Food Industries'}
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'رقم الهاتف (اختياري)' : 'Phone (Optional)'}
              </label>
              <input
                type="text"
                placeholder={isRtl ? '+20... أو أي رقم' : '+... or phone'}
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'مسؤول الاتصال' : 'Contact Person'}
              </label>
              <input
                type="text"
                value={newSupplier.contact_person}
                onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'شروط السداد' : 'Payment Terms'}
              </label>
              <select
                value={newSupplier.payment_terms}
                onChange={(e) => setNewSupplier({ ...newSupplier, payment_terms: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="Cash on Delivery">{isRtl ? 'نقداً عند الاستلام (COD)' : 'Cash on Delivery'}</option>
                <option value="15 Days Net">{isRtl ? 'آجل 15 يوم' : '15 Days Net'}</option>
                <option value="30 Days Net">{isRtl ? 'آجل 30 يوم' : '30 Days Net'}</option>
                <option value="60 Days Net">{isRtl ? 'آجل 60 يوم' : '60 Days Net'}</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الرصيد الافتتاحي (ج.م)' : 'Opening Balance (EGP)'}
              </label>
              <input
                type="number"
                step="any"
                value={newSupplier.opening_balance}
                onChange={(e) => setNewSupplier({ ...newSupplier, opening_balance: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submittingSupplier}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submittingSupplier ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ المورد' : 'Save Supplier')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Supplier Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={isRtl ? `تسجيل سند صرف لمورد: ${selectedSupplier?.name}` : `Record Supplier Payment: ${selectedSupplier?.name}`}
        size="md"
      >
        {selectedSupplier && (
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            <div className="p-3 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{isRtl ? 'الرصيد المستحق الحالي:' : 'Current Payable Balance:'}</span>
                <span className="font-bold text-red-600">{selectedSupplier.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'مبلغ السداد (ج.م) *' : 'Payment Amount (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'طريقة الصرف' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cash">{isRtl ? 'نقداً من الصندوق (Cash)' : 'Cash'}</option>
                <option value="bank_transfer">{isRtl ? 'تحويل بنكي (Bank Transfer)' : 'Bank Transfer'}</option>
                <option value="cheque">{isRtl ? 'شيك بنكي (Cheque)' : 'Cheque'}</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {submittingPayment ? (isRtl ? 'جاري السداد...' : 'Processing...') : (isRtl ? 'تأكيد السداد والخصم' : 'Confirm Payment')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Account Statement Modal (كشف حساب المورد) */}
      <Modal
        isOpen={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        title={isRtl ? `كشف حساب مورد: ${statementSupplier?.name || ''}` : `Supplier Statement: ${statementSupplier?.name || ''}`}
        size="xl"
      >
        <div className="space-y-4 text-xs">
          {/* Filter Bar */}
          <div className="p-3 bg-[#F7F9FC] border border-[#E5EAF2] rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatementMode('all');
                  if (statementSupplier) fetchStatement(statementSupplier.id);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  statementMode === 'all' ? 'bg-[#246BFD] text-white' : 'bg-white border border-[#E5EAF2] text-[#687386]'
                }`}
              >
                {isRtl ? 'كشف حساب كامل (كافة المعاملات)' : 'Full Statement (All)'}
              </button>
              <button
                type="button"
                onClick={() => setStatementMode('custom')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  statementMode === 'custom' ? 'bg-[#246BFD] text-white' : 'bg-white border border-[#E5EAF2] text-[#687386]'
                }`}
              >
                {isRtl ? 'من فترة إلى فترة' : 'Custom Date Range'}
              </button>
            </div>

            {statementMode === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={statementFromDate}
                  onChange={(e) => setStatementFromDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#E5EAF2] rounded-lg text-xs"
                />
                <span className="text-[#687386]">{isRtl ? 'إلى' : 'to'}</span>
                <input
                  type="date"
                  value={statementToDate}
                  onChange={(e) => setStatementToDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#E5EAF2] rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (statementSupplier) fetchStatement(statementSupplier.id, statementFromDate, statementToDate);
                  }}
                  className="px-3 py-1.5 bg-[#0B1730] text-white rounded-lg font-bold hover:bg-[#172033]"
                >
                  {isRtl ? 'تطبيق' : 'Apply'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const printable = document.getElementById('supplier-statement-print');
                if (printable) {
                  const printWin = window.open('', '_blank');
                  if (printWin) {
                    printWin.document.write(`
                      <html dir="${isRtl ? 'rtl' : 'ltr'}">
                        <head>
                          <title>كشف حساب ${statementSupplier?.name}</title>
                          <style>
                            body { font-family: system-ui, sans-serif; padding: 20px; font-size: 12px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: ${isRtl ? 'right' : 'left'}; }
                            th { background: #f1f5f9; }
                            .header { margin-bottom: 20px; border-bottom: 2px solid #246BFD; padding-bottom: 10px; }
                          </style>
                        </head>
                        <body>
                          ${printable.innerHTML}
                          <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
                        </body>
                      </html>
                    `);
                    printWin.document.close();
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white font-bold rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isRtl ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
            </button>
          </div>

          {loadingStatement ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#687386]">
              <div className="w-6 h-6 border-2 border-[#246BFD] border-t-transparent rounded-full animate-spin mb-2" />
              <span>{isRtl ? 'جاري استخراج كشف الحساب...' : 'Generating statement...'}</span>
            </div>
          ) : statementData ? (
            <div id="supplier-statement-print" className="space-y-4 bg-white p-3 border border-[#E5EAF2] rounded-xl">
              {/* Summary Header */}
              <div className="header flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-base font-black text-[#0B1730]">{statementSupplier?.name}</h3>
                  <p className="text-[11px] text-[#687386]">كود المورد: {statementSupplier?.code} | الهاتف: {statementSupplier?.phone || '-'}</p>
                  <p className="text-[11px] text-[#687386]">
                    الفترة: {statementMode === 'all' ? (isRtl ? 'كافة المعاملات حتى اليوم' : 'All transactions') : `${statementFromDate || 'البداية'} إلى ${statementToDate || 'اليوم'}`}
                  </p>
                </div>
                <div className="text-end">
                  <div className="text-[11px] text-[#687386]">{isRtl ? 'الرصيد المستحق الحالي للمورد' : 'Current Due Balance'}</div>
                  <div className={`text-lg font-black ${statementData.currentBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {statementData.currentBalance?.toFixed(2)} {currency}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#F7F9FC] text-[#687386] border-b">
                    <tr>
                      <th className="p-2 text-start">#</th>
                      <th className="p-2 text-start">{isRtl ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2 text-start">{isRtl ? 'النوع' : 'Type'}</th>
                      <th className="p-2 text-start">{isRtl ? 'رقم الإذن / الفاتورة' : 'Reference'}</th>
                      <th className="p-2 text-end">{isRtl ? 'فواتير ومشتريات (+)' : 'Purchases (+)'}</th>
                      <th className="p-2 text-end">{isRtl ? 'مدفوعات وسداد (-)' : 'Payments (-)'}</th>
                      <th className="p-2 text-end">{isRtl ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    <tr className="bg-amber-50/50 font-bold">
                      <td colSpan={6} className="p-2 text-start text-[#B45309]">
                        {isRtl ? 'الرصيد الافتتاحي السابق' : 'Opening Balance'}
                      </td>
                      <td className="p-2 text-end font-mono">
                        {(statementData.openingBalance || 0).toFixed(2)} {currency}
                      </td>
                    </tr>
                    {statementData.transactions?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-[#687386]">
                          {isRtl ? 'لا توجد حركات مسجلة خلال هذه الفترة' : 'No movements in this period'}
                        </td>
                      </tr>
                    ) : (
                      statementData.transactions?.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 text-[#687386]">{idx + 1}</td>
                          <td className="p-2 text-[#0B1730] font-mono">{t.created_at?.split('T')[0] || t.created_at}</td>
                          <td className="p-2 font-semibold">
                            {t.transaction_type === 'purchase' ? (
                              <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{isRtl ? 'فاتورة مشتريات' : 'Purchase'}</span>
                            ) : (
                              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{isRtl ? 'سداد دفعة' : 'Payment'}</span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-[#0B1730]">{t.reference_number}</td>
                          <td className="p-2 text-end font-mono font-bold text-blue-600">
                            {t.credit > 0 ? `${t.credit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2 text-end font-mono font-bold text-emerald-600">
                            {t.debit > 0 ? `${t.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2 text-end font-mono font-black text-[#0B1730]">
                            {t.running_balance?.toFixed(2)} {currency}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-[#F7F9FC] font-bold border-t-2">
                    <tr>
                      <td colSpan={4} className="p-2 text-start">{isRtl ? 'إجمالي الحركات' : 'Totals'}</td>
                      <td className="p-2 text-end text-blue-600 font-mono font-black">
                        {statementData.totalCredit?.toFixed(2)} {currency}
                      </td>
                      <td className="p-2 text-end text-emerald-600 font-mono font-black">
                        {statementData.totalDebit?.toFixed(2)} {currency}
                      </td>
                      <td className="p-2 text-end font-mono font-black">
                        {statementData.currentBalance?.toFixed(2)} {currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end pt-2 border-t">
            <button
              type="button"
              onClick={() => setStatementModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
