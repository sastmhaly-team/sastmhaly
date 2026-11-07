'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BarcodeSvg } from './BarcodeSvg';
import { Printer, Download, Sparkles, Plus, Minus, Tag, Check } from 'lucide-react';

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
  const [labelSize, setLabelSize] = useState<'38x25' | '40x30' | '50x25'>('40x30');
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [showProductName, setShowProductName] = useState<boolean>(true);

  if (!product) return null;

  const handlePrint = () => {
    // Generate isolated printable barcode stickers in #print-mount
    let mount = document.getElementById('print-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'print-mount';
      document.body.appendChild(mount);
    }

    mount.className = 'barcode-label-mode';
    mount.setAttribute('dir', 'rtl');

    const sizeDimensions = {
      '38x25': { width: '38mm', height: '25mm' },
      '40x30': { width: '40mm', height: '30mm' },
      '50x25': { width: '50mm', height: '25mm' },
    }[labelSize];

    const stickerHtml = document.getElementById('barcode-single-sticker-preview')?.innerHTML || '';

    // Generate repeat stickers based on copies
    let stickersGrid = '';
    for (let i = 0; i < copies; i++) {
      stickersGrid += `
        <div class="barcode-sticker-item" style="width: ${sizeDimensions.width}; height: ${sizeDimensions.height}; page-break-inside: avoid; break-inside: avoid; margin: 0 auto 2mm auto; box-sizing: border-box; padding: 1.5mm; text-align: center; border: 1px dashed #e2e8f0; background: #fff; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;">
          ${stickerHtml}
        </div>
      `;
    }

    mount.innerHTML = `
      <div style="direction: rtl; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', monospace; display: flex; flex-wrap: wrap; justify-content: center; gap: 2mm;">
        ${stickersGrid}
      </div>
    `;

    setTimeout(() => {
      window.print();
    }, 80);
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

        {/* Live Sticker Preview */}
        <div className="p-4 bg-[#F8FAFC] border border-[#E5EAF2] rounded-xl flex flex-col items-center justify-center">
          <span className="text-[11px] font-bold text-[#687386] mb-2">معاينة شكل الملصق الحراري</span>
          
          <div
            id="barcode-single-sticker-preview"
            className="bg-white border border-gray-300 rounded-lg p-2.5 shadow-sm flex flex-col justify-between items-center text-center transition-all"
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
                { id: '38x25', label: '38×25 mm', desc: 'صغير' },
                { id: '40x30', label: '40×30 mm', desc: 'قياسي' },
                { id: '50x25', label: '50×25 mm', desc: 'عريض' },
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5EAF2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E5EAF2] rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#246BFD] hover:bg-[#1A54D4] active:scale-95 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة {copies} ملصق باركود 🏷️</span>
          </button>
        </div>

      </div>
    </Modal>
  );
}

