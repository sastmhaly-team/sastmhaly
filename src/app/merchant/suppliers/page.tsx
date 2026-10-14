'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Supplier } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { 
  Building2, Plus, Search, Download, 
  CreditCard, Phone, Mail, FileText, CheckCircle2
} from 'lucide-react';

export default function SuppliersManagementPage() {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/merchant/suppliers?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.suppliers) setSuppliers(data.suppliers);
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
    const cleanedPhone = newSupplier.phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      alert(isRtl ? 'رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط' : 'Phone number must be exactly 11 digits');
      return;
    }
    setSubmittingSupplier(true);
    try {
      const res = await fetch('/api/merchant/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...newSupplier,
          phone: cleanedPhone,
          opening_balance: Number(newSupplier.opening_balance)
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

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm)
  );

  const exportSuppliersCsv = () => {
    const headers = [
      { key: 'code', labelEn: 'Code', labelAr: 'الكود' },
      { key: 'name', labelEn: 'Supplier Name', labelAr: 'اسم المورد' },
      { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
      { key: 'payment_terms', labelEn: 'Payment Terms', labelAr: 'شروط السداد' },
      { key: 'current_balance', labelEn: 'Payable Balance (EGP)', labelAr: 'الرصيد المستحق (ج.م)' }
    ];
    exportToCsv(`Suppliers_${new Date().toISOString().split('T')[0]}`, filteredSuppliers, headers, isRtl);
  };

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

        <div className="flex items-center gap-2">
          <button
            onClick={exportSuppliersCsv}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#E5EAF2] hover:bg-[#F7F9FC] text-[#172033] rounded-lg text-xs font-semibold shadow-xs"
          >
            <Download className="w-4 h-4 text-[#246BFD]" />
            <span>{isRtl ? 'تصدير (CSV)' : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إضافة مورد جديد' : 'Add Supplier'}</span>
          </button>
        </div>
      </div>

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
                        {supplier.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <button
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setPaymentAmount(supplier.current_balance > 0 ? String(supplier.current_balance) : '');
                          setPayModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B1730] hover:bg-[#172033] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-[#246BFD]" />
                        <span>{isRtl ? 'سداد دفعة' : 'Pay Supplier'}</span>
                      </button>
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
                {isRtl ? 'رقم الهاتف *' : 'Phone *'}
              </label>
              <input
                type="tel"
                required
                placeholder="010XXXXXXXX"
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
    </div>
  );
}
