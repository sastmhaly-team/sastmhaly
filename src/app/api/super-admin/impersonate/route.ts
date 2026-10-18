import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTenant, createUser } from '@/lib/db/supabase-queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const tenant = await getTenant(tenant_id);
    if (!tenant) {
      return NextResponse.json({ error: 'Merchant tenant not found' }, { status: 404 });
    }

    // 1. Try to find the primary owner user of this tenant
    let { data: ownerUser } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('role', 'merchant_owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // 2. If no user with role 'merchant_owner', find any admin or owner user
    if (!ownerUser) {
      const { data: anyAdmin } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant_id)
        .in('role', ['admin', 'owner', 'branch_manager'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      ownerUser = anyAdmin;
    }

    // 3. If no admin, find ANY user of this tenant
    if (!ownerUser) {
      const { data: anyUser } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      ownerUser = anyUser;
    }

    // 4. If still no user exists at all for this tenant, auto-provision main owner
    if (!ownerUser) {
      const cleanedPhone = (tenant.phone || '').replace(/\D/g, '').trim();
      const ownerUsername = cleanedPhone || `owner_${tenant.slug || tenant.id}`;
      ownerUser = await createUser({
        tenant_id: tenant.id,
        branch_id: undefined,
        email: tenant.email || `owner_${tenant.slug}@sastmhaly.com`,
        username: ownerUsername,
        password_hash: '123456',
        full_name: tenant.name,
        phone: tenant.phone || undefined,
        role: 'merchant_owner',
      });
    }

    const identifier = ownerUser.username || ownerUser.phone || ownerUser.email;

    return NextResponse.json({
      success: true,
      identifier,
      user: {
        id: ownerUser.id,
        full_name: ownerUser.full_name,
        username: ownerUser.username,
        phone: ownerUser.phone,
        role: ownerUser.role,
        tenant_id: ownerUser.tenant_id,
      },
      tenant,
    });
  } catch (error: any) {
    console.error('Error in super-admin impersonate:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect merchant account' },
      { status: 500 }
    );
  }
}
