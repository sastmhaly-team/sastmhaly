'use client';

import React, { useState, useMemo } from 'react';
import { Download, Calendar, Layers, CheckCircle2, FileSpreadsheet, X, Clock } from 'lucide-react';
import { generateCsv, downloadCsv, ExportColumn } from '@/lib/export/csv';
import { useLanguage } from '@/lib/i18n/context';
import { Modal } from '@/components/ui/Modal';

export interface ExportHeaderItem {
  key: string;
  labelEn?: string;
  labelAr?: string;
  header?: string;
}

export interface ExportButtonProps<T> {
  filename: string;
  data: T[];
  columns?: ExportColumn<T>[];
  headers?: ExportHeaderItem[];
  label?: string;
  className?: string;
  dateField?: string | ((item: T) => string | undefined);
}

export function ExportButton<T extends Record<string, any>>({
  filename,
  data,
  columns,
  headers,
  label,
  className,
  dateField
}: ExportButtonProps<T>) {
  const { t, isRtl, lang } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'all' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Extract date string (YYYY-MM-DD) from an item
  const getItemDate = (item: T): string => {
    if (typeof dateField === 'function') {
      const val = dateField(item);
      return val ? String(val).split('T')[0] : '';
    }
    if (dateField && item[dateField]) {
      return String(item[dateField]).split('T')[0];
    }
    // Auto-detect common date properties
    const candidates = [
      'created_at',
      'expense_date',
      'order_date',
      'opened_at',
      'sale_date',
      'entry_date',
      'date',
      'expiry_date',
      'production_date'
    ];
    for (const f of candidates) {
      if (item[f]) {
        return String(item[f]).split('T')[0];
      }
    }
    return '';
  };

  // Filtered data based on chosen export mode
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (exportMode === 'all') return data;

    return data.filter(item => {
      const d = getItemDate(item);
      if (!d) return true; // If no date field detected, include it
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [data, exportMode, fromDate, toDate]);

  // Quick Preset Handlers
  const handlePreset = (type: 'today' | '7days' | 'month' | 'year') => {
    setExportMode('custom');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (type === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (type === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) {
      alert(isRtl ? 'لا توجد بيانات مطابقة لتصديرها' : 'No matching data to export');
      return;
    }

    let finalColumns: ExportColumn<T>[] = [];
    if (columns && columns.length > 0) {
      finalColumns = columns;
    } else if (headers && headers.length > 0) {
      finalColumns = headers.map(h => ({
        header: h.header || (isRtl ? (h.labelAr || h.labelEn || h.key) : (h.labelEn || h.labelAr || h.key)),
        key: (row: T) => row[h.key]
      }));
    } else {
      // Auto-generate columns from object keys
      const sample = filteredData[0];
      finalColumns = Object.keys(sample).map(key => ({
        header: key,
        key: (row: T) => row[key]
      }));
    }

    const csvContent = generateCsv(filteredData, finalColumns);
    
    // Build descriptive filename
    let finalName = filename;
    if (exportMode === 'custom' && (fromDate || toDate)) {
      finalName += `_${fromDate || 'start'}_to_${toDate || 'end'}`;
    } else if (exportMode === 'all') {
      finalName += `_all_${new Date().toISOString().split('T')[0]}`;
    }

    downloadCsv(finalName, csvContent);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5EAF2] bg-white text-xs font-semibold text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer shadow-2xs"}
      >
        <Download className="w-4 h-4 text-[#246BFD]" />
        <span>{label || (isRtl ? 'تصدير (Excel / CSV)' : 'Export (Excel / CSV)')}</span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={isRtl ? 'تصدير البيانات إلى Excel / CSV' : 'Export Data to Excel / CSV'}
        size="md"
      >
        <div className="space-y-5 text-xs">
          
          {/* Header Explanation */}
          <div className="flex items-center gap-3 p-3.5 bg-[#F0F5FF] border border-[#D0E2FF] rounded-xl text-[#0B1730]">
            <div className="w-10 h-10 rounded-lg bg-[#246BFD] text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {isRtl ? 'تحديد نطاق البيانات المطلوب تصديرها' : 'Select Data Export Scope'}
              </h4>
              <p className="text-[11px] text-[#4F5B76] mt-0.5">
                {isRtl 
                  ? 'اختر تصدير كافة البيانات دفعة واحدة أو تحديد فترة زمنية من تاريخ إلى تاريخ.'
                  : 'Choose to export all data or specify a custom date range.'}
              </p>
            </div>
          </div>

          {/* Export Mode Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: All Data */}
            <div
              onClick={() => setExportMode('all')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                exportMode === 'all'
                  ? 'border-[#246BFD] bg-[#F7F9FC] ring-2 ring-[#246BFD]/10'
                  : 'border-[#E5EAF2] bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${exportMode === 'all' ? 'bg-[#246BFD] text-white' : 'bg-gray-100 text-[#687386]'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[#0B1730]">
                    {isRtl ? 'تصدير الكل' : 'All Data'}
                  </span>
                </div>
                {exportMode === 'all' && (
                  <CheckCircle2 className="w-4 h-4 text-[#246BFD]" />
                )}
              </div>
              <p className="text-[11px] text-[#687386] mt-2">
                {isRtl ? 'تصدير كافة السجلات بدون تقييد زمني' : 'Export all records without date restrictions'}
              </p>
              <span className="mt-2 text-[10px] font-semibold text-[#246BFD] bg-blue-50 px-2 py-0.5 rounded w-fit">
                {data.length} {isRtl ? 'سجل' : 'records'}
              </span>
            </div>

            {/* Option 2: Custom Date Range */}
            <div
              onClick={() => setExportMode('custom')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                exportMode === 'custom'
                  ? 'border-[#246BFD] bg-[#F7F9FC] ring-2 ring-[#246BFD]/10'
                  : 'border-[#E5EAF2] bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${exportMode === 'custom' ? 'bg-[#246BFD] text-white' : 'bg-gray-100 text-[#687386]'}`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-[#0B1730]">
                    {isRtl ? 'تحديد فترة زمنية' : 'Date Range'}
                  </span>
                </div>
                {exportMode === 'custom' && (
                  <CheckCircle2 className="w-4 h-4 text-[#246BFD]" />
                )}
              </div>
              <p className="text-[11px] text-[#687386] mt-2">
                {isRtl ? 'تصفية البيانات من تاريخ إلى تاريخ' : 'Filter data from specific date to date'}
              </p>
              <span className="mt-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                {isRtl ? 'مخصص بالتاريخ' : 'Custom Dates'}
              </span>
            </div>
          </div>

          {/* Date Pickers (Shown if Custom Mode is Active) */}
          {exportMode === 'custom' && (
            <div className="p-4 bg-[#F7F9FC] rounded-xl border border-[#E5EAF2] space-y-3 animate-in fade-in duration-150">
              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#687386] font-semibold me-1">
                  {isRtl ? 'فترات سريعة:' : 'Quick Presets:'}
                </span>
                <button
                  type="button"
                  onClick={() => handlePreset('today')}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-[#E5EAF2] rounded-md text-[11px] font-medium text-[#172033] transition-colors"
                >
                  {isRtl ? 'اليوم' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('7days')}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-[#E5EAF2] rounded-md text-[11px] font-medium text-[#172033] transition-colors"
                >
                  {isRtl ? 'آخر 7 أيام' : 'Last 7 Days'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('month')}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-[#E5EAF2] rounded-md text-[11px] font-medium text-[#172033] transition-colors"
                >
                  {isRtl ? 'هذا الشهر' : 'This Month'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('year')}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-[#E5EAF2] rounded-md text-[11px] font-medium text-[#172033] transition-colors"
                >
                  {isRtl ? 'هذا العام' : 'This Year'}
                </button>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-[#172033] mb-1">
                    {isRtl ? 'من تاريخ:' : 'From Date:'}
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD] font-mono text-[#0B1730]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#172033] mb-1">
                    {isRtl ? 'إلى تاريخ:' : 'To Date:'}
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5EAF2] rounded-lg text-xs outline-none focus:border-[#246BFD] font-mono text-[#0B1730]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Record Count Summary */}
          <div className="p-3 bg-white border border-[#E5EAF2] rounded-xl flex items-center justify-between">
            <span className="text-xs text-[#687386]">
              {isRtl ? 'عدد السجلات التي سيتم تصديرها:' : 'Total Records to Export:'}
            </span>
            <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
              filteredData.length > 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {filteredData.length} {isRtl ? 'سجل' : 'records'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-[#687386] hover:bg-gray-50 transition-colors"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={filteredData.length === 0}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isRtl ? 'تأكيد التصدير الآن (CSV)' : 'Confirm & Export CSV'}</span>
            </button>
          </div>

        </div>
      </Modal>
    </>
  );
}
