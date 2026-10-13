'use client';

import React from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useAuth } from '@/lib/auth/context';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <div className="w-8 h-8 border-4 border-[#246BFD] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Enforce Super Admin role
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1730]">Access Denied / غير مصرح بالدخول</h2>
        <p className="text-xs text-[#687386] max-w-md mt-2">
          This administration area is restricted to the platform SaaS owner. Merchants and branch staff cannot access this section.
        </p>
        <Link
          href="/login"
          className="mt-6 px-4 py-2 rounded-lg text-xs font-bold bg-[#0B1730] text-white hover:bg-[#172033]"
        >
          Sign In as Super Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <AppHeader />
      <div className="flex flex-1 w-full overflow-x-hidden">
        <AppSidebar />
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
