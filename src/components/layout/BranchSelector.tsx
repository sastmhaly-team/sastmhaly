'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Store, ChevronDown, Lock } from 'lucide-react';

export function BranchSelector() {
  const { user, branches, activeBranchId, setActiveBranchId } = useAuth();
  const { t, lang } = useLanguage();

  if (!user || user.role === 'super_admin' || branches.length === 0) {
    return null;
  }

  const isMainAccount = user.role === 'merchant_owner';
  const isLocked = !isMainAccount && Boolean(user.branch_id);

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-white text-xs font-medium text-[#172033] shadow-xs">
        <Store className="w-3.5 h-3.5 text-[#246BFD]" />
        
        {isLocked ? (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#0B1730]">
              {branches.find(b => b.id === user.branch_id)
                ? (lang === 'ar' ? branches.find(b => b.id === user.branch_id)?.name_ar : branches.find(b => b.id === user.branch_id)?.name_en)
                : t('all_branches')}
            </span>
            <span title="Branch Locked to Employee Account">
              <Lock className="w-3 h-3 text-[#687386]" />
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <select
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-[#0B1730] focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">
                🌐 {t('all_branches')}
              </option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  📍 {branch.code} - {lang === 'ar' ? branch.name_ar : branch.name_en}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#687386] pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
