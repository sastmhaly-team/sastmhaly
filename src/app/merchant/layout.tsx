'use client';

import React, { useEffect } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, AlertTriangle, RefreshCw, LogOut, Clock, Phone, Sparkles, Eye, ShieldCheck } from 'lucide-react';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Check if super admin is impersonating this merchant (Hook called unconditionally at top)
  const [impersonator, setImpersonator] = React.useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const imp = localStorage.getItem('sastmhaly_impersonator');
      setImpersonator(imp);
    }
  }, []);

  const handleExitImpersonation = () => {
    if (typeof window !== 'undefined' && impersonator) {
      localStorage.setItem('sastmhaly_user', impersonator);
      localStorage.removeItem('sastmhaly_impersonator');
      localStorage.setItem('sastmhaly_branch', 'all');
      window.location.href = '/super-admin/merchants';
    }
  };

  const isPos = pathname === '/merchant/pos';

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

  // Enforce Subscription Expired or Suspended Lockout (Bypassed if Super Admin is inspecting)
  const isSuspended = tenant?.status === 'suspended';
  const isExpired = tenant?.is_expired || (tenant?.sub_expires_at && new Date(tenant.sub_expires_at).getTime() < Date.now());

  if (tenant && (isSuspended || isExpired) && !impersonator && user?.role !== 'super_admin') {
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
            <a
              href="https://wa.me/201558516263?text=مرحباً،%20انتهى%20اشتراك%20متجري%20في%20منصة%20سستمهالي%20وأريد%20تجديده%20لتفعيل%20الحساب"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>تواصل للتجديد عبر واتساب (01558516263)</span>
            </a>
            <button
              onClick={() => window.location.reload()}
              className="py-2.5 px-4 rounded-xl bg-[#246BFD] hover:bg-[#1A54D4] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث الحالة</span>
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
    <div className="h-screen h-[100dvh] flex flex-col bg-[#F7F9FC] overflow-hidden">
      {/* Super Admin Impersonation Inspection Banner */}
      {impersonator && (
        <div className="bg-gradient-to-r from-[#0B1730] via-indigo-950 to-[#0B1730] border-b border-indigo-500/40 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md z-50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-white">
              أنت الآن تتصفح الحساب الرئيسي لمتجر: <strong className="text-indigo-300 font-bold underline underline-offset-2">{tenant?.name || ''}</strong> بصلاحية Super Admin (رؤية شاملة لكافة البيانات)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-mono">
              {user?.full_name || user?.username}
            </span>
          </div>

          <button
            onClick={handleExitImpersonation}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>العودة إلى لوحة تحكم Super Admin</span>
          </button>
        </div>
      )}

      <AppHeader />
      <div className="flex flex-1 w-full min-h-0 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain transition-all duration-300 ease-in-out">
          <div className={isPos ? "w-full h-full p-2 sm:p-3" : "p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"}>
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
                  href="https://wa.me/201558516263?text=مرحباً،%20أريد%20تجديد%20اشتراك%20متجري%20في%20منصة%20سستمهالي"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-xs font-bold shrink-0 transition-colors self-start sm:self-auto flex items-center gap-1.5 shadow-xs"
                >
                  <span>تواصل للتجديد عبر واتساب (01558516263)</span>
                </a>
              </div>
            )}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
