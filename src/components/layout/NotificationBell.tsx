'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Notification } from '@/lib/types';
import Link from 'next/link';

export function NotificationBell() {
  const { tenant, activeBranchId } = useAuth();
  const { lang } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const fetchNotifs = async () => {
      try {
        const branchParam = activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
        const res = await fetch(`/api/notifications?tenantId=${tenant.id}${branchParam}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotifs();
  }, [tenant, activeBranchId]);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-[#E5EAF2] bg-white text-[#172033] hover:bg-[#F7F9FC] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-[#172033]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 rtl:left-0 rtl:right-auto mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-[#E5EAF2] z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5EAF2] flex items-center justify-between bg-[#F7F9FC]">
            <h4 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
              {lang === 'ar' ? 'التنبيهات والإشعارات' : 'Notifications & Alerts'}
            </h4>
            <span className="text-[11px] font-medium text-[#687386]">
              {unreadCount} {lang === 'ar' ? 'غير مقروء' : 'unread'}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#E5EAF2]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#687386]">
                {lang === 'ar' ? 'لا توجد تنبيهات جديدة' : 'No new notifications'}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 hover:bg-[#F7F9FC] transition-colors flex gap-3 ${n.is_read === 0 ? 'bg-[#F0F9FF]' : ''}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'expiring' && (
                      <Clock className="w-4 h-4 text-[#F59E0B]" />
                    )}
                    {n.type === 'low_stock' && (
                      <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                    )}
                    {n.type !== 'expiring' && n.type !== 'low_stock' && (
                      <AlertCircle className="w-4 h-4 text-[#246BFD]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0B1730] truncate">
                      {lang === 'ar' ? n.title_ar : n.title_en}
                    </p>
                    <p className="text-[11px] text-[#687386] mt-0.5 leading-relaxed">
                      {lang === 'ar' ? n.message_ar : n.message_en}
                    </p>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => setIsOpen(false)}
                        className="inline-block mt-1 text-[11px] font-bold text-[#246BFD] hover:underline"
                      >
                        {lang === 'ar' ? 'عرض الإجراء ←' : 'View Action →'}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
