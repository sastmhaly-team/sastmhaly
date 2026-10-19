'use client';

import React from 'react';
import { Banknote, CreditCard, Smartphone, Clock, Wallet } from 'lucide-react';

interface PaymentMethodStat {
  count: number;
  total: number;
}

interface PaymentMethodsCardProps {
  data?: Record<'cash' | 'card' | 'mobile_wallet' | 'customer_credit', PaymentMethodStat>;
  currency?: string;
  isRtl?: boolean;
}

export function PaymentMethodsCard({
  data = {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    mobile_wallet: { count: 0, total: 0 },
    customer_credit: { count: 0, total: 0 },
  },
  currency = 'ج.م',
  isRtl = true,
}: PaymentMethodsCardProps) {
  const totalAmount = (data.cash?.total || 0) + (data.card?.total || 0) + (data.mobile_wallet?.total || 0) + (data.customer_credit?.total || 0);

  const getPct = (val: number) => {
    if (totalAmount <= 0) return 0;
    return Math.round((val / totalAmount) * 100);
  };

  const methods = [
    {
      key: 'cash',
      name: isRtl ? 'نقداً (كاش)' : 'Cash',
      icon: Banknote,
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
      stat: data.cash || { count: 0, total: 0 },
      pct: getPct(data.cash?.total || 0),
    },
    {
      key: 'card',
      name: isRtl ? 'بطاقة بنكية' : 'Bank Card',
      icon: CreditCard,
      color: 'bg-blue-600',
      lightBg: 'bg-blue-50 border-blue-100 text-blue-800',
      stat: data.card || { count: 0, total: 0 },
      pct: getPct(data.card?.total || 0),
    },
    {
      key: 'mobile_wallet',
      name: isRtl ? 'محافظ إلكترونية' : 'Mobile Wallet',
      icon: Smartphone,
      color: 'bg-purple-600',
      lightBg: 'bg-purple-50 border-purple-100 text-purple-800',
      stat: data.mobile_wallet || { count: 0, total: 0 },
      pct: getPct(data.mobile_wallet?.total || 0),
    },
    {
      key: 'customer_credit',
      name: isRtl ? 'آجل (على الحساب)' : 'Credit / Tab',
      icon: Clock,
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50 border-amber-100 text-amber-800',
      stat: data.customer_credit || { count: 0, total: 0 },
      pct: getPct(data.customer_credit?.total || 0),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0B1730]">
              {isRtl ? 'توزيع طرق الدفع والتحصيل' : 'Payment Methods Breakdown'}
            </h3>
            <p className="text-[11px] text-[#687386]">
              {isRtl ? `إجمالي المقبوضات: ${totalAmount.toLocaleString()} ${currency}` : `Total Collected: ${totalAmount.toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Progress Bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 mb-5 shadow-inner">
        {totalAmount > 0 ? (
          methods.map((m) => (
            m.pct > 0 && (
              <div
                key={m.key}
                style={{ width: `${m.pct}%` }}
                className={`h-full rounded-sm ${m.color} transition-all duration-700 hover:opacity-90`}
                title={`${m.name}: ${m.pct}%`}
              />
            )
          ))
        ) : (
          <div className="w-full h-full bg-gray-200 rounded-full" />
        )}
      </div>

      {/* Breakdown Items Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {methods.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className={`p-3 rounded-xl border transition-all hover:scale-[1.02] ${m.lightBg}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-xs truncate">{m.name}</span>
                </div>
                <span className="font-black text-xs px-1.5 py-0.5 rounded-md bg-white/70 shadow-2xs">
                  {m.pct}%
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-black text-sm">
                  {m.stat.total.toLocaleString()} <span className="text-[10px] font-normal">{currency}</span>
                </span>
                <span className="text-[10px] opacity-75">
                  {m.stat.count} {isRtl ? 'عملية' : 'tx'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
