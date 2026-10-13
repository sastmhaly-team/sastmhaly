'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { User, Branch, UserRole } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { exportToCsv } from '@/lib/export/csv';
import { 
  UserCog, Plus, Search, Download, 
  Shield, CheckCircle2, Building2, Mail, Phone, Lock, AlertCircle,
  Pencil, Trash2, Monitor, Check
} from 'lucide-react';

export default function EmployeesManagementPage() {
  const { tenant, user, activeBranchId } = useAuth();
  const { t, isRtl, lang } = useLanguage();
  const tenantId = user?.tenant_id || tenant?.id || '';
  const effectiveBranchId = activeBranchId && activeBranchId !== 'all' ? activeBranchId : user?.branch_id;

  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'cashier' as UserRole,
    branch_id: effectiveBranchId || '',
    password: ''
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  const fetchData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `/api/merchant/employees?tenantId=${tenantId}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`;
      const [empRes, brRes] = await Promise.all([
        fetch(url),
        fetch(`/api/merchant/branches?tenantId=${tenantId}`)
      ]);
      const empData = await empRes.json();
      const brData = await brRes.json();

      if (empData.users) setEmployees(empData.users);
      if (brData.branches) {
        setBranches(brData.branches);
        if (!newEmployee.branch_id && brData.branches.length > 0) {
          setNewEmployee(prev => ({ ...prev, branch_id: effectiveBranchId || brData.branches[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, effectiveBranchId]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
    setNewEmployee(prev => ({ ...prev, phone: cleaned }));
    if (errorMsg) setErrorMsg('');
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newEmployee.phone.length !== 11) {
      setErrorMsg(
        lang === 'ar'
          ? 'رقم هاتف الموظف يجب أن يتكون من 11 رقماً بالضبط (مثال: 01012345678)'
          : 'Employee phone number must be exactly 11 digits'
      );
      return;
    }

    if (!newEmployee.password) {
      setErrorMsg(lang === 'ar' ? 'كلمة المرور مطلوبة لتسجيل الدخول' : 'Password is required');
      return;
    }

    setSubmittingUser(true);
    try {
      const res = await fetch('/api/merchant/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...newEmployee
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddModalOpen(false);
        setNewEmployee({
          username: '',
          full_name: '',
          email: '',
          phone: '',
          role: 'cashier',
          branch_id: effectiveBranchId || branches[0]?.id || '',
          password: ''
        });
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to create employee');
      }
    } catch {
      setErrorMsg('Failed to create employee');
    } finally {
      setSubmittingUser(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.phone && e.phone.includes(searchTerm))
  );

  // Edit Employee Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'cashier' as UserRole,
    branch_id: '',
    password: ''
  });
  const [updatingUser, setUpdatingUser] = useState(false);

  const getRolePermissionInfo = (role: string) => {
    switch (role) {
      case 'cashier':
        return {
          titleAr: 'كاشير نقاط البيع (POS)',
          titleEn: 'POS Cashier',
          screenAr: 'شاشة نقطة البيع (POS) فقط (/merchant/pos)',
          screenEn: 'POS Screen Only (/merchant/pos)',
          descAr: 'تفتح له شاشة نقطة البيع حصراً فور تسجيل الدخول، ولا يرى أي قوائم أخرى في المنظومة، ومحجوب عنه لوحة التحكم والإعدادات والتقارير.',
          descEn: 'Only opens POS screen upon login. All other system menus, dashboard, settings, and reports are hidden.',
          allowedScreens: ['نقطة البيع (POS)', 'إصدار الفواتير', 'الباركود والميزان'],
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'inventory_manager':
        return {
          titleAr: 'أمين مخزن ومشتريات',
          titleEn: 'Inventory & Purchasing',
          screenAr: 'شاشات المخزون والمنتجات والموردين',
          screenEn: 'Inventory, Products & Suppliers',
          descAr: 'مسموح له فقط بإدارة الكتالوج، المخزون، الشحنات والتوريدات، وأوامر الشراء والموردين.',
          descEn: 'Allowed to access catalog, inventory balances, batch tracking, purchase orders and suppliers.',
          allowedScreens: ['المنتجات', 'أرصدة المخزون', 'التشغيلات والصلاحيات', 'التحويلات', 'المشتريات', 'الموردين'],
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'accountant':
        return {
          titleAr: 'محاسب مالي',
          titleEn: 'Financial Accountant',
          screenAr: 'شاشات المالية والتقارير والمبيعات',
          screenEn: 'Finance, Reports & Sales',
          descAr: 'مسموح له بالوصول إلى المبيعات، العملاء والديون، المصروفات، القيود المحاسبية، والتقارير التحليلية.',
          descEn: 'Allowed to access sales, customer ledgers, expense tracking, journal entries, and financial reports.',
          allowedScreens: ['سجل المبيعات', 'العملاء والديون', 'المصروفات', 'الحسابات المالية', 'التقارير التحليلية'],
          badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200'
        };
      case 'branch_manager':
        return {
          titleAr: 'مدير فرع',
          titleEn: 'Branch Manager',
          screenAr: 'عمليات الفرع (نقطة البيع، المبيعات، المخزون، المصروفات)',
          screenEn: 'Branch Operations (POS, Sales, Stock, Expenses)',
          descAr: 'صلاحيات تشغيلية لإدارة الفرع ونقاط البيع ومخزون ومصروفات الفرع.',
          descEn: 'Operational permissions for branch POS, local stock, sales, and branch expenses.',
          allowedScreens: ['لوحة الفرع', 'نقاط البيع', 'مخزون الفرع', 'المبيعات', 'العملاء', 'المصروفات', 'التقارير'],
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      default:
        return {
          titleAr: 'مالك المتجر',
          titleEn: 'Merchant Owner',
          screenAr: 'كافة شاشات وأقسام المتجر',
          screenEn: 'All Merchant Screens',
          descAr: 'صلاحيات كاملة على كافة المبيعات والمخازن والإعدادات والموظفين.',
          descEn: 'Full administrative access.',
          allowedScreens: ['كافة الشاشات'],
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200'
        };
    }
  };

  const handleOpenEdit = (emp: User) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      phone: emp.phone || emp.username,
      role: emp.role,
      branch_id: emp.branch_id || (branches[0]?.id || ''),
      password: ''
    });
    setErrorMsg('');
    setEditModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !tenantId) return;
    setErrorMsg('');

    if (editForm.phone.length !== 11) {
      setErrorMsg(
        lang === 'ar'
          ? 'رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط (مثال: 01012345678)'
          : 'Phone number must be exactly 11 digits'
      );
      return;
    }

    setUpdatingUser(true);
    try {
      const res = await fetch('/api/merchant/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEmployee.id,
          tenant_id: tenantId,
          ...editForm
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditModalOpen(false);
        setEditingEmployee(null);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to update employee');
      }
    } catch {
      setErrorMsg('Failed to update employee');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteEmployee = async (emp: User) => {
    if (!confirm(lang === 'ar' ? `هل أنت متأكد من حذف حساب الموظف "${emp.full_name}"؟` : `Are you sure you want to delete "${emp.full_name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/merchant/employees?id=${emp.id}&tenantId=${tenantId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete employee');
      }
    } catch {
      alert('Failed to delete employee');
    }
  };

  const exportEmployeesCsv = () => {
    const headers = [
      { key: 'full_name', labelEn: 'Full Name', labelAr: 'الاسم بالكامل' },
      { key: 'username', labelEn: 'Username / Phone', labelAr: 'رقم الهاتف / المستخدم' },
      { key: 'phone', labelEn: 'Phone', labelAr: 'رقم الهاتف' },
      { key: 'role', labelEn: 'Role', labelAr: 'الدور الوظيفي' },
      { key: 'email', labelEn: 'Email', labelAr: 'البريد الإلكتروني' }
    ];
    exportToCsv(`sastmhaly_employees_${Date.now()}`, employees, headers, isRtl);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">مدير منصة</span>;
      case 'merchant_owner':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">مالك المتجر</span>;
      case 'branch_manager':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">مدير فرع</span>;
      case 'cashier':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">كاشير POS</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {isRtl ? 'إدارة الموظفين والكاشير وصلاحيات الوصول' : 'Staff, Cashiers & User Access'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {isRtl ? 'إنشاء حسابات الموظفين برقم الهاتف وكلمة المرور وتعيين الفروع وصلاحيات نقاط البيع' : 'Manage user accounts, assign 11-digit phone credentials, branch assignments, and roles'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportEmployeesCsv}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#E5EAF2] hover:bg-[#F7F9FC] text-[#172033] rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#246BFD]" />
            <span>{isRtl ? 'تصدير (CSV)' : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg('');
              setAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'إضافة موظف جديد' : 'Add Employee'}</span>
          </button>
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
            placeholder={isRtl ? 'بحث باسم الموظف أو رقم الهاتف...' : 'Search by staff name or phone...'}
            className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'جاري تحميل الموظفين...' : 'Loading staff accounts...'}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#687386]">
            {isRtl ? 'لا يوجد موظفون مسجلون حالياً' : 'No staff accounts found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الموظف' : 'Employee'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'رقم الهاتف (لتسجيل الدخول)' : 'Phone (Login)'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الدور والصلاحيات المسموحة' : 'Role & Screen Access'}</th>
                  <th className="py-3 px-4 text-start">{isRtl ? 'الفرع المخصص' : 'Branch'}</th>
                  <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredEmployees.map((emp) => {
                  const branchObj = branches.find(b => b.id === emp.branch_id);
                  const permInfo = getRolePermissionInfo(emp.role);
                  return (
                    <tr key={emp.id} className="hover:bg-[#F7F9FC] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-[#246BFD] flex items-center justify-center font-bold text-xs shrink-0">
                            {emp.full_name ? emp.full_name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-[#0B1730]">{emp.full_name}</p>
                            <p className="text-[11px] text-[#687386]">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                        {emp.phone || emp.username}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {getRoleBadge(emp.role)}
                          <p className="text-[10px] text-[#687386] flex items-center gap-1 mt-0.5">
                            <Monitor className="w-3 h-3 text-[#246BFD] shrink-0" />
                            <span>{isRtl ? permInfo.screenAr : permInfo.screenEn}</span>
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#172033]">
                        {branchObj ? (isRtl ? branchObj.name_ar : branchObj.name_en) : (isRtl ? 'جميع الفروع (مركزي)' : 'All Branches')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'نشط' : 'Active'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#246BFD] hover:bg-blue-50 transition-colors cursor-pointer"
                            title={isRtl ? 'تعديل الصلاحيات والحساب' : 'Edit Account & Permissions'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title={isRtl ? 'حذف الحساب' : 'Delete Account'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal (Enforcing 11-digit phone and password) */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={isRtl ? 'إضافة موظف وتحديد صلاحياته' : 'Add Employee & Permissions'}
        size="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم الموظف بالكامل *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={isRtl ? 'أحمد كمال' : 'Ahmed Kamal'}
                value={newEmployee.full_name}
                onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-semibold">
                  {isRtl ? 'رقم الهاتف (11 رقماً للدخول) *' : 'Phone Number (11 digits) *'}
                </label>
                <span className={`text-[10px] font-mono font-bold ${newEmployee.phone.length === 11 ? 'text-[#10B981]' : 'text-[#687386]'}`}>
                  {newEmployee.phone.length}/11
                </span>
              </div>
              <input
                type="tel"
                required
                placeholder="01012345678"
                value={newEmployee.phone}
                onChange={handlePhoneChange}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'كلمة المرور الأولية *' : 'Password *'}
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الدور الوظيفي والصلاحيات *' : 'Role & Permissions *'}
              </label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as UserRole })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cashier">{isRtl ? 'كاشير (POS فقط - شاشة الكاشير حصراً)' : 'Cashier (POS Only)'}</option>
                <option value="branch_manager">{isRtl ? 'مدير فرع (مبيعات ومخزون الفرع)' : 'Branch Manager'}</option>
                <option value="inventory_manager">{isRtl ? 'أمين مخزن ومشتريات' : 'Inventory & Purchasing'}</option>
                <option value="accountant">{isRtl ? 'محاسب مالي' : 'Accountant'}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الفرع المخصص *' : 'Assigned Branch *'}
              </label>
              <select
                value={newEmployee.branch_id}
                onChange={(e) => setNewEmployee({ ...newEmployee, branch_id: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{isRtl ? b.name_ar : b.name_en} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Permission Scope Preview Card */}
            {(() => {
              const info = getRolePermissionInfo(newEmployee.role);
              return (
                <div className="col-span-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5 mt-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0B1730]">
                    <Monitor className="w-3.5 h-3.5 text-[#246BFD]" />
                    <span>{isRtl ? 'الشاشة التي تفتح له فور الدخول:' : 'Opening Screen Upon Login:'}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${info.badgeBg}`}>
                      {isRtl ? info.screenAr : info.screenEn}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {isRtl ? info.descAr : info.descEn}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {info.allowedScreens.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-700 font-medium shadow-2xs">
                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submittingUser}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submittingUser ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء حساب الموظف' : 'Create Account')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isRtl ? 'تعديل صلاحيات وحساب الموظف' : 'Edit Employee & Permissions'}
        size="md"
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم الموظف بالكامل *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-semibold">
                  {isRtl ? 'رقم الهاتف (11 رقماً للدخول) *' : 'Phone Number (11 digits) *'}
                </label>
                <span className={`text-[10px] font-mono font-bold ${editForm.phone.length === 11 ? 'text-[#10B981]' : 'text-[#687386]'}`}>
                  {editForm.phone.length}/11
                </span>
              </div>
              <input
                type="tel"
                required
                value={editForm.phone}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setEditForm(prev => ({ ...prev, phone: cleaned }));
                }}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'كلمة المرور الجديدة (اختياري)' : 'New Password (Optional)'}
              </label>
              <input
                type="password"
                placeholder={isRtl ? 'اتركه فارغاً للإبقاء على الحالية' : 'Leave empty to keep current'}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الدور الوظيفي والصلاحيات *' : 'Role & Permissions *'}
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cashier">{isRtl ? 'كاشير (POS فقط - شاشة الكاشير حصراً)' : 'Cashier (POS Only)'}</option>
                <option value="branch_manager">{isRtl ? 'مدير فرع (مبيعات ومخزون الفرع)' : 'Branch Manager'}</option>
                <option value="inventory_manager">{isRtl ? 'أمين مخزن ومشتريات' : 'Inventory & Purchasing'}</option>
                <option value="accountant">{isRtl ? 'محاسب مالي' : 'Accountant'}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الفرع المخصص *' : 'Assigned Branch *'}
              </label>
              <select
                value={editForm.branch_id}
                onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{isRtl ? b.name_ar : b.name_en} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Permission Scope Preview Card for Editing */}
            {(() => {
              const info = getRolePermissionInfo(editForm.role);
              return (
                <div className="col-span-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5 mt-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0B1730]">
                    <Monitor className="w-3.5 h-3.5 text-[#246BFD]" />
                    <span>{isRtl ? 'الشاشة التي تفتح له فور الدخول:' : 'Opening Screen Upon Login:'}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${info.badgeBg}`}>
                      {isRtl ? info.screenAr : info.screenEn}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {isRtl ? info.descAr : info.descEn}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {info.allowedScreens.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-700 font-medium shadow-2xs">
                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={updatingUser}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {updatingUser ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ التعديلات' : 'Save Changes')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
