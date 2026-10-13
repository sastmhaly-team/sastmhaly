'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { generateCsv, downloadCsv, ExportColumn } from '@/lib/export/csv';
import { useLanguage } from '@/lib/i18n/context';

interface ExportButtonProps<T> {
  filename: string;
  data: T[];
  columns: ExportColumn<T>[];
  label?: string;
}

export function ExportButton<T>({ filename, data, columns, label }: ExportButtonProps<T>) {
  const { t } = useLanguage();

  const handleExport = () => {
    if (!data || data.length === 0) {
      alert(t('no_records'));
      return;
    }
    const csvContent = generateCsv(data, columns);
    downloadCsv(filename, csvContent);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-semibold text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer shadow-2xs"
    >
      <Download className="w-3.5 h-3.5 text-[#246BFD]" />
      <span>{label || t('export_csv')}</span>
    </button>
  );
}
