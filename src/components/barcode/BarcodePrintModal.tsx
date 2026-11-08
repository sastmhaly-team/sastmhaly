'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BarcodeSvg } from './BarcodeSvg';
import { 
  Printer, Download, Sparkles, Plus, Minus, Tag, Check, AlertCircle, 
  RotateCw, HelpCircle, Usb, CheckCircle2, RefreshCw, Zap, Cable 
} from 'lucide-react';
import { 
  printBarcodeLabelsIsolated, 
  connectUsbPrinter, 
  connectSerialPrinter,
  getPairedUsbPrinter, 
  printBarcodeDirectUsb, 
  printBarcodeDirectSerial,
  isWebUsbSupported,
  isWebSerialSupported 
} from '@/lib/hardware/thermal-printer';
import { renderCode128SvgString, encodeCode128 } from '@/lib/barcode/code128';

export interface BarcodePrintProduct {
  name_ar: string;
  name_en?: string;
  barcode: string;
  selling_price: number;
  sku?: string;
}

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: BarcodePrintProduct | null;
  tenantName?: string;
  currency?: string;
}

export function BarcodePrintModal({
  isOpen,
  onClose,
  product,
  tenantName = 'سستمهالي',
  currency = 'ج.م',
}: BarcodePrintModalProps) {
  const [copies, setCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'38x25' | '40x30' | '50x25'>('38x25');
  const [printMethod, setPrintMethod] = useState<'usb' | 'serial' | 'system'>('usb');
  const [usbPrinterName, setUsbPrinterName] = useState<string | null>(null);
  const [isConnectingUsb, setIsConnectingUsb] = useState<boolean>(false);
  const [isPrintingUsb, setIsPrintingUsb] = useState<boolean>(false);
  const [usbFeedback, setUsbFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [orientation, setOrientation] = useState<'horizontal' | 'rotate90' | 'vertical'>('horizontal');
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [showProductName, setShowProductName] = useState<boolean>(true);

  // Check on mount if a USB printer is already paired
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      getPairedUsbPrinter().then((res) => {
        if (res.connected && res.name && !res.name.includes('13d3') && !res.name.includes('5a01')) {
          setUsbPrinterName(res.name);
          setPrintMethod('usb');
        } else {
          setUsbPrinterName(null);
          if (!isWebUsbSupported()) {
            setPrintMethod('system');
          }
        }
      });
    }
  }, [isOpen]);

  if (!product) return null;

  // Generate an accurate canvas representation of the sticker
  const generateStickerCanvas = (widthPx: number, heightPx: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Crisp White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);

    let currentY = Math.round(heightPx * 0.05);

    // 1. Store Name
    if (showStoreName) {
      ctx.fillStyle = '#1f2937';
      ctx.font = `bold ${Math.round(heightPx * 0.11)}px -apple-system, BlinkMacSystemFont, "Cairo", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(tenantName, widthPx / 2, currentY, widthPx - 16);
      currentY += Math.round(heightPx * 0.13);
    }

    // 2. Product Name
    if (showProductName) {
      ctx.fillStyle = '#000000';
      ctx.font = `900 ${Math.round(heightPx * 0.12)}px -apple-system, BlinkMacSystemFont, "Cairo", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const prodName = product.name_ar || product.name_en || '';
      ctx.fillText(prodName, widthPx / 2, currentY, widthPx - 16);
      currentY += Math.round(heightPx * 0.14);
    }

    // 3. Price
    if (showPrice) {
      ctx.fillStyle = '#000000';
      ctx.font = `900 ${Math.round(heightPx * 0.14)}px -apple-system, BlinkMacSystemFont, "Cairo", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${product.selling_price.toFixed(2)} ${currency}`, widthPx / 2, currentY, widthPx - 16);
      currentY += Math.round(heightPx * 0.16);
    }

    // 4. Barcode Bars
    const { totalWidth, bars } = encodeCode128(product.barcode);
    const barcodeAvailableWidth = widthPx - 24;
    const barcodeAvailableHeight = Math.max(30, heightPx - currentY - Math.round(heightPx * 0.16));
    const scaleX = barcodeAvailableWidth / totalWidth;
    const startX = 12;

    ctx.fillStyle = '#000000';
    for (const bar of bars) {
      ctx.fillRect(
        startX + bar.x * scaleX,
        currentY,
        Math.max(1, bar.width * scaleX),
        barcodeAvailableHeight
      );
    }

    currentY += barcodeAvailableHeight + 4;

    // 5. Barcode Number
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(heightPx * 0.10)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(product.barcode, widthPx / 2, currentY);

    return canvas;
  };

  // Pair or switch USB printer directly
  const handleConnectUsb = async () => {
    setIsConnectingUsb(true);
    setUsbFeedback(null);
    const res = await connectUsbPrinter();
    setIsConnectingUsb(false);

    if (res.success && res.name) {
      if (res.name.includes('13d3') || res.name.includes('5a01')) {
        setUsbPrinterName(null);
        setUsbFeedback({ 
          success: false, 
          message: 'تنبيه: لقد اخترت كاميرا اللابتوب الداخلية (13d3:5a01) بالخطأ! اضغط على الزر مرة أخرى واختر طابعة الباركود (مثل Xprinter أو POS Printer).' 
        });
        return;
      }
      setUsbPrinterName(res.name);
      setPrintMethod('usb');
      setUsbFeedback({ success: true, message: `تم الاتصال بنجاح بطابعة: ${res.name}` });
    } else {
      setUsbFeedback({ success: false, message: res.error || 'فشل الاتصال بطابعة USB' });
    }
  };

  // Pair Serial / COM port directly
  const handleConnectSerial = async () => {
    setIsConnectingUsb(true);
    setUsbFeedback(null);
    const res = await connectSerialPrinter();
    setIsConnectingUsb(false);

    if (res.success && res.name) {
      setUsbPrinterName(res.name);
      setPrintMethod('serial');
      setUsbFeedback({ success: true, message: `تم الاتصال بنجاح بمنفذ: ${res.name}` });
    } else {
      setUsbFeedback({ success: false, message: res.error || 'فشل الاتصال بمنفذ Serial' });
    }
  };

  // Direct Hardware Print (USB or Serial via TSPL)
  const handlePrintDirect = async () => {
    setIsPrintingUsb(true);
    setUsbFeedback(null);

    const dims = {
      '38x25': { w: 38, h: 25, dotsW: 304, dotsH: 200 },
      '40x30': { w: 40, h: 30, dotsW: 320, dotsH: 240 },
      '50x25': { w: 50, h: 25, dotsW: 400, dotsH: 200 },
    }[labelSize];

    const canvas = generateStickerCanvas(dims.dotsW, dims.dotsH);
    
    let res: { success: boolean; error?: string };
    if (printMethod === 'serial') {
      res = await printBarcodeDirectSerial(canvas, dims.w, dims.h, copies);
    } else {
      res = await printBarcodeDirectUsb(canvas, dims.w, dims.h, copies);
    }
    setIsPrintingUsb(false);

    if (res.success) {
      setUsbFeedback({ success: true, message: `تمت طباعة ${copies} ملصق مباشرة بنجاح! ⚡` });
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setUsbFeedback({ 
        success: false, 
        message: `${res.error} (يمكنك استخدام خيار طباعة المتصفح كبديل) `
      });
    }
  };

  // System Print via isolated iframe
  const handlePrintSystem = () => {
    const sizeDimensions = {
      '38x25': { width: '38mm', height: '25mm' },
      '40x30': { width: '40mm', height: '30mm' },
      '50x25': { width: '50mm', height: '25mm' },
    }[labelSize];

    const is25mm = labelSize === '38x25' || labelSize === '50x25';
    const svgHeight = is25mm ? 15 : 22;
    const storeFontSize = is25mm ? '8px' : '9.5px';
    const prodFontSize = is25mm ? '8.5px' : '10px';
    const priceFontSize = is25mm ? '9.5px' : '11.5px';
    const codeFontSize = is25mm ? '8px' : '9px';

    const barcodeSvgHtml = renderCode128SvgString(product.barcode, svgHeight);

    const singleStickerHtml = `
      <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; overflow: hidden; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', sans-serif; direction: ltr;">
        ${showStoreName ? `
          <div style="font-size: ${storeFontSize}; font-weight: 700; color: #1f2937; line-height: 1.1; max-height: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; direction: rtl;">
            ${tenantName}
          </div>
        ` : ''}

        ${showProductName ? `
          <div style="font-size: ${prodFontSize}; font-weight: 900; color: #000000; line-height: 1.1; max-height: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; direction: rtl;">
            ${product.name_ar || product.name_en}
          </div>
        ` : ''}

        ${showPrice ? `
          <div style="font-size: ${priceFontSize}; font-weight: 900; color: #000000; line-height: 1; margin: 0.5px 0; text-align: center; direction: rtl;">
            ${product.selling_price.toFixed(2)} <span style="font-size: 7px; font-weight: 600;">${currency}</span>
          </div>
        ` : ''}

        <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; direction: ltr;">
          ${barcodeSvgHtml}
          <span style="font-family: monospace, monospace; font-size: ${codeFontSize}; font-weight: 700; letter-spacing: 0.12em; color: #000000; line-height: 1; margin-top: 0.5px; text-align: center; display: block; width: 100%;">
            ${product.barcode}
          </span>
        </div>
      </div>
    `;

    const stickersList: string[] = [];
    for (let i = 0; i < copies; i++) {
      stickersList.push(singleStickerHtml);
    }

    printBarcodeLabelsIsolated(stickersList, sizeDimensions, { orientation });
  };

  const handleDownloadImage = () => {
    if (!product) return;
    const widthPx = labelSize === '50x25' ? 590 : labelSize === '40x30' ? 472 : 449;
    const heightPx = labelSize === '40x30' ? 354 : 295;
    const canvas = generateStickerCanvas(widthPx, heightPx);

    const link = document.createElement('a');
    link.download = `barcode-${product.barcode}-${labelSize}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="طباعة ملصقات الباركود (Barcode Labels)"
      maxWidth="lg"
    >
      <div className="space-y-5">
        
        {/* Top Info Banner */}
        <div className="bg-[#EEF4FF] border border-[#C7DCFF] rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#246BFD] shrink-0" />
            <div>
              <p className="font-bold text-[#0B1730]">{product.name_ar || product.name_en}</p>
              <p className="text-[#687386] font-mono">{product.barcode} {product.sku ? `• SKU: ${product.sku}` : ''}</p>
            </div>
          </div>
          <div className="text-left rtl:text-right font-black text-sm text-[#246BFD]">
            {product.selling_price.toFixed(2)} {currency}
          </div>
        </div>

        {/* Print Method Switcher: Direct USB vs Browser System Print */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-xs text-[#0B1730]">
              طريقة الطباعة (Print Method):
            </label>
            <span className="text-[10px] text-gray-500">
              {printMethod === 'usb' ? '⚡ طباعة مباشرة بدون نوافذ' : '📄 طباعة عبر نافذة المتصفح'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPrintMethod('usb')}
              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                printMethod === 'usb'
                  ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                  : 'bg-white border-[#E5EAF2] text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${printMethod === 'usb' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Usb className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>طابعة USB مباشرة (الأفضل)</span>
                  {printMethod === 'usb' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className="text-[10px] opacity-80 font-normal mt-0.5">
                  تطبع فوراً بضغطة زر مثل البرامج المثبتة بدون أي نوافذ
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPrintMethod('system')}
              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                printMethod === 'system'
                  ? 'bg-blue-50/70 border-blue-500 text-blue-950 font-bold shadow-xs'
                  : 'bg-white border-[#E5EAF2] text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${printMethod === 'system' ? 'bg-[#246BFD] text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>طابعة المتصفح (System Print)</span>
                  {printMethod === 'system' && <CheckCircle2 className="w-3.5 h-3.5 text-[#246BFD]" />}
                </div>
                <div className="text-[10px] opacity-80 font-normal mt-0.5">
                  تفتح نافذة الطباعة لاختيار أي طابعة معرفة بالكمبيوتر
                </div>
              </div>
            </button>
          </div>

          {/* USB Device Status / Pair Button */}
          {printMethod === 'usb' && (
            <div className="mt-2 animate-in fade-in zoom-in-95">
              {usbPrinterName ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Usb className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>متصل: {usbPrinterName}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <p className="text-[10px] text-emerald-700">جاهز للطباعة المباشرة ببروتوكول TSPL بدون ورق أبيض زائد</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    disabled={isConnectingUsb}
                    className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    {isConnectingUsb ? 'جاري الفحص...' : 'تغيير الطابعة'}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-[#246BFD] shrink-0">
                      <Usb className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-blue-950">اختر طابعة الباركود المتصلة بالـ USB</p>
                      <p className="text-[10px] text-blue-700">اضغط للاختيار من القائمة (اختر اسم طابعة الباركود مثل Xprinter أو POS Printer وليس كاميرا اللابتوب)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleConnectUsb}
                      disabled={isConnectingUsb}
                      className="px-3.5 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isConnectingUsb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Usb className="w-3.5 h-3.5" />}
                      <span>اختيار كابل USB</span>
                    </button>
                    {isWebSerialSupported() && (
                      <button
                        type="button"
                        onClick={handleConnectSerial}
                        disabled={isConnectingUsb}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="منفذ COM الافتراضي يعمل مباشرة في ويندوز بدون تعارض"
                      >
                        <Cable className="w-3.5 h-3.5" />
                        <span>منفذ Serial / COM</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* USB Feedback Toast */}
          {usbFeedback && (
            <div className={`p-3 rounded-xl border text-xs space-y-2 ${
              usbFeedback.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold flex items-center gap-2' 
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center gap-2">
                {usbFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="font-semibold leading-relaxed">{usbFeedback.message}</span>
              </div>
              {!usbFeedback.success && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintMethod('system');
                      setOrientation('rotate90');
                      setUsbFeedback(null);
                    }}
                    className="px-3 py-1.5 bg-[#246BFD] hover:bg-[#1A54D4] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>التبديل إلى طابعة المتصفح الآن (مع تدوير 90°)</span>
                  </button>
                  {isWebSerialSupported() && (
                    <button
                      type="button"
                      onClick={handleConnectSerial}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Cable className="w-3.5 h-3.5" />
                      <span>تجربة منفذ Serial / COM</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Sticker Preview */}
        <div className="p-4 bg-[#F8FAFC] border border-[#E5EAF2] rounded-xl flex flex-col items-center justify-center relative">
          <div className="flex items-center justify-between w-full max-w-[280px] mb-2 px-1">
            <span className="text-[11px] font-bold text-[#687386]">معاينة شكل الملصق الحراري</span>
            {orientation === 'rotate90' && (
              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <RotateCw className="w-2.5 h-2.5" />
                <span>تدوير 90° مفعل</span>
              </span>
            )}
          </div>
          
          <div
            id="barcode-single-sticker-preview"
            className="bg-white border border-gray-300 rounded-lg p-2.5 shadow-sm flex flex-col justify-between items-center text-center transition-all relative overflow-hidden"
            style={{
              width: labelSize === '50x25' ? '210px' : labelSize === '40x30' ? '185px' : '170px',
              minHeight: labelSize === '40x30' ? '135px' : '115px',
            }}
          >
            {showStoreName && (
              <div className="text-[10px] font-bold text-gray-800 tracking-tight truncate w-full">
                {tenantName}
              </div>
            )}

            {showProductName && (
              <div className="text-[11px] font-black text-black leading-tight line-clamp-1 w-full px-1">
                {product.name_ar || product.name_en}
              </div>
            )}

            {showPrice && (
              <div className="text-[13px] font-black text-black my-0.5">
                {product.selling_price.toFixed(2)} <span className="text-[9px] font-semibold">{currency}</span>
              </div>
            )}

            {/* Barcode Vector Graphic */}
            <div className="w-full px-1">
              <BarcodeSvg
                value={product.barcode}
                height={35}
                showText={true}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Customization Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          {/* Label Size */}
          <div className="space-y-1.5">
            <label className="block font-bold text-[#0B1730]">
              حجم الملصق (Label Size):
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: '38x25', label: '2.5 × 3.8 cm', desc: '38×25 mm (الافتراضي)' },
                { id: '40x30', label: '3.0 × 4.0 cm', desc: '40×30 mm' },
                { id: '50x25', label: '2.5 × 5.0 cm', desc: '50×25 mm' },
              ].map(sz => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setLabelSize(sz.id as any)}
                  className={`py-2 px-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                    labelSize === sz.id 
                      ? 'bg-[#0B1730] text-white border-[#0B1730] font-bold shadow-xs' 
                      : 'bg-white border-[#E5EAF2] text-[#687386] hover:bg-gray-50'
                  }`}
                >
                  <div className="text-[11px] font-bold">{sz.label}</div>
                  <div className="text-[9px] opacity-75">{sz.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Copies */}
          <div className="space-y-1.5">
            <label className="block font-bold text-[#0B1730]">
              عدد الملصقات (الكمية):
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                className="p-2 rounded-lg border border-[#E5EAF2] bg-white hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 py-1.5 text-center text-sm font-bold font-mono border border-[#E5EAF2] rounded-lg focus:outline-none focus:border-[#246BFD] bg-white"
              />
              <button
                type="button"
                onClick={() => setCopies(prev => prev + 1)}
                className="p-2 rounded-lg border border-[#E5EAF2] bg-white hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {[1, 5, 10, 25, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setCopies(cnt)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${copies === cnt ? 'bg-[#246BFD] text-white border-[#246BFD]' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Orientation Selector */}
        <div className="space-y-1.5 text-xs">
          <label className="block font-bold text-[#0B1730]">
            توجيه الطباعة على الطابعة (Print Orientation):
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setOrientation('horizontal')}
              className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                orientation === 'horizontal'
                  ? 'bg-[#0B1730] text-white border-[#0B1730] font-bold shadow-xs'
                  : 'bg-white border-[#E5EAF2] text-[#687386] hover:bg-gray-50'
              }`}
            >
              <div className="text-[11px] font-bold">بالعرض (أفقي)</div>
              <div className="text-[9px] opacity-75">الوضع الافتراضي القياسي</div>
            </button>

            <button
              type="button"
              onClick={() => setOrientation('rotate90')}
              className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                orientation === 'rotate90'
                  ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                  : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <div className="text-[11px] font-bold flex items-center justify-center gap-1">
                <RotateCw className="w-3 h-3" />
                <span>تدوير 90°</span>
              </div>
              <div className="text-[9px] opacity-90">إذا طبعت طابعتك بالجنب</div>
            </button>

            <button
              type="button"
              onClick={() => setOrientation('vertical')}
              className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                orientation === 'vertical'
                  ? 'bg-[#0B1730] text-white border-[#0B1730] font-bold shadow-xs'
                  : 'bg-white border-[#E5EAF2] text-[#687386] hover:bg-gray-50'
              }`}
            >
              <div className="text-[11px] font-bold">بالطول (رأسي)</div>
              <div className="text-[9px] opacity-75">للملصقات الطولية</div>
            </button>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4 text-xs pt-1 border-t border-[#E5EAF2] flex-wrap">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showStoreName}
              onChange={(e) => setShowStoreName(e.target.checked)}
              className="rounded text-[#246BFD] focus:ring-0 cursor-pointer"
            />
            <span className="font-semibold text-gray-700">اسم المتجر</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showProductName}
              onChange={(e) => setShowProductName(e.target.checked)}
              className="rounded text-[#246BFD] focus:ring-0 cursor-pointer"
            />
            <span className="font-semibold text-gray-700">اسم الصنف</span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="rounded text-[#246BFD] focus:ring-0 cursor-pointer"
            />
            <span className="font-semibold text-gray-700">سعر البيع</span>
          </label>
        </div>

        {/* Instruction Alert for Mini 2.5 x 3.8 cm Thermal Printers */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>إرشادات ضبط طابعة الباركود لمنع خروج ورق فارغ أو طباعة مقلوبة:</span>
          </div>
          
          <ul className="text-[11px] text-amber-800 space-y-1.5 list-disc list-inside leading-relaxed mr-1">
            <li>
              <strong>إذا طبعت الطابعة بالجنب (بالطول بدل العرض):</strong> اضغط على زر <strong>(تدوير 90°)</strong> أعلاه، وستطبع بالعرض فوراً وبشكل مضبوط.
            </li>
            <li>
              <strong>لمنع خروج 5 ورقات بيضاء فارغة:</strong> في نافذة الطباعة (Print Settings) بجهازك، اضغط على <strong>حجم الورق (Paper size)</strong> واختر مقاس ملصقك <strong>38x25mm</strong> (أو 2.5x3.8 cm) وتأكد من <strong>إلغاء خيار (Headers and footers)</strong>. خروج الورق الأبيض يحدث لأن الويندوز يعتبر حجم الورقة A4 افتراضياً فيمرر الورق حتى نهاية الصفحة.
            </li>
            <li>
              <strong>معايرة فواصل الورق:</strong> اضغط مع الاستمرار على زر (Feed / التغذية) في طابعة الباركود لمدة ثانيتين حتى تصدر صوتاً (Beep) لتقيس الطابعة فواصل الملصقات تلقائياً.
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#E5EAF2] flex-wrap">
          <button
            type="button"
            onClick={handleDownloadImage}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#E5EAF2] hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
            title="تحميل الملصق كصورة PNG عالية الدقة للطباعة من أي برنامج آخر"
          >
            <Download className="w-3.5 h-3.5 text-[#246BFD]" />
            <span>تحميل الملصق كصورة (PNG)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E5EAF2] rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            {printMethod === 'usb' || printMethod === 'serial' ? (
              <button
                type="button"
                onClick={handlePrintDirect}
                disabled={isPrintingUsb}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isPrintingUsb ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>طباعة {copies} ملصق فوراً {printMethod === 'serial' ? 'عبر COM' : 'عبر USB'} ⚡</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrintSystem}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#246BFD] hover:bg-[#1A54D4] active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة {copies} ملصق عبر المتصفح 🏷️</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
}

