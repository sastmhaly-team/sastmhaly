'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { Settings, Save, ShieldCheck, Database, Globe } from 'lucide-react';

export default function SuperAdminSettingsPage() {
  const { lang, t } = useLanguage();
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-[#0B1730]">
          {lang === 'ar' ? 'إعدادات المنصة العامة (Platform Global Settings)' : 'Platform Global Settings'}
        </h2>
        <p className="text-xs text-[#687386] mt-0.5">
          {lang === 'ar' 
            ? 'تكوين اسم المنصة، العملة الافتراضية، إعدادات الأمان، وخيارات النسخ الاحتياطي' 
            : 'Configure platform identity, default currency, security policies, and backup rules'}
        </p>
      </div>

      {saved && (
        <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-bold text-[#10B981]">
          {lang === 'ar' ? '✓ تم حفظ إعدادات المنصة بنجاح' : '✓ Platform settings saved successfully'}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-[#E5EAF2] p-6 shadow-2xs space-y-5">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1.5">
              {lang === 'ar' ? 'اسم المنصة التجاري' : 'Platform Brand Name'}
            </label>
            <input
              type="text"
              defaultValue="Sastmhaly Retail ERP"
              className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1.5">
              {lang === 'ar' ? 'العملة الافتراضية' : 'Default Currency'}
            </label>
            <select
              defaultValue="EGP"
              className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] text-xs font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
            >
              <option value="EGP">Egyptian Pound (EGP ج.م)</option>
              <option value="USD">US Dollar (USD $)</option>
              <option value="SAR">Saudi Riyal (SAR ر.س)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1.5">
              {lang === 'ar' ? 'المنطقة الزمنية الافتراضية' : 'Default Timezone'}
            </label>
            <input
              type="text"
              defaultValue="Africa/Cairo (UTC+2 / UTC+3)"
              className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1.5">
              {lang === 'ar' ? 'فترة التجربة الافتراضية (أيام)' : 'Default Trial Period (Days)'}
            </label>
            <input
              type="number"
              defaultValue={14}
              className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#F1F4F9] space-y-3">
          <h4 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
            {lang === 'ar' ? 'سياسات الأمان والعزل' : 'Security & Multi-Tenant Isolation Policies'}
          </h4>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pol1" defaultChecked className="w-4 h-4 text-[#246BFD] rounded cursor-pointer" />
            <label htmlFor="pol1" className="text-xs text-[#172033] font-medium cursor-pointer">
              Enforce strict tenant data isolation at server query execution layer
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pol2" defaultChecked className="w-4 h-4 text-[#246BFD] rounded cursor-pointer" />
            <label htmlFor="pol2" className="text-xs text-[#172033] font-medium cursor-pointer">
              Prevent cross-branch transactions for restricted cashier accounts
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pol3" defaultChecked className="w-4 h-4 text-[#246BFD] rounded cursor-pointer" />
            <label htmlFor="pol3" className="text-xs text-[#172033] font-medium cursor-pointer">
              Log all critical database updates to immutable audit log table
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-[#F1F4F9] flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{t('save')}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
