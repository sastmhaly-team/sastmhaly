'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Customer } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { ImportButton } from '@/components/ui/ImportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { saveOfflineCustomer } from '@/lib/offline/offline-manager';
import { 
  Users, Plus, Search, Download, 
  CreditCard, Phone, Sparkles, AlertTriangle, Edit3, PlusCircle,
  Printer, Calendar, FileText
} from 'lucide-react';

export default function CustomersManagementPage() {
  const { user, tenant } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || 'tenant_albaraka';
  const currency = tenant?.currency || (isRtl ? 'ج.م' : 'EGP');

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

  // Loyalty Points Modal (تعديل نقاط الولاء)
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [pointsAction, setPointsAction] = useState<'add' | 'deduct'>('add');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [submittingPoints, setSubmittingPoints] = useState(false);

  // Statement Modal State (كشف حساب العميل)
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementMode, setStatementMode] = useState<'all' | 'custom'>('all');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const fetchStatement = async (customerId: string, from?: string, to?: string) => {
    setLoadingStatement(true);
    try {
      let url = `/api/merchant/statements?tenantId=${tenantId}&type=customer&id=${customerId}`;
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

  const handleOpenStatement = (cust: Customer) => {
    setStatementCustomer(cust);
    setStatementMode('all');
    setStatementFromDate('');
    setStatementToDate('');
    setStatementData(null);
    setStatementModalOpen(true);
    fetchStatement(cust.id);
  };

  const handleOpenPointsModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setPointsAction('add');
    setPointsAmount('');
    setPointsReason('');
    setPointsModalOpen(true);
  };

  const handleSavePoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(pointsAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(isRtl ? 'يرجى إدخال عدد نقاط صحيح أكبر من صفر' : 'Please enter valid points greater than zero');
      return;
    }
    const delta = pointsAction === 'add' ? amount : -amount;
    setSubmittingPoints(true);
    try {
      const res = await fetch('/api/merchant/customers/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          customerId: selectedCustomer.id,
          pointsDelta: delta,
          reason: pointsReason || (pointsAction === 'add' ? 'إضافة نقاط يدوياً' : 'خصم نقاط يدوياً')
        })
      });
      const data = await res.json();
      if (data.success) {
        setPointsModalOpen(false);
        fetchCustomers();
      } else {
        alert(data.error || 'Failed to update points');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPoints(false);
    }
  };

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
      let createdCustomer: any = null;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        createdCustomer = {
          id: `cust_off_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          tenant_id: tenantId,
          ...newCustomer,
          phone: cleanedPhone,
          credit_limit: Number(newCustomer.credit_limit) || 2000,
          current_balance: 0,
          loyalty_points: 0,
        };
        saveOfflineCustomer(createdCustomer);
      } else {
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
            createdCustomer = data.customer;
          } else {
            alert(data.error || 'Failed to create customer');
            setSubmittingCustomer(false);
            return;
          }
        } catch (fetchErr) {
          createdCustomer = {
            id: `cust_off_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            tenant_id: tenantId,
            ...newCustomer,
            phone: cleanedPhone,
            credit_limit: Number(newCustomer.credit_limit) || 2000,
            current_balance: 0,
            loyalty_points: 0,
          };
          saveOfflineCustomer(createdCustomer);
        }
      }

      if (createdCustomer) {
        setCustomers(prev => [createdCustomer, ...prev]);
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

  const customerImportColumns = [
    { key: 'name', labelAr: 'اسم العميل', labelEn: 'Customer Name', required: true, example: 'أحمد محمود' },
    { key: 'phone', labelAr: 'رقم الهاتف', labelEn: 'Phone Number', required: true, example: '01012345678' },
    { key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email', example: 'ahmed@gmail.com' },
    { key: 'address', labelAr: 'العنوان', labelEn: 'Address', example: 'المعادي، القاهرة' },
    { key: 'credit_limit', labelAr: 'الحد الائتماني', labelEn: 'Credit Limit', example: '3000' },
    { key: 'tax_id', labelAr: 'الرقم الضريبي', labelEn: 'Tax ID', example: '123-456-789' },
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

        <div className="flex items-center gap-2 flex-wrap">
          <ImportButton
            entityNameAr="العملاء"
            entityNameEn="Customers"
            columns={customerImportColumns}
            apiEndpoint="/api/merchant/customers"
            extraPayload={{ tenant_id: tenantId }}
            onSuccess={fetchCustomers}
            sampleRows={[
              { name: 'محمد علي', phone: '01123456789', email: 'mohamed@example.com', address: 'مدينة نصر، القاهرة', credit_limit: 5000, tax_id: '' }
            ]}
          />

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
                      {customer.credit_limit.toFixed(2)} {currency}
                    </td>
                    <td className="py-3 px-4 font-black">
                      <span className={customer.current_balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {customer.current_balance.toFixed(2)} {currency}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenPointsModal(customer)}
                        title={isRtl ? 'تعديل نقاط الولاء (إضافة أو خصم)' : 'Manage Loyalty Points'}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-purple-500" />
                        <span>{customer.loyalty_points}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Statement (كشف حساب) */}
                        <button
                          onClick={() => handleOpenStatement(customer)}
                          title={isRtl ? 'عرض وطباعة كشف الحساب' : 'Account Statement'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F0F5FF] hover:bg-[#D0E2FF] border border-[#BAE6FD] text-[#246BFD] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'كشف حساب' : 'Statement'}</span>
                        </button>

                        {/* Loyalty Points */}
                        <button
                          onClick={() => handleOpenPointsModal(customer)}
                          title={isRtl ? 'تعديل نقاط الولاء' : 'Loyalty Points'}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>{isRtl ? 'النقاط' : 'Points'}</span>
                        </button>

                        {/* Edit Credit Limit */}
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setNewCreditLimit(String(customer.credit_limit));
                            setCreditLimitModalOpen(true);
                          }}
                          title={isRtl ? 'تعديل الحد الائتماني' : 'Change Credit Limit'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F7F9FC] hover:bg-gray-100 border border-[#E5EAF2] text-[#172033] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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

      {/* Loyalty Points Modal (تعديل نقاط الولاء) */}
      <Modal
        isOpen={pointsModalOpen}
        onClose={() => setPointsModalOpen(false)}
        title={isRtl ? `تعديل نقاط الولاء: ${selectedCustomer?.name || ''}` : `Manage Loyalty Points: ${selectedCustomer?.name || ''}`}
        size="md"
      >
        <form onSubmit={handleSavePoints} className="space-y-4 text-xs">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-purple-900">{isRtl ? 'الرصيد الحالي للنقاط:' : 'Current Points Balance:'}</span>
            <span className="text-base font-black text-purple-700">{selectedCustomer?.loyalty_points || 0} {isRtl ? 'نقطة' : 'pts'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPointsAction('add')}
              className={`p-2.5 rounded-lg font-bold border transition-colors ${
                pointsAction === 'add' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {isRtl ? '+ إضافة نقاط للعميل' : '+ Add Points'}
            </button>
            <button
              type="button"
              onClick={() => setPointsAction('deduct')}
              className={`p-2.5 rounded-lg font-bold border transition-colors ${
                pointsAction === 'deduct' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {isRtl ? '- خصم نقاط من العميل' : '- Deduct Points'}
            </button>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'عدد النقاط *' : 'Points Amount *'}
            </label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={pointsAmount}
              onChange={(e) => setPointsAmount(e.target.value)}
              placeholder="50"
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'سبب الحركة / ملاحظات' : 'Reason / Notes'}
            </label>
            <input
              type="text"
              value={pointsReason}
              onChange={(e) => setPointsReason(e.target.value)}
              placeholder={isRtl ? 'مكافأة ولاء، تسوية، هدية مناسبة...' : 'Loyalty bonus, settlement...'}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setPointsModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submittingPoints}
              className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                pointsAction === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submittingPoints ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (pointsAction === 'add' ? (isRtl ? 'تأكيد إضافة النقاط' : 'Confirm Add') : (isRtl ? 'تأكيد خصم النقاط' : 'Confirm Deduct'))}
            </button>
          </div>
        </form>
      </Modal>

      {/* Account Statement Modal (كشف حساب العميل) */}
      <Modal
        isOpen={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        title={isRtl ? `كشف حساب عميل: ${statementCustomer?.name || ''}` : `Customer Statement: ${statementCustomer?.name || ''}`}
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
                  if (statementCustomer) fetchStatement(statementCustomer.id);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  statementMode === 'all' ? 'bg-[#246BFD] text-white' : 'bg-white border border-[#E5EAF2] text-[#687386]'
                }`}
              >
                {isRtl ? 'كشف حساب كامل (كافة الفواتير)' : 'Full Statement (All)'}
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
                    if (statementCustomer) fetchStatement(statementCustomer.id, statementFromDate, statementToDate);
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
                const printable = document.getElementById('customer-statement-print');
                if (printable) {
                  const printWin = window.open('', '_blank');
                  if (printWin) {
                    printWin.document.write(`
                      <html dir="${isRtl ? 'rtl' : 'ltr'}">
                        <head>
                          <title>كشف حساب ${statementCustomer?.name}</title>
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
            <div id="customer-statement-print" className="space-y-4 bg-white p-3 border border-[#E5EAF2] rounded-xl">
              {/* Summary Header */}
              <div className="header flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-base font-black text-[#0B1730]">{statementCustomer?.name}</h3>
                  <p className="text-[11px] text-[#687386]">كود العميل: {statementCustomer?.code} | الهاتف: {statementCustomer?.phone || '-'}</p>
                  <p className="text-[11px] text-[#687386]">
                    الفترة: {statementMode === 'all' ? (isRtl ? 'كافة المعاملات حتى اليوم' : 'All transactions') : `${statementFromDate || 'البداية'} إلى ${statementToDate || 'اليوم'}`}
                  </p>
                </div>
                <div className="text-end">
                  <div className="text-[11px] text-[#687386]">{isRtl ? 'الرصيد المتبقي على العميل (دين)' : 'Remaining Customer Debt'}</div>
                  <div className={`text-lg font-black ${statementData.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
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
                      <th className="p-2 text-start">{isRtl ? 'رقم الفاتورة / الإذن' : 'Reference'}</th>
                      <th className="p-2 text-end">{isRtl ? 'مبيعات ومديونية (+)' : 'Sales (+)'}</th>
                      <th className="p-2 text-end">{isRtl ? 'مدفوعات ومسدد (-)' : 'Paid (-)'}</th>
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
                            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{isRtl ? 'فاتورة مبيعات' : 'Sale'}</span>
                          </td>
                          <td className="p-2 font-mono text-[#0B1730]">{t.reference_number}</td>
                          <td className="p-2 text-end font-mono font-bold text-amber-600">
                            {t.debit > 0 ? `${t.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2 text-end font-mono font-bold text-emerald-600">
                            {t.credit > 0 ? `${t.credit.toFixed(2)}` : '-'}
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
                      <td className="p-2 text-end text-amber-600 font-mono font-black">
                        {statementData.totalDebit?.toFixed(2)} {currency}
                      </td>
                      <td className="p-2 text-end text-emerald-600 font-mono font-black">
                        {statementData.totalCredit?.toFixed(2)} {currency}
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
