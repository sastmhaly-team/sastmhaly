'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { LanguageToggle } from './LanguageToggle';
import { BranchSelector } from './BranchSelector';
import { NotificationBell } from './NotificationBell';
import { useNav } from '@/lib/nav-context';
import { LogOut, ShieldCheck, ShoppingCart, User as UserIcon, Menu } from 'lucide-react';

export function AppHeader() {
  const { user, tenant, logout } = useAuth();
  const { t, lang } = useLanguage();
  const { toggleMobileMenu } = useNav();

  return (
    <header className="sticky top-0 z-40 shrink-0 w-full bg-white border-b border-[#E5EAF2] shadow-2xs">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Drawer Trigger */}
          {user && (
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="md:hidden p-1.5 -ms-1 text-[#172033] hover:bg-[#F7F9FC] rounded-lg transition-colors"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5 text-[#246BFD]" />
            </button>
          )}

          <Link 
            href={
              user?.role === 'super_admin' 
                ? '/super-admin' 
                : user?.role === 'cashier'
                  ? '/merchant/pos'
                  : user?.role === 'inventory_manager'
                    ? '/merchant/inventory'
                    : user?.role === 'accountant'
                      ? '/merchant/accounting'
                      : '/merchant/dashboard'
            } 
            className="flex items-center gap-2.5"
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-[#E5EAF2] bg-white flex items-center justify-center p-0.5">
              <Image
                src="/logo.png"
                alt="Sastmhaly Logo"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#0B1730] tracking-tight leading-none">
                {lang === 'ar' ? 'سستمهالي' : 'Sastmhaly'}
              </span>
              <span className="text-[10px] font-medium text-[#687386] leading-tight">
                {user?.role === 'super_admin' 
                  ? t('super_admin_portal')
                  : (tenant ? (lang === 'ar' ? tenant.name : tenant.name) : t('tagline'))}
              </span>
            </div>
          </Link>

          {/* Quick link to POS for non-cashier merchant staff */}
          {user && user.role !== 'super_admin' && user.role !== 'cashier' && (
            <Link
              href="/merchant/pos"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs ml-2 rtl:mr-2 rtl:ml-0"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{t('nav_pos')}</span>
            </Link>
          )}
        </div>

        {/* Right Tools & User Info */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          
          {/* Active Branch Selector for multi-branch merchants */}
          {user && user.role !== 'super_admin' && (
            <BranchSelector />
          )}

          {/* User Profile Info (Real, Production) */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC]">
              <div className="w-7 h-7 rounded-md bg-[#246BFD]/10 text-[#246BFD] flex items-center justify-center font-bold text-xs">
                {user.role === 'super_admin' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
              </div>
              <div className="text-left rtl:text-right">
                <p className="text-xs font-bold text-[#0B1730] leading-none">
                  {user.full_name || user.username}
                </p>
                <p className="text-[10px] font-mono text-[#687386] leading-tight mt-0.5">
                  {user.phone || (user.role === 'super_admin' ? 'Super Admin' : user.role)}
                </p>
              </div>
            </div>
          )}

          <NotificationBell />
          <LanguageToggle />

          {/* User Logout */}
          {user && (
            <button
              onClick={logout}
              className="p-2 rounded-lg border border-[#E5EAF2] bg-white text-[#687386] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
}
