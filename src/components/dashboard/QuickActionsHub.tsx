'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, PackagePlus, ArrowLeftRight, DollarSign, ArrowRight, Sparkles } from 'lucide-react';

interface QuickActionsHubProps {
  isRtl?: boolean;
}

export function QuickActionsHub({ isRtl = true }: QuickActionsHubProps) {
  const actions = [
    {
      title: isRtl ? 'فتح شاشة الكاشير (POS)' : 'Fast POS Terminal',
      desc: isRtl ? 'بدء جلسة بيع فورية وإصدار فواتير' : 'Start ring sales & print receipts',
      href: '/merchant/pos',
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-50 border-blue-200 group-hover:bg-[#246BFD] group-hover:text-white',
      badge: isRtl ? 'الأساسي' : 'Primary',
    },
    {
      title: isRtl ? 'إضافة صنف جديد' : 'New Product',
      desc: isRtl ? 'تسجيل صنف أو باركود للمخزن' : 'Add product or barcode',
      href: '/merchant/products',
      icon: PackagePlus,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white',
    },
    {
      title: isRtl ? 'تحويل بضاعة بين الفروع' : 'Stock Transfer',
      desc: isRtl ? 'نقل كميات بين مخازن الفروع' : 'Move inventory between branches',
      href: '/merchant/transfers',
      icon: ArrowLeftRight,
      color: 'text-purple-600 bg-purple-50 border-purple-200 group-hover:bg-purple-600 group-hover:text-white',
    },
    {
      title: isRtl ? 'تسجيل مصروف تشغيلي' : 'Record Expense',
      desc: isRtl ? 'إيجار، كهرباء، صيانة، نثريات' : 'Rent, utilities, petty cash',
      href: '/merchant/expenses',
      icon: DollarSign,
      color: 'text-rose-600 bg-rose-50 border-rose-200 group-hover:bg-rose-600 group-hover:text-white',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#246BFD]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B1730]">
              {isRtl ? 'إجراءات تشغيلية سريعة' : 'Quick Operations'}
            </h3>
            <p className="text-[11px] text-[#687386]">
              {isRtl ? 'الوصول المباشر لأهم أدوات الإدارة اليومية' : 'Shortcuts to daily essential tasks'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of actions */}
      <div className="space-y-2.5">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <Link
              key={idx}
              href={act.href}
              className="group flex items-center justify-between p-3 rounded-xl border border-[#E5EAF2] hover:border-blue-500/50 hover:bg-blue-50/30 transition-all duration-200 active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 shadow-2xs ${act.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-[#0B1730] group-hover:text-blue-600 transition-colors truncate">
                      {act.title}
                    </h4>
                    {act.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-700">
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#687386] truncate">
                    {act.desc}
                  </p>
                </div>
              </div>

              <div className="w-7 h-7 rounded-lg bg-gray-50 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center text-[#687386] transition-all shrink-0">
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
