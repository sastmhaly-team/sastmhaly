'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useLanguage } from '@/lib/i18n/context';
import { CashRegister, CashSession } from '@/lib/types';
import { ExportButton } from '@/components/reports/ExportButton';
import { Modal } from '@/components/ui/Modal';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { fetchWithCache, getCachedData } from '@/lib/cache/client-cache';
import { 
  Landmark, Plus, Minus, CheckCircle2, Clock, 
  ArrowUpRight, ArrowDownRight, Printer, AlertTriangle, Banknote, ShieldAlert
} from 'lucide-react';

export default function MerchantRegistersPage() {
  const { tenant, user, activeBranchId, branches } = useAuth();
  const { lang, t } = useLanguage();

  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isOpenSessionModal, setIsOpenSessionModal] = useState(false);
  const [isCloseSessionModal, setIsCloseSessionModal] = useState(false);
  const [isMovementModal, setIsMovementModal] = useState(false);

  // Form states
  const [openingFloat, setOpeningFloat] = useState(500);
  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [closingCountedCash, setClosingCountedCash] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');
  
  // Pay in / out
  const [movementType, setMovementType] = useState<'pay_in' | 'pay_out'>('pay_in');
  const [movementAmount, setMovementAmount] = useState(100);
  const [movementReason, setMovementReason] = useState('');

  const tenantId = user?.tenant_id || tenant?.id;

  const fetchRegisters = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    try {
      const branchParam = activeBranchId && activeBranchId !== 'all' ? `&branchId=${activeBranchId}` : '';
      const url = `/api/merchant/registers?tenantId=${tenantId}${branchParam}`;
      
      const cached = getCachedData<any>(url);
      if (cached) {
        if (cached.registers) setRegisters(cached.registers);
        if (cached.sessions) setSessions(cached.sessions);
        if (cached.activeSession !== undefined) setActiveSession(cached.activeSession);
        if (cached.registers?.length > 0 && !selectedRegisterId) {
          setSelectedRegisterId(cached.registers[0].id);
        }
        setLoading(false);
      } else if (registers.length === 0 && sessions.length === 0) {
        setLoading(true);
      }

      await fetchWithCache<any>(url, (data) => {
        if (data.registers) setRegisters(data.registers);
        if (data.sessions) setSessions(data.sessions);
        setActiveSession(data.activeSession || null);
        if (data.registers?.length > 0 && !selectedRegisterId) {
          setSelectedRegisterId(data.registers[0].id);
        }
        setLoading(false);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegisters();
  }, [tenantId, activeBranchId]);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    const targetBranchId = activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'main');

    try {
      const res = await fetch('/api/merchant/registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          branch_id: targetBranchId,
          register_id: selectedRegisterId || registers[0]?.id,
          cashier_id: user?.id || 'cashier_user',
          opening_float: Number(openingFloat) || 0,
        }),
      });

      if (res.ok) {
        setIsOpenSessionModal(false);
        fetchRegisters();
      } else {
        alert('Could not open register session');
      }
    } catch {
      alert('Error opening cash register');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeSession) return;

    try {
      const res = await fetch('/api/merchant/registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          tenant_id: tenantId,
          session_id: activeSession.id,
          counted_cash: Number(closingCountedCash) || 0,
          notes: closingNotes,
        }),
      });

      if (res.ok) {
        setIsCloseSessionModal(false);
        fetchRegisters();
      }
    } catch {
      alert('Error closing cash register');
    }
  };

  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeSession) return;

    try {
      const res = await fetch('/api/merchant/registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'movement',
          session_id: activeSession.id,
          type: movementType,
          amount: Number(movementAmount) || 0,
          reason: movementReason,
        }),
      });

      if (res.ok) {
        setIsMovementModal(false);
        setMovementReason('');
        fetchRegisters();
      }
    } catch {
      alert('Error recording cash movement');
    }
  };

  const safeMoney = (val: unknown) => {
    const num = Number(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  if (!tenantId && user?.role === 'super_admin') {
    return (
      <div className="p-8 bg-white rounded-xl border border-[#E5EAF2] text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-[#246BFD] mx-auto" />
        <h3 className="text-sm font-bold text-[#0B1730]">
          {lang === 'ar' ? 'حساب مدير المنصة (Super Admin)' : 'Platform Super Admin Account'}
        </h3>
        <p className="text-xs text-[#687386] max-w-md mx-auto">
          {lang === 'ar'
            ? 'لإدارة ورديات الخزينة والكاشير، يرجى تسجيل الدخول بحساب تاجر أو كاشير مخصص لفرع تجاري.'
            : 'To manage registers and till sessions, please log in with a merchant owner or cashier account.'}
        </p>
      </div>
    );
  }

  const exportColumns = [
    { header: 'Session #', key: 'session_number' as const },
    { header: 'Cashier', key: 'cashier_name' as const },
    { header: 'Register', key: 'register_name' as const },
    { header: 'Branch', key: 'branch_name' as const },
    { header: 'Status', key: 'status' as const },
    { header: 'Opening Float', key: 'opening_float' as const },
    { header: 'Expected Cash', key: 'expected_cash' as const },
    { header: 'Counted Cash', key: 'closing_cash_counted' as const },
    { header: 'Discrepancy', key: 'difference' as const },
    { header: 'Opened At', key: 'opened_at' as const },
    { header: 'Closed At', key: 'closed_at' as const },
  ];

  const filteredSessions = sessions.filter(s => {
    if (!startDate && !endDate) return true;
    const sDate = s.opened_at ? s.opened_at.split('T')[0] : '';
    if (startDate && sDate < startDate) return false;
    if (endDate && sDate > endDate) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1730]">
            {lang === 'ar' ? 'إدارة الخزينة وورديات الكاشير' : 'Cash Register & Till Management'}
          </h2>
          <p className="text-xs text-[#687386] mt-0.5">
            {lang === 'ar' 
              ? 'متابعة الرصيد الافتتاحي، الإيداعات والسحوبات، جرد نهاية اليوم، وتقرير Z المالي' 
              : 'Shift opening floats, cash drops, end-of-shift reconciliation, and Z-report closing'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportButton
            filename="sastmhaly_cash_sessions_audit"
            data={filteredSessions}
            columns={exportColumns}
          />

          {!activeSession ? (
            <button
              onClick={() => setIsOpenSessionModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('reg_open_session')}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setClosingCountedCash(Number(activeSession.opening_float) || 0);
                setIsCloseSessionModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('reg_close_session')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />

      {/* Active Shift Banner Card */}
      {activeSession ? (
        <div className="bg-white rounded-xl border-2 border-[#246BFD] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-[#246BFD] flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping"></span>
                <span className="text-[11px] font-bold text-[#10B981] uppercase tracking-wider">
                  {lang === 'ar' ? 'وردية نشطة ومفتوحة الآن' : 'Active Shift In Progress'}
                </span>
                <span className="text-xs font-mono font-bold text-[#0B1730]">
                  #{activeSession.session_number}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0B1730] mt-0.5">
                {activeSession.register_name} • Cashier: {activeSession.cashier_name}
              </h3>
              <p className="text-xs text-[#687386]">
                Opened at {activeSession.opened_at} with opening float: <strong>{safeMoney(activeSession.opening_float)} {t('currency')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMovementType('pay_in');
                setIsMovementModal(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] hover:bg-white text-xs font-bold text-[#0B1730] transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowDownRight className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{t('reg_pay_in')}</span>
            </button>

            <button
              onClick={() => {
                setMovementType('pay_out');
                setIsMovementModal(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] hover:bg-white text-xs font-bold text-[#0B1730] transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>{t('reg_pay_out')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-[#E5EAF2] bg-white flex items-center justify-between">
          <p className="text-xs text-[#687386]">
            {lang === 'ar' ? 'لا توجد وردية مفتوحة حالياً لهذا الفرع. افتح وردية لبدء تسجيل مبيعات الكاشير.' : 'No active shift currently open for this branch. Open a session to begin POS checkout.'}
          </p>
        </div>
      )}

      {/* Shift Sessions History Table */}
      <div className="bg-white rounded-xl border border-[#E5EAF2] overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-[#E5EAF2] bg-[#F7F9FC]">
          <h3 className="text-xs font-bold text-[#0B1730] uppercase tracking-wider">
            {lang === 'ar' ? 'سجل الورديات السابقة وتقرير Z' : 'Previous Shift Sessions & Reconciliation'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right border-collapse">
            <thead className="bg-[#F7F9FC] border-b border-[#E5EAF2] text-[#687386] uppercase font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'رقم الوردية' : 'Session #'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'الخزينة والكاشير' : 'Register / Cashier'}</th>
                <th className="px-4 py-3.5">{lang === 'ar' ? 'وقت الفتح والإغلاق' : 'Shift Duration'}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">{t('reg_opening_float')}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">{t('reg_expected_cash')}</th>
                <th className="px-4 py-3.5 text-right rtl:text-left">{t('reg_counted_cash')}</th>
                <th className="px-4 py-3.5 text-center">{t('reg_difference')}</th>
                <th className="px-4 py-3.5 text-center">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#687386]">{t('loading')}</td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#687386]">{t('no_records')}</td>
                </tr>
              ) : (
                filteredSessions.map((s, idx) => {
                  const diff = s.difference !== undefined && s.difference !== null ? Number(s.difference) : null;
                  return (
                    <tr key={s.id} className="hover:bg-[#F7F9FC]">
                      <td className="px-4 py-3.5 font-mono text-[#687386]">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#246BFD]">
                        {s.session_number}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-[#0B1730]">{s.register_name}</p>
                        <p className="text-[10px] text-[#687386]">{s.cashier_name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[#687386]">
                        <p>{s.opened_at}</p>
                        <p>{s.closed_at ? `to ${s.closed_at}` : 'In progress...'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono font-semibold">
                        {safeMoney(s.opening_float)}
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono text-[#687386]">
                        {s.expected_cash !== undefined && s.expected_cash !== null ? safeMoney(s.expected_cash) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right rtl:text-left font-mono font-bold text-[#0B1730]">
                        {s.closing_cash_counted !== undefined && s.closing_cash_counted !== null ? safeMoney(s.closing_cash_counted) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold">
                        {diff !== null ? (
                          <span className={diff === 0 ? 'text-[#10B981]' : diff < 0 ? 'text-[#EF4444]' : 'text-[#246BFD]'}>
                            {diff > 0 ? `+${safeMoney(diff)}` : safeMoney(diff)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {s.status === 'open' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]">
                            Open
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-[#687386]">
                            Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Session Modal */}
      <Modal
        isOpen={isOpenSessionModal}
        onClose={() => setIsOpenSessionModal(false)}
        title={t('reg_open_session')}
        maxWidth="sm"
      >
        <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#172033] mb-1">Select Register *</label>
            <select
              value={selectedRegisterId}
              onChange={(e) => setSelectedRegisterId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] font-semibold focus:border-[#246BFD] focus:outline-none cursor-pointer"
            >
              {registers.length > 0 ? (
                registers.map(r => (
                  <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                ))
              ) : (
                <option value="reg_default">POS-01 (Main Cashier Till)</option>
              )}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">{t('reg_opening_float')} ({t('currency')}) *</label>
            <input
              type="number"
              step="50"
              required
              value={openingFloat}
              onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-base font-bold font-mono rounded-lg border border-[#246BFD] text-[#0B1730] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpenSessionModal(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386] cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold cursor-pointer"
            >
              Start Session
            </button>
          </div>
        </form>
      </Modal>

      {/* Close Session Z-Report Modal */}
      <Modal
        isOpen={isCloseSessionModal}
        onClose={() => setIsCloseSessionModal(false)}
        title={lang === 'ar' ? 'إغلاق الوردية وجرد النقدية (Z-Report)' : 'Close Register & Reconciliation'}
        maxWidth="md"
      >
        <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E5EAF2] space-y-1.5">
            <div className="flex justify-between text-[#687386]">
              <span>Session Number:</span>
              <span className="font-mono font-bold text-[#0B1730]">{activeSession?.session_number}</span>
            </div>
            <div className="flex justify-between text-[#687386]">
              <span>Opening Float:</span>
              <span className="font-mono">{safeMoney(activeSession?.opening_float)} {t('currency')}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">
              Actual Counted Cash in Till (النقدية الفعلية بالدرج) *
            </label>
            <input
              type="number"
              step="1"
              required
              value={closingCountedCash}
              onChange={(e) => setClosingCountedCash(parseFloat(e.target.value) || 0)}
              className="w-full text-center py-2.5 text-2xl font-bold font-mono rounded-lg border border-[#246BFD] text-[#0B1730] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Closing Notes / Discrepancy Reason</label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              placeholder="e.g. Exact match with sales receipt tape."
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCloseSessionModal(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386] cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold cursor-pointer"
            >
              Close Shift (Print Z-Report)
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay In / Pay Out Drawer Movement Modal */}
      <Modal
        isOpen={isMovementModal}
        onClose={() => setIsMovementModal(false)}
        title={movementType === 'pay_in' ? t('reg_pay_in') : t('reg_pay_out')}
        maxWidth="sm"
      >
        <form onSubmit={handleCashMovement} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#172033] mb-1">Amount ({t('currency')}) *</label>
            <input
              type="number"
              required
              min="1"
              value={movementAmount}
              onChange={(e) => setMovementAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-lg font-bold font-mono rounded-lg border border-[#246BFD] text-[#0B1730] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#172033] mb-1">Reason / Description *</label>
            <input
              type="text"
              required
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E5EAF2] focus:border-[#246BFD] focus:outline-none"
              placeholder={movementType === 'pay_in' ? 'Added change banknotes' : 'Midday bank safe deposit'}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsMovementModal(false)}
              className="px-4 py-2 rounded-lg border border-[#E5EAF2] font-bold text-[#687386] cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#246BFD] hover:bg-[#1A54D4] text-white font-bold cursor-pointer"
            >
              Record Movement
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
