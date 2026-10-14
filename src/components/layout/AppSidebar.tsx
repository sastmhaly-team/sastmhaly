'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { useNav } from '@/lib/nav-context';
import { 
  LayoutDashboard, ShoppingCart, Package, Layers, CalendarDays, 
  ArrowLeftRight, Truck, Users, Receipt, Landmark, Banknote,
  BookOpen, BarChart3, Building2, UserCog, Settings, Sparkles,
  ShieldAlert, CreditCard, X
} from 'lucide-react';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { isMobileMenuOpen, closeMobileMenu } = useNav();

  if (!user) return null;

  const isSuperAdmin = user.role === 'super_admin';

  const superAdminNav = [
    { href: '/super-admin', icon: LayoutDashboard, label: t('nav_dashboard') },
    { href: '/super-admin/merchants', icon: Building2, label: t('sa_merchants') },
    { href: '/super-admin/subscriptions', icon: CreditCard, label: t('sa_subscriptions') },
    { href: '/super-admin/settings', icon: Settings, label: t('sa_platform_settings') },
    { href: '/super-admin/logs', icon: ShieldAlert, label: t('sa_audit_logs') },
  ];

  const merchantNavGroups = [
    {
      titleEn: 'Main & POS',
      titleAr: 'الرئيسية ونقاط البيع',
      items: [
        { href: '/merchant/dashboard', icon: LayoutDashboard, label: t('nav_dashboard') },
        { href: '/merchant/pos', icon: ShoppingCart, label: t('nav_pos'), highlight: true },
        { href: '/merchant/registers', icon: Landmark, label: t('nav_registers') },
      ]
    },
    {
      titleEn: 'Catalog & Inventory',
      titleAr: 'الكتالوج والمخزون',
      items: [
        { href: '/merchant/products', icon: Package, label: t('nav_products') },
        { href: '/merchant/inventory', icon: Layers, label: t('nav_inventory') },
        { href: '/merchant/batches', icon: CalendarDays, label: t('nav_batches') },
        { href: '/merchant/transfers', icon: ArrowLeftRight, label: t('nav_transfers') },
      ]
    },
    {
      titleEn: 'Procurement & Sales',
      titleAr: 'المشتريات والمبيعات',
      items: [
        { href: '/merchant/purchasing', icon: Truck, label: t('nav_purchases') },
        { href: '/merchant/suppliers', icon: Building2, label: t('nav_suppliers') },
        { href: '/merchant/sales', icon: Receipt, label: t('nav_sales') },
        { href: '/merchant/customers', icon: Users, label: t('nav_customers') },
      ]
    },
    {
      titleEn: 'Finance & Reports',
      titleAr: 'المالية والتقارير',
      items: [
        { href: '/merchant/expenses', icon: Banknote, label: t('nav_expenses') },
        { href: '/merchant/accounting', icon: BookOpen, label: t('nav_accounting') },
        { href: '/merchant/reports', icon: BarChart3, label: t('nav_reports') },
      ]
    },
    {
      titleEn: 'Management',
      titleAr: 'الإدارة والإعدادات',
      items: [
        { href: '/merchant/branches', icon: Building2, label: t('nav_branches') },
        { href: '/merchant/employees', icon: UserCog, label: t('nav_employees') },
        { href: '/merchant/settings', icon: Settings, label: t('nav_settings') },
        { href: '/merchant/onboarding', icon: Sparkles, label: t('nav_onboarding') },
      ]
    }
  ];

  const getVisibleNavGroups = () => {
    if (user.role === 'cashier') {
      return [
        {
          titleEn: 'Point of Sale',
          titleAr: 'نقطة البيع (POS)',
          items: [
            { href: '/merchant/pos', icon: ShoppingCart, label: t('nav_pos'), highlight: true },
          ]
        }
      ];
    }

    if (user.role === 'inventory_manager') {
      return [
        {
          titleEn: 'Catalog & Inventory',
          titleAr: 'الكتالوج والمخزون',
          items: [
            { href: '/merchant/products', icon: Package, label: t('nav_products') },
            { href: '/merchant/inventory', icon: Layers, label: t('nav_inventory') },
            { href: '/merchant/batches', icon: CalendarDays, label: t('nav_batches') },
            { href: '/merchant/transfers', icon: ArrowLeftRight, label: t('nav_transfers') },
          ]
        },
        {
          titleEn: 'Procurement',
          titleAr: 'المشتريات والموردين',
          items: [
            { href: '/merchant/purchasing', icon: Truck, label: t('nav_purchases') },
            { href: '/merchant/suppliers', icon: Building2, label: t('nav_suppliers') },
          ]
        }
      ];
    }

    if (user.role === 'accountant') {
      return [
        {
          titleEn: 'Sales & Customers',
          titleAr: 'المبيعات والعملاء',
          items: [
            { href: '/merchant/sales', icon: Receipt, label: t('nav_sales') },
            { href: '/merchant/customers', icon: Users, label: t('nav_customers') },
          ]
        },
        {
          titleEn: 'Finance & Reports',
          titleAr: 'المالية والتقارير',
          items: [
            { href: '/merchant/expenses', icon: Banknote, label: t('nav_expenses') },
            { href: '/merchant/accounting', icon: BookOpen, label: t('nav_accounting') },
            { href: '/merchant/reports', icon: BarChart3, label: t('nav_reports') },
          ]
        }
      ];
    }

    if (user.role === 'branch_manager') {
      return [
        {
          titleEn: 'Main & POS',
          titleAr: 'الرئيسية ونقاط البيع',
          items: [
            { href: '/merchant/dashboard', icon: LayoutDashboard, label: t('nav_dashboard') },
            { href: '/merchant/pos', icon: ShoppingCart, label: t('nav_pos'), highlight: true },
            { href: '/merchant/registers', icon: Landmark, label: t('nav_registers') },
          ]
        },
        {
          titleEn: 'Catalog & Sales',
          titleAr: 'الكتالوج والمبيعات',
          items: [
            { href: '/merchant/products', icon: Package, label: t('nav_products') },
            { href: '/merchant/inventory', icon: Layers, label: t('nav_inventory') },
            { href: '/merchant/sales', icon: Receipt, label: t('nav_sales') },
            { href: '/merchant/customers', icon: Users, label: t('nav_customers') },
          ]
        },
        {
          titleEn: 'Expenses & Reports',
          titleAr: 'المصروفات والتقارير',
          items: [
            { href: '/merchant/expenses', icon: Banknote, label: t('nav_expenses') },
            { href: '/merchant/reports', icon: BarChart3, label: t('nav_reports') },
          ]
        }
      ];
    }

    // Default for merchant_owner / super admin or unassigned: full merchant navigation
    return merchantNavGroups;
  };

  const visibleGroups = getVisibleNavGroups();

  const renderNavList = (onItemClick?: () => void) => (
    <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto overscroll-contain">
      {isSuperAdmin ? (
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-bold text-[#687386] uppercase tracking-wider">
            {t('super_admin_portal')}
          </div>
          {superAdminNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-[#0B1730] text-white shadow-xs' 
                    : 'text-[#172033] hover:bg-[#F7F9FC]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#246BFD]' : 'text-[#687386]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        visibleGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-[#687386] uppercase tracking-wider">
              {lang === 'ar' ? group.titleAr : group.titleEn}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-[#0B1730] text-white shadow-xs' 
                      : item.highlight
                        ? 'bg-[#F0F9FF] text-[#246BFD] hover:bg-[#E0F2FE]'
                        : 'text-[#172033] hover:bg-[#F7F9FC]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#246BFD]' : item.highlight ? 'text-[#246BFD]' : 'text-[#687386]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.highlight && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#246BFD]"></span>
                  )}
                </Link>
              );
            })}
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible from md up) */}
      <aside className="hidden md:flex w-64 bg-white border-r rtl:border-r-0 rtl:border-l border-[#E5EAF2] flex-col shrink-0 h-full min-h-0 overflow-hidden">
        {renderNavList()}
      </aside>

      {/* Mobile Drawer Navigation (slides out when menu button is clicked) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={closeMobileMenu}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col shadow-2xl z-10 transition-transform">
            <div className="p-4 border-b border-[#E5EAF2] flex items-center justify-between bg-[#F7F9FC]">
              <span className="font-bold text-xs text-[#0B1730]">
                {isSuperAdmin ? t('super_admin_portal') : (lang === 'ar' ? 'سستمهالي - القائمة' : 'Navigation')}
              </span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-1.5 rounded-lg text-gray-500 hover:text-black hover:bg-gray-200 transition-colors"
                aria-label="Close Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderNavList(closeMobileMenu)}
          </div>
        </div>
      )}
    </>
  );
}
