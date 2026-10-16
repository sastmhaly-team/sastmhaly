'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Account, JournalEntry } from '@/lib/types';
import { exportToCsv } from '@/lib/export/csv';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  BookOpen, Layers, CheckCircle2, Download, 
  ArrowUpRight, ArrowDownLeft, Scale, FileText
} from 'lucide-react';

export default function AccountingManagementPage() {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';

  const [activeTab, setActiveTab] = useState<'coa' | 'journal'>('coa');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAccountingData = async () => {
    try {
      const url = `/api/merchant/accounting?tenantId=${tenantId}`;
      const cached = getCachedData<any>(url);
      if (cached) {
        if (cached.accounts) setAccounts(cached.accounts);
        if (cached.journalEntries) setJournalEntries(cached.journalEntries);
        setLoading(false);
      } else if (accounts.length === 0 && journalEntries.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.accounts) setAccounts(data.accounts);
        if (data.journalEntries) setJournalEntries(data.journalEntries);
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, [tenantId]);

  const coaExportHeaders = [
    { key: 'account_code', labelEn: 'Account Code', labelAr: 'كود الحساب' },
    { key: 'account_name_en', labelEn: 'Account Name (EN)', labelAr: 'اسم الحساب بالإنجليزية' },
    { key: 'account_name_ar', labelEn: 'Account Name (AR)', labelAr: 'اسم الحساب بالعربية' },
    { key: 'account_type', labelEn: 'Type', labelAr: 'نوع الحساب' }
  ];

  const journalExportHeaders = [
    { key: 'entry_number', labelEn: 'Entry Number', labelAr: 'رقم القيد' },
    { key: 'entry_date', labelEn: 'Date', labelAr: 'التاريخ' },
    { key: 'description', labelEn: 'Description', labelAr: 'البيان' },
    { key: 'account_code', labelEn: 'Account Code', labelAr: 'كود الحساب' },
    { key: 'account_name', labelEn: 'Account Name', labelAr: 'اسم الحساب' },
    { key: 'debit', labelEn: 'Debit (EGP)', labelAr: 'مدين (ج.م)' },
    { key: 'credit', labelEn: 'Credit (EGP)', labelAr: 'دائن (ج.م)' }
  ];

  const flatJournalRows: any[] = [];
  journalEntries.forEach(je => {
    je.lines?.forEach(line => {
      flatJournalRows.push({
        entry_number: je.entry_number,
        entry_date: je.entry_date,
        created_at: je.created_at || je.entry_date,
        description: je.description,
        account_code: line.account_code,
        account_name: isRtl ? line.account_name_ar : line.account_name_en,
        debit: line.debit,
        credit: line.credit
      });
    });
  });

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case 'asset':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{isRtl ? 'أصول (Asset)' : 'Asset'}</span>;
      case 'liability':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{isRtl ? 'خصوم والتزامات' : 'Liability'}</span>;
      case 'equity':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{isRtl ? 'حقوق ملكية' : 'Equity'}</span>;
      case 'revenue':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{isRtl ? 'إيرادات' : 'Revenue'}</span>;
      case 'cogs':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">{isRtl ? 'تكلفة بضاعة (COGS)' : 'COGS'}</span>;
      case 'expense':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">{isRtl ? 'مصروفات تشغيلية' : 'Expense'}</span>;
      default:
        return <span>{type}</span>;
    }
  };

  const filteredJournalEntries = journalEntries.filter(je => {
    if (!startDate && !endDate) return true;
    const jeDate = je.entry_date ? je.entry_date.split('T')[0] : '';
    if (startDate && jeDate < startDate) return false;
    if (endDate && jeDate > endDate) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'النظام المحاسبي ودفتر الأستاذ العام' : 'Accounting & General Ledger'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'دليل الحسابات الموحد، قيود اليومية المزدوجة المتوازنة، وميزان المراجعة (Section 18)'
              : 'Standard Chart of Accounts, balanced double-entry journals, and audit trails'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'coa' ? (
            <ExportButton
              filename="Chart_Of_Accounts"
              data={accounts}
              headers={coaExportHeaders}
              label={isRtl ? 'تصدير دليل الحسابات (CSV)' : 'Export COA (CSV)'}
            />
          ) : (
            <ExportButton
              filename="General_Ledger_Journal"
              data={flatJournalRows}
              headers={journalExportHeaders}
              dateField="entry_date"
              label={isRtl ? 'تصدير قيود اليومية (CSV)' : 'Export Journal (CSV)'}
            />
          )}
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

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAF2] gap-6">
        <button
          onClick={() => setActiveTab('coa')}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === 'coa'
              ? 'text-[#246BFD] border-b-2 border-[#246BFD]'
              : 'text-[#687386] hover:text-[#172033]'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>{isRtl ? 'دليل الحسابات (Chart of Accounts)' : 'Chart of Accounts'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700 font-normal">
              {accounts.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === 'journal'
              ? 'text-[#246BFD] border-b-2 border-[#246BFD]'
              : 'text-[#687386] hover:text-[#172033]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            <span>{isRtl ? 'قيود اليومية المحاسبية المزدوجة (Journal Entries)' : 'Double-Entry Journal Lines'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700 font-normal">
              {journalEntries.length}
            </span>
          </div>
        </button>
      </div>

      {/* Tab 1: Chart of Accounts */}
      {activeTab === 'coa' && (
        <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#687386]">
              {isRtl ? 'جاري تحميل دليل الحسابات...' : 'Loading chart of accounts...'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F7F9FC] text-[#687386] border-b border-[#E5EAF2] font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{isRtl ? 'كود الحساب' : 'Code'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'اسم الحساب (عربي)' : 'Account Name (AR)'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'اسم الحساب (إنجليزي)' : 'Account Name (EN)'}</th>
                    <th className="py-3 px-4 text-start">{isRtl ? 'تصنيف الحساب' : 'Account Type'}</th>
                    <th className="py-3 px-4 text-end">{isRtl ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-[#F7F9FC]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                        {acc.account_code}
                      </td>
                      <td className="py-3 px-4 text-[#172033] font-semibold">
                        {acc.account_name_ar}
                      </td>
                      <td className="py-3 px-4 text-[#687386]">
                        {acc.account_name_en}
                      </td>
                      <td className="py-3 px-4">
                        {getAccountTypeBadge(acc.account_type)}
                      </td>
                      <td className="py-3 px-4 text-end">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'نشط' : 'Active'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Journal Entries */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-xl border border-[#E5EAF2] text-center text-xs text-[#687386]">
              {isRtl ? 'جاري تحميل قيود اليومية...' : 'Loading journal entries...'}
            </div>
          ) : filteredJournalEntries.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-[#E5EAF2] text-center space-y-3">
              <Scale className="w-10 h-10 text-[#687386] mx-auto opacity-40" />
              <p className="text-sm font-semibold text-[#172033]">
                {isRtl ? 'لا توجد قيود يومية مسجلة' : 'No journal entries found'}
              </p>
            </div>
          ) : (
            filteredJournalEntries.map((je) => (
              <div key={je.id} className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
                <div className="p-3 bg-[#F7F9FC] border-b border-[#E5EAF2] flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-[#0B1730]">{je.entry_number}</span>
                    <span className="text-xs text-[#687386]">({je.entry_date})</span>
                    <span className="text-xs text-[#172033] font-semibold">{je.description}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {isRtl ? 'قيد متوازن ومرحل' : 'Posted & Balanced'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs font-mono">
                    <thead className="text-[#687386] border-b border-[#E5EAF2] text-[11px]">
                      <tr>
                        <th className="py-2 px-4 text-start">{isRtl ? 'كود الحساب' : 'Code'}</th>
                        <th className="py-2 px-4 text-start font-sans">{isRtl ? 'اسم الحساب' : 'Account'}</th>
                        <th className="py-2 px-4 text-end text-blue-600">{isRtl ? 'مدين (Debit)' : 'Debit'}</th>
                        <th className="py-2 px-4 text-end text-emerald-600">{isRtl ? 'دائن (Credit)' : 'Credit'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5EAF2]">
                      {je.lines?.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2 px-4 text-[#687386]">{line.account_code}</td>
                          <td className="py-2 px-4 font-sans text-[#172033]">
                            {isRtl ? line.account_name_ar : line.account_name_en}
                          </td>
                          <td className="py-2 px-4 text-end font-bold text-blue-700">
                            {line.debit > 0 ? `${line.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-4 text-end font-bold text-emerald-700">
                            {line.credit > 0 ? `${line.credit.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
