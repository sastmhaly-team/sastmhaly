'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

type ConfirmFunction = (options: string | ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmOptions>({ message: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  // Lock body scroll when confirmation dialog is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isOpen]);

  const confirm: ConfirmFunction = useCallback((options: string | ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      if (typeof options === 'string') {
        const lower = options.toLowerCase();
        const isDelete = options.includes('حذف') || lower.includes('delete') || options.includes('إلغاء') || lower.includes('cancel');
        setConfig({
          title: isDelete ? (isRtl ? 'تأكيد الحذف' : 'Confirm Deletion') : (isRtl ? 'تأكيد الإجراء' : 'Confirmation Required'),
          message: options,
          type: isDelete ? 'danger' : 'warning',
          confirmText: isDelete ? (isRtl ? 'نعم، حذف' : 'Delete') : (isRtl ? 'تأكيد' : 'Confirm'),
          cancelText: isRtl ? 'إلغاء' : 'Cancel',
        });
      } else {
        setConfig(options);
      }
      setIsOpen(true);
    });
  }, [isRtl]);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const type = config.type || 'warning';

  const getTheme = () => {
    switch (type) {
      case 'danger':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-red-50 text-red-600 border-red-200',
          btnBg: 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
        };
      case 'success':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
        };
      case 'info':
        return {
          icon: HelpCircle,
          iconBg: 'bg-blue-50 text-[#246BFD] border-blue-200',
          btnBg: 'bg-[#246BFD] hover:bg-blue-600 text-white shadow-xs',
        };
      case 'warning':
      default:
        return {
          icon: AlertCircle,
          iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto overscroll-contain"
          onClick={handleCancel}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter') handleConfirm();
          }}
          tabIndex={-1}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-[#E5EAF2] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 text-start"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Icon and Close */}
            <div className="p-5 pb-4 flex items-start gap-3.5 overflow-y-auto flex-1">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${theme.iconBg}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-black text-[#0B1730]">
                  {config.title || (isRtl ? 'تأكيد العملية' : 'Confirm Action')}
                </h3>
                <p className="text-xs text-[#4F5B76] mt-2 leading-relaxed whitespace-pre-line">
                  {config.message}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="p-1 text-[#8A94A6] hover:text-[#172033] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Action Buttons */}
            <div className="p-4 px-5 bg-[#F7F9FC] border-t border-[#E5EAF2] flex items-center justify-end gap-2.5">
              <button
                type="button"
                autoFocus
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl border border-[#E5EAF2] bg-white text-xs font-semibold text-[#4F5B76] hover:bg-gray-100 hover:text-[#172033] transition-colors cursor-pointer"
              >
                {config.cancelText || (isRtl ? 'إلغاء' : 'Cancel')}
              </button>
              
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${theme.btnBg}`}
              >
                {config.confirmText || (isRtl ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
