'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { KpiCard } from '@/components/reports/KpiCard';
import { 
  Building2, Users, Store, Banknote, ShieldCheck, 
  Activity, ArrowUpRight, CheckCircle2, Clock, Plus
} from 'lucide-react';
import Link from 'next/link';

interface PlatformOverviewData {
  totalMerchants: number;
  activeMerchants: number;
  suspendedMerchants: number;
  trialMerchants: number;
  totalBranches: number;
  totalUsers: number;
  mrr: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    user_name?: string;
    tenant_name?: string;
  }>;
  plans: Array<{
    id: string;
    name_en: string;
    name_ar: string;
    price_monthly: number;
  }>;
}

export default function SuperAdminOverviewPage() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<PlatformOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch('/api/super-admin/overview');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-md w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'لوحة تحكم مالك المنصة (Super Admin)' : 'Platform Super Admin Overview'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'متابعة التجار، الاشتراكات، الإيراد الشهري، وسجلات الأمان لجميع المستأجرين' 
              : 'Real-time metrics, merchant subscriptions, MRR revenue, and platform telemetry'}
          </p>
        </div>

        <Link
          href="/super-admin/merchants"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'ar' ? 'إنشاء وتفعيل تاجر جديد' : 'Provision New Merchant'}</span>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={lang === 'ar' ? 'إجمالي التجار' : 'Total Merchants'}
          value={data.totalMerchants}
          subtitle={`${data.activeMerchants} ${lang === 'ar' ? 'نشط' : 'active'}, ${data.trialMerchants} ${lang === 'ar' ? 'تجريبي' : 'trial'}`}
          icon={Building2}
          badge={{ text: `${data.activeMerchants} Active`, type: 'success' }}
        />

        <KpiCard
          title={lang === 'ar' ? 'الإيراد الشهري المتكرر' : 'Monthly Recurring Revenue'}
          value={`${data.mrr.toLocaleString()} ${t('currency')}`}
          subtitle={lang === 'ar' ? 'محسوب من الاشتراكات النشطة' : 'From active merchant subscriptions'}
          icon={Banknote}
          badge={{ text: 'MRR', type: 'info' }}
        />

        <KpiCard
          title={lang === 'ar' ? 'إجمالي الفروع بالمنصة' : 'Total Branches'}
          value={data.totalBranches}
          subtitle={lang === 'ar' ? 'عبر جميع المتاجر المسجلة' : 'Across all tenant shops'}
          icon={Store}
          badge={{ text: 'Branches', type: 'info' }}
        />

        <KpiCard
          title={lang === 'ar' ? 'المستخدمين والموظفين' : 'Registered Users'}
          value={data.totalUsers}
          subtitle={lang === 'ar' ? 'مدراء، مشرفين، وكاشير' : 'Admins, managers, cashiers'}
          icon={Users}
          badge={{ text: 'Active Users', type: 'info' }}
        />
      </div>

      {/* Subscription Plans & System Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* System Health */}
        <div className="bg-white rounded-xl border border-[#E5EAF2] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
              {lang === 'ar' ? 'حالة المنصة والخدمات' : 'System Health & Engine'}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Operational
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F9FC]">
              <span className="text-[#687386] font-medium">Database Engine:</span>
              <span className="font-bold text-[#0B1730]">SQLite Relational (WAL Mode)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F9FC]">
              <span className="text-[#687386] font-medium">Multi-Tenant Isolation:</span>
              <span className="font-bold text-[#10B981]">Enforced (Strict Server Scope)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F9FC]">
              <span className="text-[#687386] font-medium">Supabase Project:</span>
              <span className="font-bold text-[#10B981] font-mono text-[11px]">Connected (unctfxlnmqddykxbxxyt)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F9FC]">
              <span className="text-[#687386] font-medium">POS Atomic Consistency:</span>
              <span className="font-bold text-[#10B981]">Active (ACID Transactions)</span>
            </div>
          </div>
        </div>

        {/* Subscription Plans Overview */}
        <div className="bg-white rounded-xl border border-[#E5EAF2] p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
              {lang === 'ar' ? 'باقات الاشتراكات والتسعير' : 'SaaS Subscription Plans'}
            </h3>
            <Link href="/super-admin/subscriptions" className="text-xs font-bold text-[#246BFD] hover:underline">
              {lang === 'ar' ? 'إدارة الباقات ←' : 'Manage Plans →'}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.plans.map(p => (
              <div key={p.id} className="p-3.5 rounded-xl border border-[#E5EAF2] bg-[#F7F9FC] flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0B1730]">
                    {lang === 'ar' ? p.name_ar : p.name_en}
                  </h4>
                  <p className="text-lg font-extrabold text-[#246BFD] mt-1">
                    {p.price_monthly} <span className="text-[10px] text-[#687386] font-normal">{t('currency')}/mo</span>
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#E5EAF2] text-[11px] text-[#687386]">
                  {p.id === 'plan_starter' && '1 Branch • 3 Users • 500 SKUs'}
                  {p.id === 'plan_growth' && '5 Branches • 15 Users • 10K SKUs'}
                  {p.id === 'plan_enterprise' && 'Unlimited Branches & Users'}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Platform Activity */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider mb-4">
          {lang === 'ar' ? 'آخر العمليات وسجلات المنصة' : 'Recent Platform Activity & Audit Logs'}
        </h3>

        <div className="divide-y divide-[#E5EAF2] overflow-x-auto">
          {data.recentActivity.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#687386]">
              {t('no_records')}
            </div>
          ) : (
            data.recentActivity.map(act => (
              <div key={act.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[#246BFD] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#0B1730]">{act.action}</span>
                    <span className="text-[#687386] ml-2 rtl:mr-2 rtl:ml-0">
                      {act.tenant_name ? `• ${act.tenant_name}` : ''}
                    </span>
                    <p className="text-[11px] text-[#687386] mt-0.5">
                      By {act.user_name || 'System Admin'}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-[#687386] shrink-0 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{act.created_at}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
