'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Customer } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Users, Plus, Search, Download, 
  CreditCard, Phone, Sparkles, AlertTriangle, Edit3, PlusCircle
} from 'lucide-react';

export default function CustomersManagementPage() {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm]);

  // Add Customer Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    credit_limit: 2000
  });
  const [submittingCustomer, setSubmittingCustomer] = useState(false);

  // Collect Payment Modal
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [submittingCollect, setSubmittingCollect] = useState(false);

  // Add Debt Modal (تسجيل مديونية)
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [newDebtAmount, setNewDebtAmount] = useState('');
  const [submittingDebt, setSubmittingDebt] = useState(false);

  // Update Credit Limit Modal (تعديل الحد الائتماني)
  const [creditLimitModalOpen, setCreditLimitModalOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [submittingCreditLimit, setSubmittingCreditLimit] = useState(false);

  const fetchCustomers = async () => {
    try {
      const url = `/api/merchant/customers?tenantId=${tenantId}`;
      const cached = getCachedData<any>(url);
      if (cached?.customers) {
        setCustomers(cached.customers);
        setLoading(false);
      } else if (customers.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.customers) setCustomers(data.customers);
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [tenantId]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = newCustomer.phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      alert(isRtl ? 'رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط' : 'Phone number must be exactly 11 digits');
      return;
    }
    setSubmittingCustomer(true);
    try {
      const res = await fetch('/api/merchant/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...newCustomer,
          phone: cleanedPhone,
          credit_limit: Number(newCustomer.credit_limit)
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddModalOpen(false);
        setNewCustomer({
          code: '',
          name: '',
          phone: '',
          email: '',
          address: '',
          tax_id: '',
          credit_limit: 2000
        });
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to create customer');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingCustomer(false);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !collectAmount) return;
    setSubmittingCollect(true);
    try {
      const res = await fetch('/api/merchant/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collect',
          tenant_id: tenantId,
          customer_id: selectedCustomer.id,
          payment_amount: Number(collectAmount),
          payment_method: collectMethod
        })
      });
      const data = await res.json();
      if (data.success) {
        setCollectModalOpen(false);
        setCollectAmount('');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to record customer payment');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingCollect(false);
    }
  };

  const handleAdjustDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !newDebtAmount) return;
    setSubmittingDebt(true);
    try {
      const res = await fetch('/api/merchant/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_debt',
          tenant_id: tenantId,
          customer_id: selectedCustomer.id,
          debt_amount: Number(newDebtAmount)
        })
      });
      const data = await res.json();
      if (data.success) {
        setDebtModalOpen(false);
        setNewDebtAmount('');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to add customer debt');
      }
    } catch {
      alert('Error updating customer debt');
    } finally {
      setSubmittingDebt(false);
    }
  };

  const handleUpdateCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || newCreditLimit === '') return;
    setSubmittingCreditLimit(true);
    try {
      const res = await fetch('/api/merchant/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_credit_limit',
          tenant_id: tenantId,
          customer_id: selectedCustomer.id,
          credit_limit: Number(newCreditLimit)
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreditLimitModalOpen(false);
        setNewCreditLimit('');
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to update credit limit');
      }
    } catch {
      alert('Error updating credit limit');
    } finally {
      setSubmittingCreditLimit(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);
    const dateStr = (c as any).created_at ? (c as any).created_at.split('T')[0] : '';
    const matchesDate = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
    return matchesSearch && matchesDate;
  });

  const customerExportHeaders = [
    { key: 'code', labelEn: 'Code', labelAr: 'الكود' },
    { key: 'name', labelEn: 'Customer Name', labelAr: 'اسم العميل' },
    { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
    { key: 'credit_limit', labelEn: 'Credit Limit (EGP)', labelAr: 'الحد الائتماني (ج.م)' },
    { key: 'current_balance', labelEn: 'Current Balance (EGP)', labelAr: 'الرصيد المدين (ج.م)' },
    { key: 'loyalty_points', labelEn: 'Loyalty Points', labelAr: 'نقاط الولاء' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'العملاء والمدينون (حسابات الآجل)' : 'Customers & Accounts Receivable'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'إدارة العملاء، البيع الآجل، حدود الائتمان، تحصيل الديون، وبرامج الولاء والنقاط'
              : 'Manage customer accounts, credit limits, debt collection, and loyalty rewards'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            filename="Customers"
            data={customers}
            headers={customerExportHeaders}
            label={isRtl ? 'تصدير (CSV)' : 'Export CSV'}
          />

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إضافة عميل جديد' : 'Add Customer'}</span>
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
            placeholder={isRtl ? 'بحث باسم العميل، الكود، أو رقم الهاتف...' : 'Search by name, code, or phone...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل العملاء...' : 'Loading customers...'}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
            <p className="text-sm font-semibold text-[#172033]">
              {isRtl ? 'لا يوجد عملاء مسجلون' : 'No customers registered'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الكود' : 'Code'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'اسم العميل' : 'Customer Name'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الهاتف' : 'Phone'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الحد الائتماني' : 'Credit Limit'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الرصيد المدين (مستحق)' : 'Current Balance'}</th>
                  <th className="py-3 px-4 text-center">{isRtl ? 'نقاط الولاء' : 'Points'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredCustomers.slice(0, visibleCount).map((customer) => (
                  <tr key={customer.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#0B1730]">
                      {customer.code}
                    </td>
                    <td className="py-3 px-4 text-[#172033] font-medium">
                      {customer.name}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {customer.phone}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {customer.credit_limit.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="py-3 px-4 font-black">
                      <span className={customer.current_balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {customer.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Sparkles className="w-3 h-3 text-purple-500" />
                        <span>{customer.loyalty_points}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Edit Credit Limit */}
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setNewCreditLimit(String(customer.credit_limit));
                            setCreditLimitModalOpen(true);
                          }}
                          title={isRtl ? 'تعديل الحد الائتماني' : 'Change Credit Limit'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F7F9FC] hover:bg-gray-100 border border-[#E5EAF2] text-[#172033] rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#246BFD]" />
                          <span>{isRtl ? 'الحد الائتماني' : 'Credit Limit'}</span>
                        </button>

                        {/* Add Debt (يدينه بمبلغ) */}
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setNewDebtAmount('');
                            setDebtModalOpen(true);
                          }}
                          title={isRtl ? 'تسجيل دين إضافي على العميل' : 'Add Debt'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isRtl ? '+ تسجيل دين' : '+ Add Debt'}</span>
                        </button>

                        {/* Collect Payment */}
                        {customer.current_balance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setCollectAmount(String(customer.current_balance));
                              setCollectModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'تحصيل دفعة' : 'Collect'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCount < filteredCustomers.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isRtl ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filteredCustomers.length - visibleCount})` : `Load More (+20 items - ${filteredCustomers.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={isRtl ? 'إضافة عميل جديد' : 'Add New Customer'}
        size="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'كود العميل *' : 'Customer Code *'}
              </label>
              <input
                type="text"
                required
                placeholder="CUST-03"
                value={newCustomer.code}
                onChange={(e) => setNewCustomer({ ...newCustomer, code: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم العميل *' : 'Customer Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={isRtl ? 'محمد إبراهيم' : 'Mohamed Ibrahim'}
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
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
                placeholder="011XXXXXXXX"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الحد الائتماني (ج.م) *' : 'Credit Limit (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={newCustomer.credit_limit}
                onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'العنوان' : 'Address'}
            </label>
            <input
              type="text"
              placeholder={isRtl ? 'شارع التحرير، القاهرة' : 'El Tahrir St, Cairo'}
              value={newCustomer.address}
              onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
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
              disabled={submittingCustomer}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submittingCustomer ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ العميل' : 'Save Customer')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal
        isOpen={collectModalOpen}
        onClose={() => setCollectModalOpen(false)}
        title={isRtl ? `تحصيل دفعة من حساب العميل: ${selectedCustomer?.name}` : `Collect Payment from ${selectedCustomer?.name}`}
        size="md"
      >
        {selectedCustomer && (
          <form onSubmit={handleCollectPayment} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
              <div className="flex justify-between font-bold">
                <span>{isRtl ? 'إجمالي الدين الحالي على العميل:' : 'Current Outstanding Balance:'}</span>
                <span>{selectedCustomer.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المبلغ المحصل (ج.م) *' : 'Amount Collected (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="1"
                max={selectedCustomer.current_balance}
                required
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'طريقة التحصيل' : 'Payment Method'}
              </label>
              <select
                value={collectMethod}
                onChange={(e) => setCollectMethod(e.target.value)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cash">{isRtl ? 'نقداً بالصندوق (Cash)' : 'Cash'}</option>
                <option value="card">{isRtl ? 'بطاقة بنكية / فيزا (Card)' : 'Card'}</option>
                <option value="bank_transfer">{isRtl ? 'تحويل بنكي (Bank Transfer)' : 'Bank Transfer'}</option>
                <option value="mobile_wallet">{isRtl ? 'محفظة إلكترونية (Mobile Wallet)' : 'Mobile Wallet'}</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setCollectModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingCollect}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {submittingCollect ? (isRtl ? 'جاري التحصيل...' : 'Collecting...') : (isRtl ? 'تأكيد التحصيل وخفض الدين' : 'Confirm Collection')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Debt Modal (تسجيل مديونية / يدينه بمبلغ) */}
      <Modal
        isOpen={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        title={isRtl ? `تسجيل مديونية على العميل: ${selectedCustomer?.name}` : `Record Debt for ${selectedCustomer?.name}`}
        size="md"
      >
        {selectedCustomer && (
          <form onSubmit={handleAdjustDebt} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1.5">
              <div className="flex justify-between font-bold">
                <span>{isRtl ? 'المديونية الحالية:' : 'Current Debt:'}</span>
                <span>{selectedCustomer.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex justify-between text-[#687386]">
                <span>{isRtl ? 'الحد الائتماني المسموح به:' : 'Credit Limit:'}</span>
                <span>{selectedCustomer.credit_limit.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المبلغ المطلوب تديينه للعميل (ج.م) *' : 'Debt Amount to Add (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="0.5"
                required
                autoFocus
                value={newDebtAmount}
                onChange={(e) => setNewDebtAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
              />
              <p className="text-[11px] text-[#687386] mt-1">
                {isRtl 
                  ? 'سيتم إضافة هذا المبلغ إلى رصيد المديونية المستحق على العميل فوراً.'
                  : 'This amount will be added immediately to the customer debt balance.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setDebtModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingDebt}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {submittingDebt ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'تأكيد تسجيل الدين' : 'Confirm Add Debt')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Update Credit Limit Modal (تعديل الحد الائتماني) */}
      <Modal
        isOpen={creditLimitModalOpen}
        onClose={() => setCreditLimitModalOpen(false)}
        title={isRtl ? `تعديل الحد الائتماني للعميل: ${selectedCustomer?.name}` : `Update Credit Limit for ${selectedCustomer?.name}`}
        size="md"
      >
        {selectedCustomer && (
          <form onSubmit={handleUpdateCreditLimit} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
              <div className="flex justify-between font-bold">
                <span>{isRtl ? 'الحد الائتماني الحالي:' : 'Current Credit Limit:'}</span>
                <span>{selectedCustomer.credit_limit.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex justify-between text-[#687386]">
                <span>{isRtl ? 'الرصيد المدين الحالي:' : 'Current Outstanding Debt:'}</span>
                <span className="font-semibold text-amber-700">{selectedCustomer.current_balance.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الحد الائتماني الجديد (ج.م) *' : 'New Credit Limit (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                autoFocus
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)}
                placeholder="5000"
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
              />
              <p className="text-[11px] text-[#687386] mt-1">
                {isRtl 
                  ? 'يمكنك تغيير الحد الائتماني في أي وقت لتحديد أقصى مبلغ يمكن للعميل الشراء به بالآجل.'
                  : 'You can adjust the credit limit anytime to cap maximum customer credit sales.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setCreditLimitModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submittingCreditLimit}
                className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {submittingCreditLimit ? (isRtl ? 'جاري التحديث...' : 'Updating...') : (isRtl ? 'حفظ الحد الجديد' : 'Save Credit Limit')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
