'use client';

import React, { useState, useEffect } from 'react';
import { 
  Printer, Usb, Cable, Check, AlertCircle, Settings2, 
  RefreshCw, ChevronDown, CheckCircle2 
} from 'lucide-react';
import { 
  getSavedPrinterConfig, savePrinterConfig, 
  connectUsbPrinter, connectSerialPrinter, 
  isWebUsbSupported, isWebSerialSupported, 
  PrinterConfig, PrinterMode 
} from '@/lib/hardware/thermal-printer';

interface ThermalPrinterSelectorProps {
  onPrinterChange?: (config: PrinterConfig) => void;
  compact?: boolean;
}

export function ThermalPrinterSelector({ onPrinterChange, compact = false }: ThermalPrinterSelectorProps) {
  const [config, setConfig] = useState<PrinterConfig>({ mode: 'system', name: 'طابعة النظام (System Print)' });
  const [isOpen, setIsOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = getSavedPrinterConfig();
    setConfig(saved);
  }, []);

  const handleSelectMode = async (mode: PrinterMode) => {
    setStatusMessage(null);

    if (mode === 'system') {
      const newConfig: PrinterConfig = { mode: 'system', name: 'طابعة النظام (System Print)' };
      savePrinterConfig(newConfig);
      setConfig(newConfig);
      onPrinterChange?.(newConfig);
      setIsOpen(false);
      return;
    }

    if (mode === 'usb') {
      if (!isWebUsbSupported()) {
        setStatusMessage('متصفحك لا يدعم اتصال USB المباشر (يرجى فتح النظام في Chrome أو Edge).');
        return;
      }
      setConnecting(true);
      const res = await connectUsbPrinter();
      setConnecting(false);

      if (res.success && res.name) {
        const newConfig: PrinterConfig = { mode: 'usb', name: res.name };
        setConfig(newConfig);
        onPrinterChange?.(newConfig);
        setStatusMessage('تم ربط طابعة USB بنجاح! سيتم إرسال الفواتير إليها مباشرة.');
        setIsOpen(false);
      } else {
        setStatusMessage(res.error || 'فشل الاتصال بطابعة USB');
      }
      return;
    }

    if (mode === 'serial') {
      if (!isWebSerialSupported()) {
        setStatusMessage('متصفحك لا يدعم اتصال Serial المباشر (يرجى فتح النظام في Chrome أو Edge).');
        return;
      }
      setConnecting(true);
      const res = await connectSerialPrinter();
      setConnecting(false);

      if (res.success && res.name) {
        const newConfig: PrinterConfig = { mode: 'serial', name: res.name };
        setConfig(newConfig);
        onPrinterChange?.(newConfig);
        setStatusMessage('تم ربط منفذ الطابعة بنجاح!');
        setIsOpen(false);
      } else {
        setStatusMessage(res.error || 'فشل الاتصال بمنفذ Serial');
      }
      return;
    }
  };

  return (
    <div className="relative inline-block text-right" dir="rtl">
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs cursor-pointer transition-all"
        title="تحديد أو تغيير الطابعة"
      >
        {config.mode === 'usb' ? (
          <Usb className="w-3.5 h-3.5 text-emerald-600" />
        ) : config.mode === 'serial' ? (
          <Cable className="w-3.5 h-3.5 text-purple-600" />
        ) : (
          <Printer className="w-3.5 h-3.5 text-blue-600" />
        )}
        <span className="truncate max-w-[150px]">{config.name}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute left-0 bottom-full mb-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 text-xs animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-gray-500" />
              إعدادات طابعة الإيصالات
            </span>
            <span className="text-[10px] text-gray-400 font-mono">Thermal POS</span>
          </div>

          <div className="space-y-1">
            {/* System Print Option */}
            <button
              type="button"
              onClick={() => handleSelectMode('system')}
              className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-right transition-colors cursor-pointer ${
                config.mode === 'system' ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Printer className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>طابعة النظام (المتصفح)</span>
                  {config.mode === 'system' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                  معاينة سريعة معزولة بدون أي تعليق أو بطء
                </div>
              </div>
            </button>

            {/* Direct USB Print Option */}
            <button
              type="button"
              disabled={connecting}
              onClick={() => handleSelectMode('usb')}
              className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-right transition-colors cursor-pointer ${
                config.mode === 'usb' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Usb className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>طابعة حرارية USB مباشرة</span>
                  {config.mode === 'usb' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                  طباعة فورية بضغطة واحدة من الطابعة بدون نافذة المتصفح
                </div>
              </div>
            </button>

            {/* Direct Serial/COM Print Option */}
            <button
              type="button"
              disabled={connecting}
              onClick={() => handleSelectMode('serial')}
              className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-right transition-colors cursor-pointer ${
                config.mode === 'serial' ? 'bg-purple-50 text-purple-900 border border-purple-200' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Cable className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>طابعة تسلسلية Serial / COM</span>
                  {config.mode === 'serial' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                  للطابعات المتصلة بمنافذ COM أو محول USB-to-Serial
                </div>
              </div>
            </button>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="mt-2 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}

          {connecting && (
            <div className="mt-2 text-center text-xs text-blue-600 font-semibold flex items-center justify-center gap-1 py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>جاري البحث والاتصال بالطابعة...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
