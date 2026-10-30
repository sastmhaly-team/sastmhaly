'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/lib/i18n/context';
import { 
  Upload, FileText, Download, CheckCircle2, AlertCircle, 
  RefreshCw, FileSpreadsheet, ArrowRight, Eye, Table, Trash2, X
} from 'lucide-react';

export interface ImportColumnDef {
  key: string;
  labelAr: string;
  labelEn: string;
  required?: boolean;
  example: string;
  description?: string;
}

export interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  entityNameAr: string;
  entityNameEn: string;
  columns: ImportColumnDef[];
  apiEndpoint: string;
  extraPayload?: Record<string, any>;
  onSuccess?: () => void;
  sampleRows?: Record<string, any>[];
}

export function DataImportModal({
  isOpen,
  onClose,
  title,
  entityNameAr,
  entityNameEn,
  columns,
  apiEndpoint,
  extraPayload,
  onSuccess,
  sampleRows,
}: DataImportModalProps) {
  const { lang, isRtl } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    successCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  // Helper: Detect delimiter (comma, tab, semicolon)
  const detectDelimiter = (line: string): string => {
    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    return ',';
  };

  // Helper: Parse CSV/TSV line respecting quotes
  const parseLine = (line: string, delimiter: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
  };

  // Parse text into structured records based on columns
  const parsedRecords = useMemo(() => {
    if (!csvText.trim()) return [];
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(lines[0]);
    const firstLineValues = parseLine(lines[0], delimiter).map(v => v.toLowerCase().trim());

    // Check if the first line is header by matching keys or labels
    const hasHeader = columns.some(col => 
      firstLineValues.includes(col.key.toLowerCase()) || 
      firstLineValues.includes(col.labelEn.toLowerCase()) ||
      firstLineValues.includes(col.labelAr.toLowerCase())
    );

    const startIndex = hasHeader ? 1 : 0;
    const headerMapping: (string | null)[] = [];

    if (hasHeader) {
      firstLineValues.forEach(val => {
        const matched = columns.find(col => 
          col.key.toLowerCase() === val ||
          col.labelEn.toLowerCase() === val ||
          col.labelAr.toLowerCase() === val
        );
        headerMapping.push(matched ? matched.key : null);
      });
    }

    const items: Record<string, any>[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const parts = parseLine(lines[i], delimiter);
      if (parts.length === 0 || parts.every(p => p === '')) continue;

      const row: Record<string, any> = {};
      if (hasHeader) {
        parts.forEach((val, colIdx) => {
          const key = headerMapping[colIdx];
          if (key) row[key] = val;
        });
      } else {
        // Fallback: positional mapping
        columns.forEach((col, colIdx) => {
          if (parts[colIdx] !== undefined) {
            row[col.key] = parts[colIdx];
          }
        });
      }

      // Only push if at least one required field or non-empty value exists
      if (Object.keys(row).length > 0) {
        items.push(row);
      }
    }

    return items;
  }, [csvText, columns]);

  // Handle file drop & selection
  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setCsvText(text);
        setResult(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadTemplate = () => {
    const headers = columns.map(c => lang === 'ar' ? c.key : c.key).join(',');
    const sample1 = columns.map(c => `"${c.example || ''}"`).join(',');
    const sample2 = sampleRows && sampleRows[0] 
      ? columns.map(c => `"${sampleRows[0][c.key] || ''}"`).join(',')
      : columns.map(c => `"${c.example || ''}"`).join(',');

    const csvContent = '\uFEFF' + [headers, sample1, sample2].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `template_${entityNameEn.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (parsedRecords.length === 0) return;
    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulk: true,
          items: parsedRecords,
          ...(extraPayload || {}),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          successCount: data.successCount ?? parsedRecords.length,
          errorCount: data.errorCount ?? (data.errors?.length || 0),
          errors: data.errors || [],
        });
        if (onSuccess) onSuccess();
      } else {
        setResult({
          success: false,
          successCount: 0,
          errorCount: parsedRecords.length,
          errors: [data.error || 'Failed to complete import'],
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        successCount: 0,
        errorCount: parsedRecords.length,
        errors: [err.message || 'Network error occurred during import'],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAll = () => {
    setCsvText('');
    setFileName('');
    setResult(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetAll();
        onClose();
      }}
      title={
        title ||
        (lang === 'ar'
          ? `استيراد بيانات ${entityNameAr} (ملف CSV / Excel)`
          : `Import ${entityNameEn} Data (CSV / Excel)`)
      }
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Header Ribbon & Template Download */}
        <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#0B1730]">
                {lang === 'ar' ? 'استيراد جماعي مرن وسريع' : 'Fast & Seamless Bulk Import'}
              </h4>
              <p className="text-[11px] text-[#687386]">
                {lang === 'ar'
                  ? 'قم برفع ملف Excel/CSV أو انسخ البيانات مباشرة من جدولك الحالي.'
                  : 'Upload an Excel/CSV file or paste your existing data directly.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50/60 text-[#246BFD] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'تحميل نموذج CSV' : 'Sample CSV'}</span>
          </button>
        </div>

        {/* Column Reference Pills */}
        <div className="bg-[#F7F9FC] border border-[#E5EAF2] rounded-xl p-3 space-y-2">
          <span className="text-[11px] font-bold text-[#687386] block">
            {lang === 'ar' ? 'الأعمدة المدعومة في الملف:' : 'Supported Column Headers:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {columns.map(col => (
              <span 
                key={col.key}
                className={`px-2 py-1 rounded-md text-[10px] font-mono font-medium flex items-center gap-1 ${
                  col.required 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold' 
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
                title={lang === 'ar' ? col.labelAr : col.labelEn}
              >
                <span>{col.key}</span>
                <span className="text-[9px] opacity-75">
                  ({lang === 'ar' ? col.labelAr : col.labelEn})
                </span>
                {col.required && <span className="text-red-500 font-bold">*</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Input Mode Tabs */}
        <div className="flex border-b border-[#E5EAF2] gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-b-2 border-[#246BFD] text-[#246BFD]'
                : 'text-[#687386] hover:text-[#0B1730]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'رفع ملف CSV / Excel' : 'Upload File'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-b-2 border-[#246BFD] text-[#246BFD]'
                : 'text-[#687386] hover:text-[#0B1730]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'لصق نص البيانات مباشرة' : 'Paste Raw Data'}</span>
          </button>
        </div>

        {/* Tab 1: Upload Drag & Drop */}
        {activeTab === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging 
                ? 'border-[#246BFD] bg-blue-50/60' 
                : fileName 
                ? 'border-emerald-300 bg-emerald-50/30' 
                : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#246BFD]/60 hover:bg-blue-50/20'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv,.txt,.tsv" 
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            {fileName ? (
              <div className="space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto stroke-[1.5]" />
                <p className="font-bold text-[#0B1730] text-xs">{fileName}</p>
                <p className="text-[11px] text-emerald-700">
                  {lang === 'ar' ? 'تم اختيار الملف بنجاح! جاهز للمعاينة والتنفيذ.' : 'File loaded successfully! Ready to preview & import.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-8 h-8 text-[#94A3B8] mx-auto stroke-[1.5]" />
                <p className="font-bold text-[#0B1730]">
                  {lang === 'ar' ? 'اسحب وأفلت الملف هنا أو انقر للاختيار' : 'Drag & drop file here or click to browse'}
                </p>
                <p className="text-[11px] text-[#687386]">
                  {lang === 'ar' ? 'يدعم ملفات CSV أو Text المفصولة بفواصل أو Tabs' : 'Supports .CSV, .TSV, or .TXT'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Direct Paste */}
        {activeTab === 'paste' && (
          <div className="space-y-1.5">
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFileName('');
                setResult(null);
              }}
              rows={6}
              placeholder={columns.map(c => c.key).join(',') + '\n' + columns.map(c => c.example).join(',')}
              className="w-full p-3 font-mono text-[11px] border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#246BFD] bg-[#F8FAFC]"
            />
            <p className="text-[10px] text-[#687386]">
              {lang === 'ar' ? 'الصق نص السطور مباشرة من ملف Excel، حيث يمثل كل سطر سجلاً مستقلاً.' : 'Paste CSV or TSV lines directly from your spreadsheet.'}
            </p>
          </div>
        )}

        {/* Live Preview Table */}
        {parsedRecords.length > 0 && (
          <div className="border border-[#E5EAF2] rounded-xl overflow-hidden bg-white">
            <div className="px-3 py-2 bg-[#F7F9FC] border-b border-[#E5EAF2] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-[#246BFD]" />
                <span className="font-bold text-[#0B1730]">
                  {lang === 'ar' ? 'معاينة البيانات المكتشفة' : 'Data Preview'}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  {parsedRecords.length} {lang === 'ar' ? 'سجل' : 'rows'}
                </span>
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title={lang === 'ar' ? 'إعادة تعيين' : 'Clear'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-[10px] text-right rtl:text-right ltr:text-left">
                <thead className="bg-gray-50 border-b border-gray-100 font-bold text-gray-600">
                  <tr>
                    <th className="p-1.5 w-8">#</th>
                    {columns.slice(0, 5).map(col => (
                      <th key={col.key} className="p-1.5">
                        {lang === 'ar' ? col.labelAr : col.labelEn}
                      </th>
                    ))}
                    {columns.length > 5 && <th className="p-1.5">...</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRecords.slice(0, 4).map((rec, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30">
                      <td className="p-1.5 text-gray-400 font-mono">{idx + 1}</td>
                      {columns.slice(0, 5).map(col => (
                        <td key={col.key} className="p-1.5 text-[#0B1730] font-mono truncate max-w-[120px]">
                          {rec[col.key] || '-'}
                        </td>
                      ))}
                      {columns.length > 5 && <td className="p-1.5 text-gray-400">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Banner */}
        {result && (
          <div className={`p-3.5 rounded-xl border space-y-2 ${
            result.successCount > 0 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {result.successCount > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-bold">
                {lang === 'ar'
                  ? `تم استيراد ${result.successCount} من أصل ${parsedRecords.length} بنجاح!`
                  : `Successfully imported ${result.successCount} of ${parsedRecords.length} records!`}
              </span>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-red-200 text-[11px] text-red-700 max-h-24 overflow-y-auto space-y-1">
                <span className="font-bold block">
                  {lang === 'ar' ? 'الأخطاء التي لم يتم استيرادها:' : 'Failed Rows:'}
                </span>
                {result.errors.map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => {
              resetAll();
              onClose();
            }}
            className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>

          <button
            type="button"
            disabled={parsedRecords.length === 0 || isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}</span>
              </>
            ) : (
              <>
                <span>{lang === 'ar' ? `بدء الاستيراد (${parsedRecords.length})` : `Execute Import (${parsedRecords.length})`}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
