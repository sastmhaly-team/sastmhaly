'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';
import { getPendingOfflineSales, syncPendingSales, initOfflineSync } from '@/lib/offline/offline-manager';

export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [justSynced, setJustSynced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set initial network state
    setOnline(navigator.onLine);
    setPendingCount(getPendingOfflineSales().length);

    // Initialize auto sync
    initOfflineSync();

    // Register Service Worker for offline caching
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }

    const handleOnline = () => {
      setOnline(true);
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleSyncEvent = (e: any) => {
      const detail = e.detail || {};
      if (detail.pendingCount !== undefined) {
        setPendingCount(detail.pendingCount);
      }
      if (detail.type === 'syncing_start') {
        setIsSyncing(true);
      }
      if (detail.type === 'syncing_complete') {
        setIsSyncing(false);
        if (detail.successCount > 0) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 5000);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sastmhaly_offline_sync', handleSyncEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sastmhaly_offline_sync', handleSyncEvent);
    };
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncPendingSales();
      if (res.success > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 5000);
      }
    } finally {
      setIsSyncing(false);
      setPendingCount(getPendingOfflineSales().length);
    }
  };

  // If online with 0 pending and not just synced, display a sleek compact online indicator
  if (online && pendingCount === 0 && !justSynced && !isSyncing) {
    return (
      <div 
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold"
        title="متصل بالإنترنت - السحابة متزامنة بالكامل"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <Wifi className="w-3 h-3 text-emerald-600" />
        <span>متصل</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      {!online && (
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-xs animate-pulse"
          title="أنت في وضع عدم الاتصال (أوفلاين) - جميع الشاشات والمبيعات تعمل محلياً وسيتم حفظ البيانات ومزامنتها تلقائياً"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>وضع أوفلاين</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 bg-white text-amber-700 rounded-full font-mono text-[10px]">
              {pendingCount} معلقة
            </span>
          )}
        </div>
      )}

      {online && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
          title="توجد فواتير مبيعات مسجلة أوفلاين بانتظار المزامنة"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CloudUpload className="w-3.5 h-3.5" />
          )}
          <span>{isSyncing ? 'جاري المزامنة...' : `مزامنة ${pendingCount} فواتير الآن`}</span>
        </button>
      )}

      {justSynced && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>تمت المزامنة بنجاح!</span>
        </div>
      )}
    </div>
  );
}
