'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { Tenant } from '@/lib/types';
import { 
  Building2, Plus, Search, Filter, CheckCircle2, 
  Ban, ShieldCheck, ArrowUpRight, Store, Phone, Mail, Sparkles, MapPin, AlertCircle,
  Calendar, Clock, RefreshCw, AlertTriangle, Trash2, Loader2
} from 'lucide-react';

const DURATION_PRESETS = [
  { months: 1, labelAr: 'شهر واحد', labelEn: '1 Month' },
  { months: 2, labelAr: 'شهرين', labelEn: '2 Months' },
  { months: 3, labelAr: '3 شهور', labelEn: '3 Months' },
  { months: 4, labelAr: '4 شهور', labelEn: '4 Months' },
  { months: 5, labelAr: '5 شهور', labelEn: '5 Months' },
  { months: 6, labelAr: '6 شهور', labelEn: '6 Months' },
  { months: 7, labelAr: '7 شهور', labelEn: '7 Months' },
  { months: 8, labelAr: '8 شهور', labelEn: '8 Months' },
  { months: 9, labelAr: '9 شهور', labelEn: '9 Months' },
  { months: 10, labelAr: '10 شهور', labelEn: '10 Months' },
  { months: 11, labelAr: '11 شهر', labelEn: '11 Months' },
  { months: 12, labelAr: '12 شهر (سنة)', labelEn: '12 Months (1 Year)' },
];

export default function SuperAdminMerchantsPage() {
  const { lang, t } = useLanguage();
  const [merchants, setMerchants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedMerchantForBranch, setSelectedMerchantForBranch] = useState<Tenant | null>(null);
  const [merchantBranches, setMerchantBranches] = useState<any[]>([]);
  const [loadingMerchantBranches, setLoadingMerchantBranches] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [branchSuccessMsg, setBranchSuccessMsg] = useState('');

  // Renew Subscription Modal
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedMerchantForRenew, setSelectedMerchantForRenew] = useState<Tenant | null>(null);
  const [renewDurationType, setRenewDurationType] = useState<'preset' | 'custom'>('preset');
  const [renewDurationMonths, setRenewDurationMonths] = useState<number>(1);
  const [renewCustomStartDate, setRenewCustomStartDate] = useState('');
  const [renewCustomEndDate, setRenewCustomEndDate] = useState('');
  const [renewSubmitting, setRenewSubmitting] = useState(false);
  const [renewError, setRenewError] = useState('');

  // Delete Merchant Modal
  const [merchantToDelete, setMerchantToDelete] = useState<Tenant | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [branchError, setBranchError] = useState('');

  // Merchant Form state
  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    slug: '',
    phone: '',
    email: '',
    owner_name: '',
    password: '',
  });

  // Provisioning duration state
  const [durationType, setDurationType] = useState<'preset' | 'custom'>('preset');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Branch Form state for Super Admin provisioning branches
  const [branchData, setBranchData] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    phone: '',
    address: '',
    city: 'Cairo',
    opening_hours: '09:00 - 23:00',
    manager_name: '',
    is_main: false
  });

  const fetchMerchants = async () => {
    try {
      const res = await fetch('/api/super-admin/merchants');
      if (res.ok) {
        const json = await res.json();
        setMerchants(json.tenants || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
    setFormData(prev => ({ ...prev, phone: cleaned }));
    if (formError) setFormError('');
  };

  const handleBranchPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
    setBranchData(prev => ({ ...prev, phone: cleaned }));
    if (branchError) setBranchError('');
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.phone.length !== 11) {
      setFormError(
        lang === 'ar'
          ? 'رقم هاتف المالك يجب أن يتكون من 11 رقماً بالضبط (مثال: 01012345678)'
          : 'Owner phone number must be exactly 11 digits (e.g. 01012345678)'
      );
      return;
    }

    if (!formData.password) {
      setFormError(lang === 'ar' ? 'يرجى إدخال كلمة المرور الأولية للمالك' : 'Password is required');
      return;
    }

    if (durationType === 'custom') {
      if (!customStartDate || !customEndDate) {
        setFormError(lang === 'ar' ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please specify start and end dates');
        return;
      }
      if (new Date(customEndDate) <= new Date(customStartDate)) {
        setFormError(lang === 'ar' ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
        return;
      }
    }

    setFormSubmitting(true);
    try {
      const payload = {
        ...formData,
        duration_months: durationType === 'preset' ? durationMonths : undefined,
        custom_start_date: durationType === 'custom' ? customStartDate : undefined,
        custom_end_date: durationType === 'custom' ? customEndDate : undefined,
      };

      const res = await fetch('/api/super-admin/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await fetchMerchants();
        setIsModalOpen(false);
        setFormData({
          name: '',
          legal_name: '',
          slug: '',
          phone: '',
          email: '',
          owner_name: '',
          password: '',
        });
        setDurationType('preset');
        setDurationMonths(1);
      } else {
        setFormError(data.error || 'Failed to create merchant');
      }
    } catch {
      setFormError('Network or server error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenRenewModal = (merchant: Tenant) => {
    setSelectedMerchantForRenew(merchant);
    setRenewDurationType('preset');
    setRenewDurationMonths(1);
    setRenewCustomStartDate(new Date().toISOString().split('T')[0]);
    setRenewCustomEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setRenewError('');
    setIsRenewModalOpen(true);
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchantForRenew) return;
    setRenewError('');

    if (renewDurationType === 'custom') {
      if (!renewCustomStartDate || !renewCustomEndDate) {
        setRenewError(lang === 'ar' ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please specify start and end dates');
        return;
      }
      if (new Date(renewCustomEndDate) <= new Date(renewCustomStartDate)) {
        setRenewError(lang === 'ar' ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
        return;
      }
    }

    setRenewSubmitting(true);
    try {
      const payload = {
        id: selectedMerchantForRenew.id,
        action: 'renew',
        duration_months: renewDurationType === 'preset' ? renewDurationMonths : undefined,
        custom_start_date: renewDurationType === 'custom' ? renewCustomStartDate : undefined,
        custom_end_date: renewDurationType === 'custom' ? renewCustomEndDate : undefined,
      };

      const res = await fetch('/api/super-admin/merchants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchMerchants();
        setIsRenewModalOpen(false);
        alert(lang === 'ar' ? 'تم تجديد وتمديد اشتراك المتجر بنجاح' : 'Subscription renewed successfully');
      } else {
        setRenewError(data.error || 'Failed to renew subscription');
      }
    } catch {
      setRenewError('Network error');
    } finally {
      setRenewSubmitting(false);
    }
  };

  const fetchMerchantBranches = async (tenantId: string) => {
    setLoadingMerchantBranches(true);
    try {
      const res = await fetch(`/api/super-admin/branches?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.branches) {
        setMerchantBranches(data.branches);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMerchantBranches(false);
    }
  };

  const handleOpenAddBranch = (merchant: Tenant) => {
    setSelectedMerchantForBranch(merchant);
    setBranchData({
      code: `BR-${Date.now().toString().slice(-2)}`,
      name_ar: '',
      name_en: '',
      phone: merchant.phone.replace(/\D/g, '').slice(0, 11) || '',
      address: '',
      city: 'Cairo',
      opening_hours: '09:00 - 23:00',
      manager_name: '',
      is_main: false
    });
    setBranchError('');
    setBranchSuccessMsg('');
    setIsBranchModalOpen(true);
    fetchMerchantBranches(merchant.id);
  };

  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (!selectedMerchantForBranch) return;
    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من حذف الفرع "${branchName}" لهذا التاجر؟`
      : `Are you sure you want to delete branch "${branchName}" for this merchant?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingBranchId(branchId);
    setBranchError('');
    setBranchSuccessMsg('');
    try {
      const res = await fetch(`/api/super-admin/branches?tenantId=${selectedMerchantForBranch.id}&branchId=${branchId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBranchSuccessMsg(lang === 'ar' ? 'تم حذف الفرع بنجاح' : 'Branch removed successfully');
        await fetchMerchantBranches(selectedMerchantForBranch.id);
      } else {
        setBranchError(data.error || 'Failed to delete branch');
      }
    } catch {
      setBranchError(lang === 'ar' ? 'فشل الاتصال بالخادم' : 'Server communication error');
    } finally {
      setDeletingBranchId(null);
    }
  };

  const handleCreateBranchForMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchantForBranch) return;
    setBranchError('');
    setBranchSuccessMsg('');

    if (branchData.phone.length !== 11) {
      setBranchError(
        lang === 'ar'
          ? 'رقم هاتف الفرع يجب أن يتكون من 11 رقماً بالضبط'
          : 'Branch phone number must be exactly 11 digits'
      );
      return;
    }

    setBranchSubmitting(true);
    try {
      const res = await fetch('/api/super-admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedMerchantForBranch.id,
          ...branchData
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBranchSuccessMsg(lang === 'ar' ? 'تمت إضافة الفرع للتاجر بنجاح' : 'Branch created successfully');
        setBranchData({
          code: `BR-${Date.now().toString().slice(-2)}`,
          name_ar: '',
          name_en: '',
          phone: selectedMerchantForBranch.phone.replace(/\D/g, '').slice(0, 11) || '',
          address: '',
          city: 'Cairo',
          opening_hours: '09:00 - 23:00',
          manager_name: '',
          is_main: false
        });
        await fetchMerchantBranches(selectedMerchantForBranch.id);
      } else {
        setBranchError(data.error || 'Failed to create branch');
      }
    } catch {
      setBranchError('Failed to communicate with server');
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/super-admin/merchants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchMerchants();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDeleteModal = (merchant: Tenant) => {
    setMerchantToDelete(merchant);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!merchantToDelete) return;
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/super-admin/merchants?id=${merchantToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsDeleteModalOpen(false);
        setMerchantToDelete(null);
        await fetchMerchants();
      } else {
        setDeleteError(data.error || 'Failed to delete merchant');
      }
    } catch {
      setDeleteError(lang === 'ar' ? 'فشل الاتصال بالخادم' : 'Failed to communicate with server');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filtered = merchants.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.slug.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportColumns = [
    { header: 'Merchant ID', key: 'id' as const },
    { header: 'Business Name', key: 'name' as const },
    { header: 'Identifier Slug', key: 'slug' as const },
    { header: 'Email', key: 'email' as const },
    { header: 'Phone', key: 'phone' as const },
    { header: 'Status', key: 'status' as const },
    { header: 'Currency', key: 'currency' as const },
    { header: 'Created At', key: 'created_at' as const },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'إدارة المتاجر والتجار (Multi-Tenant Management)' : 'Merchant Accounts & Provisioning'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'إنشاء المتاجر الجديدة بالخطة الشاملة، إدارة الفروع، تفعيل وتعليق الحسابات'
              : 'Provision merchants on unified all-inclusive plan, manage branches, and configure workspaces'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportButton
            filename="sastmhaly_merchants_directory"
            data={merchants}
            columns={exportColumns}
          />

          <button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#246BFD] hover:bg-[#1A54D4] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة تاجر جديد' : 'Provision Merchant'}</span>
          </button>
        </div>
      </div>
      {/* Expiry Alerts Banner for Super Admin */}
      {(() => {
        const expiringSoon = merchants.filter(m => m.status === 'active' && m.days_remaining !== undefined && m.days_remaining <= 7 && !m.is_expired);
        const expiredOrSuspended = merchants.filter(m => m.is_expired || m.status === 'suspended');

        if (expiringSoon.length === 0 && expiredOrSuspended.length === 0) return null;

        return (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  {lang === 'ar' ? 'تنبيهات حالة اشتراكات التجار' : 'Merchant Subscription Alerts'}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {lang === 'ar' ? (
                    <>
                      يوجد <strong className="text-amber-900">{expiringSoon.length}</strong> متجر تنتهي اشتراكاتهم خلال 7 أيام أو أقل، و <strong className="text-red-700">{expiredOrSuspended.length}</strong> متجر منتهي الصلاحية أو معلق الخدمة.
                    </>
                  ) : (
                    <>
                      <strong>{expiringSoon.length}</strong> merchants expiring within 7 days, and <strong>{expiredOrSuspended.length}</strong> expired or suspended.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : 'all')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                {lang === 'ar' ? 'متابعة وتجديد الاشتراكات' : 'Review Subscriptions'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-[#687386] absolute left-3 rtl:left-auto rtl:right-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث بالاسم، الرابط، الهاتف...' : 'Search by business name, slug, phone...'}
            className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-1.5 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-[#687386]" />
          <span className="text-[#687386] font-medium">{t('filter')}:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E5EAF2] text-xs font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
          >
            <option value="all">{lang === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="active">{lang === 'ar' ? 'نشط' : 'Active'}</option>
            <option value="trial">{lang === 'ar' ? 'تجريبي' : 'Trial'}</option>
            <option value="suspended">{lang === 'ar' ? 'معلق / مغلق' : 'Suspended'}</option>
          </select>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'اسم المتجر والهوية' : 'Merchant Name & Identity'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'معرف الرابط (Slug)' : 'Unique Slug'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'بيانات التواصل (11 رقماً)' : 'Contact (Phone)'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'فترة وصلاحية الاشتراك' : 'Subscription & Expiry'}</th>
                <th className="px-4 py-3.5">{t('status')}</th>
                <th className="px-4 py-3.5 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#687386]">
                    {t('loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#687386]">
                    {lang === 'ar' ? 'لا يوجد تجار مسجلون حالياً. انقر على "إضافة تاجر جديد" للبدء.' : 'No merchants registered yet. Click "Add New Merchant" to begin.'}
                  </td>
                </tr>
              ) : (
                filtered.map((m, idx) => {
                  const isSuspended = m.status === 'suspended';
                  const isExpired = m.is_expired;
                  const isExpiringSoon = !isExpired && !isSuspended && m.days_remaining !== undefined && m.days_remaining <= 7;

                  return (
                    <tr key={m.id} className="hover:bg-[#F7F9FC] transition-colors">
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center text-[#246BFD] font-bold text-xs shrink-0">
                            {m.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[#0B1730]">{m.name}</p>
                            {m.legal_name && (
                              <p className="text-[10px] text-[#687386]">{m.legal_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium text-[#246BFD]">
                        {m.slug}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-mono font-semibold text-[#172033]">
                            <Phone className="w-3 h-3 text-[#246BFD]" />
                            <span>{m.phone}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#687386] text-[11px]">
                            <Mail className="w-3 h-3 text-[#687386]" />
                            <span>{m.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#246BFD] border border-[#BFDBFE]">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? 'الخطة الشاملة' : 'All-Inclusive'}</span>
                            </span>
                          </div>
                          
                          {/* Expiry Date Display */}
                          <div className="text-[11px] text-[#4A5568] flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-[#687386]" />
                            <span>
                              {m.sub_expires_at 
                                ? new Date(m.sub_expires_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') 
                                : 'مفتوح'}
                            </span>
                          </div>

                          {/* Expiry Badge */}
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <Ban className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? 'مغلق من الإدارة' : 'Suspended'}</span>
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? 'منتهي الصلاحية' : 'Expired'}</span>
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? `ينتهي خلال ${m.days_remaining} يوم` : `Expires in ${m.days_remaining}d`}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{lang === 'ar' ? `متبقي ${m.days_remaining ?? 0} يوم` : `${m.days_remaining ?? 0}d left`}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#EF4444] border border-[#FECACA]">
                            <Ban className="w-3 h-3" />
                            {lang === 'ar' ? 'معلق / مغلق' : 'Suspended'}
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                            <AlertTriangle className="w-3 h-3" />
                            {lang === 'ar' ? 'منتهي' : 'Expired'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === 'ar' ? 'نشط' : 'Active'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                          {/* Renew / Extend Button */}
                          <button
                            onClick={() => handleOpenRenewModal(m)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] hover:bg-[#10B981] hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            title="Renew / Extend Subscription"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'تجديد / تمديد' : 'Renew'}</span>
                          </button>

                          {/* Super Admin manages & provisions branches for merchant */}
                          <button
                            onClick={() => handleOpenAddBranch(m)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#246BFD] bg-[#F0F9FF] border border-[#BAE6FD] hover:bg-[#246BFD] hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            title={lang === 'ar' ? 'عرض وإضافة وحذف فروع هذا التاجر' : 'View, Add & Remove Branches'}
                          >
                            <Store className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'الفروع' : 'Branches'}</span>
                          </button>

                          {m.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(m.id, 'suspended')}
                              className="px-2 py-1 rounded text-[11px] font-bold text-[#EF4444] bg-red-50 hover:bg-[#FEF2F2] border border-red-200 transition-colors cursor-pointer"
                              title="Suspend / Close Merchant Access"
                            >
                              {lang === 'ar' ? 'إغلاق / تعليق' : 'Suspend'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(m.id, 'active')}
                              className="px-2 py-1 rounded text-[11px] font-bold text-[#10B981] bg-emerald-50 hover:bg-[#ECFDF5] border border-emerald-200 transition-colors cursor-pointer"
                              title="Reactivate Merchant Access"
                            >
                              {lang === 'ar' ? 'إعادة تفعيل' : 'Activate'}
                            </button>
                          )}

                          {/* Delete Merchant Button */}
                          <button
                            onClick={() => handleOpenDeleteModal(m)}
                            className="px-2 py-1 rounded text-[11px] font-bold text-[#DC2626] bg-red-50 hover:bg-[#DC2626] hover:text-white border border-red-200 transition-all cursor-pointer flex items-center gap-1"
                            title={lang === 'ar' ? 'حذف المتجر نهائياً' : 'Delete Merchant'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New Merchant Modal (Unified Plan, 11-digit phone) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={lang === 'ar' ? 'إنشاء وتفعيل تاجر جديد (الخطة الشاملة)' : 'Provision New Merchant Tenant (All-Inclusive)'}
        maxWidth="xl"
      >
        <form onSubmit={handleCreateMerchant} className="space-y-4">
          
          {/* Plan Banner */}
          <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#246BFD] shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-[#0B1730]">
                {lang === 'ar' ? 'الخطة الشاملة مفعلة تلقائياً (All-Inclusive System)' : 'Unified All-Inclusive Plan Active'}
              </p>
              <p className="text-[#687386] text-[11px]">
                {lang === 'ar'
                  ? 'كافة المميزات مفعلة: نقاط البيع POS، إدارة الفروع، المخزون، الحسابات، صلاحيات الموظفين، وتقارير Z.'
                  : 'All modules unlocked: POS, branch network, real-time inventory, accounting, and cashier shifts.'}
              </p>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'اسم المتجر التجاري *' : 'Business Name *'}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="سوبرماركت المدينة"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'الاسم التجاري القانوني' : 'Legal / Company Name'}
              </label>
              <input
                type="text"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                placeholder="شركة المدينة لتجارة الأغذية ذ.م.م"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'المعرف الفريد (Slug) *' : 'Unique Identifier Slug *'}
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="madina-market"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#172033]">
                  {lang === 'ar' ? 'رقم هاتف المالك (11 رقماً) *' : 'Owner Phone (11 digits) *'}
                </label>
                <span className={`text-[10px] font-mono font-bold ${formData.phone.length === 11 ? 'text-[#10B981]' : 'text-[#687386]'}`}>
                  {formData.phone.length}/11
                </span>
              </div>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="01012345678"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs font-mono focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'كلمة المرور لحساب المالك *' : 'Owner Password *'}
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'اسم المالك بالكامل' : 'Owner Full Name'}
              </label>
              <input
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                placeholder="أحمد محمد"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {lang === 'ar' ? 'البريد الإلكتروني للعمل' : 'Business Email'}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="owner@madina.com"
                className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-[11px] text-[#475569]">
              <ShieldCheck className="w-4 h-4 text-[#246BFD] shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'الحساب المنشأ هنا هو الحساب الرئيسي للمتجر (Main Account) ويملك تلقائياً حق رؤية جميع الفروع وبيانات كل فرع على حدة أو إجمالي كل الفروع.'
                  : 'The account created here is the merchant Main Account with full access to oversee all branches, toggle single branch data, or view all branches combined.'}
              </span>
            </div>

            {/* Duration Selector in Provision Modal */}
            <div className="sm:col-span-2 pt-2 border-t border-[#E5EAF2]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#246BFD]" />
                  <span>{lang === 'ar' ? 'تحديد فترة صلاحية اشتراك المتجر *' : 'Subscription Duration *'}</span>
                </label>
                <div className="inline-flex rounded-lg border border-[#E5EAF2] p-0.5 bg-[#F7F9FC] text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDurationType('preset')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      durationType === 'preset'
                        ? 'bg-white text-[#246BFD] shadow-2xs'
                        : 'text-[#687386] hover:text-[#0B1730]'
                    }`}
                  >
                    {lang === 'ar' ? 'خيارات سريعة (بالشهور)' : 'Quick Presets'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationType('custom')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      durationType === 'custom'
                        ? 'bg-white text-[#246BFD] shadow-2xs'
                        : 'text-[#687386] hover:text-[#0B1730]'
                    }`}
                  >
                    {lang === 'ar' ? 'فترة مخصصة (من وقت لوقت)' : 'Custom Range'}
                  </button>
                </div>
              </div>

              {durationType === 'preset' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {DURATION_PRESETS.map((p) => {
                    const isSelected = durationMonths === p.months;
                    return (
                      <button
                        type="button"
                        key={p.months}
                        onClick={() => setDurationMonths(p.months)}
                        className={`p-2 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#EFF6FF] border-[#246BFD] text-[#246BFD] shadow-2xs ring-1 ring-[#246BFD]'
                            : 'bg-white border-[#E5EAF2] text-[#4A5568] hover:border-[#246BFD]/50'
                        }`}
                      >
                        {lang === 'ar' ? p.labelAr : p.labelEn}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF2]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172033] mb-1">
                      {lang === 'ar' ? 'تاريخ بداية الاشتراك' : 'Start Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5EAF2] text-xs bg-white focus:border-[#246BFD] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#172033] mb-1">
                      {lang === 'ar' ? 'تاريخ نهاية الاشتراك' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#E5EAF2] text-xs bg-white focus:border-[#246BFD] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Expiry calculation preview */}
              <div className="mt-2 text-[11px] text-[#687386] flex items-center gap-1.5 bg-[#EFF6FF]/50 p-2 rounded-lg border border-[#DBEAFE]">
                <Calendar className="w-3.5 h-3.5 text-[#246BFD] shrink-0" />
                <span>
                  {lang === 'ar' ? 'تاريخ انتهاء الاشتراك المتوقع:' : 'Expected Expiry Date:'}{' '}
                  <strong className="text-[#0B1730] font-mono">
                    {durationType === 'preset'
                      ? new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
                      : (customEndDate ? new Date(customEndDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '-')}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386] hover:bg-gray-100 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {formSubmitting ? t('loading') : (lang === 'ar' ? 'إنشاء وتأكيد المتجر' : 'Provision Merchant')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Renew / Extend Subscription Modal */}
      <Modal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title={
          lang === 'ar'
            ? `تجديد وتمديد اشتراك المتجر: ${selectedMerchantForRenew?.name || ''}`
            : `Renew / Extend Subscription: ${selectedMerchantForRenew?.name || ''}`
        }
        maxWidth="lg"
      >
        <form onSubmit={handleRenewSubscription} className="space-y-4">
          {/* Current Status Box */}
          <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E5EAF2] text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#687386]">{lang === 'ar' ? 'حالة الاشتراك الحالية:' : 'Current Status:'}</span>
              {selectedMerchantForRenew?.status === 'suspended' ? (
                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">معلق / مغلق</span>
              ) : selectedMerchantForRenew?.is_expired ? (
                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">منتهي الصلاحية</span>
              ) : (
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">نشط (ساري)</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#687386]">{lang === 'ar' ? 'تاريخ الانتهاء الحالي:' : 'Current Expiration:'}</span>
              <span className="font-mono font-bold text-[#0B1730]">
                {selectedMerchantForRenew?.sub_expires_at
                  ? new Date(selectedMerchantForRenew.sub_expires_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
                  : 'غير محدد'}
              </span>
            </div>
            {selectedMerchantForRenew?.days_remaining !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[#687386]">{lang === 'ar' ? 'الأيام المتبقية:' : 'Days Remaining:'}</span>
                <span className="font-bold text-[#246BFD]">
                  {selectedMerchantForRenew.days_remaining > 0
                    ? `${selectedMerchantForRenew.days_remaining} يوم`
                    : 'منتهي (0 يوم)'}
                </span>
              </div>
            )}
          </div>

          {renewError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{renewError}</span>
            </div>
          )}

          {/* Renewal Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#246BFD]" />
                <span>{lang === 'ar' ? 'مدة التمديد أو التجديد *' : 'Renewal Duration *'}</span>
              </label>
              <div className="inline-flex rounded-lg border border-[#E5EAF2] p-0.5 bg-[#F7F9FC] text-[11px]">
                <button
                  type="button"
                  onClick={() => setRenewDurationType('preset')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    renewDurationType === 'preset'
                      ? 'bg-white text-[#246BFD] shadow-2xs'
                      : 'text-[#687386] hover:text-[#0B1730]'
                  }`}
                >
                  {lang === 'ar' ? 'خيارات سريعة (بالشهور)' : 'Quick Presets'}
                </button>
                <button
                  type="button"
                  onClick={() => setRenewDurationType('custom')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    renewDurationType === 'custom'
                      ? 'bg-white text-[#246BFD] shadow-2xs'
                      : 'text-[#687386] hover:text-[#0B1730]'
                  }`}
                >
                  {lang === 'ar' ? 'تاريخ مخصص' : 'Custom Dates'}
                </button>
              </div>
            </div>

            {renewDurationType === 'preset' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {DURATION_PRESETS.map((p) => {
                  const isSelected = renewDurationMonths === p.months;
                  return (
                    <button
                      type="button"
                      key={p.months}
                      onClick={() => setRenewDurationMonths(p.months)}
                      className={`p-2 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EFF6FF] border-[#246BFD] text-[#246BFD] shadow-2xs ring-1 ring-[#246BFD]'
                          : 'bg-white border-[#E5EAF2] text-[#4A5568] hover:border-[#246BFD]/50'
                      }`}
                    >
                      {lang === 'ar' ? p.labelAr : p.labelEn}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#F7F9FC] border border-[#E5EAF2]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'تاريخ بداية التجديد' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={renewCustomStartDate}
                    onChange={(e) => setRenewCustomStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E5EAF2] text-xs bg-white focus:border-[#246BFD] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'تاريخ انتهاء التجديد' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={renewCustomEndDate}
                    onChange={(e) => setRenewCustomEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E5EAF2] text-xs bg-white focus:border-[#246BFD] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E5EAF2] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRenewModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386] hover:bg-gray-100 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={renewSubmitting}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${renewSubmitting ? 'animate-spin' : ''}`} />
              <span>{renewSubmitting ? t('loading') : (lang === 'ar' ? 'تأكيد تجديد وتمديد الاشتراك' : 'Confirm Renewal')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal for Super Admin to View, Add, and Remove Branches for a Merchant */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title={
          lang === 'ar'
            ? `إدارة فروع التاجر: ${selectedMerchantForBranch?.name || ''}`
            : `Manage Branches: ${selectedMerchantForBranch?.name || ''}`
        }
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {branchSuccessMsg && (
            <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center gap-2 text-xs text-[#059669]">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
              <span className="font-semibold">{branchSuccessMsg}</span>
            </div>
          )}

          {branchError && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{branchError}</span>
            </div>
          )}

          {/* Section 1: Existing Branches List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF2]">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#246BFD]" />
                <h3 className="text-xs font-bold text-[#0B1730]">
                  {lang === 'ar' ? 'فروع المتجر المسجلة حالياً' : 'Current Merchant Branches'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#246BFD] border border-blue-200">
                  {merchantBranches.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => selectedMerchantForBranch && fetchMerchantBranches(selectedMerchantForBranch.id)}
                disabled={loadingMerchantBranches}
                className="text-[11px] text-[#246BFD] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingMerchantBranches ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
              </button>
            </div>

            {loadingMerchantBranches ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-500 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-[#246BFD]" />
                <span>{lang === 'ar' ? 'جاري تحميل الفروع...' : 'Loading branches...'}</span>
              </div>
            ) : merchantBranches.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 bg-[#F7F9FC] rounded-xl border border-dashed border-[#E5EAF2]">
                {lang === 'ar' ? 'لا توجد فروع مسجلة لهذا التاجر حتى الآن' : 'No branches recorded for this merchant yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5EAF2] bg-white">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F7F9FC] text-[#687386] font-semibold border-b border-[#E5EAF2]">
                    <tr>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الفرع' : 'Branch'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الكود' : 'Code'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الهاتف' : 'Phone'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'العنوان / المدينة' : 'Location'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="py-2.5 px-3 text-center">{lang === 'ar' ? 'حذف' : 'Remove'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {merchantBranches.map((b: any) => (
                      <tr key={b.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#0B1730]">
                          <div>{b.name_ar}</div>
                          {b.name_en && b.name_en !== b.name_ar && (
                            <div className="text-[10px] text-gray-400 font-normal">{b.name_en}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-600">
                          {b.code}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">
                          {b.phone}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {b.address || b.city || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {b.is_main === 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {lang === 'ar' ? 'الفرع الرئيسي' : 'Main Branch'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              {lang === 'ar' ? 'فرع إضافي' : 'Branch'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {b.is_main === 1 ? (
                            <span 
                              title={lang === 'ar' ? 'الفرع الرئيسي لا يمكن حذفه' : 'Main branch cannot be deleted'} 
                              className="text-gray-300 inline-block p-1 cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteBranch(b.id, b.name_ar)}
                              disabled={deletingBranchId === b.id}
                              title={lang === 'ar' ? 'حذف هذا الفرع' : 'Remove this branch'}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              {deletingBranchId === b.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Add New Branch */}
          <div className="pt-2 border-t border-[#E5EAF2] space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#246BFD]" />
              <h3 className="text-xs font-bold text-[#0B1730]">
                {lang === 'ar' ? 'إضافة فرع جديد لهذا التاجر' : 'Add New Branch for this Merchant'}
              </h3>
            </div>

            <form onSubmit={handleCreateBranchForMerchant} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'اسم الفرع بالعربية *' : 'Branch Arabic Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={branchData.name_ar}
                    onChange={(e) => setBranchData({ ...branchData, name_ar: e.target.value })}
                    placeholder="فرع المعادي"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'اسم الفرع بالإنجليزية' : 'Branch English Name'}
                  </label>
                  <input
                    type="text"
                    value={branchData.name_en}
                    onChange={(e) => setBranchData({ ...branchData, name_en: e.target.value })}
                    placeholder="Maadi Branch"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'كود الفرع *' : 'Branch Code *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={branchData.code}
                    onChange={(e) => setBranchData({ ...branchData, code: e.target.value })}
                    placeholder="BR-02"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs font-mono focus:border-[#246BFD] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#172033]">
                      {lang === 'ar' ? 'هاتف الفرع (11 رقماً) *' : 'Branch Phone (11 digits) *'}
                    </label>
                    <span className={`text-[10px] font-mono font-bold ${branchData.phone.length === 11 ? 'text-[#10B981]' : 'text-[#687386]'}`}>
                      {branchData.phone.length}/11
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    value={branchData.phone}
                    onChange={handleBranchPhoneChange}
                    placeholder="01112223344"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs font-mono focus:border-[#246BFD] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'العنوان' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={branchData.address}
                    onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                    placeholder="شارع النصر، المعادي"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#172033] mb-1">
                    {lang === 'ar' ? 'المدينة' : 'City'}
                  </label>
                  <input
                    type="text"
                    value={branchData.city}
                    onChange={(e) => setBranchData({ ...branchData, city: e.target.value })}
                    placeholder="القاهرة"
                    className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] text-xs focus:border-[#246BFD] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5EAF2] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386] hover:bg-gray-100 cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق النافذة' : 'Close'}
                </button>
                <button
                  type="submit"
                  disabled={branchSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {branchSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إضافة الفرع' : 'Provision Branch'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>

      {/* Delete Merchant Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleteSubmitting && setIsDeleteModalOpen(false)}
        title={lang === 'ar' ? 'تأكيد حذف المتجر نهائياً' : 'Confirm Permanent Merchant Deletion'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 space-y-1">
              <p className="font-bold">
                {lang === 'ar' ? 'تحذير أمني: هذا الإجراء نهائي ولا يمكن التراجع عنه!' : 'Security Warning: This action is permanent and irreversible!'}
              </p>
              <p>
                {lang === 'ar'
                  ? `هل أنت متأكد من رغبتك في حذف المتجر "${merchantToDelete?.name}" (${merchantToDelete?.slug})؟ سيتم حذف كافة الفروع، حسابات المستخدمين، المنتجات، المبيعات، والبيانات المالية المرتبطة به فوراً من قاعدة البيانات.`
                  : `Are you sure you want to permanently delete "${merchantToDelete?.name}" (${merchantToDelete?.slug})? All branches, users, products, sales, and financial records will be wiped from the database.`}
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="p-3 rounded-lg bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="pt-3 border-t border-[#E5EAF2] flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] text-xs font-bold text-[#687386] hover:bg-gray-100 cursor-pointer disabled:opacity-50"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ حذف المتجر...' : 'Deleting Merchant...'}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تأكيد الحذف النهائي' : 'Confirm Delete'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
