import { NextRequest, NextResponse } from 'next/server';
import { getTenants, createTenant, updateTenantStatus, renewSubscription, createUser, getTenantBySlug, deleteTenant } from '@/lib/db/supabase-queries';

export async function GET() {
  try {
    const tenants = await getTenants();
    return NextResponse.json({ tenants });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, legal_name, phone, email, slug, owner_name, password,
      duration_months, custom_start_date, custom_end_date 
    } = body;

    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'Name, phone number and password are required' }, { status: 400 });
    }

    // Clean and validate 11-digit phone number
    const cleanedPhone = phone.replace(/\D/g, '').trim();
    if (cleanedPhone.length !== 11) {
      return NextResponse.json({ 
        error: 'Phone number must be exactly 11 digits (e.g. 01012345678)' 
      }, { status: 400 });
    }

    const rawSlug = (slug || name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const tenantSlug = rawSlug || `merchant-${cleanedPhone.slice(-6)}`;

    const existingSlug = await getTenantBySlug(tenantSlug);
    const finalSlug = existingSlug ? `${tenantSlug}-${Date.now().toString().slice(-4)}` : tenantSlug;

    const tenantId = `tenant_${Date.now()}`;
    const merchantEmail = email || `owner_${cleanedPhone}@sastmhaly.com`;

    // 1. Create Tenant with unified All-Inclusive Plan & selected subscription duration
    const newTenant = await createTenant({
      id: tenantId,
      slug: finalSlug,
      name,
      legal_name: legal_name || name,
      phone: cleanedPhone,
      email: merchantEmail,
      plan_id: 'plan_all_inclusive',
      duration_months: duration_months ? Number(duration_months) : 1,
      custom_start_date: custom_start_date || undefined,
      custom_end_date: custom_end_date || undefined,
    });

    // 2. Create Main Owner Account (username is 11-digit phone number, branch_id is undefined/null so they oversee ALL branches)
    await createUser({
      tenant_id: tenantId,
      branch_id: undefined,
      email: merchantEmail,
      username: cleanedPhone,
      password_hash: password,
      full_name: owner_name || name,
      phone: cleanedPhone,
      role: 'merchant_owner',
    });

    return NextResponse.json({
      success: true,
      tenant: newTenant,
      message: 'Merchant provisioned successfully with subscription duration.'
    });
  } catch (error: unknown) {
    console.error('Error creating merchant', error);
    const msg = error instanceof Error ? error.message : 'Failed to create merchant';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, status, duration_months, custom_start_date, custom_end_date } = body;
    if (!id) {
      return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 });
    }

    if (action === 'renew') {
      const updated = await renewSubscription(id, {
        duration_months: duration_months ? Number(duration_months) : undefined,
        custom_start_date,
        custom_end_date,
      });
      return NextResponse.json({ success: true, tenant: updated });
    }

    if (status) {
      await updateTenantStatus(id, status);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action or status' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update merchant' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing merchant id' }, { status: 400 });
    }

    const res = await deleteTenant(id);
    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Failed to delete merchant' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Merchant deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete merchant' }, { status: 500 });
  }
}
