import { NextRequest, NextResponse } from 'next/server';
import { getUsers, createUser, updateUser, deleteUser, findUserByPhoneOrEmail } from '@/lib/db/supabase-queries';

function formatDatabaseError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || '');
  if (msg.includes('users_email_key') || msg.includes('users.email')) {
    return 'رقم الهاتف أو البريد الإلكتروني مسجل بالفعل لموظف آخر. يرجى استخدام رقم هاتف مختلف.';
  }
  if (msg.includes('users_username_key') || msg.includes('users.username') || msg.includes('users.phone')) {
    return 'رقم الهاتف أو اسم المستخدم مسجل بالفعل في المنظومة. يرجى استخدام رقم مختلف.';
  }
  if (msg.includes('violates foreign key') || msg.includes('FOREIGN KEY constraint failed')) {
    return 'لا يمكن حذف الموظف لوجود عمليات بيع أو ورديات مسجلة باسمه في المنظومة.';
  }
  return msg || 'فشلت معالجة بيانات الموظف';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const branchId = searchParams.get('branchId') && searchParams.get('branchId') !== 'all' 
    ? searchParams.get('branchId')! 
    : undefined;

  if (!tenantId) {
    return NextResponse.json({ users: [] });
  }

  try {
    const users = await getUsers(tenantId, branchId);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      tenant_id, full_name, phone, password, role, branch_id, email, username,
      job_title, base_salary, salary_type, daily_hours, national_id, hire_date, shift_name,
      allowed_pages
    } = body;

    if (body.bulk && Array.isArray(body.items)) {
      if (!tenant_id) {
        return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
      }
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          if (!item.full_name || !item.phone) {
            errors.push(`Row #${i + 1}: Name and phone are required`);
            continue;
          }
          const cleanedPhone = String(item.phone).replace(/\D/g, '').trim();
          if (cleanedPhone.length !== 11) {
            errors.push(`الصف #${i + 1} (${item.full_name}): رقم الهاتف يجب أن يتكون من 11 رقماً`);
            continue;
          }
          const tenantSuffix = String(tenant_id).replace(/^tenant_/, '').slice(0, 8);
          const empPassword = item.password || '123456';
          const empEmail = item.email && item.email.trim()
            ? item.email.trim().toLowerCase()
            : `emp_${tenantSuffix}_${cleanedPhone}@sastmhaly.com`;
          const empUsername = item.username || cleanedPhone;

          // Check if already exists
          const existing = await findUserByPhoneOrEmail(cleanedPhone, empEmail);
          if (existing) {
            if (existing.tenant_id === tenant_id && !existing.is_active) {
              await updateUser(existing.id, tenant_id, {
                full_name: item.full_name.trim(),
                phone: cleanedPhone,
                role: item.role || 'cashier',
                branch_id: item.branch_id || branch_id || undefined,
                password_hash: empPassword,
                is_active: 1,
                job_title: item.job_title || 'موظف',
                base_salary: item.base_salary ? Number(item.base_salary) : 4000,
                salary_type: item.salary_type || 'monthly',
                daily_hours: item.daily_hours ? Number(item.daily_hours) : 8,
                national_id: item.national_id || undefined,
                hire_date: item.hire_date || new Date().toISOString().split('T')[0],
                shift_name: item.shift_name || 'الوردية الصباحية',
              });
              successCount++;
              continue;
            } else {
              errors.push(`الصف #${i + 1} (${item.full_name}): رقم الهاتف ${cleanedPhone} مسجل بالفعل`);
              continue;
            }
          }

          await createUser({
            tenant_id,
            branch_id: item.branch_id || branch_id || undefined,
            email: empEmail,
            username: empUsername,
            password_hash: empPassword,
            full_name: item.full_name.trim(),
            phone: cleanedPhone,
            role: item.role || 'cashier',
            job_title: item.job_title || 'موظف',
            base_salary: item.base_salary ? Number(item.base_salary) : 4000,
            salary_type: item.salary_type || 'monthly',
            daily_hours: item.daily_hours ? Number(item.daily_hours) : 8,
            national_id: item.national_id || undefined,
            hire_date: item.hire_date || new Date().toISOString().split('T')[0],
            shift_name: item.shift_name || 'الوردية الصباحية',
          });
          successCount++;
        } catch (err: unknown) {
          errors.push(`الصف #${i + 1} (${item.full_name}): ${formatDatabaseError(err)}`);
        }
      }

      return NextResponse.json({
        success: true,
        successCount,
        errorCount: errors.length,
        errors,
      });
    }

    if (!tenant_id || !full_name || !phone || !password) {
      return NextResponse.json({ 
        error: 'اسم الموظف، ورقم الهاتف (11 رقماً)، وكلمة المرور مطلوبة' 
      }, { status: 400 });
    }

    // Clean and validate 11-digit phone number
    const cleanedPhone = phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      return NextResponse.json({ 
        error: 'رقم هاتف الموظف يجب أن يتكون من 11 رقماً بالضبط (مثال: 01012345678)' 
      }, { status: 400 });
    }

    const tenantSuffix = String(tenant_id).replace(/^tenant_/, '').slice(0, 8);
    const employeeEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : `emp_${tenantSuffix}_${cleanedPhone}@sastmhaly.com`;
    const employeeUsername = username || cleanedPhone;

    // Check if user with this phone or email already exists
    const existingUser = await findUserByPhoneOrEmail(cleanedPhone, employeeEmail);
    if (existingUser) {
      if (existingUser.tenant_id === tenant_id) {
        if (!existingUser.is_active) {
          // Reactivate and update existing employee record
          const reactivated = await updateUser(existingUser.id, tenant_id, {
            full_name,
            phone: cleanedPhone,
            role: role || 'cashier',
            branch_id: branch_id || undefined,
            allowed_pages: allowed_pages || undefined,
            password_hash: password,
            is_active: 1,
            job_title,
            base_salary: base_salary !== undefined ? Number(base_salary) : 0,
            salary_type: salary_type || 'monthly',
            daily_hours: daily_hours !== undefined ? Number(daily_hours) : 8,
            national_id,
            hire_date: hire_date || new Date().toISOString().split('T')[0],
            shift_name: shift_name || 'الوردية الصباحية',
          });
          return NextResponse.json({ 
            success: true, 
            user: reactivated,
            message: 'تم إعادة تفعيل وتحديث حساب الموظف بنجاح.' 
          });
        }

        return NextResponse.json({ 
          error: `رقم الهاتف (${cleanedPhone}) مسجل بالفعل للموظف "${existingUser.full_name}". يمكنك تعديل بياناته وصلاحياته من قائمة الموظفين.` 
        }, { status: 409 });
      } else {
        return NextResponse.json({ 
          error: `رقم الهاتف (${cleanedPhone}) مسجل بالفعل في المنظومة لحساب مستخدم آخر. يرجى استخدام رقم هاتف مختلف خاص بهذا الموظف.` 
        }, { status: 409 });
      }
    }

    const user = await createUser({
      tenant_id,
      branch_id: branch_id || undefined,
      email: employeeEmail,
      username: employeeUsername,
      password_hash: password,
      full_name,
      phone: cleanedPhone,
      role: role || 'cashier',
      allowed_pages: allowed_pages || undefined,
      job_title,
      base_salary: base_salary !== undefined ? Number(base_salary) : 0,
      salary_type: salary_type || 'monthly',
      daily_hours: daily_hours !== undefined ? Number(daily_hours) : 8,
      national_id,
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      shift_name: shift_name || 'الوردية الصباحية',
    });

    return NextResponse.json({ 
      success: true, 
      user,
      message: 'تم إنشاء حساب الموظف بنجاح. يمكنه الآن تسجيل الدخول برقم الهاتف وكلمة المرور.' 
    });
  } catch (error: unknown) {
    const msg = formatDatabaseError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, tenant_id, full_name, phone, password, role, branch_id, is_active,
      job_title, base_salary, salary_type, daily_hours, national_id, hire_date, shift_name,
      allowed_pages
    } = body;

    if (!id || !tenant_id) {
      return NextResponse.json({ error: 'User ID and tenant ID are required' }, { status: 400 });
    }

    let cleanedPhone = phone;
    if (phone) {
      cleanedPhone = phone.replace(/\D/g, '').trim();
      if (cleanedPhone.length !== 11) {
        return NextResponse.json({ 
          error: 'رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط (مثال: 01012345678)' 
        }, { status: 400 });
      }

      // Check if phone belongs to another user
      const existingUser = await findUserByPhoneOrEmail(cleanedPhone);
      if (existingUser && existingUser.id !== id) {
        return NextResponse.json({
          error: `رقم الهاتف (${cleanedPhone}) مسجل بالفعل لمستخدم آخر.`
        }, { status: 409 });
      }
    }

    const updated = await updateUser(id, tenant_id, {
      full_name,
      phone: cleanedPhone,
      role,
      branch_id,
      allowed_pages: allowed_pages !== undefined ? allowed_pages : undefined,
      password_hash: password || undefined,
      is_active,
      job_title,
      base_salary: base_salary !== undefined ? Number(base_salary) : undefined,
      salary_type,
      daily_hours: daily_hours !== undefined ? Number(daily_hours) : undefined,
      national_id,
      hire_date,
      shift_name,
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: 'تم تحديث بيانات وصلاحيات الموظف بنجاح.'
    });
  } catch (error: unknown) {
    const msg = formatDatabaseError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId');

    if (!id || !tenantId) {
      return NextResponse.json({ error: 'User ID and tenant ID are required' }, { status: 400 });
    }

    const deleted = await deleteUser(id, tenantId);
    if (!deleted) {
      return NextResponse.json({ 
        error: 'تعذر حذف الموظف. قد يكون الحساب مرتبطاً بعمليات أو ورديات مسجلة.' 
      }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'تم حذف حساب الموظف بنجاح' });
  } catch (error: unknown) {
    const msg = formatDatabaseError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

