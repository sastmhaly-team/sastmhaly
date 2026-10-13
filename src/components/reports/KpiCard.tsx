import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    type?: 'success' | 'warning' | 'error' | 'info';
  };
}

export function KpiCard({ title, value, subtitle, icon: Icon, badge }: KpiCardProps) {
  const badgeStyles = {
    success: 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#F59E0B] border-[#FDE68A]',
    error: 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]',
    info: 'bg-[#F0F9FF] text-[#246BFD] border-[#BAE6FD]',
  }[badge?.type || 'info'];

  return (
    <div className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:border-[#CBD5E1] transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#687386] uppercase tracking-wide">{title}</p>
          <h3 className="text-2xl font-bold text-[#0B1730] mt-1.5 tracking-tight">{value}</h3>
          {subtitle && (
            <p className="text-xs text-[#687386] mt-1">{subtitle}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-[#F7F9FC] border border-[#E5EAF2] flex items-center justify-center text-[#246BFD] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-3.5 pt-3 border-t border-[#F1F4F9] flex items-center">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeStyles}`}>
            {badge.text}
          </span>
        </div>
      )}
    </div>
  );
}
