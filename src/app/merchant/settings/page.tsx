'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Settings, Save, CheckCircle2, Building2, 
  Receipt, Scale, Percent, AlertCircle, Sparkles,
  UploadCloud, Loader2, ImageIcon
} from 'lucide-react';

export default function MerchantSettingsPage() {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const tenantId = user?.tenant_id || 'tenant_albaraka';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    tax_id: '',
    logo_url: '',
    default_tax_rate: 14.0,
    vat_enabled: 1,
    receipt_header: '',
    receipt_footer: '',
    receipt_width: '80mm' as '80mm' | '58mm',
    scale_barcode_prefix: '21',
    valuation_method: 'WAC' as 'FIFO' | 'WAC',
    expiry_warning_days: 30
  });

  const fetchSettings = async () => {
    try {
      const url = `/api/merchant/settings?tenantId=${tenantId}`;
      const cached = getCachedData<any>(url);
      if (cached?.tenant && cached?.settings) {
        setFormData({
          name: cached.tenant.name || '',
          phone: cached.tenant.phone || '',
          email: cached.tenant.email || '',
          tax_id: cached.tenant.tax_id || '',
          logo_url: cached.tenant.logo_url || '',
          default_tax_rate: cached.settings.default_tax_rate ?? 14.0,
          vat_enabled: cached.settings.vat_enabled ?? 1,
          receipt_header: cached.settings.receipt_header || '',
          receipt_footer: cached.settings.receipt_footer || '',
          receipt_width: cached.settings.receipt_width || '80mm',
          scale_barcode_prefix: cached.settings.scale_barcode_prefix || '21',
          valuation_method: cached.settings.valuation_method || 'WAC',
          expiry_warning_days: cached.settings.expiry_warning_days || 30
        });
        setLoading(false);
      } else if (!formData.name) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.tenant && data.settings) {
          setFormData({
            name: data.tenant.name || '',
            phone: data.tenant.phone || '',
            email: data.tenant.email || '',
            tax_id: data.tenant.tax_id || '',
            logo_url: data.tenant.logo_url || '',
            default_tax_rate: data.settings.default_tax_rate ?? 14.0,
            vat_enabled: data.settings.vat_enabled ?? 1,
            receipt_header: data.settings.receipt_header || '',
            receipt_footer: data.settings.receipt_footer || '',
            receipt_width: data.settings.receipt_width || '80mm',
            scale_barcode_prefix: data.settings.scale_barcode_prefix || '21',
            valuation_method: data.settings.valuation_method || 'WAC',
            expiry_warning_days: data.settings.expiry_warning_days || 30
          });
          setLoading(false);
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const body = new FormData();
      body.append('logo', file);
      body.append('tenantId', tenantId);

      const res = await fetch('/api/merchant/settings/logo', {
        method: 'POST',
        body,
      });

      const data = await res.json();
      if (data.success && data.logo_url) {
        setFormData(prev => ({ ...prev, logo_url: data.logo_url }));
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } else {
        alert(data.error || 'Failed to upload logo');
      }
    } catch {
      alert('Error uploading logo to Supabase');
    } finally {
      setUploadingLogo(false);
      // Reset input value
      e.target.value = '';
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(false);
    try {
      const res = await fetch('/api/merchant/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...formData,
          vat_enabled: formData.vat_enabled ? 1 : 0,
          default_tax_rate: Number(formData.default_tax_rate),
          expiry_warning_days: Number(formData.expiry_warning_days)
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } else {
        alert(data.error || 'Failed to save settings');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#687386]">
        {isRtl ? 'جاري تحميل إعدادات المتجر...' : 'Loading settings...'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0B1730]">
            {isRtl ? 'إعدادات المتجر والفواتير' : 'Store & System Settings'}
          </h1>
          <p className="text-xs text-[#687386] mt-1">
            {isRtl 
              ? 'تخصيص البيانات التجارية، الضريبة، تصميم الإيصال الحراري، وقواعد موازين الباركود (Section 34)'
              : 'Configure business identity, VAT rules, thermal receipt layouts, and electronic scale barcode prefixes'}
          </p>
        </div>

        {successMessage && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isRtl ? 'تم حفظ التعديلات بنجاح' : 'Settings saved successfully'}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Brand & Business Details */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAF2]">
            <Building2 className="w-4 h-4 text-[#246BFD]" />
            <h2 className="font-bold text-sm text-[#0B1730]">
              {isRtl ? 'بيانات المنشأة والهوية التجارية' : 'Business Identity & Profile'}
            </h2>
          </div>

          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#F7F9FC] rounded-xl border border-[#E5EAF2]">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 bg-white rounded-xl border border-[#E5EAF2] p-1 flex items-center justify-center shrink-0 shadow-xs relative overflow-hidden">
                {formData.logo_url ? (
                  <img 
                    src={formData.logo_url} 
                    alt="Brand Logo" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Image 
                    src="/logo.png" 
                    alt="Default Brand Logo" 
                    width={48} 
                    height={48} 
                    className="object-contain" 
                  />
                )}
              </div>
              <div>
                <p className="font-bold text-[#0B1730]">{formData.name || 'Al-Baraka Supermarket'}</p>
                <p className="text-[11px] text-[#687386] mt-0.5">
                  {isRtl ? 'الشعار المعتمد للمتجر يظهر في أعلى الفواتير والإيصالات الحرارية' : 'Official brand identity rendered on thermal receipts and invoices'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0B1730] hover:bg-[#172033] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                {uploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#246BFD]" />
                    <span>{isRtl ? 'جاري الرفع...' : 'Uploading...'}</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 text-[#246BFD]" />
                    <span>{isRtl ? 'رفع لوجو المتجر' : 'Upload Logo'}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  disabled={uploadingLogo}
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الاسم التجاري للمتجر *' : 'Business Name *'}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'رقم الهاتف الرسمي *' : 'Official Phone *'}
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'البريد الإلكتروني الرسمي *' : 'Official Email *'}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الرقم الضريبي (Tax ID)' : 'Tax ID Number'}
              </label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>
        </div>

        {/* VAT & Tax Settings */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2]">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#246BFD]" />
              <h2 className="font-bold text-sm text-[#0B1730]">
                {isRtl ? 'إعدادات الضرائب وضريبة القيمة المضافة (VAT)' : 'VAT & Tax Settings'}
              </h2>
            </div>
            {/* Active Status Badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              formData.vat_enabled === 1 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {formData.vat_enabled === 1 
                ? (isRtl ? 'الضريبة مفعلة' : 'VAT Enabled') 
                : (isRtl ? 'الضريبة معطلة (بدون ضريبة)' : 'VAT Disabled')}
            </span>
          </div>

          {/* Toggle Switch Card */}
          <div className="flex items-center justify-between p-4 bg-[#F7F9FC] rounded-xl border border-[#E5EAF2]">
            <div className="space-y-0.5">
              <label className="font-bold text-xs text-[#0B1730]">
                {isRtl ? 'تفعيل ضريبة القيمة المضافة في الفواتير ونقاط البيع' : 'Enable VAT in Invoices & POS'}
              </label>
              <p className="text-[11px] text-[#687386]">
                {isRtl 
                  ? 'عند إيقاف الضريبة، لن يتم احتساب أي ضريبة على المنتجات في شاشة الـ POS ولن تظهر خانة الضريبة في الفاتورة أو الإيصال الحراري.' 
                  : 'When turned OFF, no VAT is calculated in POS and VAT is completely excluded from thermal receipts and invoices.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, vat_enabled: prev.vat_enabled === 1 ? 0 : 1 }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formData.vat_enabled === 1 ? 'bg-[#246BFD]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.vat_enabled === 1 ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'نسبة ضريبة القيمة المضافة الافتراضية (%)' : 'Default VAT Rate (%)'}
              </label>
              <input
                type="number"
                step="0.1"
                disabled={formData.vat_enabled === 0}
                value={formData.default_tax_rate}
                onChange={(e) => setFormData({ ...formData, default_tax_rate: Number(e.target.value) })}
                className={`w-full p-2.5 rounded-lg text-xs outline-none border transition-colors ${
                  formData.vat_enabled === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-[#F7F9FC] border-[#E5EAF2] focus:bg-white focus:border-[#246BFD]'
                }`}
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                {formData.vat_enabled === 1 
                  ? (isRtl ? 'المعدل الضريبي القياسي في جمهورية مصر العربية هو 14%' : 'Standard Egyptian VAT rate is 14%')
                  : (isRtl ? 'تم إيقاف احتساب الضريبة للمتجر بالكامل' : 'VAT calculation is disabled')}
              </span>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'العملة الافتراضية للنظام' : 'Currency'}
              </label>
              <input
                type="text"
                disabled
                value={isRtl ? 'الجنيه المصري (EGP / ج.م)' : 'Egyptian Pound (EGP)'}
                className="w-full p-2.5 bg-gray-100 border border-[#E5EAF2] rounded-lg text-xs font-bold text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Receipt & Thermal Printer Settings */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAF2]">
            <Receipt className="w-4 h-4 text-[#246BFD]" />
            <h2 className="font-bold text-sm text-[#0B1730]">
              {isRtl ? 'تخصيص الإيصال الحراري ورأس الفاتورة' : 'Thermal Receipt Customization'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'عرض ورق الطباعة الحراري' : 'Paper Width'}
              </label>
              <select
                value={formData.receipt_width}
                onChange={(e) => setFormData({ ...formData, receipt_width: e.target.value as any })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="80mm">80 mm ({isRtl ? 'طابعات الكاشير القياسية' : 'Standard 80mm'})</option>
                <option value="58mm">58 mm ({isRtl ? 'طابعات مدمجة وصغيرة' : 'Compact 58mm'})</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'نص تذييل الإيصال (أسفل الفاتورة)' : 'Receipt Footer Message'}
              </label>
              <input
                type="text"
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                placeholder={isRtl ? 'شكراً لتعاملكم معنا' : 'Thank you for shopping with us'}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>
        </div>

        {/* Supermarket Scale Barcodes & Valuation */}
        <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAF2]">
            <Scale className="w-4 h-4 text-[#246BFD]" />
            <h2 className="font-bold text-sm text-[#0B1730]">
              {isRtl ? 'إعدادات السوبرماركت وموازين الباركود' : 'Supermarket Scales & Inventory Policies'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'بادئة باركود الميزان (Scale Prefix)' : 'Scale Barcode Prefix'}
              </label>
              <input
                type="text"
                maxLength={4}
                value={formData.scale_barcode_prefix}
                onChange={(e) => setFormData({ ...formData, scale_barcode_prefix: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-mono text-center font-bold"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                {isRtl ? 'الرمز القياسي لموازين الباركود في مصر هو 21' : 'Default prefix 21 for EAN-13 price-embedded scale barcodes'}
              </span>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'طريقة تقييم المخزون' : 'Inventory Valuation Method'}
              </label>
              <select
                value={formData.valuation_method}
                onChange={(e) => setFormData({ ...formData, valuation_method: e.target.value as any })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="WAC">{isRtl ? 'متوسط التكلفة المرجح (WAC)' : 'Weighted Average Cost (WAC)'}</option>
                <option value="FIFO">{isRtl ? 'الوارد أولاً يصرف أولاً (FIFO)' : 'First In First Out (FIFO)'}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'فترة التنبيه قبل الصلاحية (أيام)' : 'Expiry Alert Window (Days)'}
              </label>
              <input
                type="number"
                min="1"
                value={formData.expiry_warning_days}
                onChange={(e) => setFormData({ ...formData, expiry_warning_days: Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ وتحديث الإعدادات' : 'Save Changes')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
