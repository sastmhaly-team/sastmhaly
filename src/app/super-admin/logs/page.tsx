'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { ExportButton } from '@/components/reports/ExportButton';
import { AuditLog } from '@/lib/types';
import { ShieldAlert, Search, Clock, Activity } from 'lucide-react';

export default function SuperAdminLogsPage() {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/super-admin/overview');
        if (res.ok) {
          const json = await res.json();
          setLogs(json.recentActivity || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
    (l.user_name && l.user_name.toLowerCase().includes(search.toLowerCase()))
  );

  const exportColumns = [
    { header: 'Log ID', key: 'id' as const },
    { header: 'Action', key: 'action' as const },
    { header: 'Entity', key: 'entity_type' as const },
    { header: 'Actor', key: (r: AuditLog) => r.user_name || 'System' },
    { header: 'Timestamp', key: 'created_at' as const },
  ];

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'سجلات الأمان والتدقيق (Platform Audit Logs)' : 'Platform Security & Audit Logs'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'سجل غير قابل للتعديل لكافة العمليات الحساسة عبر جميع المستأجرين' 
              : 'Immutable record of sensitive platform operations, logins, and tenant modifications'}
          </p>
        </div>

        <ExportButton
          filename="sastmhaly_platform_audit_logs"
          data={filtered}
          columns={exportColumns}
        />
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] flex items-center justify-between shadow-2xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث في السجلات والعمليات...' : 'Search logs, actions, actors...'}
            className="w-full px-3.5 py-2 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] text-xs text-[#172033] focus:bg-white focus:border-[#246BFD] focus:outline-none pl-9 rtl:pl-3 rtl:pr-9"
          />
          <Search className="w-4 h-4 text-[#687386] absolute left-3 rtl:left-auto rtl:right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <table className="w-full text-xs text-left rtl:text-right border-collapse">
          <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
            <tr>
              <th className="px-4 py-3.5">#</th>
              <th className="px-4 py-3.5">{lang === 'ar' ? 'نوع العملية' : 'Action Type'}</th>
              <th className="px-4 py-3.5">{lang === 'ar' ? 'الكيان المتأثر' : 'Entity'}</th>
              <th className="px-4 py-3.5">{lang === 'ar' ? 'المستخدم المنفذ' : 'Actor'}</th>
              <th className="px-4 py-3.5">{lang === 'ar' ? 'المتجر / المستأجر' : 'Tenant Context'}</th>
              <th className="px-4 py-3.5">{lang === 'ar' ? 'الوقت والتاريخ' : 'Timestamp'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF2]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#687386]">
                  {t('loading')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#687386]">
                  {t('no_records')}
                </td>
              </tr>
            ) : (
              filtered.map((log, idx) => (
                <tr key={log.id} className="hover:bg-[#F7F9FC] transition-colors">
                  <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-bold text-[#0B1730]">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F0F9FF] text-[#246BFD] font-mono text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[#172033] font-medium capitalize">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-[#0B1730]">
                    {log.user_name || 'System Admin'}
                  </td>
                  <td className="px-4 py-3.5 text-[#687386]">
                    {log.tenant_id || 'Platform-Wide'}
                  </td>
                  <td className="px-4 py-3.5 text-[#687386] font-mono text-[11px]">
                    {log.created_at}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
