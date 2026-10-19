'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { 
  User, Branch, UserRole, 
  AttendanceRecord, AttendanceStatus, 
  EmployeeAdjustment, AdjustmentType, 
  PayrollRecord 
} from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Users, UserCheck, UserX, Clock, Calendar, DollarSign, Wallet, 
  FileText, CheckCircle2, AlertCircle, Printer, TrendingUp, Plus, 
  Search, Shield, Building2, Phone, Lock, Pencil, Trash2, Monitor, 
  Check, ChevronLeft, ChevronRight, RefreshCw, CreditCard, 
  ArrowDownRight, ArrowUpRight, Award, AlertTriangle, Briefcase
} from 'lucide-react';

export default function EmployeesManagementPage() {
  const { tenant, user, activeBranchId } = useAuth();
  const { t, isRtl, lang } = useLanguage();
  const confirm = useConfirm();
  const tenantId = user?.tenant_id || tenant?.id || '';
  const effectiveBranchId = activeBranchId && activeBranchId !== 'all' ? activeBranchId : user?.branch_id;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'payroll' | 'adjustments'>('directory');

  // Shared Data
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab 1: Staff Directory state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);

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
    password: '',
    job_title: 'كاشير نقاط البيع',
    base_salary: 4000,
    salary_type: 'monthly',
    daily_hours: 8,
    shift_name: 'الوردية الصباحية',
    hire_date: new Date().toISOString().split('T')[0],
    national_id: ''
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // Edit Employee Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'cashier' as UserRole,
    branch_id: '',
    password: '',
    job_title: '',
    base_salary: 0,
    salary_type: 'monthly',
    daily_hours: 8,
    shift_name: '',
    hire_date: '',
    national_id: ''
  });
  const [updatingUser, setUpdatingUser] = useState(false);

  // Tab 2: Attendance state
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendanceId, setSavingAttendanceId] = useState<string | null>(null);

  // Tab 3: Payroll state
  const [payrollMonth, setPayrollMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [generatingPayroll, setGeneratingPayroll] = useState(false);
  
  // Pay Out Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'bank' | 'wallet'>('cash');
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [submittingPay, setSubmittingPay] = useState(false);

  // Payslip Modal
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipData, setPayslipData] = useState<PayrollRecord | null>(null);

  // Tab 4: Adjustments (Advances, Bonuses, Deductions)
  const [adjustments, setAdjustments] = useState<EmployeeAdjustment[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [adjTypeFilter, setAdjTypeFilter] = useState<string>('all');
  const [addAdjModalOpen, setAddAdjModalOpen] = useState(false);
  const [newAdj, setNewAdj] = useState({
    user_id: '',
    type: 'advance' as AdjustmentType,
    amount: 500,
    date: new Date().toISOString().split('T')[0],
    month: payrollMonth,
    reason: '',
  });
  const [submittingAdj, setSubmittingAdj] = useState(false);

  // Fetch initial core staff data
  const fetchData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    try {
      const empUrl = `/api/merchant/employees?tenantId=${tenantId}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`;
      const brUrl = `/api/merchant/branches?tenantId=${tenantId}`;

      const cachedEmp = getCachedData<any>(empUrl);
      const cachedBr = getCachedData<any>(brUrl);
      if (cachedEmp?.users) setEmployees(cachedEmp.users);
      if (cachedBr?.branches) setBranches(cachedBr.branches);

      await Promise.all([
        fetchWithCache<any>(empUrl, (empData) => {
          if (empData.users) setEmployees(empData.users);
        }),
        fetchWithCache<any>(brUrl, (brData) => {
          if (brData.branches) {
            setBranches(brData.branches);
            if (!newEmployee.branch_id && brData.branches.length > 0) {
              setNewEmployee(prev => ({ ...prev, branch_id: effectiveBranchId || brData.branches[0].id }));
            }
          }
        }),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, effectiveBranchId]);

  // Fetch Attendance records for selected date
  const fetchAttendance = async () => {
    if (!tenantId) return;
    setLoadingAttendance(true);
    try {
      const res = await fetch(`/api/merchant/attendance?tenantId=${tenantId}&date=${attendanceDate}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`);
      const data = await res.json();
      setAttendanceRecords(data.attendance || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendance();
    }
  }, [tenantId, attendanceDate, effectiveBranchId, activeTab]);

  // Fetch Payroll records for selected month
  const fetchPayroll = async () => {
    if (!tenantId) return;
    setLoadingPayroll(true);
    try {
      const res = await fetch(`/api/merchant/payroll?tenantId=${tenantId}&month=${payrollMonth}${effectiveBranchId ? `&branchId=${effectiveBranchId}` : ''}`);
      const data = await res.json();
      setPayrollRecords(data.payroll || []);
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'payroll') {
      fetchPayroll();
    }
  }, [tenantId, payrollMonth, effectiveBranchId, activeTab]);

  // Fetch Adjustments (Advances, Bonuses, Deductions)
  const fetchAdjustments = async () => {
    if (!tenantId) return;
    setLoadingAdjustments(true);
    try {
      const res = await fetch(`/api/merchant/adjustments?tenantId=${tenantId}&month=${payrollMonth}`);
      const data = await res.json();
      setAdjustments(data.adjustments || []);
    } catch (err) {
      console.error('Error fetching adjustments:', err);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'adjustments' || activeTab === 'payroll') {
      fetchAdjustments();
    }
  }, [tenantId, payrollMonth, activeTab]);

  // Helper: Role Info
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
      case 'inventory_manager':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">أمين مخزن</span>;
      case 'accountant':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">محاسب</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">{role}</span>;
    }
  };

  // KPI Calculations
  const totalEmployeesCount = employees.length;
  
  // Attendance metrics for selected date
  const presentTodayCount = attendanceRecords.filter(a => a.status === 'present').length;
  const lateTodayCount = attendanceRecords.filter(a => a.status === 'late').length;
  const absentTodayCount = attendanceRecords.filter(a => a.status === 'absent').length;
  const leaveTodayCount = attendanceRecords.filter(a => a.status === 'excused' || a.status === 'half_day').length;

  // Payroll metrics
  const totalMonthlyPayrollAmount = payrollRecords.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
  const totalPaidPayrollAmount = payrollRecords.filter(p => p.status === 'paid').reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
  const totalAdvancesAmount = adjustments.filter(a => a.type === 'advance').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Form Handlers
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
          password: '',
          job_title: 'كاشير نقاط البيع',
          base_salary: 4000,
          salary_type: 'monthly',
          daily_hours: 8,
          shift_name: 'الوردية الصباحية',
          hire_date: new Date().toISOString().split('T')[0],
          national_id: ''
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

  const handleOpenEdit = (emp: User) => {
    setEditingEmployee(emp);
    setEditForm({
      full_name: emp.full_name,
      phone: emp.phone || emp.username,
      role: emp.role,
      branch_id: emp.branch_id || (branches[0]?.id || ''),
      password: '',
      job_title: emp.job_title || '',
      base_salary: emp.base_salary || 0,
      salary_type: emp.salary_type || 'monthly',
      daily_hours: emp.daily_hours || 8,
      shift_name: emp.shift_name || 'الوردية الصباحية',
      hire_date: emp.hire_date || '',
      national_id: emp.national_id || ''
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
    const msg = lang === 'ar' 
      ? `هل أنت متأكد من حذف حساب الموظف "${emp.full_name}"؟ سيتم حذف بيانات دخوله وسجلاته.` 
      : `Are you sure you want to delete "${emp.full_name}"?`;
    const ok = await confirm(msg);
    if (!ok) return;

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

  // Quick Attendance Actions
  const handleSetAttendanceStatus = async (
    emp: User, 
    status: AttendanceStatus, 
    checkIn?: string, 
    checkOut?: string
  ) => {
    if (!tenantId) return;
    setSavingAttendanceId(emp.id);

    const existing = attendanceRecords.find(a => a.user_id === emp.id);
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const newCheckIn = checkIn !== undefined ? checkIn : (existing?.check_in_time || (status === 'present' ? nowTime : undefined));
    const newCheckOut = checkOut !== undefined ? checkOut : existing?.check_out_time;

    try {
      const res = await fetch('/api/merchant/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existing?.id,
          tenant_id: tenantId,
          branch_id: emp.branch_id || effectiveBranchId,
          user_id: emp.id,
          date: attendanceDate,
          status,
          check_in_time: newCheckIn,
          check_out_time: newCheckOut,
          notes: existing?.notes,
        })
      });
      const data = await res.json();
      if (data.success && data.record) {
        setAttendanceRecords(prev => {
          const idx = prev.findIndex(a => a.user_id === emp.id);
          const fullRecord = {
            ...data.record,
            user_name: emp.full_name,
            user_phone: emp.phone || emp.username
          };
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = fullRecord;
            return updated;
          }
          return [fullRecord, ...prev];
        });
      }
    } catch (e) {
      console.error('Error updating attendance:', e);
    } finally {
      setSavingAttendanceId(null);
    }
  };

  const handleCheckInNow = (emp: User) => {
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    handleSetAttendanceStatus(emp, 'present', nowTime);
  };

  const handleCheckOutNow = (emp: User) => {
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const existing = attendanceRecords.find(a => a.user_id === emp.id);
    handleSetAttendanceStatus(emp, existing?.status || 'present', existing?.check_in_time, nowTime);
  };

  // Generate Monthly Payroll
  const handleGeneratePayroll = async () => {
    if (!tenantId) return;
    const ok = await confirm(
      isRtl 
        ? `هل تريد احتساب وتحديث مسير رواتب شهر (${payrollMonth}) بناءً على سجلات الحضور والسلف والمكافآت؟` 
        : `Generate payroll for month (${payrollMonth})?`
    );
    if (!ok) return;

    setGeneratingPayroll(true);
    try {
      const res = await fetch('/api/merchant/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          tenant_id: tenantId,
          month: payrollMonth,
          branch_id: effectiveBranchId,
        })
      });
      const data = await res.json();
      if (data.success && data.payroll) {
        setPayrollRecords(data.payroll);
      } else {
        alert(data.error || 'Failed to generate payroll');
      }
    } catch (e) {
      alert('Failed to generate payroll');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  // Submit Salary Pay Out
  const handleConfirmPayOut = async () => {
    if (!selectedPayroll || !tenantId) return;
    setSubmittingPay(true);
    try {
      const res = await fetch('/api/merchant/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          id: selectedPayroll.id,
          tenant_id: tenantId,
          payment_method: payMethod,
          record_expense: autoRecordExpense,
        })
      });
      const data = await res.json();
      if (data.success && data.record) {
        setPayrollRecords(prev => prev.map(p => p.id === selectedPayroll.id ? { ...p, ...data.record } : p));
        setPayModalOpen(false);
        setSelectedPayroll(null);
      } else {
        alert(data.error || 'Failed to process payout');
      }
    } catch {
      alert('Failed to process payout');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Print Official Payslip via #print-mount
  // Print Official Payslip via #print-mount (Pure printable document without buttons)
  const handlePrintPayslip = () => {
    if (!payslipData) return;
    let mount = document.getElementById('print-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'print-mount';
      document.body.appendChild(mount);
    }
    mount.className = 'document-mode';
    mount.setAttribute('dir', 'rtl');

    // Build the pure official payslip document - guaranteed 0 buttons
    mount.innerHTML = `
      <div style="font-family: Cairo, system-ui, -apple-system, sans-serif; direction: rtl; padding: 24px 30px; color: #0B1730; background: #fff; max-width: 750px; margin: 0 auto; box-sizing: border-box;">
        <!-- Header / Store Info -->
        <div style="text-align: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: #0B1730;">${tenant?.name || 'سوبر ماركت / المتجر'}</h1>
          <p style="font-size: 13px; color: #64748B; margin: 5px 0 0; font-weight: 600;">قسيمة استلام راتب ومستحقات شهرية</p>
          <div style="display: inline-block; background: #EFF6FF; color: #246BFD; font-weight: 800; padding: 4px 14px; border-radius: 6px; margin-top: 8px; font-size: 13px; border: 1px solid #BFDBFE;">
            شهر: ${payslipData.month}
          </div>
        </div>

        <!-- Employee Details Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px;">
          <div>
            <span style="font-size: 11px; color: #64748B; display: block; font-weight: 600;">اسم الموظف:</span>
            <strong style="font-size: 15px; color: #0F172A;">${payslipData.user_name}</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: #64748B; display: block; font-weight: 600;">المسمى الوظيفي:</span>
            <strong style="font-size: 15px; color: #334155;">${payslipData.job_title}</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: #64748B; display: block; font-weight: 600;">أيام الحضور الفعلي:</span>
            <strong style="font-size: 14px; color: #16A34A;">${payslipData.attended_days} يوم</strong>
          </div>
          <div>
            <span style="font-size: 11px; color: #64748B; display: block; font-weight: 600;">أيام الغياب:</span>
            <strong style="font-size: 14px; color: #DC2626;">${payslipData.absent_days} يوم</strong>
          </div>
        </div>

        <!-- Financial Breakdown Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
              <th style="padding: 11px 16px; text-align: right; color: #475569; font-weight: 700;">البند المالي</th>
              <th style="padding: 11px 16px; text-align: left; color: #475569; font-weight: 700;">المبلغ (${tenant?.currency || 'ج.م'})</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 11px 16px; color: #334155;">الراتب الأساسي</td>
              <td style="padding: 11px 16px; text-align: left; font-weight: 700; color: #0F172A;">${Number(payslipData.base_salary).toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0; color: #16A34A; background: #F0FDF4;">
              <td style="padding: 11px 16px;">المكافآت والبدلات (+)</td>
              <td style="padding: 11px 16px; text-align: left; font-weight: 700;">+${Number(payslipData.total_bonuses).toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0; color: #DC2626; background: #FEF2F2;">
              <td style="padding: 11px 16px;">الخصومات والجزاءات (-)</td>
              <td style="padding: 11px 16px; text-align: left; font-weight: 700;">-${Number(payslipData.total_deductions).toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #E2E8F0; color: #D97706; background: #FFFBEB;">
              <td style="padding: 11px 16px;">السلف المستردة (-)</td>
              <td style="padding: 11px 16px; text-align: left; font-weight: 700;">-${Number(payslipData.total_advances).toLocaleString()}</td>
            </tr>
            <tr style="background: #EFF6FF; border-top: 2px solid #93C5FD; font-size: 16px; font-weight: 800; color: #1D4ED8;">
              <td style="padding: 13px 16px;">صافي الراتب المستلم (=)</td>
              <td style="padding: 13px 16px; text-align: left;">${Number(payslipData.net_salary).toLocaleString()} ${tenant?.currency || 'ج.م'}</td>
            </tr>
          </tbody>
        </table>

        <!-- Official Signatures -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; margin-top: 45px; font-size: 13px; color: #475569;">
          <div>
            <p style="margin: 0 0 45px; font-weight: 600;">توقيع الإدارة / المحاسب</p>
            <div style="border-top: 1px dashed #94A3B8; width: 65%; margin: 0 auto;"></div>
          </div>
          <div>
            <p style="margin: 0 0 45px; font-weight: 600;">توقيع واستلام الموظف</p>
            <div style="border-top: 1px dashed #94A3B8; width: 65%; margin: 0 auto;"></div>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      window.print();
    }, 50);
  };


  // Create Adjustment (Advance, Bonus, Deduction)
  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newAdj.user_id || !newAdj.amount || !newAdj.reason) return;

    setSubmittingAdj(true);
    try {
      const res = await fetch('/api/merchant/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          branch_id: effectiveBranchId,
          ...newAdj,
          month: newAdj.date.substring(0, 7),
        })
      });
      const data = await res.json();
      if (data.success && data.adjustment) {
        const emp = employees.find(u => u.id === newAdj.user_id);
        setAdjustments(prev => [{ ...data.adjustment, user_name: emp?.full_name || 'موظف' }, ...prev]);
        setAddAdjModalOpen(false);
        setNewAdj({
          user_id: employees[0]?.id || '',
          type: 'advance',
          amount: 500,
          date: new Date().toISOString().split('T')[0],
          month: payrollMonth,
          reason: '',
        });
      } else {
        alert(data.error || 'Failed to create adjustment');
      }
    } catch {
      alert('Failed to create adjustment');
    } finally {
      setSubmittingAdj(false);
    }
  };

  const handleDeleteAdjustment = async (adj: EmployeeAdjustment) => {
    const ok = await confirm(
      isRtl ? `هل أنت متأكد من حذف هذا القيد (${adj.reason}) بمبلغ ${adj.amount} ج.م؟` : `Delete adjustment?`
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/merchant/adjustments?id=${adj.id}&tenantId=${tenantId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setAdjustments(prev => prev.filter(a => a.id !== adj.id));
      }
    } catch {
      alert('Failed to delete adjustment');
    }
  };

  // Filtered employees for Tab 1
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.job_title && e.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.phone && e.phone.includes(searchTerm));
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    const dateStr = (e as any).created_at ? (e as any).created_at.split('T')[0] : '';
    const matchesDate = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
    return matchesSearch && matchesRole && matchesDate;
  });

  // Filtered adjustments for Tab 4
  const filteredAdjustments = adjustments.filter(a => {
    const matchesType = adjTypeFilter === 'all' || a.type === adjTypeFilter;
    return matchesType;
  });

  // Export Headers
  const employeeExportHeaders = [
    { key: 'full_name', labelEn: 'Full Name', labelAr: 'الاسم بالكامل' },
    { key: 'job_title', labelEn: 'Job Title', labelAr: 'المسمى الوظيفي' },
    { key: 'phone', labelEn: 'Phone', labelAr: 'رقم الهاتف' },
    { key: 'role', labelEn: 'Role', labelAr: 'الدور الوظيفي' },
    { key: 'base_salary', labelEn: 'Base Salary', labelAr: 'الراتب الأساسي' },
    { key: 'shift_name', labelEn: 'Shift', labelAr: 'الوردية' },
    { key: 'created_at', labelEn: 'Hire Date', labelAr: 'تاريخ التسجيل' },
  ];

  const attendanceExportHeaders = [
    { key: 'user_name', labelEn: 'Employee Name', labelAr: 'اسم الموظف' },
    { key: 'date', labelEn: 'Date', labelAr: 'التاريخ' },
    { key: 'status', labelEn: 'Status', labelAr: 'الحالة' },
    { key: 'check_in_time', labelEn: 'Check In', labelAr: 'وقت الحضور' },
    { key: 'check_out_time', labelEn: 'Check Out', labelAr: 'وقت الانصراف' },
    { key: 'total_hours', labelEn: 'Total Hours', labelAr: 'إجمالي الساعات' },
    { key: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات' },
  ];

  const payrollExportHeaders = [
    { key: 'user_name', labelEn: 'Employee Name', labelAr: 'اسم الموظف' },
    { key: 'job_title', labelEn: 'Job Title', labelAr: 'المسمى الوظيفي' },
    { key: 'month', labelEn: 'Month', labelAr: 'الشهر' },
    { key: 'base_salary', labelEn: 'Base Salary', labelAr: 'الراتب الأساسي' },
    { key: 'attended_days', labelEn: 'Attended Days', labelAr: 'أيام الحضور' },
    { key: 'absent_days', labelEn: 'Absent Days', labelAr: 'أيام الغياب' },
    { key: 'total_bonuses', labelEn: 'Bonuses (+)', labelAr: 'المكافآت والبدلات' },
    { key: 'total_deductions', labelEn: 'Deductions (-)', labelAr: 'الخصومات' },
    { key: 'total_advances', labelEn: 'Advances (-)', labelAr: 'السلف المستردة' },
    { key: 'net_salary', labelEn: 'Net Salary', labelAr: 'صافي الراتب المستحق' },
    { key: 'status', labelEn: 'Status', labelAr: 'حالة الصرف' },
    { key: 'payment_method', labelEn: 'Payment Method', labelAr: 'طريقة الصرف' },
  ];

  const adjustmentsExportHeaders = [
    { key: 'user_name', labelEn: 'Employee Name', labelAr: 'اسم الموظف' },
    { key: 'type', labelEn: 'Type', labelAr: 'النوع' },
    { key: 'amount', labelEn: 'Amount', labelAr: 'المبلغ' },
    { key: 'date', labelEn: 'Date', labelAr: 'التاريخ' },
    { key: 'month', labelEn: 'Month', labelAr: 'الشهر المالي' },
    { key: 'reason', labelEn: 'Reason', labelAr: 'السبب والبيان' },
    { key: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  ];

  // Helper date shift
  const shiftAttendanceDay = (days: number) => {
    const current = new Date(attendanceDate);
    current.setDate(current.getDate() + days);
    setAttendanceDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#246BFD] to-[#5089FF] text-white flex items-center justify-center shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0B1730]">
                {isRtl ? 'نظام إدارة الموارد البشرية وشؤون الموظفين' : 'HR, Attendance & Payroll Suite'}
              </h2>
              <p className="text-xs text-[#687386] mt-0.5">
                {isRtl 
                  ? 'منظومة متكاملة لمتابعة الحضور والانصراف، احتساب المرتبات ومسير الرواتب، السلف والمكافآت والصلاحيات' 
                  : 'Complete system for daily attendance, shifts, automated payroll calculations, advances, and permissions'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action / Export based on active tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'directory' && (
            <>
              <ExportButton
                filename="Staff_Directory"
                data={filteredEmployees}
                headers={employeeExportHeaders}
                label={isRtl ? 'تصدير الموظفين' : 'Export Staff'}
              />
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
            </>
          )}

          {activeTab === 'attendance' && (
            <ExportButton
              filename={`Attendance_${attendanceDate}`}
              data={attendanceRecords}
              headers={attendanceExportHeaders}
              label={isRtl ? 'تصدير كشف الحضور' : 'Export Attendance'}
            />
          )}

          {activeTab === 'payroll' && (
            <>
              <ExportButton
                filename={`Payroll_${payrollMonth}`}
                data={payrollRecords}
                headers={payrollExportHeaders}
                label={isRtl ? 'تصدير مسير الرواتب' : 'Export Payroll'}
              />
              <button
                onClick={handleGeneratePayroll}
                disabled={generatingPayroll}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${generatingPayroll ? 'animate-spin' : ''}`} />
                <span>{generatingPayroll ? (isRtl ? 'جاري الاحتساب...' : 'Calculating...') : (isRtl ? 'احتساب رواتب الشهر' : 'Generate Payroll')}</span>
              </button>
            </>
          )}

          {activeTab === 'adjustments' && (
            <>
              <ExportButton
                filename={`Adjustments_${payrollMonth}`}
                data={filteredAdjustments}
                headers={adjustmentsExportHeaders}
                label={isRtl ? 'تصدير السلف والمكافآت' : 'Export Adjustments'}
              />
              <button
                onClick={() => {
                  if (employees.length > 0 && !newAdj.user_id) {
                    setNewAdj(prev => ({ ...prev, user_id: employees[0].id }));
                  }
                  setAddAdjModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isRtl ? 'إضافة سلفة أو مكافأة أو خصم' : 'Add Adjustment'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#687386] mb-1">
            <span className="text-xs font-medium">{isRtl ? 'إجمالي الموظفين' : 'Total Staff'}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#246BFD] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#0B1730]">{totalEmployeesCount}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{isRtl ? 'نشطين بالمتجر' : 'Active'}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#687386] mb-1">
            <span className="text-xs font-medium">{isRtl ? 'حضور اليوم' : 'Present Today'}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-600">{presentTodayCount}</span>
            {lateTodayCount > 0 && (
              <span className="text-[10px] text-amber-600 font-medium">({lateTodayCount} {isRtl ? 'متأخر' : 'late'})</span>
            )}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#687386] mb-1">
            <span className="text-xs font-medium">{isRtl ? 'غياب وإجازات' : 'Absent / On Leave'}</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-red-600">{absentTodayCount}</span>
            {leaveTodayCount > 0 && (
              <span className="text-[10px] text-blue-600 font-medium">({leaveTodayCount} {isRtl ? 'إجازة' : 'leave'})</span>
            )}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between text-[#687386] mb-1">
            <span className="text-xs font-medium">{isRtl ? 'مسير رواتب الشهر' : 'Month Payroll'}</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#0B1730]">
              {totalMonthlyPayrollAmount.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#687386]">{tenant?.currency || 'ج.م'}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E5EAF2] shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#687386] mb-1">
            <span className="text-xs font-medium">{isRtl ? 'إجمالي السلف النشطة' : 'Active Advances'}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-amber-600">
              {totalAdvancesAmount.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#687386]">{tenant?.currency || 'ج.م'}</span>
          </div>
        </div>
      </div>

      {/* Main HR Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#F4F6F9] rounded-xl border border-[#E5EAF2] text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'directory'
              ? 'bg-white text-[#246BFD] shadow-xs'
              : 'text-[#687386] hover:text-[#0B1730] hover:bg-white/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isRtl ? 'دليل الموظفين والرواتب الأساسية' : 'Staff Directory & Salaries'}</span>
          <span className="px-1.5 py-0.2 bg-blue-100/60 text-[#246BFD] rounded-full text-[10px]">
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-white text-[#246BFD] shadow-xs'
              : 'text-[#687386] hover:text-[#0B1730] hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isRtl ? 'الحضور والانصراف والغياب اليومي' : 'Daily Attendance & Timesheets'}</span>
          {presentTodayCount > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full text-[10px]">
              {presentTodayCount} {isRtl ? 'حاضر' : 'in'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'bg-white text-[#246BFD] shadow-xs'
              : 'text-[#687386] hover:text-[#0B1730] hover:bg-white/50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{isRtl ? 'مسير الرواتب والمستحقات الشهرية' : 'Monthly Payroll & Payslips'}</span>
          {payrollRecords.length > 0 && (
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px]">
              {payrollRecords.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'adjustments'
              ? 'bg-white text-[#246BFD] shadow-xs'
              : 'text-[#687386] hover:text-[#0B1730] hover:bg-white/50'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{isRtl ? 'السلف والخصومات والمكافآت' : 'Advances & Adjustments'}</span>
          {adjustments.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full text-[10px]">
              {adjustments.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STAFF DIRECTORY & SALARIES */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute top-2.5 start-3 text-[#687386]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'بحث باسم الموظف، المسمى الوظيفي، أو رقم الهاتف...' : 'Search staff by name, title, or phone...'}
                className="w-full ps-9 pe-3 py-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs focus:bg-white focus:border-[#246BFD] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="p-2 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD] font-medium"
              >
                <option value="all">{isRtl ? 'جميع الأدوار الوظيفية' : 'All Roles'}</option>
                <option value="cashier">{isRtl ? 'كاشير نقاط البيع (POS)' : 'Cashier'}</option>
                <option value="branch_manager">{isRtl ? 'مدير فرع' : 'Branch Manager'}</option>
                <option value="inventory_manager">{isRtl ? 'أمين مخزن' : 'Inventory Manager'}</option>
                <option value="accountant">{isRtl ? 'محاسب مالي' : 'Accountant'}</option>
                <option value="merchant_owner">{isRtl ? 'مالك متجر' : 'Owner'}</option>
              </select>

              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#246BFD]" />
                <span>{isRtl ? 'جاري تحميل دليل الموظفين...' : 'Loading staff directory...'}</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-bold text-gray-700">{isRtl ? 'لا يوجد موظفون مسجلون مطابقون' : 'No staff accounts found.'}</p>
                <p className="text-[11px] text-gray-400 mt-1">{isRtl ? 'أضف موظفاً جديداً من الزر أعلاه لتفعيل الحساب ونظام الحضور' : 'Add an employee to activate account'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-semibold">
                    <tr>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الموظف والمسمى' : 'Employee & Job Title'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'رقم الهاتف (للدخول)' : 'Phone (Login)'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الدور والصلاحيات' : 'Role & Screen Access'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الفرع والوردية' : 'Branch & Shift'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الراتب الأساسي' : 'Base Salary'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {filteredEmployees.slice(0, visibleCount).map((emp) => {
                      const branchObj = branches.find(b => b.id === emp.branch_id);
                      const permInfo = getRolePermissionInfo(emp.role);
                      return (
                        <tr key={emp.id} className="hover:bg-[#F7F9FC] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-200/60 text-[#246BFD] flex items-center justify-center font-bold text-sm shrink-0">
                                {emp.full_name ? emp.full_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-[#0B1730]">{emp.full_name}</p>
                                <div className="flex items-center gap-1.5 text-[11px] text-[#687386] mt-0.5">
                                  <Briefcase className="w-3 h-3 text-[#246BFD]" />
                                  <span>{emp.job_title || (emp.role === 'cashier' ? 'كاشير POS' : 'موظف')}</span>
                                </div>
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
                          <td className="py-3 px-4">
                            <div className="text-[#172033] font-medium">
                              {branchObj ? (isRtl ? branchObj.name_ar : branchObj.name_en) : (isRtl ? 'جميع الفروع (مركزي)' : 'All Branches')}
                            </div>
                            <span className="text-[10px] text-[#687386] block mt-0.5">
                              {emp.shift_name || (isRtl ? 'وردية صباحية' : 'Morning Shift')} ({emp.daily_hours || 8}h)
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#0B1730]">
                            {emp.base_salary ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {Number(emp.base_salary).toLocaleString()} {tenant?.currency || 'ج.م'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">{isRtl ? 'غير محدد' : 'Not set'}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50/50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isRtl ? 'نشط' : 'Active'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEdit(emp)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-[#246BFD] hover:bg-blue-50 transition-colors cursor-pointer"
                                title={isRtl ? 'تعديل بيانات وراتب الموظف' : 'Edit Staff & Salary'}
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

            {visibleCount < filteredEmployees.length && (
              <div className="p-4 border-t border-[#E5EAF2] flex justify-center bg-[#FAFCFF]">
                <button
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="px-6 py-2 bg-[#246BFD] hover:bg-[#1A54D4] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {isRtl ? `عرض المزيد (تحميل 20 إضافية - متبقي ${filteredEmployees.length - visibleCount})` : `Load More`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY ATTENDANCE & CHECK-IN/OUT */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Day Selector & Branch Controls */}
          <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => shiftAttendanceDay(-1)}
                className="p-2 border border-[#E5EAF2] rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                title={isRtl ? 'اليوم السابق' : 'Previous Day'}
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <div className="relative flex items-center">
                <Calendar className="w-4 h-4 absolute start-3 text-[#246BFD] pointer-events-none" />
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="ps-9 pe-3 py-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-bold text-[#0B1730] outline-none focus:bg-white focus:border-[#246BFD]"
                />
              </div>

              <button
                onClick={() => shiftAttendanceDay(1)}
                className="p-2 border border-[#E5EAF2] rounded-lg hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                title={isRtl ? 'اليوم التالي' : 'Next Day'}
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#246BFD] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {isRtl ? 'اليوم' : 'Today'}
              </button>
            </div>

            {/* Quick Day Stats Pill */}
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{presentTodayCount} {isRtl ? 'حاضر' : 'Present'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">
                <UserX className="w-3.5 h-3.5" />
                <span>{absentTodayCount} {isRtl ? 'غائب' : 'Absent'}</span>
              </span>
              {lateTodayCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{lateTodayCount} {isRtl ? 'متأخر' : 'Late'}</span>
                </span>
              )}
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            {loadingAttendance ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#246BFD]" />
                <span>{isRtl ? 'جاري تحميل سجل الحضور...' : 'Loading attendance sheet...'}</span>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#687386]">
                {isRtl ? 'لا يوجد موظفون لتسجيل الحضور' : 'No employees to record attendance.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-semibold">
                    <tr>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الموظف' : 'Employee'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'حالة الحضور اليومية' : 'Attendance Status'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'وقت الحضور (Check-in)' : 'Check-in Time'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'وقت الانصراف (Check-out)' : 'Check-out Time'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'ساعات العمل' : 'Hours'}</th>
                      <th className="py-3 px-4 text-end">{isRtl ? 'تسجيل فوري' : 'Quick Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {employees.map((emp) => {
                      const rec = attendanceRecords.find(a => a.user_id === emp.id);
                      const currentStatus = rec?.status || 'absent';
                      const isSaving = savingAttendanceId === emp.id;

                      return (
                        <tr key={emp.id} className="hover:bg-[#F7F9FC] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#246BFD] flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.full_name ? emp.full_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-[#0B1730]">{emp.full_name}</p>
                                <p className="text-[10px] text-[#687386]">{emp.job_title || emp.role}</p>
                              </div>
                            </div>
                          </td>

                          {/* Status Selector Buttons */}
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center p-1 bg-gray-100/80 rounded-lg gap-1 border border-gray-200">
                              <button
                                onClick={() => handleSetAttendanceStatus(emp, 'present')}
                                disabled={isSaving}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {isRtl ? 'حاضر' : 'Present'}
                              </button>

                              <button
                                onClick={() => handleSetAttendanceStatus(emp, 'late')}
                                disabled={isSaving}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  currentStatus === 'late'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                {isRtl ? 'متأخر' : 'Late'}
                              </button>

                              <button
                                onClick={() => handleSetAttendanceStatus(emp, 'absent')}
                                disabled={isSaving}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  currentStatus === 'absent'
                                    ? 'bg-red-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-red-700 hover:bg-red-50'
                                }`}
                              >
                                {isRtl ? 'غائب' : 'Absent'}
                              </button>

                              <button
                                onClick={() => handleSetAttendanceStatus(emp, 'excused')}
                                disabled={isSaving}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                  currentStatus === 'excused'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                                }`}
                              >
                                {isRtl ? 'إجازة' : 'Leave'}
                              </button>
                            </div>
                          </td>

                          {/* Check-in time */}
                          <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                            {rec?.check_in_time ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Clock className="w-3 h-3 text-emerald-600" />
                                {rec.check_in_time}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">--:--</span>
                            )}
                          </td>

                          {/* Check-out time */}
                          <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                            {rec?.check_out_time ? (
                              <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                <Clock className="w-3 h-3 text-indigo-600" />
                                {rec.check_out_time}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">--:--</span>
                            )}
                          </td>

                          {/* Total Hours */}
                          <td className="py-3 px-4 text-center">
                            {rec?.total_hours && rec.total_hours > 0 ? (
                              <span className="font-bold text-[#0B1730] bg-gray-100 px-2 py-0.5 rounded">
                                {rec.total_hours} {isRtl ? 'ساعة' : 'hrs'}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Quick Live Actions */}
                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleCheckInNow(emp)}
                                disabled={isSaving}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                title={isRtl ? 'تسجيل حضور الآن بالساعة الحالية' : 'Check-in Now'}
                              >
                                {isRtl ? 'حضور الآن' : 'In Now'}
                              </button>

                              <button
                                onClick={() => handleCheckOutNow(emp)}
                                disabled={isSaving}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                title={isRtl ? 'تسجيل انصراف الآن وحساب الساعات' : 'Check-out Now'}
                              >
                                {isRtl ? 'انصراف الآن' : 'Out Now'}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MONTHLY PAYROLL & PAYSLIPS */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Month Selector Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#246BFD]" />
                <span>{isRtl ? 'الشهر المالي لمسير الرواتب:' : 'Payroll Month:'}</span>
              </label>
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="px-3 py-1.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-bold text-[#0B1730] outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {isRtl ? `تم صرف ${totalPaidPayrollAmount.toLocaleString()} من إجمالي ${totalMonthlyPayrollAmount.toLocaleString()} ${tenant?.currency || 'ج.م'}` : ''}
              </span>
            </div>
          </div>

          {/* Payroll Table */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            {loadingPayroll ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#246BFD]" />
                <span>{isRtl ? 'جاري تحميل مسير الرواتب...' : 'Loading payroll sheet...'}</span>
              </div>
            ) : payrollRecords.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-bold text-gray-700">{isRtl ? 'لم يتم احتساب رواتب هذا الشهر بعد' : 'Payroll not generated for this month.'}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {isRtl ? 'اضغط على زر "احتساب رواتب الشهر" أعلاه لحساب المستحقات آلياً بناءً على الحضور والسلف' : 'Click "Generate Payroll" to compute salaries'}
                </p>
                <button
                  onClick={handleGeneratePayroll}
                  disabled={generatingPayroll}
                  className="mt-4 px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {isRtl ? 'احتساب رواتب الشهر الآن' : 'Generate Payroll Now'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-semibold">
                    <tr>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الموظف' : 'Employee'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الراتب الأساسي' : 'Base Salary'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'حضور / غياب' : 'Attended / Absent'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'مكافآت (+)' : 'Bonuses (+)'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'خصومات (-)' : 'Deductions (-)'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'سلف مستردة (-)' : 'Advances (-)'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'صافي المستحق' : 'Net Salary'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4 text-end">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {payrollRecords.map((pay) => {
                      const isPaid = pay.status === 'paid';
                      return (
                        <tr key={pay.id} className="hover:bg-[#F7F9FC] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#246BFD] flex items-center justify-center font-bold text-xs shrink-0">
                                {pay.user_name ? pay.user_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-[#0B1730]">{pay.user_name}</p>
                                <p className="text-[10px] text-[#687386]">{pay.job_title || 'موظف'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                            {Number(pay.base_salary).toLocaleString()} {tenant?.currency || 'ج.م'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="text-emerald-700 font-bold">{pay.attended_days}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-red-600 font-bold">{pay.absent_days}</span>
                          </td>

                          <td className="py-3 px-4 text-center text-emerald-600 font-bold">
                            {Number(pay.total_bonuses) > 0 ? `+${Number(pay.total_bonuses).toLocaleString()}` : '0'}
                          </td>

                          <td className="py-3 px-4 text-center text-red-600 font-bold">
                            {Number(pay.total_deductions) > 0 ? `-${Number(pay.total_deductions).toLocaleString()}` : '0'}
                          </td>

                          <td className="py-3 px-4 text-center text-amber-600 font-bold">
                            {Number(pay.total_advances) > 0 ? `-${Number(pay.total_advances).toLocaleString()}` : '0'}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono font-extrabold text-[#246BFD] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                              {Number(pay.net_salary).toLocaleString()} {tenant?.currency || 'ج.م'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'تم الصرف' : 'Paid'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'مستحق للصرف' : 'Due'}</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPaid && (
                                <button
                                  onClick={() => {
                                    setSelectedPayroll(pay);
                                    setPayModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                                >
                                  {isRtl ? 'صرف الراتب' : 'Pay Out'}
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setPayslipData(pay);
                                  setPayslipModalOpen(true);
                                }}
                                className="p-1.5 rounded-md text-gray-600 hover:text-[#246BFD] hover:bg-blue-50 border border-gray-200 transition-colors cursor-pointer"
                                title={isRtl ? 'عرض وطباعة قسيمة الراتب' : 'View Payslip'}
                              >
                                <Printer className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADVANCES, BONUSES & DEDUCTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="bg-white p-4 rounded-xl border border-[#E5EAF2] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">{isRtl ? 'تصفية النوع:' : 'Filter Type:'}</span>
              <div className="inline-flex p-1 bg-gray-100 rounded-lg text-xs font-bold">
                <button
                  onClick={() => setAdjTypeFilter('all')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    adjTypeFilter === 'all' ? 'bg-white text-[#246BFD] shadow-xs' : 'text-gray-600'
                  }`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setAdjTypeFilter('advance')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    adjTypeFilter === 'advance' ? 'bg-white text-amber-600 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  {isRtl ? 'سلف' : 'Advances'}
                </button>
                <button
                  onClick={() => setAdjTypeFilter('bonus')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    adjTypeFilter === 'bonus' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  {isRtl ? 'مكافآت وبدلات' : 'Bonuses'}
                </button>
                <button
                  onClick={() => setAdjTypeFilter('deduction')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    adjTypeFilter === 'deduction' ? 'bg-white text-red-600 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  {isRtl ? 'خصومات وجزاءات' : 'Deductions'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">
                {isRtl ? `إجمالي السلف: ${totalAdvancesAmount.toLocaleString()} ${tenant?.currency || 'ج.م'}` : ''}
              </span>
            </div>
          </div>

          {/* Adjustments Table */}
          <div className="bg-white rounded-xl border border-[#E5EAF2] shadow-xs overflow-hidden">
            {loadingAdjustments ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#246BFD]" />
                <span>{isRtl ? 'جاري تحميل السجل...' : 'Loading adjustments...'}</span>
              </div>
            ) : filteredAdjustments.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#687386]">
                <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-bold text-gray-700">{isRtl ? 'لا توجد سلف أو مكافآت أو خصومات مسجلة' : 'No adjustments recorded.'}</p>
                <p className="text-[11px] text-gray-400 mt-1">{isRtl ? 'اضغط على زر الإضافة لتسجيل سلفة أو مكافأة أو خصم لموظف' : 'Click Add to record'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] font-semibold">
                    <tr>
                      <th className="py-3 px-4 text-start">{isRtl ? 'الموظف' : 'Employee'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'النوع' : 'Type'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'المبلغ' : 'Amount'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'التاريخ والشهر' : 'Date & Month'}</th>
                      <th className="py-3 px-4 text-start">{isRtl ? 'البيان والسبب' : 'Reason / Note'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4 text-end">{isRtl ? 'حذف' : 'Delete'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {filteredAdjustments.map((adj) => {
                      return (
                        <tr key={adj.id} className="hover:bg-[#F7F9FC] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#0B1730]">
                            {adj.user_name || 'موظف'}
                          </td>

                          <td className="py-3 px-4">
                            {adj.type === 'advance' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <Wallet className="w-3 h-3" />
                                {isRtl ? 'سلفة مالية' : 'Advance'}
                              </span>
                            )}
                            {adj.type === 'bonus' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Award className="w-3 h-3" />
                                {isRtl ? 'مكافأة تشجيعية' : 'Bonus'}
                              </span>
                            )}
                            {adj.type === 'deduction' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                <AlertTriangle className="w-3 h-3" />
                                {isRtl ? 'خصم / جزاء' : 'Deduction'}
                              </span>
                            )}
                            {adj.type === 'allowance' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <Plus className="w-3 h-3" />
                                {isRtl ? 'بدل انتقال/سكن' : 'Allowance'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono font-bold text-[#0B1730]">
                            {Number(adj.amount).toLocaleString()} {tenant?.currency || 'ج.م'}
                          </td>

                          <td className="py-3 px-4 text-[#687386]">
                            <div>{adj.date}</div>
                            <div className="text-[10px] text-gray-400 font-mono">({adj.month})</div>
                          </td>

                          <td className="py-3 px-4 text-gray-700 max-w-xs truncate">
                            {adj.reason}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isRtl ? 'معتمد' : 'Approved'}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 text-end">
                            <button
                              onClick={() => handleDeleteAdjustment(adj)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title={isRtl ? 'حذف القيد' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD EMPLOYEE (WITH FULL SALARY & HR SPECS) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={isRtl ? 'إضافة موظف جديد وتحديد راتبه وصلاحياته' : 'Add Employee & Salary'}
        size="lg"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'اسم الموظف بالكامل *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={isRtl ? 'أحمد كمال محمود' : 'Ahmed Kamal'}
                value={newEmployee.full_name}
                onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المسمى الوظيفي *' : 'Job Title *'}
              </label>
              <input
                type="text"
                placeholder={isRtl ? 'كاشير نقاط البيع، بائع، مسؤول مخزن...' : 'Cashier, Store Manager...'}
                value={newEmployee.job_title}
                onChange={(e) => setNewEmployee({ ...newEmployee, job_title: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-700 font-semibold">
                  {isRtl ? 'رقم الهاتف (11 رقماً لتسجيل الدخول) *' : 'Phone Number (11 digits) *'}
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
                {isRtl ? 'كلمة المرور الأولية للدخول *' : 'Login Password *'}
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
                {isRtl ? 'الدور الوظيفي وصلاحيات الشاشات *' : 'Role & System Access *'}
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
                {isRtl ? 'الفرع التابع له *' : 'Branch *'}
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

            {/* Salary & Shift Fields */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الراتب الأساسي الشهري (ج.م)' : 'Base Salary (Monthly)'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={newEmployee.base_salary || ''}
                onChange={(e) => setNewEmployee({ ...newEmployee, base_salary: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono font-bold outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الوردية وساعات العمل' : 'Shift & Daily Hours'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newEmployee.shift_name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, shift_name: e.target.value })}
                  className="p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
                >
                  <option value="الوردية الصباحية">{isRtl ? 'وردية صباحية' : 'Morning'}</option>
                  <option value="الوردية المسائية">{isRtl ? 'وردية مسائية' : 'Evening'}</option>
                  <option value="الوردية الليلية">{isRtl ? 'وردية ليلية' : 'Night'}</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={newEmployee.daily_hours}
                  onChange={(e) => setNewEmployee({ ...newEmployee, daily_hours: Number(e.target.value) })}
                  placeholder="8 ساعات"
                  className="p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono outline-none focus:bg-white focus:border-[#246BFD]"
                />
              </div>
            </div>

            {/* Permission Scope Preview Card */}
            {(() => {
              const info = getRolePermissionInfo(newEmployee.role);
              return (
                <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5 mt-1">
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

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EMPLOYEE */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={isRtl ? 'تعديل بيانات وراتب الموظف' : 'Edit Employee & Salary'}
        size="lg"
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2">
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
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المسمى الوظيفي' : 'Job Title'}
              </label>
              <input
                type="text"
                value={editForm.job_title}
                onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
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
                {isRtl ? 'الراتب الأساسي الشهري (ج.م)' : 'Base Salary (Monthly)'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={editForm.base_salary || ''}
                onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono font-bold outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الوردية' : 'Shift'}
              </label>
              <select
                value={editForm.shift_name}
                onChange={(e) => setEditForm({ ...editForm, shift_name: e.target.value })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="الوردية الصباحية">{isRtl ? 'وردية صباحية' : 'Morning'}</option>
                <option value="الوردية المسائية">{isRtl ? 'وردية مسائية' : 'Evening'}</option>
                <option value="الوردية الليلية">{isRtl ? 'وردية ليلية' : 'Night'}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'الدور والصلاحيات *' : 'Role & Permissions *'}
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

      {/* ========================================================================= */}
      {/* MODAL 3: ADD ADJUSTMENT (ADVANCE / BONUS / DEDUCTION) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={addAdjModalOpen}
        onClose={() => setAddAdjModalOpen(false)}
        title={isRtl ? 'إضافة قيد (سلفة / مكافأة / خصم / بدل)' : 'Add Employee Adjustment'}
        size="md"
      >
        <form onSubmit={handleCreateAdjustment} className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'الموظف المستهدف *' : 'Employee *'}
            </label>
            <select
              value={newAdj.user_id}
              onChange={(e) => setNewAdj({ ...newAdj, user_id: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            >
              {employees.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.job_title || u.role})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'نوع القيد *' : 'Adjustment Type *'}
              </label>
              <select
                value={newAdj.type}
                onChange={(e) => setNewAdj({ ...newAdj, type: e.target.value as AdjustmentType })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="advance">{isRtl ? 'سلفة مالية (تخصم من الراتب)' : 'Advance'}</option>
                <option value="bonus">{isRtl ? 'مكافأة تشجيعية (تضاف للراتب)' : 'Bonus'}</option>
                <option value="deduction">{isRtl ? 'خصم / جزاء (يخصم من الراتب)' : 'Deduction'}</option>
                <option value="allowance">{isRtl ? 'بدل انتقال / سكن' : 'Allowance'}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'المبلغ (ج.م) *' : 'Amount *'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={newAdj.amount || ''}
                onChange={(e) => setNewAdj({ ...newAdj, amount: e.target.value === '' ? 0 : Number(e.target.value) })}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-mono font-bold outline-none focus:bg-white focus:border-[#246BFD]"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'تاريخ الاستحقاق *' : 'Date *'}
            </label>
            <input
              type="date"
              required
              value={newAdj.date}
              onChange={(e) => setNewAdj({ ...newAdj, date: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              {isRtl ? 'السبب والبيان التوضيحي *' : 'Reason / Note *'}
            </label>
            <textarea
              required
              rows={3}
              placeholder={isRtl ? 'مثال: سلفة نقدية على الحساب، مكافأة تميز في المبيعات، خصم تأخير...' : 'Write reason...'}
              value={newAdj.reason}
              onChange={(e) => setNewAdj({ ...newAdj, reason: e.target.value })}
              className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs outline-none focus:bg-white focus:border-[#246BFD]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setAddAdjModalOpen(false)}
              className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submittingAdj}
              className="px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submittingAdj ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ القيد' : 'Save Adjustment')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: PAY OUT SALARY MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={isRtl ? 'صرف وتأكيد راتب الموظف' : 'Salary Payout Confirmation'}
        size="md"
      >
        {selectedPayroll && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-[#0B1730]">{selectedPayroll.user_name}</p>
                  <p className="text-[11px] text-[#687386]">{selectedPayroll.job_title} | شهر ({selectedPayroll.month})</p>
                </div>
                <div className="text-end">
                  <span className="text-xs text-gray-500 block">{isRtl ? 'صافي المبلغ للصرف' : 'Net Payable'}</span>
                  <span className="text-lg font-mono font-extrabold text-[#246BFD]">
                    {Number(selectedPayroll.net_salary).toLocaleString()} {tenant?.currency || 'ج.م'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                {isRtl ? 'طريقة الصرف المالي *' : 'Payment Method *'}
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full p-2.5 bg-[#F7F9FC] border border-[#E5EAF2] rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-[#246BFD]"
              >
                <option value="cash">{isRtl ? 'نقداً من درج الكاشير / الخزينة (Cash Drawer)' : 'Cash Drawer'}</option>
                <option value="bank">{isRtl ? 'تحويل بنكي (Bank Transfer)' : 'Bank Transfer'}</option>
                <option value="wallet">{isRtl ? 'محفظة إلكترونية (فودافون كاش / إنستاباي)' : 'Mobile Wallet / InstaPay'}</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
              <input
                type="checkbox"
                id="autoExpenseCheck"
                checked={autoRecordExpense}
                onChange={(e) => setAutoRecordExpense(e.target.checked)}
                className="w-4 h-4 rounded text-[#246BFD] cursor-pointer"
              />
              <label htmlFor="autoExpenseCheck" className="text-xs text-gray-700 cursor-pointer">
                {isRtl ? 'تسجيل المبلغ تلقائياً في حساب المصروفات (مرتبات وأجور) لحساب الأرباح بدقة' : 'Automatically record in expenses ledger'}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayOut}
                disabled={submittingPay}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submittingPay ? (isRtl ? 'جاري الصرف...' : 'Processing...') : (isRtl ? 'تأكيد صرف الراتب الآن' : 'Confirm Payout')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: PAYSLIP (PRINTABLE OFFICIAL RECEIPT) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={payslipModalOpen}
        onClose={() => setPayslipModalOpen(false)}
        title={isRtl ? 'قسيمة راتب الموظف الرسمية' : 'Official Payslip'}
        size="md"
      >
        {payslipData && (
          <div className="space-y-4">
            <div id="printable-payslip" className="space-y-4 text-xs font-sans">
            {/* Header / Store Info */}
            <div className="text-center pb-3 border-b border-gray-200">
              <h3 className="font-extrabold text-base text-[#0B1730]">{tenant?.name || 'سوبر ماركت / المتجر'}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{isRtl ? 'قسيمة استلام راتب ومستحقات شهرية' : 'Monthly Salary Payslip'}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-50 text-[#246BFD] font-mono font-bold rounded-md text-[11px]">
                {payslipData.month}
              </span>
            </div>

            {/* Employee Details Grid */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] text-gray-400 block">{isRtl ? 'اسم الموظف:' : 'Employee:'}</span>
                <span className="font-bold text-[#0B1730]">{payslipData.user_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">{isRtl ? 'المسمى الوظيفي:' : 'Job Title:'}</span>
                <span className="font-semibold text-gray-700">{payslipData.job_title}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">{isRtl ? 'أيام الحضور الفعلي:' : 'Attended Days:'}</span>
                <span className="font-bold text-emerald-700">{payslipData.attended_days} {isRtl ? 'يوم' : 'days'}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">{isRtl ? 'أيام الغياب:' : 'Absent Days:'}</span>
                <span className="font-bold text-red-600">{payslipData.absent_days} {isRtl ? 'يوم' : 'days'}</span>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100/80 font-bold text-gray-600">
                  <tr>
                    <th className="py-2 px-3 text-start">{isRtl ? 'البند المالي' : 'Item'}</th>
                    <th className="py-2 px-3 text-end">{isRtl ? 'المبلغ' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 px-3 text-gray-700">{isRtl ? 'الراتب الأساسي' : 'Base Salary'}</td>
                    <td className="py-2 px-3 text-end font-mono font-bold">{Number(payslipData.base_salary).toLocaleString()} {tenant?.currency || 'ج.م'}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-emerald-700">{isRtl ? 'المكافآت والبدلات (+)' : 'Bonuses (+)'}</td>
                    <td className="py-2 px-3 text-end font-mono font-bold text-emerald-700">+{Number(payslipData.total_bonuses).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-red-600">{isRtl ? 'الخصومات والجزاءات (-)' : 'Deductions (-)'}</td>
                    <td className="py-2 px-3 text-end font-mono font-bold text-red-600">-{Number(payslipData.total_deductions).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-amber-600">{isRtl ? 'السلف المستردة (-)' : 'Advances (-)'}</td>
                    <td className="py-2 px-3 text-end font-mono font-bold text-amber-600">-{Number(payslipData.total_advances).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-blue-50/60 font-extrabold text-sm">
                    <td className="py-2.5 px-3 text-[#246BFD]">{isRtl ? 'صافي الراتب المستلم (=)' : 'Net Paid (=)'}</td>
                    <td className="py-2.5 px-3 text-end font-mono text-[#246BFD]">{Number(payslipData.net_salary).toLocaleString()} {tenant?.currency || 'ج.م'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 text-center">
              <div>
                <span className="text-[10px] text-gray-400 block mb-8">{isRtl ? 'توقيع الإدارة / المحاسب' : 'Management Signature'}</span>
                <span className="block border-t border-dashed border-gray-300 w-32 mx-auto"></span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block mb-8">{isRtl ? 'توقيع واستلام الموظف' : 'Employee Receipt'}</span>
                <span className="block border-t border-dashed border-gray-300 w-32 mx-auto"></span>
              </div>
            </div>
          </div>

          {/* Print and Close buttons (outside printable-payslip container) */}
          <div className="no-print print:hidden flex justify-end gap-2 pt-3 border-t border-[#E5EAF2]">
            <button
              type="button"
              onClick={() => setPayslipModalOpen(false)}
              className="no-print px-4 py-2 border border-[#E5EAF2] rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handlePrintPayslip}
              className="no-print inline-flex items-center gap-1.5 px-4 py-2 bg-[#246BFD] hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRtl ? 'طباعة القسيمة' : 'Print Payslip'}</span>
            </button>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
