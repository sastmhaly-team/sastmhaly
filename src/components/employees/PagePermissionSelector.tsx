'use client';

import React, { useState } from 'react';
import { 
  ALL_MERCHANT_PAGES, 
  ROLE_DEFAULT_PAGES, 
  SystemPage 
} from '@/lib/auth/permissions';
import { 
  Check, X, RotateCcw, ShieldCheck, CheckSquare, Square, 
  Search, LayoutDashboard, ShoppingCart, Landmark, Package, 
  Layers, CalendarDays, ArrowLeftRight, Truck, Building2, 
  Receipt, Users, Banknote, BookOpen, BarChart3, UserCog, Settings
} from 'lucide-react';

interface PagePermissionSelectorProps {
  selectedPages: string[];
  onChange: (pages: string[]) => void;
  role: string;
  isRtl?: boolean;
}

// Icon mapping for pages
const PAGE_ICONS: Record<string, React.ElementType> = {
  '/merchant/dashboard': LayoutDashboard,
  '/merchant/pos': ShoppingCart,
  '/merchant/registers': Landmark,
  '/merchant/products': Package,
  '/merchant/inventory': Layers,
  '/merchant/batches': CalendarDays,
  '/merchant/transfers': ArrowLeftRight,
  '/merchant/purchasing': Truck,
  '/merchant/suppliers': Building2,
  '/merchant/sales': Receipt,
  '/merchant/customers': Users,
  '/merchant/expenses': Banknote,
  '/merchant/accounting': BookOpen,
  '/merchant/reports': BarChart3,
  '/merchant/branches': Building2,
  '/merchant/employees': UserCog,
  '/merchant/settings': Settings,
};

export function PagePermissionSelector({
  selectedPages,
  onChange,
  role,
  isRtl = true,
}: PagePermissionSelectorProps) {
  const [filterSearch, setFilterSearch] = useState('');

  const togglePage = (path: string) => {
    if (selectedPages.includes(path)) {
      onChange(selectedPages.filter(p => p !== path));
    } else {
      onChange([...selectedPages, path]);
    }
  };

  const handleSelectAll = () => {
    onChange(ALL_MERCHANT_PAGES.map(p => p.path));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleResetToRole = () => {
    const defaults = ROLE_DEFAULT_PAGES[role] || ['/merchant/pos'];
    onChange([...defaults]);
  };

  // Group pages
  const groups = Array.from(new Set(ALL_MERCHANT_PAGES.map(p => isRtl ? p.groupAr : p.groupEn)));

  const filteredPages = ALL_MERCHANT_PAGES.filter(p => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return p.nameAr.includes(q) || p.nameEn.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3 p-3.5 bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] border border-[#CBD5E1]/80 rounded-xl">
      {/* Header with counters and quick action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#246BFD]" />
            <h4 className="font-bold text-xs text-[#0B1730]">
              {isRtl ? 'صلاحيات الشاشات المسموحة لهذا الموظف' : 'Allowed Screen Permissions for Employee'}
            </h4>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              selectedPages.length === 0 
                ? 'bg-red-50 text-red-600 border border-red-200' 
                : 'bg-blue-50 text-[#246BFD] border border-blue-200'
            }`}>
              {selectedPages.length} / {ALL_MERCHANT_PAGES.length} {isRtl ? 'شاشة مسموحة' : 'screens allowed'}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            {isRtl 
              ? 'انقر على الشاشات لتفعيلها أو إيقافها، ولن يتمكن الموظف من رؤية أو فتح أي شاشة غير محددة هنا'
              : 'Click screens to enable/disable. The employee can ONLY view and open the screens checked below.'}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSelectAll}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[#246BFD] bg-white hover:bg-blue-50 border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <CheckSquare className="w-3 h-3" />
            <span>{isRtl ? 'تحديد الكل' : 'Select All'}</span>
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-600 bg-white hover:bg-gray-100 border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Square className="w-3 h-3" />
            <span>{isRtl ? 'إلغاء التحديد' : 'Clear All'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetToRole}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title={isRtl ? 'إعادة ضبط الشاشات المسموحة للافتراضي الخاص بهذا الدور' : 'Reset to default screens for this role'}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isRtl ? 'افتراضي الدور' : 'Role Default'}</span>
          </button>
        </div>
      </div>

      {/* Warning if 0 pages selected */}
      {selectedPages.length === 0 && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{isRtl ? 'تنبيه: لم تحدد أي شاشة! يجب تحديد شاشة واحدة على الأقل ليتمكن الموظف من تسجيل الدخول.' : 'Warning: No screens selected. Please allow at least one screen for login.'}</span>
        </div>
      )}

      {/* Pages Grouped by Module */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto overscroll-contain pr-1 rtl:pr-0 rtl:pl-1">
        {groups.map((groupName) => {
          const groupPages = filteredPages.filter(p => (isRtl ? p.groupAr : p.groupEn) === groupName);
          if (groupPages.length === 0) return null;

          const groupSelectedCount = groupPages.filter(p => selectedPages.includes(p.path)).length;

          return (
            <div key={groupName} className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wide">
                  {groupName}
                </span>
                <span className="text-[10px] font-semibold text-[#94A3B8]">
                  ({groupSelectedCount} / {groupPages.length})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groupPages.map((page: SystemPage) => {
                  const isChecked = selectedPages.includes(page.path);
                  const Icon = PAGE_ICONS[page.path] || Package;

                  return (
                    <div
                      key={page.path}
                      onClick={() => togglePage(page.path)}
                      className={`relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-white border-[#246BFD] shadow-sm ring-1 ring-[#246BFD]/30'
                          : 'bg-white/70 border-[#E2E8F0] hover:bg-white hover:border-[#CBD5E1] text-[#64748B]'
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <div className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked 
                          ? 'bg-[#246BFD] text-white shadow-2xs' 
                          : 'border border-[#CBD5E1] bg-white'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Icon */}
                      <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                        isChecked ? 'bg-blue-50 text-[#246BFD]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Title & Desc */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-bold leading-tight truncate ${
                            isChecked ? 'text-[#0B1730]' : 'text-gray-700'
                          }`}>
                            {isRtl ? page.nameAr : page.nameEn}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#64748B] leading-snug line-clamp-1 mt-0.5">
                          {isRtl ? page.descriptionAr : page.descriptionEn}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

