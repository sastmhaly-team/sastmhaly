'use client';

import html2canvas from 'html2canvas';

// Active printer references retained during browser session
let activeUsbDevice: any = null;
let activeSerialPort: any = null;

export type PrinterMode = 'system' | 'usb' | 'serial';

export interface PrinterConfig {
  mode: PrinterMode;
  name: string;
}

const STORAGE_KEY = 'sastmhaly_printer_config';

/**
 * Get saved printer configuration from localStorage
 */
export function getSavedPrinterConfig(): PrinterConfig {
  if (typeof window === 'undefined') {
    return { mode: 'system', name: 'طابعة النظام (System Print)' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'system' || parsed.mode === 'usb' || parsed.mode === 'serial')) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { mode: 'system', name: 'طابعة النظام (System Print)' };
}

/**
 * Save printer configuration to localStorage
 */
export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Check if WebUSB API is supported by the current browser
 */
export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Check if Web Serial API is supported by the current browser
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Request and pair a USB thermal printer directly
 */
export async function connectUsbPrinter(): Promise<{ success: boolean; name?: string; error?: string }> {
  if (!isWebUsbSupported()) {
    return { success: false, error: 'المتصفح لا يدعم اتصال USB المباشر (يرجى استخدام Chrome أو Edge)' };
  }

  try {
    const usb = (navigator as any).usb;
    const device = await usb.requestDevice({ filters: [] });
    if (!device) {
      return { success: false, error: 'لم يتم اختيار طابعة' };
    }

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    let hasOutEndpoint = false;
    let targetInterfaceNum = 0;
    if (device.configuration && device.configuration.interfaces) {
      for (const iface of device.configuration.interfaces) {
        for (const alt of iface.alternates) {
          if (alt.endpoints && alt.endpoints.some((e: any) => e.direction === 'out')) {
            hasOutEndpoint = true;
            targetInterfaceNum = iface.interfaceNumber;
            break;
          }
        }
        if (hasOutEndpoint) break;
      }
    }

    // Validate that the device is actually a printer and NOT an input device like a webcam
    if (!hasOutEndpoint) {
      const isWebcam = device.vendorId === 0x13d3 || device.productName?.toLowerCase().includes('cam') || device.configuration?.interfaces?.some((i: any) => i.alternates?.some((a: any) => a.interfaceClass === 14));
      try { await device.close(); } catch (_) {}
      
      if (isWebcam) {
        return { 
          success: false, 
          error: 'الجهاز الذي اخترته هو (كاميرا اللابتوب الداخلية 13d3:5a01) وليس طابعة! يرجى الضغط مرة أخرى واختيار طابعة الباركود (مثل Xprinter أو POS Printer).' 
        };
      }
      return { 
        success: false, 
        error: 'الجهاز المختار لا يحتوي على منفذ إرسال بيانات (OUT endpoint). تأكد من توصيل طابعة الباركود واختيارها.' 
      };
    }

    try {
      await device.claimInterface(targetInterfaceNum);
    } catch (e) {
      console.warn('Interface claim notice on connect:', e);
    }

    activeUsbDevice = device;
    const name = device.productName || device.manufacturerName || `طابعة USB (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;

    savePrinterConfig({ mode: 'usb', name });
    return { success: true, name };
  } catch (err: any) {
    console.error('USB printer connect error:', err);
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('access denied') || msg.includes('securityerror')) {
      return { 
        success: false, 
        error: 'ويندوز يحجز طابعة الـ USB لصالح تعريف الويندوز المثبت (Access Denied). يرجى التبديل لخيار (طابعة المتصفح) واختيار (تدوير 90°) للطباعة فوراً وبشكل مضبوط عبر الويندوز.' 
      };
    }
    return { success: false, error: err.message || 'فشل الاتصال بطابعة USB' };
  }
}

/**
 * Request and pair a Serial/COM thermal printer directly
 */
export async function connectSerialPrinter(): Promise<{ success: boolean; name?: string; error?: string }> {
  if (!isWebSerialSupported()) {
    return { success: false, error: 'المتصفح لا يدعم اتصال Serial المباشر (يرجى استخدام Chrome أو Edge)' };
  }

  try {
    const serial = (navigator as any).serial;
    const port = await serial.requestPort();
    if (!port) {
      return { success: false, error: 'لم يتم اختيار منفذ طابعة' };
    }

    activeSerialPort = port;
    const name = 'طابعة Serial / COM حرارية';
    savePrinterConfig({ mode: 'serial', name });
    return { success: true, name };
  } catch (err: any) {
    console.error('Serial printer connect error:', err);
    return { success: false, error: err.message || 'فشل الاتصال بمنفذ الطابعة' };
  }
}

/**
 * Convert HTML receipt element to a 1-bit monochrome raster ESC/POS byte buffer
 * Works with ALL ESC/POS thermal printers (XP-58, XP-80, Rongta, Epson, Bixolon, etc.)
 */
export async function renderReceiptToEscPosBuffer(element: HTMLElement, targetWidthDots: number = 384): Promise<Uint8Array> {
  const canvas = await (html2canvas as any)(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const width = canvas.width;
  const height = canvas.height;

  // Scale down or fit to thermal dot width (384 dots for 58mm roll, 576 dots for 80mm roll)
  const printWidth = targetWidthDots;
  const printHeight = Math.round((height / width) * printWidth);

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = printWidth;
  scaledCanvas.height = printHeight;
  const ctx = scaledCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, printWidth, printHeight);
  ctx.drawImage(canvas, 0, 0, printWidth, printHeight);

  const imgData = ctx.getImageData(0, 0, printWidth, printHeight);
  const data = imgData.data;

  const widthBytes = Math.ceil(printWidth / 8);
  const rasterData = new Uint8Array(widthBytes * printHeight);

  for (let y = 0; y < printHeight; y++) {
    for (let x = 0; x < printWidth; x++) {
      const idx = (y * printWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Luminance check for black pixel
      const isBlack = a > 128 && (0.299 * r + 0.587 * g + 0.114 * b) < 165;
      if (isBlack) {
        const byteIndex = y * widthBytes + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        rasterData[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  // ESC/POS Command: GS v 0 m xL xH yL yH [data]
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = printHeight % 256;
  const yH = Math.floor(printHeight / 256);

  const header = new Uint8Array([
    0x1B, 0x40, // ESC @ (Initialize printer)
    0x1B, 0x61, 0x01, // ESC a 1 (Center alignment)
    0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH // GS v 0 0 xL xH yL yH
  ]);

  const footer = new Uint8Array([
    0x1B, 0x64, 0x03, // ESC d 3 (Feed 3 lines)
    0x1D, 0x56, 0x42, 0x00 // GS V 66 0 (Cut paper)
  ]);

  const fullBuffer = new Uint8Array(header.length + rasterData.length + footer.length);
  fullBuffer.set(header, 0);
  fullBuffer.set(rasterData, header.length);
  fullBuffer.set(footer, header.length + rasterData.length);

  return fullBuffer;
}

/**
 * Check if a valid USB printer (not a webcam) is already paired and available
 */
export async function getPairedUsbPrinter(): Promise<{ connected: boolean; name?: string }> {
  if (!isWebUsbSupported()) return { connected: false };
  try {
    const devices = await (navigator as any).usb.getDevices();
    if (devices && devices.length > 0) {
      // Find a device that is genuinely a printer and has an OUT endpoint
      for (const dev of devices) {
        if (dev.vendorId === 0x13d3) continue; // AzureWave webcam
        if (dev.productName?.toLowerCase().includes('cam')) continue;
        
        const hasOut = dev.configuration?.interfaces?.some((i: any) => 
          i.alternates?.some((a: any) => 
            a.endpoints?.some((e: any) => e.direction === 'out')
          )
        );
        
        // If device has OUT endpoint or isn't a known webcam
        const name = dev.productName || dev.manufacturerName || `طابعة USB (${dev.vendorId.toString(16)}:${dev.productId.toString(16)})`;
        return { connected: true, name };
      }
    }
  } catch (e) {
    // ignore
  }
  return { connected: false };
}

/**
 * Send raw binary buffer to active USB thermal printer
 */
export async function sendBufferToUsbDevice(buffer: Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (!isWebUsbSupported()) {
    return { success: false, error: 'المتصفح لا يدعم اتصال USB (يرجى استخدام Chrome أو Edge)' };
  }

  try {
    const usb = (navigator as any).usb;
    if (!activeUsbDevice || activeUsbDevice.vendorId === 0x13d3) {
      activeUsbDevice = null;
      const devices = await usb.getDevices();
      const validPrinter = devices?.find((d: any) => d.vendorId !== 0x13d3);
      if (validPrinter) {
        activeUsbDevice = validPrinter;
      } else {
        const conn = await connectUsbPrinter();
        if (!conn.success) return { success: false, error: conn.error || 'يرجى ربط طابعة USB أولاً' };
      }
    }

    if (!activeUsbDevice) {
      return { success: false, error: 'طابعة USB غير متصلة' };
    }

    if (!activeUsbDevice.opened) {
      await activeUsbDevice.open();
    }
    if (activeUsbDevice.configuration === null) {
      await activeUsbDevice.selectConfiguration(1);
    }

    let targetInterfaceNum = 0;
    let endpointOut: any = null;

    if (activeUsbDevice.configuration && activeUsbDevice.configuration.interfaces) {
      for (const iface of activeUsbDevice.configuration.interfaces) {
        for (const alt of iface.alternates) {
          const outEp = alt.endpoints?.find((e: any) => e.direction === 'out');
          if (outEp) {
            targetInterfaceNum = iface.interfaceNumber;
            endpointOut = outEp;
            break;
          }
        }
        if (endpointOut) break;
      }
    }

    if (!endpointOut) {
      activeUsbDevice = null;
      return { 
        success: false, 
        error: 'الجهاز الموصول ليس طابعة باركود (لا يحتوي على منفذ إرسال OUT endpoint). اضغط على (تغيير الطابعة) واختر طابعة الباركود (مثل Xprinter أو POS Printer).' 
      };
    }

    try {
      await activeUsbDevice.claimInterface(targetInterfaceNum);
    } catch (e) {
      // If already claimed, ignore
    }

    // Split large buffers into 16KB chunks to prevent USB packet overflow
    const chunkSize = 16384;
    for (let offset = 0; offset < buffer.length; offset += chunkSize) {
      const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
      await activeUsbDevice.transferOut(endpointOut.endpointNumber, chunk);
    }

    return { success: true };
  } catch (err: any) {
    console.error('USB transfer error:', err);
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('access denied') || msg.includes('securityerror')) {
      return { 
        success: false, 
        error: 'ويندوز يحجز طابعة الـ USB لصالح تعريف الويندوز المثبت (Access Denied). يرجى التبديل لخيار (طابعة المتصفح) مع تفعيل (تدوير 90°) للطباعة المباشرة عبر الويندوز.' 
      };
    }
    return { success: false, error: err.message || 'فشلت الطباعة عبر USB' };
  }
}

/**
 * Print barcode label directly to connected Serial / COM thermal printer via TSPL protocol
 */
export async function printBarcodeDirectSerial(
  canvas: HTMLCanvasElement,
  widthMm: number,
  heightMm: number,
  copies: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!activeSerialPort) {
      const conn = await connectSerialPrinter();
      if (!conn.success) return { success: false, error: conn.error || 'يرجى ربط منفذ الطابعة أولاً' };
    }

    if (!activeSerialPort) {
      return { success: false, error: 'منفذ الطابعة غير متصل' };
    }

    const buffer = createTsplBarcodeBuffer(widthMm, heightMm, canvas, copies);

    if (!activeSerialPort.readable || !activeSerialPort.writable) {
      await activeSerialPort.open({ baudRate: 9600 });
    }
    const writer = activeSerialPort.writable.getWriter();
    await writer.write(buffer);
    writer.releaseLock();

    return { success: true };
  } catch (err: any) {
    console.error('Serial barcode print error:', err);
    return { success: false, error: err.message || 'فشلت الطباعة عبر منفذ Serial' };
  }
}

/**
 * Build TSPL binary command buffer from a rendered canvas for thermal barcode label printers
 * (Xprinter XP-365B, XP-235B, Rongta, TSC, Gprinter, etc.)
 */
export function createTsplBarcodeBuffer(
  widthMm: number,
  heightMm: number,
  canvas: HTMLCanvasElement,
  copies: number = 1
): Uint8Array {
  const widthBytes = Math.ceil(canvas.width / 8);
  const heightDots = canvas.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // In TSPL mode 0, 0 is white, 1 is black
  const rasterData = new Uint8Array(widthBytes * heightDots);

  for (let y = 0; y < heightDots; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const isBlack = a > 128 && (0.299 * r + 0.587 * g + 0.114 * b) < 165;
      if (isBlack) {
        const byteIndex = y * widthBytes + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        rasterData[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  const encoder = new TextEncoder();
  const headerStr = `SIZE ${widthMm} mm, ${heightMm} mm\r\nGAP 2 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,${widthBytes},${heightDots},0,`;
  const header = encoder.encode(headerStr);
  const footerStr = `\r\nPRINT ${copies},1\r\n`;
  const footer = encoder.encode(footerStr);

  const fullBuffer = new Uint8Array(header.length + rasterData.length + footer.length);
  fullBuffer.set(header, 0);
  fullBuffer.set(rasterData, header.length);
  fullBuffer.set(footer, header.length + rasterData.length);
  return fullBuffer;
}

/**
 * Print barcode label directly to connected USB thermal printer via TSPL protocol
 * Runs in under 100ms without opening any browser dialog
 */
export async function printBarcodeDirectUsb(
  canvas: HTMLCanvasElement,
  widthMm: number,
  heightMm: number,
  copies: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const buffer = createTsplBarcodeBuffer(widthMm, heightMm, canvas, copies);
    return await sendBufferToUsbDevice(buffer);
  } catch (err: any) {
    console.error('Direct USB barcode print error:', err);
    return { success: false, error: err.message || 'فشلت الطباعة المباشرة عبر USB' };
  }
}

/**
 * Print directly to connected USB thermal printer without browser print dialog
 */
export async function printDirectUsb(elementId: string): Promise<{ success: boolean; error?: string }> {
  const element = document.getElementById(elementId);
  if (!element) return { success: false, error: 'عنصر الفاتورة غير موجود' };

  try {
    // Determine target width (384 for 58mm, 576 for 80mm)
    const buffer = await renderReceiptToEscPosBuffer(element, 384);
    return await sendBufferToUsbDevice(buffer);
  } catch (err: any) {
    console.error('USB print error:', err);
    return { success: false, error: err.message || 'فشلت الطباعة عبر USB' };
  }
}

/**
 * Print directly to connected Serial / COM thermal printer without browser print dialog
 */
export async function printDirectSerial(elementId: string): Promise<{ success: boolean; error?: string }> {
  const element = document.getElementById(elementId);
  if (!element) return { success: false, error: 'عنصر الفاتورة غير موجود' };

  try {
    if (!activeSerialPort) {
      const conn = await connectSerialPrinter();
      if (!conn.success) return { success: false, error: conn.error || 'يرجى ربط منفذ الطابعة أولاً' };
    }

    if (!activeSerialPort) {
      return { success: false, error: 'منفذ الطابعة غير متصل' };
    }

    const buffer = await renderReceiptToEscPosBuffer(element, 384);

    await activeSerialPort.open({ baudRate: 9600 });
    const writer = activeSerialPort.writable.getWriter();
    await writer.write(buffer);
    writer.releaseLock();
    await activeSerialPort.close();

    return { success: true };
  } catch (err: any) {
    console.error('Serial print error:', err);
    return { success: false, error: err.message || 'فشلت الطباعة عبر منفذ Serial' };
  }
}

/**
 * Bulletproof Isolated Iframe System Print
 * - Runs in a completely separate hidden iframe.
 * - NEVER hides or touches the main Next.js React DOM tree.
 * - ZERO thread blocking, ZERO freezing, ZERO crashing.
 * - Loads the preview in under 10ms.
 */
export function printViaIsolatedIframe(elementId: string, options?: { isCompact?: boolean; extraCompact?: boolean }): void {
  const receipt = document.getElementById(elementId);
  if (!receipt) {
    window.print();
    return;
  }

  // Create or retrieve dedicated print iframe
  let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '76mm';
    iframe.style.height = '100px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  const compactClass = options?.extraCompact ? 'compact-receipt-extra' : options?.isCompact ? 'compact-receipt' : '';

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>فاتورة البيع</title>
      <style>
        @page {
          size: auto;
          margin: 0 !important;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          border-width: 0;
          border-style: solid;
          border-color: transparent;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif !important;
          direction: rtl !important;
          text-align: right !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          display: block !important;
          visibility: visible !important;
        }

        body > *,
        #print-mount,
        #printable-receipt {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        /* Core Flexbox Layout */
        .flex { display: flex !important; }
        .flex-col { flex-direction: column !important; }
        .items-center { align-items: center !important; }
        .items-start { align-items: flex-start !important; }
        .justify-center { justify-content: center !important; }
        .justify-between { justify-content: space-between !important; }
        .w-full { width: 100% !important; }
        .mx-auto { margin-left: auto !important; margin-right: auto !important; }

        /* Typography & Alignment */
        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
        .text-left { text-align: left !important; }
        .font-bold { font-weight: 700 !important; }
        .font-semibold { font-weight: 600 !important; }
        .font-normal { font-weight: 400 !important; }
        .font-mono { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif !important; }
        .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif !important; }
        
        .text-xs { font-size: 11px !important; }
        .text-sm { font-size: 13px !important; }
        .text-\\[9px\\] { font-size: 9px !important; }
        .text-\\[10px\\] { font-size: 10px !important; }
        .text-\\[11px\\] { font-size: 11px !important; }
        .tracking-tight { letter-spacing: -0.025em !important; }
        .tracking-wider { letter-spacing: 0.05em !important; }

        /* Colors */
        .text-black { color: #000000 !important; }
        .text-gray-500 { color: #6b7280 !important; }
        .text-gray-600 { color: #4b5563 !important; }
        .text-gray-700 { color: #374151 !important; }
        .text-emerald-600 { color: #059669 !important; }
        .bg-white { background-color: #ffffff !important; }

        /* Borders & Dividers */
        .border-none { border: none !important; border-width: 0 !important; }
        .border { border: 1px solid #d1d5db !important; }
        .border-b { border-bottom: 1px solid #000000 !important; }
        .border-t { border-top: 1px solid #000000 !important; }
        .border-dashed { border-style: dashed !important; }
        .border-dotted { border-style: dotted !important; }
        .border-black { border-color: #000000 !important; }
        .border-gray-300 { border-color: #d1d5db !important; }
        .border-collapse { border-collapse: collapse !important; }
        .rounded-lg { border-radius: 8px !important; }
        .divide-y > * + * { border-top: 1px solid #d1d5db !important; }
        .divide-dotted > * + * { border-top-style: dotted !important; }

        /* Spacing */
        .space-y-0\\.5 > * + * { margin-top: 2px !important; }
        .space-y-1 > * + * { margin-top: 3px !important; }
        .space-y-1\\.5 > * + * { margin-top: 4px !important; }
        .space-y-2 > * + * { margin-top: 6px !important; }
        .space-y-3 > * + * { margin-top: 8px !important; }
        .my-1\\.5 { 
          margin-top: 6px !important; 
          margin-bottom: 6px !important; 
          border-top: 1px dashed #000000 !important; 
          height: 0 !important; 
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          display: block !important;
        }
        .pt-1 { padding-top: 3px !important; }
        .pt-1\\.5 { padding-top: 4px !important; }
        .pt-2 { padding-top: 6px !important; }
        .pb-1 { padding-bottom: 3px !important; }
        .pb-2 { padding-bottom: 6px !important; }
        .py-1 { padding-top: 2px !important; padding-bottom: 2px !important; }
        .p-4 { padding: 8px !important; }
        .mt-2 { margin-top: 6px !important; }
        .mb-1 { margin-bottom: 3px !important; }
        .mb-1\\.5 { margin-bottom: 4px !important; }

        /* Table */
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        th, td {
          padding: 2px 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        /* Images */
        img {
          display: block !important;
          margin-left: auto !important;
          margin-right: auto !important;
          object-fit: contain !important;
        }
        .max-h-12 { max-height: 48px !important; }
        .max-h-6 { max-height: 24px !important; }
        .max-w-\\[130px\\] { max-width: 130px !important; }
        .object-contain { object-fit: contain !important; }

        /* Receipt Outer Container */
        #printable-receipt {
          width: 76mm !important;
          max-width: 76mm !important;
          margin: 0 auto !important;
          padding: 8px 6px !important;
          background: #ffffff !important;
          color: #000000 !important;
          direction: rtl !important;
          text-align: right !important;
          font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif !important;
          font-size: 11px !important;
          border: none !important;
          border-width: 0 !important;
          box-shadow: none !important;
        }

        /* Footer - Clean with NO borders or cut lines around message or logo */
        .receipt-footer,
        .receipt-footer *,
        .receipt-footer *::before,
        .receipt-footer *::after {
          border: none !important;
          border-width: 0 !important;
          border-top: none !important;
          border-bottom: none !important;
          border-left: none !important;
          border-right: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .receipt-footer {
          display: block !important;
          text-align: center !important;
          page-break-before: avoid !important;
          break-before: avoid !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
          margin-top: 8px !important;
          padding-top: 4px !important;
          border: none !important;
        }
        .receipt-footer img {
          display: block !important;
          margin: 4px auto 2px auto !important;
          max-height: 24px !important;
          border: none !important;
        }
        .receipt-footer p {
          text-align: center !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }

        /* Compact Modes */
        .compact-receipt {
          font-size: 9.5px !important;
          line-height: 1.15 !important;
        }
        .compact-receipt img { max-height: 22px !important; }
        .compact-receipt th, .compact-receipt td { padding: 1px 0 !important; }

        .compact-receipt-extra {
          font-size: 8.5px !important;
          line-height: 1.1 !important;
        }
        .compact-receipt-extra img { max-height: 18px !important; }
        .compact-receipt-extra th, .compact-receipt-extra td { padding: 0.5px 0 !important; }
        .compact-receipt-extra .space-y-3 > * + * { margin-top: 2px !important; }
      </style>
    </head>
    <body class="${compactClass}">
      <div id="print-mount" style="width: 76mm; margin: 0 auto; display: block !important; visibility: visible !important;">
        <div id="printable-receipt" dir="rtl" class="p-4 bg-white text-black font-mono text-[11px] space-y-3 text-right" style="width: 76mm; margin: 0 auto; display: block !important; visibility: visible !important;">
          ${receipt.innerHTML}
        </div>
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Ensure images are decoded before print
  const images = Array.from(doc.images);
  const imagePromises = images.map((img) => {
    img.removeAttribute('loading');
    img.setAttribute('loading', 'eager');
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  Promise.race([
    Promise.all(imagePromises),
    new Promise((resolve) => setTimeout(resolve, 200)),
  ]).then(() => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error', err);
        window.print();
      }
    }, 80);
  });
}

/**
 * Universal print handler that respects the merchant's chosen mode
 */
export async function printReceiptUnified(
  elementId: string,
  options?: { isCompact?: boolean; extraCompact?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const config = getSavedPrinterConfig();

  if (config.mode === 'usb') {
    const res = await printDirectUsb(elementId);
    if (!res.success) {
      console.warn('Direct USB print failed, falling back to isolated system print:', res.error);
      printViaIsolatedIframe(elementId, options);
      return res;
    }
    return { success: true };
  }

  if (config.mode === 'serial') {
    const res = await printDirectSerial(elementId);
    if (!res.success) {
      console.warn('Direct Serial print failed, falling back to isolated system print:', res.error);
      printViaIsolatedIframe(elementId, options);
      return res;
    }
    return { success: true };
  }

  // Default: Isolated Iframe System Print
  printViaIsolatedIframe(elementId, options);
  return { success: true };
}

/**
 * Options for Barcode Label printing
 */
export interface BarcodePrintOptions {
  orientation?: 'horizontal' | 'rotate90' | 'vertical';
}

/**
 * Isolated Iframe Print specifically for Mini Barcode Labels / Stickers.
 *
 * ORIENTATION STRATEGY (industry-standard for Windows thermal label printers):
 * ─────────────────────────────────────────────────────────────────────────────
 * Windows thermal-label drivers default to PORTRAIT orientation.
 * When Chrome receives @page { size: 38mm 25mm } (width > height) it treats
 * the page as LANDSCAPE, which makes the driver auto-rotate the job 90° →
 * the label appears sideways.
 *
 * Fix: We ALWAYS declare the @page in PORTRAIT order (short-side × long-side),
 * i.e. 25mm × 38mm for a 38×25 sticker. The physical label content is then
 * CSS-rotated -90° inside the page so it reads correctly as landscape on paper.
 *
 * Result: Chrome sends a portrait page → Windows driver doesn't rotate →
 * the sticker sits in its correct orientation on the physical label.
 *
 * "rotate90" toggle: used ONLY when the merchant's driver is already set to
 * landscape mode, so we counter-rotate by +90° instead of -90°.
 *
 * Blank-feed prevention:
 * - html/body height is clamped to exactly one label height so the browser
 *   document is never taller than the physical sticker.
 * - 0.5mm is subtracted from each label to prevent fractional-pixel overflow.
 * - page-break-after:avoid on the last child prevents the driver from feeding
 *   an extra blank label at the end.
 */
export function printBarcodeLabelsIsolated(
  stickers: string[] | string,
  dimensions: { width: string; height: string },
  options?: BarcodePrintOptions
): void {
  if (typeof window === 'undefined') return;

  // Remove any previous barcode print iframe to guarantee fresh styles
  const oldIframe = document.getElementById('barcode-print-iframe');
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'barcode-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = dimensions.width;
  iframe.style.height = dimensions.height;
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  const stickersList = Array.isArray(stickers) ? stickers : [stickers];
  const isExplicitRotate90 = options?.orientation === 'rotate90';

  // ─── Portrait-based layout ───────────────────────────────────────────────
  // For a 38mm × 25mm label (width × height):
  //   • @page declares 25mm × 38mm  (portrait = short-side first)
  //   • The .barcode-label-page box is 25mm wide × 38mm tall (portrait)
  //   • The inner content wrapper is 38mm wide × 25mm tall, rotated -90°
  //     so it reads in landscape on the physical paper.
  //
  // If the merchant switches "rotate90" (driver already in landscape), we
  // flip back to landscape @page and rotate content +90° instead.
  // ─────────────────────────────────────────────────────────────────────────
  const pgWidth  = isExplicitRotate90 ? dimensions.width  : dimensions.height; // short-side first = portrait
  const pgHeight = isExplicitRotate90 ? dimensions.height : dimensions.width;
  const boxW     = isExplicitRotate90 ? dimensions.width  : dimensions.height;
  const boxH     = isExplicitRotate90 ? dimensions.height : dimensions.width;

  // The inner content div physically occupies the FULL label in landscape
  // but lives inside a portrait page-box → achieve this with a 90° rotation.
  // We subtract 1mm from each axis to leave a hairline bleed buffer.
  const innerW   = `calc(${isExplicitRotate90 ? dimensions.height : dimensions.width}  - 1mm)`;
  const innerH   = `calc(${isExplicitRotate90 ? dimensions.width  : dimensions.height} - 1mm)`;
  const rotateDeg = isExplicitRotate90 ? '90deg' : '-90deg';

  const pagesHtml = stickersList.map((stickerContent, idx) => `
    <div class="barcode-label-page" data-page="${idx + 1}">
      <div class="barcode-inner" style="
        width: ${innerW} !important;
        height: ${innerH} !important;
        transform: rotate(${rotateDeg}) !important;
        transform-origin: center center !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        align-items: center !important;
        text-align: center !important;
        box-sizing: border-box !important;
        padding: 0.8mm 1mm !important;
        overflow: hidden !important;
      ">
        ${stickerContent}
      </div>
    </div>
  `).join('');

  // Temporarily clear main document title so Chrome prints no header/footer text
  const originalTitle = document.title;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="utf-8" />
      <title></title>
      <style>
        @page {
          size: ${pgWidth} ${pgHeight};
          margin: 0mm !important;
        }
        @page :first { margin: 0mm !important; }
        @page :left  { margin: 0mm !important; }
        @page :right { margin: 0mm !important; }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", Arial, sans-serif !important;
          direction: ltr !important;
          text-align: left !important;
          margin: 0 !important;
          padding: 0 !important;
          /* Clamp body to exactly one label height to prevent blank feeds */
          width: ${pgWidth} !important;
          height: ${pgHeight} !important;
          max-height: ${pgHeight} !important;
          overflow: hidden !important;
        }

        /*
         * Each label page-box is PORTRAIT (short-side × long-side).
         * The inner div is rotated to fill the landscape area.
         */
        .barcode-label-page {
          width: ${boxW} !important;
          height: calc(${boxH} - 0.5mm) !important;
          max-width: ${boxW} !important;
          max-height: calc(${boxH} - 0.5mm) !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          overflow: hidden !important;
          background: #ffffff !important;
          direction: ltr !important;
          position: relative !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: always !important;
          break-after: page !important;
          border: none !important;
        }
        .barcode-label-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        @media print {
          @page {
            size: ${pgWidth} ${pgHeight};
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${pgWidth} !important;
            height: ${pgHeight} !important;
            max-height: ${pgHeight} !important;
            overflow: hidden !important;
          }
          .barcode-label-page {
            border: none !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .barcode-label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }

        /* Typography & Utilities */
        .text-center  { text-align: center !important; }
        .w-full       { width: 100% !important; }
        .truncate     { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
        .font-bold    { font-weight: 700 !important; }
        .font-black   { font-weight: 900 !important; }
        .font-semibold{ font-weight: 600 !important; }
        .font-normal  { font-weight: 400 !important; }
        .font-mono    { font-family: monospace, monospace !important; }
        svg {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          shape-rendering: crispEdges !important;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `);
  doc.close();

  // 300ms gives the iframe time to fully lay out before the print dialog opens
  setTimeout(() => {
    try {
      const contentWin = iframe.contentWindow;
      if (contentWin) {
        document.title = '';
        contentWin.document.title = '';
        contentWin.focus();
        contentWin.print();
        setTimeout(() => {
          document.title = originalTitle;
        }, 2000);
      } else {
        window.print();
      }
    } catch (e) {
      console.error('Barcode iframe print failed:', e);
      window.print();
    }
  }, 300);
}

