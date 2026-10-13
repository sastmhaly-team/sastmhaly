'use client';

import React, { useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, AlertTriangle, RefreshCw, LogOut, Clock, Phone, Sparkles } from 'lucide-react';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Role-based route permissions check
  const isAuthorized = React.useMemo(() => {
    if (!user) return true;
    if (user.role === 'super_admin' || user.role === 'merchant_owner') return true;

    if (user.role === 'cashier') {
      return pathname === '/merchant/pos';
    }

    if (user.role === 'inventory_manager') {
      const allowed = ['/merchant/inventory', '/merchant/products', '/merchant/batches', '/merchant/transfers', '/merchant/purchasing', '/merchant/suppliers'];
      return allowed.some(p => pathname.startsWith(p));
    }

    if (user.role === 'accountant') {
      const allowed = ['/merchant/accounting', '/merchant/sales', '/merchant/customers', '/merchant/expenses', '/merchant/reports', '/merchant/dashboard'];
      return allowed.some(p => pathname.startsWith(p));
    }

    if (user.role === 'branch_manager') {
      const disallowed = ['/merchant/branches', '/merchant/employees', '/merchant/settings', '/merchant/onboarding'];
      return !disallowed.some(p => pathname.startsWith(p));
    }

    return true;
  }, [user, pathname]);

  useEffect(() => {
    if (!isLoading && user && !isAuthorized) {
      if (user.role === 'cashier') {
        router.replace('/merchant/pos');
      } else if (user.role === 'inventory_manager') {
        router.replace('/merchant/inventory');
      } else if (user.role === 'accountant') {
        router.replace('/merchant/accounting');
      } else {
        router.replace('/merchant/dashboard');
      }
    }
  }, [user, isLoading, isAuthorized, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <div className="w-8 h-8 border-4 border-[#246BFD] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F9FC] p-6 text-center">
        <h2 className="text-lg font-bold text-[#0B1730]">يرجى تسجيل الدخول للوصول إلى لوحة المتجر</h2>
        <Link href="/" className="mt-4 px-4 py-2 rounded-lg bg-[#246BFD] text-white text-xs font-bold">
          الانتقال إلى صفحة الدخول
        </Link>
      </div>
    );
  }

  // Prevent flash of unauthorized screens while redirecting
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F9FC] gap-3">
        <div className="w-8 h-8 border-4 border-[#246BFD] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-[#687386] font-medium">جاري تحويلك إلى الشاشة المخصصة لصلاحياتك...</p>
      </div>
    );
  }

  // Enforce Subscription Expired or Suspended Lockout
  const isSuspended = tenant?.status === 'suspended';
  const isExpired = tenant?.is_expired || (tenant?.sub_expires_at && new Date(tenant.sub_expires_at).getTime() < Date.now());

  if (tenant && (isSuspended || isExpired)) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-4 sm:p-6 text-center text-[#0B1730] relative">
        <div className="max-w-lg w-full bg-white border border-[#E5EAF2] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />

          {/* Alert Icon */}
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-500 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-[#0B1730] mb-2">
            {isSuspended 
              ? 'تم إيقاف حساب المتجر مؤقتاً' 
              : 'عفواً، انتهت فترة اشتراك متجرك'}
          </h2>

          <p className="text-sm font-bold text-amber-600 mb-3">
            {tenant.name}
          </p>

          <p className="text-xs text-[#687386] leading-relaxed mb-6">
            {isSuspended
              ? 'تم تعليق هذا الحساب بواسطة إدارة المنصة. يرجى التواصل مع الإدارة لإعادة تفعيل الحساب والوصول إلى لوحة التحكم ونقاط البيع.'
              : `انتهت فترة الاشتراك المخصصة لمتجرك ${tenant.sub_expires_at ? `بتاريخ ${new Date(tenant.sub_expires_at).toLocaleDateString('ar-EG')}` : ''}. يرجى التواصل مع إدارة منصة سستمهالي لتجديد الاشتراك وإعادة تفعيل نقاط البيع وكافة الحسابات التابعة فوراً.`}
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#246BFD] hover:bg-[#1A54D4] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث الحالة (تم التجديد)</span>
            </button>
            <button
              onClick={logout}
              className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#0B1730] font-bold text-xs border border-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <AppHeader />
      <div className="flex flex-1 w-full overflow-x-hidden">
        <AppSidebar />
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0">
          {/* Warning Banner when subscription is about to end (within 7 days) */}
          {tenant && tenant.days_remaining !== undefined && tenant.days_remaining <= 7 && tenant.days_remaining > 0 && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-medium">
                  تنبيه هام: اشتراك متجرك ينتهي خلال <strong>{tenant.days_remaining} أيام</strong> (بتاريخ {tenant.sub_expires_at ? new Date(tenant.sub_expires_at).toLocaleDateString('ar-EG') : ''}). يرجى التواصل مع الإدارة لتجديد الاشتراك قبل توقف نقاط البيع والخدمات.
                </span>
              </div>
              <a
                href="tel:01211583961"
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors self-start sm:self-auto"
              >
                تواصل للتجديد (01211583961)
              </a>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
