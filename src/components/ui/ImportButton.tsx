'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import { DataImportModal, ImportColumnDef } from '@/components/ui/DataImportModal';

export interface ImportButtonProps {
  entityNameAr: string;
  entityNameEn: string;
  columns: ImportColumnDef[];
  apiEndpoint: string;
  extraPayload?: Record<string, any>;
  onSuccess?: () => void;
  sampleRows?: Record<string, any>[];
  label?: string;
  className?: string;
}

export function ImportButton({
  entityNameAr,
  entityNameEn,
  columns,
  apiEndpoint,
  extraPayload,
  onSuccess,
  sampleRows,
  label,
  className,
}: ImportButtonProps) {
  const { lang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const defaultLabel = lang === 'ar' ? `استيراد ${entityNameAr} (CSV)` : `Import ${entityNameEn}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5EAF2] bg-white hover:bg-[#F7F9FC] text-xs font-bold text-[#0B1730] shadow-2xs hover:border-[#CBD5E1] transition-all cursor-pointer'
        }
      >
        <Upload className="w-3.5 h-3.5 text-[#246BFD]" />
        <span>{label || defaultLabel}</span>
      </button>

      <DataImportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        entityNameAr={entityNameAr}
        entityNameEn={entityNameEn}
        columns={columns}
        apiEndpoint={apiEndpoint}
        extraPayload={extraPayload}
        onSuccess={() => {
          if (onSuccess) onSuccess();
        }}
        sampleRows={sampleRows}
      />
    </>
  );
}
