import { NextRequest, NextResponse } from 'next/server';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/db/supabase-queries';

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
    const { tenant_id, full_name, phone, password, role, branch_id, email, username } = body;

    if (!tenant_id || !full_name || !phone || !password) {
      return NextResponse.json({ 
        error: 'Full name, 11-digit phone number, and password are required' 
      }, { status: 400 });
    }

    // Clean and validate 11-digit phone number
    const cleanedPhone = phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      return NextResponse.json({ 
        error: 'Phone number must be exactly 11 digits (e.g. 01012345678)' 
      }, { status: 400 });
    }

    const employeeEmail = email || `emp_${cleanedPhone}@sastmhaly.com`;
    const employeeUsername = username || cleanedPhone;

    const user = await createUser({
      tenant_id,
      branch_id: branch_id || undefined,
      email: employeeEmail,
      username: employeeUsername,
      password_hash: password,
      full_name,
      phone: cleanedPhone,
      role: role || 'cashier',
    });

    return NextResponse.json({ 
      success: true, 
      user,
      message: 'Employee created successfully. Can log in with phone and password.' 
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'User creation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tenant_id, full_name, phone, password, role, branch_id, is_active } = body;

    if (!id || !tenant_id) {
      return NextResponse.json({ error: 'User ID and tenant ID are required' }, { status: 400 });
    }

    let cleanedPhone = phone;
    if (phone) {
      cleanedPhone = phone.replace(/\D/g, '').trim();
      if (cleanedPhone.length !== 11) {
        return NextResponse.json({ 
          error: 'Phone number must be exactly 11 digits (e.g. 01012345678)' 
        }, { status: 400 });
      }
    }

    const updated = await updateUser(id, tenant_id, {
      full_name,
      phone: cleanedPhone,
      role,
      branch_id,
      password_hash: password || undefined,
      is_active
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: 'Employee updated successfully.'
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'User update failed';
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
    return NextResponse.json({ success: deleted });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'User deletion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

