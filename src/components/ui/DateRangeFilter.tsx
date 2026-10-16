'use client';

import React from 'react';
import { Calendar, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  className = '',
}: DateRangeFilterProps) {
  const { lang, isRtl } = useLanguage();

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const setPreset = (preset: 'all' | 'today' | '7days' | 'this_month' | 'last_month') => {
    const today = new Date();
    const todayStr = getTodayStr();

    if (preset === 'all') {
      onChange('', '');
      return;
    }

    if (preset === 'today') {
      onChange(todayStr, todayStr);
      return;
    }

    if (preset === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      onChange(past.toISOString().split('T')[0], todayStr);
      return;
    }

    if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      onChange(firstDay.toISOString().split('T')[0], todayStr);
      return;
    }

    if (preset === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      onChange(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]);
      return;
    }
  };

  const isPresetActive = (preset: 'all' | 'today' | '7days' | 'this_month'): boolean => {
    const today = new Date();
    const todayStr = getTodayStr();

    if (preset === 'all') return !startDate && !endDate;
    if (preset === 'today') return startDate === todayStr && endDate === todayStr;
    if (preset === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      return startDate === past.toISOString().split('T')[0] && endDate === todayStr;
    }
    if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return startDate === firstDay.toISOString().split('T')[0] && endDate === todayStr;
    }
    return false;
  };

  const hasFilter = Boolean(startDate || endDate);

  return (
    <div className={`flex flex-wrap items-center gap-2 p-2 bg-white border border-[#E5EAF2] rounded-xl shadow-2xs text-xs ${className}`}>
      {/* Icon + Label */}
      <div className="flex items-center gap-1.5 text-[#246BFD] font-bold px-2 shrink-0">
        <Calendar className="w-4 h-4 text-[#246BFD]" />
        <span className="text-[#0B1730] hidden sm:inline">
          {isRtl ? 'الفترة الزمنية:' : 'Date Range:'}
        </span>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setPreset('all')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
            isPresetActive('all')
              ? 'bg-[#0B1730] text-white shadow-xs'
              : 'bg-[#F7F9FC] text-[#687386] hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'الكل' : 'All'}
        </button>

        <button
          type="button"
          onClick={() => setPreset('today')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
            isPresetActive('today')
              ? 'bg-[#0B1730] text-white shadow-xs'
              : 'bg-[#F7F9FC] text-[#687386] hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'اليوم' : 'Today'}
        </button>

        <button
          type="button"
          onClick={() => setPreset('7days')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
            isPresetActive('7days')
              ? 'bg-[#0B1730] text-white shadow-xs'
              : 'bg-[#F7F9FC] text-[#687386] hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'آخر 7 أيام' : '7 Days'}
        </button>

        <button
          type="button"
          onClick={() => setPreset('this_month')}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
            isPresetActive('this_month')
              ? 'bg-[#0B1730] text-white shadow-xs'
              : 'bg-[#F7F9FC] text-[#687386] hover:bg-gray-100'
          }`}
        >
          {isRtl ? 'هذا الشهر' : 'This Month'}
        </button>
      </div>

      {/* Date Pickers */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
        <div className="flex items-center gap-1 bg-[#F7F9FC] border border-[#CBD5E1] rounded-lg px-2 py-1 flex-1">
          <span className="text-[11px] text-[#687386] font-medium shrink-0">
            {isRtl ? 'من:' : 'From:'}
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange(e.target.value, endDate)}
            className="w-full bg-transparent text-xs text-[#0B1730] font-mono outline-none cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#F7F9FC] border border-[#CBD5E1] rounded-lg px-2 py-1 flex-1">
          <span className="text-[11px] text-[#687386] font-medium shrink-0">
            {isRtl ? 'إلى:' : 'To:'}
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange(startDate, e.target.value)}
            className="w-full bg-transparent text-xs text-[#0B1730] font-mono outline-none cursor-pointer"
          />
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            title={isRtl ? 'إلغاء التصفية' : 'Clear dates'}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
