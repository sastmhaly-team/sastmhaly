'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Expense, Branch } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Banknote, Plus, Search, Filter, Download, 
  DollarSign, TrendingDown, Building, Wallet, Landmark
} from 'lucide-react';

export default function ExpensesManagementPage() {
  const { user, activeBranchId } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';
  const effectiveBranchId = activeBranchId && activeBranchId !== 'all' ? activeBranchId : user?.branch_id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, categoryFilter]);

  // Add Expense Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    branch_id: effectiveBranchId || '',
    category: 'Utilities',
    amount: '',
    payment_source: 'cash_drawer' as 'cash_drawer' | 'bank_account' | 'petty_cash',
    payee: '',
    description: ''
  });
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const fetchData = async () => {
    try {
      const url = `/api/merchant/expenses?tenantId=${tenantId}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`;
      
      const cached = getCachedData<any>(url);
      if (cached) {
        if (cached.expenses) setExpenses(cached.expenses);
        setLoading(false);
      } else if (expenses.length === 0) {
        setLoading(true);
      }

      const brCached = getCachedData<any>(`/api/merchant/branches?tenantId=${tenantId}`);
      if (brCached && brCached.branches) {
        setBranches(brCached.branches);
        if (!newExpense.branch_id && brCached.branches.length > 0) {
          setNewExpense(prev => ({ ...prev, branch_id: effectiveBranchId || brCached.branches[0].id }));
        }
      }

      await Promise.all([
        fetchWithCache<any>(url, (expData) => {
          if (expData.expenses) setExpenses(expData.expenses);
          setLoading(false);
        }),
        fetchWithCache<any>(`/api/merchant/branches?tenantId=${tenantId}`, (brData) => {
          if (brData.branches) {
            setBranches(brData.branches);
            if (!newExpense.branch_id && brData.branches.length > 0) {
              setNewExpense(prev => ({ ...prev, branch_id: effectiveBranchId || brData.branches[0].id }));
            }
          }
        })
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, effectiveBranchId]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.amount || Number(newExpense.amount) <= 0) return;

    setSubmittingExpense(true);
    try {
      const res = await fetch('/api/merchant/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...newExpense,
          amount: Number(newExpense.amount),
          created_by: user?.id || 'admin'
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddModalOpen(false);
        setNewExpense({
          branch_id: effectiveBranchId || branches[0]?.id || '',
          category: 'Utilities',
          amount: '',
          payment_source: 'cash_drawer',
          payee: '',
          description: ''
        });
        fetchData();
      } else {
        alert(data.error || 'Failed to record expense');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.payee && e.payee.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesDate = (() => {
      if (!startDate && !endDate) return true;
      const expDate = e.created_at ? e.created_at.split('T')[0] : '';
      if (startDate && expDate < startDate) return false;
      if (endDate && expDate > endDate) return false;
      return true;
    })();
    return matchesSearch && matchesCategory && matchesDate;
  });

  const totalExpenseAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const expenseExportHeaders = [
    { key: 'category', labelEn: 'Category', labelAr: 'التصنيف' },
    { key: 'amount', labelEn: 'Amount (EGP)', labelAr: 'المبلغ (ج.م)' },
    { key: 'payment_source', labelEn: 'Payment Source', labelAr: 'مصدر الصرف' },
    { key: 'branch_name', labelEn: 'Branch', labelAr: 'الفرع' },
    { key: 'payee', labelEn: 'Payee', labelAr: 'الجهة المستلمة' },
    { key: 'description', labelEn: 'Description', labelAr: 'البيان' },
    { key: 'created_at', labelEn: 'Date', labelAr: 'التاريخ' }
  ];

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'Rent': return isRtl ? 'إيجار المقر' : 'Rent';
      case 'Utilities': return isRtl ? 'كهرباء ومياه وغاز' : 'Utilities';
      case 'Staff Salaries': return isRtl ? 'رواتب الموظفين' : 'Staff Salaries';
      case 'Maintenance': return isRtl ? 'صيانة وتصليح' : 'Maintenance';
      case 'Packaging': return isRtl ? 'أكياس وتغليف' : 'Packaging';
      case 'Transport': return isRtl ? 'نقل ومشال' : 'Transport';
      default: return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'المصروفات والتكاليف التشغيلية' : 'Operating Expenses'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'تسجيل ومتابعة نفقات التشغيل (إيجار، كهرباء، رواتب، صيانة) وتأثيرها على حساب الأرباح والخسائر'
              : 'Track operating costs and deductions from cash drawer or bank accounts with double-entry ledger'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            filename="Operating_Expenses"
            data={expenses}
            headers={expenseExportHeaders}
            label={isRtl ? 'تصدير (CSV)' : 'Export CSV'}
          />

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'تسجيل مصروف جديد' : 'Record Expense'}</span>
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

      {/* KPI Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#687386]">{isRtl ? 'إجمالي المصروفات المعروضة' : 'Total Filtered Expenses'}</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#0B1730] mt-2">
            {totalExpenseAmount.toFixed(2)} <span className="text-xs font-bold text-[#687386]">{isRtl ? 'ج.م' : 'EGP'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#687386]">{isRtl ? 'المصروف من الخزينة النقدية' : 'Paid from Cash Till'}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#246BFD] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#0B1730] mt-2">
            {filteredExpenses.filter(e => e.payment_source === 'cash_drawer').reduce((a, c) => a + c.amount, 0).toFixed(2)} <span className="text-xs font-bold text-[#687386]">{isRtl ? 'ج.م' : 'EGP'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#687386]">{isRtl ? 'المصروف من الحساب البنكي' : 'Paid from Bank'}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#0B1730] mt-2">
            {filteredExpenses.filter(e => e.payment_source === 'bank_account').reduce((a, c) => a + c.amount, 0).toFixed(2)} <span className="text-xs font-bold text-[#687386]">{isRtl ? 'ج.م' : 'EGP'}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث بالبيان أو الجهة المستلمة...' : 'Search by description or payee...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs text-[#172033] outline-none"
        >
          <option value="all">{isRtl ? 'جميع التصنيفات' : 'All Categories'}</option>
          <option value="Rent">{isRtl ? 'إيجار المقر' : 'Rent'}</option>
          <option value="Utilities">{isRtl ? 'كهرباء ومياه وغاز' : 'Utilities'}</option>
          <option value="Staff Salaries">{isRtl ? 'رواتب الموظفين' : 'Staff Salaries'}</option>
          <option value="Maintenance">{isRtl ? 'صيانة وتصليح' : 'Maintenance'}</option>
          <option value="Packaging">{isRtl ? 'أكياس وتغليف' : 'Packaging'}</option>
          <option value="Transport">{isRtl ? 'نقل ومشال' : 'Transport'}</option>
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل المصروفات...' : 'Loading expenses...'}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Banknote className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
            <p className="text-sm font-semibold text-[#172033]">
              {isRtl ? 'لا توجد مصروفات مسجلة' : 'No expenses recorded'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'التصنيف' : 'Category'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'المبلغ' : 'Amount'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'مصدر الصرف' : 'Source'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الفرع' : 'Branch'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الجهة المستلمة' : 'Payee'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'البيان' : 'Description'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredExpenses.slice(0, visibleCount).map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#0B1730]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F0F9FF] text-[#246BFD] border border-[#BAE6FD]">
                        {getCategoryLabel(exp.category)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-red-600">
                      {exp.amount.toFixed(2)} {isRtl ? 'ج.م' : 'EGP'}
                    </td>
                    <td className="py-3 px-4 text-[#172033]">
                      {exp.payment_source === 'cash_drawer' ? (isRtl ? 'درج الكاشير' : 'Cash Drawer') :
                       exp.payment_source === 'bank_account' ? (isRtl ? 'حساب بنكي' : 'Bank Account') : (isRtl ? 'عهدة نثرية' : 'Petty Cash')}
                    </td>
                    <td className="py-3 px-4 text-[#687386]">
                      {exp.branch_name || 'الفرع الرئيسي'}
                    </td>
                    <td className="py-3 px-4 text-[#172033]">
                      {exp.payee || '-'}
                    </td>
                    <td className="py-3 px-4 text-[#687386] max-w-xs truncate">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-end text-[#687386]">
                      {new Date(exp.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCount < filteredExpenses.length && (
          <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isRtl ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filteredExpenses.length - visibleCount})` : `Load More (+20 items - ${filteredExpenses.length - visibleCount} remaining)`}
            </button>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={isRtl ? 'تسجيل سند صرف / مصروف تشغيلي' : 'Record Operating Expense'}
        size="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الفرع *' : 'Branch *'}
              </label>
              <select
                value={newExpense.branch_id}
                onChange={(e) => setNewExpense({ ...newExpense, branch_id: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{isRtl ? b.name_ar : b.name_en} ({b.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'تصنيف المصروف *' : 'Category *'}
              </label>
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="Rent">{isRtl ? 'إيجار المقر' : 'Rent'}</option>
                <option value="Utilities">{isRtl ? 'كهرباء ومياه وغاز' : 'Utilities'}</option>
                <option value="Staff Salaries">{isRtl ? 'رواتب الموظفين' : 'Staff Salaries'}</option>
                <option value="Maintenance">{isRtl ? 'صيانة وتصليح' : 'Maintenance'}</option>
                <option value="Packaging">{isRtl ? 'أكياس وتغليف' : 'Packaging'}</option>
                <option value="Transport">{isRtl ? 'نقل ومشال' : 'Transport'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'مصدر الصرف *' : 'Payment Source *'}
              </label>
              <select
                value={newExpense.payment_source}
                onChange={(e) => setNewExpense({ ...newExpense, payment_source: e.target.value as any })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cash_drawer">{isRtl ? 'من درج الكاشير (خصم من عهدة الجلسة)' : 'Cash Drawer (Till Deduct)'}</option>
                <option value="bank_account">{isRtl ? 'من الحساب البنكي' : 'Bank Account'}</option>
                <option value="petty_cash">{isRtl ? 'عهدة نثرية' : 'Petty Cash'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'الجهة المستلمة (Payee)' : 'Payee'}
            </label>
            <input
              type="text"
              placeholder={isRtl ? 'شركة الكهرباء، مالك العقار، فني الصيانة...' : 'e.g. Electricity Co, Landlord, etc.'}
              value={newExpense.payee}
              onChange={(e) => setNewExpense({ ...newExpense, payee: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'البيان والتفاصيل *' : 'Description *'}
            </label>
            <textarea
              required
              placeholder={isRtl ? 'اكتب تفاصيل المصروف والغرض منه...' : 'Describe the expense details...'}
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] h-20"
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
              disabled={submittingExpense}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submittingExpense ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'اعتماد المصروف' : 'Save Expense')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
