'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';
import { Sale, SaleItem } from '@/lib/types';
import { 
  MessageCircle, Image as ImageIcon, FileText, Download, 
  Copy, Check, Share2, Loader2, Sparkles, AlertCircle 
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface InvoiceShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: (Sale & { items?: SaleItem[] }) | null;
  tenantName?: string;
  tenantLogoUrl?: string;
  receiptFooter?: string;
  branchAddress?: string;
  branchPhone?: string;
  isRtl?: boolean;
}

export function InvoiceShareModal({
  isOpen,
  onClose,
  sale,
  tenantName = 'سستمهالي',
  tenantLogoUrl,
  receiptFooter = 'شكراً لتعاملكم معنا',
  branchAddress = 'القاهرة، مصر',
  branchPhone = '01558516263',
  isRtl = true,
}: InvoiceShareModalProps) {
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'choose' | 'image_ready'>('choose');
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const saleDate = new Date(sale.created_at).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const paymentMethodText = 
    sale.payment_method === 'cash' ? (isRtl ? 'نقداً (كاش)' : 'Cash') :
    sale.payment_method === 'card' ? (isRtl ? 'بطاقة بنكية' : 'Card') :
    sale.payment_method === 'mobile_wallet' ? (isRtl ? 'محفظة إلكترونية' : 'Mobile Wallet') :
    sale.payment_method === 'customer_credit' ? (isRtl ? 'آجل' : 'Credit') : sale.payment_method;

  // 1. Text Message Share to WhatsApp
  const handleShareText = () => {
    let itemsText = '';
    if (sale.items && sale.items.length > 0) {
      itemsText = sale.items.map(item => {
        const name = (isRtl ? item.product_name_ar : item.product_name_en) || item.product_name_ar || item.product_name_en || (item as any).product_name || 'صنف';
        return `• *${name}* × ${item.quantity} = ${item.line_total.toFixed(2)} ${isRtl ? 'ج.م' : 'EGP'}`;
      }).join('\n');
    }

    const messageParts = [
      `🧾 *${isRtl ? 'فاتورة مبيعات' : 'Sales Receipt'} - ${tenantName}*`,
      `🔢 *${isRtl ? 'رقم الفاتورة:' : 'Invoice #:'}* ${sale.sale_number}`,
      `📅 *${isRtl ? 'التاريخ:' : 'Date:'}* ${saleDate}`,
      `🏢 *${isRtl ? 'الفرع:' : 'Branch:'}* ${sale.branch_name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}`,
      `👤 *${isRtl ? 'العميل:' : 'Customer:'}* ${sale.customer_name || (isRtl ? 'عميل نقدي عام' : 'Walk-in Customer')}`,
      `━━━━━━━━━━━━━━━━━━━`,
    ];

    if (itemsText) {
      messageParts.push(`🛍️ *${isRtl ? 'الأصناف:' : 'Purchased Items:'}*\n${itemsText}`);
      messageParts.push(`━━━━━━━━━━━━━━━━━━━`);
    }

    messageParts.push(`💵 *${isRtl ? 'المجموع الفرعي:' : 'Subtotal:'}* ${sale.subtotal.toFixed(2)} ${isRtl ? 'ج.م' : 'EGP'}`);
    if (sale.discount_amount > 0) {
      messageParts.push(`🏷️ *${isRtl ? 'الخصم:' : 'Discount:'}* -${sale.discount_amount.toFixed(2)} ${isRtl ? 'ج.م' : 'EGP'}`);
    }
    if (sale.tax_amount > 0) {
      messageParts.push(`📊 *${isRtl ? 'الضريبة:' : 'VAT:'}* +${sale.tax_amount.toFixed(2)} ${isRtl ? 'ج.م' : 'EGP'}`);
    }
    messageParts.push(`💰 *${isRtl ? 'الإجمالي النهائي:' : 'Total Amount:'}* ${sale.total_amount.toFixed(2)} ${isRtl ? 'ج.م' : 'EGP'}`);
    messageParts.push(`💳 *${isRtl ? 'طريقة الدفع:' : 'Payment Method:'}* ${paymentMethodText}`);
    messageParts.push(`━━━━━━━━━━━━━━━━━━━`);

    if (receiptFooter) {
      messageParts.push(`${receiptFooter}\n`);
    }
    messageParts.push(isRtl ? 'شكراً لتسوقكم معنا! 🙏\nمنصة سستمهالي لإدارة المتاجر' : 'Thank you for shopping with us! 🙏\nPowered by Sastmhaly');

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageParts.join('\n'))}`;
    window.open(waUrl, '_blank');
    onClose();
  };

  // 2. Generate Receipt Photo
  const handleGenerateImage = async () => {
    setLoadingImage(true);
    try {
      // Find element (either onscreen or offscreen template)
      const element = receiptContainerRef.current || document.getElementById('printable-receipt');
      if (!element) {
        alert(isRtl ? 'تعذر العثور على نموذج الإيصال' : 'Receipt template not found');
        return;
      }

      const canvas = await (html2canvas as any)(element, {
        scale: 2.5, // High resolution crisp text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => {
          const el = clonedDoc.getElementById('share-receipt-template');
          if (el) {
            el.style.position = 'static';
            el.style.left = '0';
            el.style.top = '0';
            el.style.display = 'block';
          }
        },
      });

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          alert('Failed to generate image');
          setLoadingImage(false);
          return;
        }

        setImageBlob(blob);
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setActiveTab('image_ready');
        setLoadingImage(false);

        // Try Native Share API if available (Mobile Browsers / Modern Desktop)
        const file = new File([blob], `receipt_${sale.sale_number}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `فاتورة ${sale.sale_number}`,
              text: `فاتورة مبيعات ${tenantName} - رقم ${sale.sale_number}`,
            });
          } catch (err: any) {
            // User cancelled or share dismissed, keep preview open
            console.log('Share dismissed or cancelled', err);
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error generating receipt image', err);
      alert('Error generating image');
      setLoadingImage(false);
    }
  };

  // 3. Copy image to clipboard for instant Ctrl+V pasting in WhatsApp Web
  const handleCopyImage = async () => {
    if (!imageBlob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': imageBlob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.warn('Clipboard write image not permitted, downloading instead', err);
      handleDownloadImage();
    }
  };

  // 4. Download image directly
  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `فاتورة_${sale.sale_number}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 5. Open WhatsApp Web / App directly
  const handleOpenWhatsAppForImage = async () => {
    await handleCopyImage();
    const caption = `فاتورة مبيعات - ${tenantName} (#${sale.sale_number})`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`, '_blank');
  };

  const handleModalClose = () => {
    setActiveTab('choose');
    setImageBlob(null);
    setImageUrl(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title={isRtl ? `مشاركة الفاتورة ${sale.sale_number} عبر واتساب` : `Share Invoice ${sale.sale_number} on WhatsApp`}
        size="md"
      >
        <div className="space-y-4 text-xs">
          {activeTab === 'choose' ? (
            <div>
              <p className="text-gray-600 mb-4 text-center">
                {isRtl 
                  ? 'اختر الطريقة التي تفضلها لمشاركة الفاتورة مع العميل عبر واتساب:' 
                  : 'Choose how you want to share this invoice on WhatsApp:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Share as Real Receipt Photo */}
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={loadingImage}
                  className="p-4 rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950 flex flex-col items-center text-center gap-2.5 transition-all group cursor-pointer shadow-xs active:scale-98"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    {loadingImage ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <ImageIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="font-black text-sm text-emerald-950 block">
                      {isRtl ? '📸 صورة الإيصال (Photo)' : '📸 Receipt Photo'}
                    </span>
                    <span className="text-[11px] text-emerald-800/80 mt-1 block leading-relaxed">
                      {isRtl 
                        ? 'مشاركة الفاتورة كصورة حقيقية للإيصال المطبوع بدقة عالية' 
                        : 'Share as a high-resolution printed receipt photo'}
                    </span>
                  </div>
                  <span className="mt-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-2xs">
                    {loadingImage ? (isRtl ? 'جاري تجهيز الصورة...' : 'Generating...') : (isRtl ? 'توليد ومشاركة الصورة' : 'Generate & Share')}
                  </span>
                </button>

                {/* Option 2: Share as Formatted Text Message */}
                <button
                  type="button"
                  onClick={handleShareText}
                  className="p-4 rounded-2xl border-2 border-blue-500/80 bg-blue-50/50 hover:bg-blue-50 text-blue-950 flex flex-col items-center text-center gap-2.5 transition-all group cursor-pointer shadow-xs active:scale-98"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-blue-950 block">
                      {isRtl ? '📝 رسالة نصية (Text)' : '📝 Text Message'}
                    </span>
                    <span className="text-[11px] text-blue-800/80 mt-1 block leading-relaxed">
                      {isRtl 
                        ? 'إرسال تفاصيل الفاتورة كرسالة نصية بالأصناف والأسعار والإجمالي' 
                        : 'Send receipt items and totals as a formatted text message'}
                    </span>
                  </div>
                  <span className="mt-1 px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-[10px] shadow-2xs">
                    {isRtl ? 'إرسال كنص في واتساب' : 'Send as Text'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Image Preview & Share Actions */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-xs font-semibold">
                  {isRtl 
                    ? 'تم توليد صورة الفاتورة بنجاح بجودة عالية! يمكنك نسخها ولصقها مباشرة في أي محادثة على واتساب أو تحميلها.'
                    : 'Receipt image generated! You can paste it directly into WhatsApp or download it.'}
                </p>
              </div>

              {/* Photo Preview */}
              {imageUrl && (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-gray-100 p-3 flex justify-center shadow-inner">
                  <img
                    src={imageUrl}
                    alt="Receipt Preview"
                    className="max-w-[280px] w-full rounded-lg shadow-md border border-gray-300"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppForImage}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{isRtl ? 'فتح واتساب ولصق الصورة (Ctrl+V)' : 'Open WhatsApp & Paste'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="py-2.5 px-3.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? (isRtl ? 'تم نسخ الصورة!' : 'Copied!') : (isRtl ? 'نسخ الصورة' : 'Copy Image')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="py-2.5 px-3.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                  title={isRtl ? 'تحميل صورة الفاتورة (PNG)' : 'Download PNG'}
                >
                  <Download className="w-4 h-4" />
                  <span>{isRtl ? 'تحميل PNG' : 'Download'}</span>
                </button>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('choose')}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  {isRtl ? '← العودة لاختيار رسالة نصية' : '← Back to text message'}
                </button>

                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Hidden Offscreen Receipt Template for html2canvas to capture anywhere */}
      <div
        id="share-receipt-template"
        ref={receiptContainerRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '360px',
          background: '#ffffff',
          padding: '16px',
          fontFamily: 'monospace',
          color: '#000000',
          direction: 'rtl',
        }}
      >
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
          {tenantLogoUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
              <img src={tenantLogoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '140px', objectFit: 'contain' }} />
            </div>
          )}
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '2px 0' }}>{tenantName}</h2>
          <p style={{ fontSize: '11px', color: '#555', margin: '2px 0' }}>{branchAddress}</p>
          <p style={{ fontSize: '11px', color: '#555', margin: '2px 0' }}>{branchPhone}</p>
          <p style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '6px' }}>{sale.sale_number}</p>
        </div>

        <div style={{ fontSize: '11px', marginBottom: '10px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>التاريخ:</span>
            <span>{saleDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>الكاشير:</span>
            <span>{sale.cashier_name || 'الكاشير'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>العميل:</span>
            <span>{sale.customer_name || 'عميل نقدي عام'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#555' }}>طريقة الدفع:</span>
            <span>{paymentMethodText}</span>
          </div>
        </div>

        {/* Table of items */}
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'right', marginBottom: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ padding: '4px 0', textAlign: 'right' }}>الصنف</th>
              <th style={{ padding: '4px 0', textAlign: 'center' }}>الكمية</th>
              <th style={{ padding: '4px 0', textAlign: 'left' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items && sale.items.length > 0) ? (
              sale.items.map((it, idx) => {
                const name = it.product_name_ar || it.product_name_en || (it as any).product_name || 'صنف';
                return (
                  <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{name}</td>
                    <td style={{ padding: '4px 0', textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ padding: '4px 0', textAlign: 'left', fontWeight: 'bold' }}>{it.line_total.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} style={{ padding: '6px 0', textAlign: 'center', color: '#555' }}>مبيعات نقدية</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>المجموع الفرعي:</span>
            <span>{sale.subtotal.toFixed(2)} ج.م</span>
          </div>
          {sale.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
              <span>الخصم:</span>
              <span>-{sale.discount_amount.toFixed(2)} ج.م</span>
            </div>
          )}
          {sale.tax_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
              <span>ضريبة القيمة المضافة:</span>
              <span>+{sale.tax_amount.toFixed(2)} ج.م</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
            <span>الإجمالي النهائي:</span>
            <span>{sale.total_amount.toFixed(2)} ج.م</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginTop: '2px' }}>
            <span>المدفوع:</span>
            <span>{sale.paid_amount.toFixed(2)} ج.م</span>
          </div>
          {sale.change_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
              <span>الباقي:</span>
              <span>{sale.change_amount.toFixed(2)} ج.م</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '10px', marginTop: '10px', fontSize: '11px', color: '#555' }}>
          <p style={{ margin: '2px 0' }}>{receiptFooter}</p>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/logo.png" alt="Sastmhaly" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <p style={{ fontWeight: 'bold', fontSize: '10px', color: '#333', marginTop: '2px' }}>Powered by Sastmhaly SaaS</p>
          </div>
        </div>
      </div>
    </>
  );
}
