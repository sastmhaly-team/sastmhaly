import { NextRequest, NextResponse } from 'next/server';
import { getBranches, createBranch, deleteBranch, getTenant } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    const branches = await getBranches(tenantId);
    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id, code, name_en, name_ar, phone, address, city, opening_hours, manager_name, is_main } = body;

    if (!tenant_id || !code || !name_ar || !phone) {
      return NextResponse.json({ 
        error: 'Tenant ID, branch code, Arabic name, and phone number are required' 
      }, { status: 400 });
    }

    const tenant = await getTenant(tenant_id);
    if (!tenant) {
      return NextResponse.json({ error: 'Merchant tenant not found' }, { status: 404 });
    }

    // Clean and validate 11-digit phone number
    const cleanedPhone = phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      return NextResponse.json({ 
        error: 'Branch phone number must be exactly 11 digits (e.g. 01012345678)' 
      }, { status: 400 });
    }

    const branch = await createBranch(tenant_id, {
      code,
      name_en: name_en || name_ar,
      name_ar,
      phone: cleanedPhone,
      address: address || 'Main Commercial Area',
      city: city || 'Cairo',
      opening_hours: opening_hours || '09:00 - 23:00',
      manager_name: manager_name || ''
    });

    return NextResponse.json({ 
      success: true, 
      branch,
      message: 'Branch provisioned successfully for merchant.' 
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create branch';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const branchId = searchParams.get('branchId');

    if (!tenantId || !branchId) {
      return NextResponse.json({ error: 'tenantId and branchId are required' }, { status: 400 });
    }

    const result = await deleteBranch(tenantId, branchId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete branch' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete branch';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
