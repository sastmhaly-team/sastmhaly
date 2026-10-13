'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { Branch } from '@/lib/types';
import { exportToCsv } from '@/lib/export/csv';
import { 
  Building2, Search, Download, 
  MapPin, Phone, Clock, UserCheck, ShieldCheck, Info
} from 'lucide-react';

export default function BranchesPage() {
  const { tenant, user } = useAuth();
  const { t, isRtl, lang } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || '';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBranches = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/merchant/branches?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.branches) {
        setBranches(data.branches);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [tenantId]);

  const filteredBranches = branches.filter(b =>
    b.name_ar.includes(searchTerm) ||
    b.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportBranchesCsv = () => {
    const headers = [
      { key: 'code', labelEn: 'Branch Code', labelAr: 'كود الفرع' },
      { key: 'name_ar', labelEn: 'Name (Arabic)', labelAr: 'الاسم بالعربية' },
      { key: 'name_en', labelEn: 'Name (English)', labelAr: 'الاسم بالإنجليزية' },
      { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
      { key: 'city', labelEn: 'City', labelAr: 'المدينة' },
      { key: 'address', labelEn: 'Address', labelAr: 'العنوان' },
      { key: 'is_main', labelEn: 'Is Main', labelAr: 'الفرع الرئيسي' }
    ];
    exportToCsv(`sastmhaly_branches_${Date.now()}`, branches, headers, isRtl);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining that branches are provisioned by Super Admin */}
      <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#BAE6FD] text-[#246BFD] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#0B1730]">
              {lang === 'ar' ? 'إدارة شبكة الفروع المركزية' : 'Platform Managed Branch Network'}
            </h3>
            <p className="text-[11px] text-[#687386] mt-0.5">
              {lang === 'ar'
                ? 'إضافة وتخصيص الفروع يتم حصرياً عبر إدارة المنصة (Super Admin). لطلب إضافة فرع جديد يرجى التواصل مع الدعم الفني للمنصة.'
                : 'Branch provisioning is managed exclusively by the Platform Super Admin. Contact support to provision a new branch.'}
            </p>
          </div>
        </div>

        <button
          onClick={exportBranchesCsv}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#BAE6FD] hover:bg-[#F0F9FF] text-[#246BFD] rounded-lg text-xs font-bold shadow-2xs cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isRtl ? 'تصدير قائمة الفروع (CSV)' : 'Export Branches (CSV)'}</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {isRtl ? 'الفروع والمواقع' : 'Branch Locations'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {isRtl ? 'قائمة الفروع المرتبطة بحساب متجرك مع بيانات الاتصال والعناوين' : 'View your authorized active branch locations and points of sale'}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? 'بحث باسم الفرع أو الكود...' : 'Search by branch name or code...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل الفروع...' : 'Loading branches...'}
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="col-span-full p-8 text-center text-xs text-[#687386] bg-white rounded-xl border border-[#E5EAF2]">
            {isRtl ? 'لا توجد فروع مسجلة لهذا الحساب حالياً' : 'No branches assigned yet.'}
          </div>
        ) : filteredBranches.map((branch) => (
          <div key={branch.id} className="bg-white p-5 rounded-xl border border-[#E5EAF2] shadow-xs space-y-4 hover:border-[#246BFD]/50 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded font-semibold text-[#687386]">
                    {branch.code}
                  </span>
                  {branch.is_main === 1 && (
                    <span className="text-[10px] bg-blue-50 text-[#246BFD] border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                      {isRtl ? 'الفرع الرئيسي' : 'Main Branch'}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#0B1730] mt-2">
                  {isRtl ? branch.name_ar : branch.name_en}
                </h3>
                <p className="text-xs text-[#687386]">
                  {isRtl ? branch.name_en : branch.name_ar}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[#246BFD]">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5EAF2] space-y-2 text-xs text-[#687386]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate">{branch.city} - {branch.address}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{branch.phone}</span>
              </div>
              {branch.opening_hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{branch.opening_hours}</span>
                </div>
              )}
              {branch.manager_name && (
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{isRtl ? 'المدير:' : 'Manager:'} {branch.manager_name}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5EAF2] flex justify-between items-center text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold ${branch.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                <span className={`w-2 h-2 rounded-full ${branch.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                {branch.is_active ? (isRtl ? 'فرع نشط' : 'Active') : (isRtl ? 'معطل' : 'Inactive')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
