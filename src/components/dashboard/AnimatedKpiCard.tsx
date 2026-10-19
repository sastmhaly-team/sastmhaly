'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { CountUpNumber } from './CountUpNumber';
import { Sparkline } from './Sparkline';

interface AnimatedKpiCardProps {
  title: string;
  value: number;
  suffix?: string;
  prefix?: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    type?: 'success' | 'warning' | 'error' | 'info';
  };
  sparklineData?: number[];
  sparklineColor?: string;
  delayIndex?: number;
}

export function AnimatedKpiCard({
  title,
  value,
  suffix = '',
  prefix = '',
  subtitle,
  icon: Icon,
  badge,
  sparklineData,
  sparklineColor = '#246BFD',
  delayIndex = 0,
}: AnimatedKpiCardProps) {
  const badgeStyles = {
    success: 'bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#F59E0B] border-[#FDE68A]',
    error: 'bg-[#FEF2F2] text-[#EF4444] border-[#FECACA]',
    info: 'bg-[#F0F9FF] text-[#246BFD] border-[#BAE6FD]',
  }[badge?.type || 'info'];

  return (
    <div
      className="group relative bg-white p-5 rounded-2xl border border-[#E5EAF2] shadow-2xs hover:shadow-lg hover:border-blue-500/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
      style={{
        animationDelay: `${delayIndex * 80}ms`,
      }}
    >
      {/* Subtle top border glow on hover */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#687386] uppercase tracking-wide truncate">
            {title}
          </p>

          <div className="flex items-baseline gap-1 mt-1.5">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B1730] tracking-tight font-mono">
              <CountUpNumber
                value={value}
                prefix={prefix}
                suffix={suffix ? ` ${suffix}` : ''}
              />
            </h3>
          </div>

          {subtitle && (
            <p className="text-xs text-[#687386] mt-1 font-medium truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Icon Container with subtle background hover */}
        <div className="w-11 h-11 rounded-xl bg-[#F7F9FC] border border-[#E5EAF2] group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-[#246BFD] flex items-center justify-center text-[#246BFD] shrink-0 transition-colors shadow-2xs">
          <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        </div>
      </div>

      {/* Sparkline & Badge Row */}
      <div className="mt-4 pt-3 border-t border-[#F1F4F9] flex items-center justify-between gap-2">
        {badge ? (
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${badgeStyles}`}>
            {badge.text}
          </span>
        ) : <div />}

        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            width={90}
            height={28}
          />
        )}
      </div>

    </div>
  );
}
