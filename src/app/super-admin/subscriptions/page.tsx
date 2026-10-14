'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { CreditCard, Check, ShieldCheck, DollarSign, ArrowUpRight } from 'lucide-react';
import { SubscriptionPlan } from '@/lib/types';

export default function SuperAdminSubscriptionsPage() {
  const { lang, t } = useLanguage();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/super-admin/overview');
        if (res.ok) {
          const json = await res.json();
          setPlans(json.plans || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0B1730]">
          {lang === 'ar' ? 'إدارة باقات الاشتراكات والفوترة' : 'Subscription Plans & Billing Administration'}
        </h2>
        <p className="text-xs text-[#687386] mt-0.5">
          {lang === 'ar' 
            ? 'تحديد أسعار الباقات، حدود الفروع، أعداد المستخدمين، وميزات كل اشتراك' 
            : 'Configure pricing tiers, branch limits, user quotas, and entitlement features'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.slice(0, visibleCount).map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-[#E5EAF2] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#246BFD] uppercase tracking-wider">
                  {p.code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#10B981]">
                  Active Plan
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#0B1730]">
                {lang === 'ar' ? p.name_ar : p.name_en}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-[#0B1730]">{p.price_monthly}</span>
                <span className="text-xs text-[#687386] font-medium">{t('currency')}/mo</span>
              </div>
              <p className="text-xs text-[#687386] mt-1">
                or {p.price_annual} {t('currency')}/year (Save 17%)
              </p>

              <div className="mt-6 pt-5 border-t border-[#F1F4F9] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-[#172033]">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>Max Branches: <strong>{p.max_branches >= 999 ? 'Unlimited' : p.max_branches}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[#172033]">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>Max Users: <strong>{p.max_users >= 999 ? 'Unlimited' : p.max_users}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[#172033]">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>Max SKUs: <strong>{p.max_products.toLocaleString()}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[#172033]">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>Fast POS & Thermal Receipts</span>
                </div>
                <div className="flex items-center gap-2 text-[#172033]">
                  <Check className="w-4 h-4 text-[#10B981]" />
                  <span>Full Inventory & Ledger Auditing</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert(`Plan ${p.code} configured`)}
              className="mt-6 w-full py-2 px-3 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] text-xs font-bold text-[#0B1730] hover:bg-[#EDF2F7] transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'تعديل أسعار الباقة' : 'Edit Plan Details'}
            </button>
          </div>
        ))}
      </div>

      {visibleCount < plans.length && (
        <div className="p-4 flex justify-center">
          <button
            onClick={() => setVisibleCount(prev => prev + 20)}
            className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
          >
            {lang === 'ar' ? `عرض المزيد (تحميل 20 إضافية - متبقي ${plans.length - visibleCount})` : `Load More (+20 items - ${plans.length - visibleCount} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
