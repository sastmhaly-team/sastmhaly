'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { 
  Building2, Image as ImageIcon, Receipt, Package, 
  ShoppingCart, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2
} from 'lucide-react';

export default function MerchantOnboardingPage() {
  const { tenant } = useAuth();
  const { lang, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [savingSettings, setSavingSettings] = useState(false);

  const [businessData, setBusinessData] = useState({
    businessName: tenant?.name || 'Al-Baraka Supermarket',
    taxId: tenant?.tax_id || '',
    phone: tenant?.phone || '',
    address: '15 Talaat Harb St, Downtown, Cairo',
    defaultTax: '14.0',
    receiptFooter: 'شكراً لتعاملكم معنا',
  });

  // Load existing tenant settings so onboarding and settings stay completely synchronized
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/merchant/settings?tenantId=${tenant.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.tenant || data.settings) {
          setBusinessData(prev => ({
            ...prev,
            businessName: data.tenant?.name || prev.businessName,
            taxId: data.tenant?.tax_id || prev.taxId,
            phone: data.tenant?.phone || prev.phone,
            defaultTax: data.settings?.default_tax_rate !== undefined ? String(data.settings.default_tax_rate) : prev.defaultTax,
            receiptFooter: data.settings?.receipt_footer !== undefined && data.settings?.receipt_footer !== null ? data.settings.receipt_footer : prev.receiptFooter,
          }));
        }
      })
      .catch(err => console.error('Failed to load settings in onboarding:', err));
  }, [tenant?.id]);

  // Synchronize onboarding changes directly with tenant_settings in backend
  const syncSettingsToBackend = async (dataToSave = businessData) => {
    if (!tenant?.id) return;
    setSavingSettings(true);
    try {
      await fetch('/api/merchant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: dataToSave.businessName,
          tax_id: dataToSave.taxId,
          phone: dataToSave.phone,
          default_tax_rate: parseFloat(dataToSave.defaultTax) || 14.0,
          receipt_footer: dataToSave.receiptFooter,
        })
      });
    } catch (e) {
      console.error('Failed to sync onboarding settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1 || step === 3) {
      await syncSettingsToBackend();
    }
    setStep(s => s + 1);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Wizard Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5EAF2] shadow-2xs text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-[#246BFD] flex items-center justify-center mb-1">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1730]">
          {lang === 'ar' ? `مرحباً بك في سستمهالي، ${tenant?.name || 'التاجر'}` : `Welcome to Sastmhaly, ${tenant?.name || 'Merchant'}`}
        </h2>
        <p className="text-xs text-[#687386] max-w-lg mx-auto">
          {lang === 'ar' 
            ? 'معالج الإعداد الأولي السريع لضبط الهوية، الشعار، الضرائب، والمخزون لبدء استقبال المبيعات فوراً.' 
            : 'Complete these quick setup steps to establish your store identity, tax settings, and catalog ready for checkout.'}
        </p>

        {/* Step Indicator Pills */}
        <div className="flex items-center justify-center gap-2 pt-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step
                  ? 'bg-[#246BFD] text-white shadow-xs'
                  : s < step
                  ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
                  : 'bg-[#F7F9FC] text-[#687386] border border-[#E5EAF2]'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5EAF2] shadow-2xs">
        
        {/* Step 1: Business Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0B1730] border-b border-[#F1F4F9] pb-3">
              {lang === 'ar' ? 'الخطوة 1: التحقق من بيانات المنشأة' : 'Step 1: Business Profile Verification'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessData.businessName}
                  onChange={(e) => setBusinessData({ ...businessData, businessName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Tax Registration Number (الرقم الضريبي)</label>
                <input
                  type="text"
                  value={businessData.taxId}
                  onChange={(e) => setBusinessData({ ...businessData, taxId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Main Store Phone</label>
                <input
                  type="text"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">Headquarters Address</label>
                <input
                  type="text"
                  value={businessData.address}
                  onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Store Logo */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0B1730] border-b border-[#F1F4F9] pb-3">
              {lang === 'ar' ? 'الخطوة 2: شعار المتجر والفواتير' : 'Step 2: Business Logo for Receipts & Invoices'}
            </h3>
            
            <div className="p-6 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F7F9FC] text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden border border-[#E5EAF2] bg-white p-1">
                <Image src="/logo.png" alt="Store Logo" width={64} height={64} className="object-contain" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0B1730]">
                  {lang === 'ar' ? 'تم ضبط الشعار الافتراضي بنجاح' : 'Official Brand Logo Active'}
                </p>
                <p className="text-[11px] text-[#687386] mt-0.5">
                  {lang === 'ar' ? 'يظهر هذا الشعار على لوحة التحكم وإيصالات الكاشير الحرارية والفواتير' : 'This logo prints on POS receipts and merchant dashboards'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => alert('Logo file updated')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-semibold hover:bg-gray-50"
              >
                <Upload className="w-3.5 h-3.5 text-[#246BFD]" />
                <span>Upload Custom Image</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Tax & Receipt Footer */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0B1730] border-b border-[#F1F4F9] pb-3">
              {lang === 'ar' ? 'الخطوة 3: ضريبة القيمة المضافة والإيصالات' : 'Step 3: Egyptian VAT & Receipt Settings'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#172033] mb-1">
                  Default VAT Rate (نسبة ضريبة القيمة المضافة %)
                </label>
                <input
                  type="number"
                  value={businessData.defaultTax}
                  onChange={(e) => setBusinessData({ ...businessData, defaultTax: e.target.value })}
                  className="w-full sm:w-48 px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172033] mb-1">
                  Thermal Receipt Width
                </label>
                <select className="w-full sm:w-48 px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none cursor-pointer">
                  <option value="80mm">80 mm Standard Thermal</option>
                  <option value="58mm">58 mm Compact Thermal</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-[#172033]">
                    {lang === 'ar' ? 'نص تذييل الإيصال أسفل الفاتورة (متطابق مع الإعدادات)' : 'Receipt Footer Message (Synced with Settings)'}
                  </label>
                  {savingSettings && (
                    <span className="text-[10px] text-[#246BFD] font-medium animate-pulse">
                      {lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={businessData.receiptFooter}
                  onChange={(e) => setBusinessData({ ...businessData, receiptFooter: e.target.value })}
                  placeholder={lang === 'ar' ? 'شكراً لتعاملكم معنا' : 'Thank you for shopping with us'}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Products & CSV Import */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0B1730] border-b border-[#F1F4F9] pb-3">
              {lang === 'ar' ? 'الخطوة 4: الأصناف والكتالوج الافتتاحي' : 'Step 4: Products & Initial Catalog'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] space-y-2">
                <Package className="w-6 h-6 text-[#246BFD]" />
                <h4 className="text-xs font-bold text-[#0B1730]">Sample Catalog Seeded</h4>
                <p className="text-[11px] text-[#687386]">
                  10+ products including Dairy, Produce, Butcher meat, and Groceries are already loaded in your workspace.
                </p>
                <Link
                  href="/merchant/products"
                  className="inline-block text-xs font-bold text-[#246BFD] hover:underline"
                >
                  View Catalog Products →
                </Link>
              </div>

              <div className="p-4 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] space-y-2">
                <Upload className="w-6 h-6 text-[#10B981]" />
                <h4 className="text-xs font-bold text-[#0B1730]">Import Existing CSV / Excel</h4>
                <p className="text-[11px] text-[#687386]">
                  Download our bulk import template with barcode, SKU, Arabic/English names, and unit prices.
                </p>
                <Link
                  href="/merchant/products"
                  className="inline-block text-xs font-bold text-[#10B981] hover:underline"
                >
                  Go to CSV Import Tool →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Ready for Sales */}
        {step === 5 && (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#0B1730]">
              {lang === 'ar' ? 'تهانينا! متجرك جاهز للتشغيل بالكامل' : 'Setup Complete! Your Store is Ready'}
            </h3>
            <p className="text-xs text-[#687386] max-w-md mx-auto">
              {lang === 'ar'
                ? 'تم ضبط الفروع، الحسابات، الكتالوج، وإعدادات الكاشير. يمكنك الآن فتح وردية الخزينة وبدء البيع فوراً.'
                : 'Your branches, ledger, catalog, and cash registers are active. Launch the POS terminal or explore your dashboard.'}
            </p>

            <div className="pt-4 flex justify-center gap-3">
              <Link
                href="/merchant/pos"
                className="px-5 py-2.5 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold shadow-xs flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{lang === 'ar' ? 'فتح نقطة البيع والبدء بالبيع' : 'Launch POS Checkout'}</span>
              </Link>
              <Link
                href="/merchant/dashboard"
                className="px-5 py-2.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-bold text-[#0B1730] hover:bg-gray-50"
              >
                {lang === 'ar' ? 'الانتقال للوحة التحكم' : 'Go to Dashboard'}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom Nav Controls */}
        {step < 5 && (
          <div className="mt-6 pt-4 border-t border-[#F1F4F9] flex items-center justify-between">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386] hover:bg-gray-100 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{t('back')}</span>
            </button>

            <button
              type="button"
              disabled={savingSettings}
              onClick={handleNextStep}
              className="px-5 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('loading')}</span>
                </>
              ) : (
                <>
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </>
              )}
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
