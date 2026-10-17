-- ============================================================================
-- HR, ATTENDANCE & PAYROLL MIGRATION
-- نظام الموارد البشرية والحضور والانصراف ومسير الرواتب
-- ============================================================================

-- 1. Add HR profile columns to users table (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_type VARCHAR(32) DEFAULT 'monthly';
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_hours NUMERIC(4, 1) DEFAULT 8.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shift_name VARCHAR(64) DEFAULT 'الوردية الصباحية';

-- 2. Daily Attendance & Check-In/Out (الحضور والانصراف اليومي)
CREATE TABLE IF NOT EXISTS employee_attendance (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'present', -- present, absent, late, excused, half_day
  check_in_time VARCHAR(16),  -- HH:mm
  check_out_time VARCHAR(16), -- HH:mm
  total_hours NUMERIC(5, 2) DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_emp_attendance_date UNIQUE (tenant_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_emp_attendance_tenant_date ON employee_attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_emp_attendance_user ON employee_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_attendance_branch ON employee_attendance(branch_id);

-- 3. Employee Adjustments (السلف، المكافآت، الخصومات والبدلات)
CREATE TABLE IF NOT EXISTS employee_adjustments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL, -- advance (سلفة), bonus (مكافأة), deduction (خصم/جزاء), allowance (بدل)
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  month VARCHAR(10) NOT NULL, -- YYYY-MM
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'approved', -- pending, approved, settled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_adjustments_tenant_month ON employee_adjustments(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_emp_adjustments_user ON employee_adjustments(user_id);

-- 4. Monthly Payroll Ledger (مسير الرواتب الشهري)
CREATE TABLE IF NOT EXISTS employee_payroll (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(10) NOT NULL, -- YYYY-MM
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  working_days INTEGER DEFAULT 30,
  attended_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  total_bonuses NUMERIC(12, 2) DEFAULT 0,
  total_deductions NUMERIC(12, 2) DEFAULT 0,
  total_advances NUMERIC(12, 2) DEFAULT 0,
  net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- draft, calculated, paid
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR(32) DEFAULT 'cash', -- cash, bank, wallet
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_emp_payroll_month UNIQUE (tenant_id, user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_emp_payroll_tenant_month ON employee_payroll(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_emp_payroll_user ON employee_payroll(user_id);
