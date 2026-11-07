'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { useNav } from '@/lib/nav-context';
import { 
  LayoutDashboard, ShoppingCart, Package, Receipt, Menu
} from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { toggleMobileMenu, isMobileMenuOpen } = useNav();

  if (!user || user.role === 'super_admin') return null;

  const isCashier = user.role === 'cashier';

  const navItems = isCashier
    ? [
        { href: '/merchant/pos', icon: ShoppingCart, labelAr: 'نقطة البيع', labelEn: 'POS', highlight: true },
      ]
    : [
        { href: '/merchant/dashboard', icon: LayoutDashboard, labelAr: 'الرئيسية', labelEn: 'Dashboard' },
        { href: '/merchant/pos', icon: ShoppingCart, labelAr: 'الكاشير', labelEn: 'POS', highlight: true },
        { href: '/merchant/products', icon: Package, labelAr: 'المنتجات', labelEn: 'Products' },
        { href: '/merchant/sales', icon: Receipt, labelAr: 'المبيعات', labelEn: 'Sales' },
      ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5EAF2] shadow-lg transition-transform duration-300 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-15 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/merchant/dashboard' && pathname.startsWith(item.href));

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4 relative group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-90 ${
                  isActive 
                    ? 'bg-[#0B1730] text-white ring-4 ring-blue-100' 
                    : 'bg-[#246BFD] text-white hover:bg-[#1A54D4]'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-[#0B1730]' : 'text-[#246BFD]'}`}>
                  {lang === 'ar' ? item.labelAr : item.labelEn}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all active:scale-95 ${
                isActive 
                  ? 'text-[#246BFD]' 
                  : 'text-[#687386] hover:text-[#0B1730]'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-[10px] font-semibold mt-1 ${isActive ? 'font-bold text-[#246BFD]' : ''}`}>
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </span>
            </Link>
          );
        })}

        {/* Menu Drawer Toggle */}
        <button
          type="button"
          onClick={toggleMobileMenu}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
            isMobileMenuOpen ? 'text-[#246BFD]' : 'text-[#687386] hover:text-[#0B1730]'
          }`}
          aria-label="Open Full Menu"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">
            {lang === 'ar' ? 'المزيد' : 'Menu'}
          </span>
        </button>
      </div>
    </nav>
  );
}
