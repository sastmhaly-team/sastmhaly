import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsernameOrEmail, getTenant, getBranches } from '@/lib/db/supabase-queries';
import { supabase } from '@/lib/supabase';
import { Branch } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'No identifier provided' }, { status: 400 });
  }

  let user = await getUserByUsernameOrEmail(username);
  if (!user) {
    try {
      const { data: supaUser } = await supabase
        .from('users')
        .select('*')
        .or(`phone.eq.${username},username.eq.${username},email.eq.${username}`)
        .maybeSingle();
      if (supaUser) {
        user = supaUser as any;
      }
    } catch (err) {
      console.error('Supabase user lookup error in GET:', err);
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safeUser } = user;

  let tenant = null;
  let branches: Branch[] = [];

  if (safeUser.tenant_id) {
    tenant = await getTenant(safeUser.tenant_id);
    branches = await getBranches(safeUser.tenant_id);
  }

  return NextResponse.json({
    user: safeUser,
    tenant,
    branches
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, phone, password } = body;
    const loginId = (phone || identifier || '').trim();

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    let user = await getUserByUsernameOrEmail(loginId);
    if (!user) {
      try {
        const { data: supaUser } = await supabase
          .from('users')
          .select('*')
          .or(`phone.eq.${loginId},username.eq.${loginId},email.eq.${loginId}`)
          .maybeSingle();

        if (supaUser) {
          user = supaUser as any;
        }
      } catch (err) {
        console.error('Supabase user lookup error:', err);
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 });
    }

    if (user.password_hash !== password) {
      return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;
    let tenant = null;
    let branches: Branch[] = [];

    if (safeUser.tenant_id) {
      tenant = await getTenant(safeUser.tenant_id);
      branches = await getBranches(safeUser.tenant_id);
    }

    let redirectUrl = '/merchant/dashboard';
    if (safeUser.role === 'super_admin') {
      redirectUrl = '/super-admin';
    } else if (safeUser.role === 'cashier') {
      redirectUrl = '/merchant/pos';
    }

    return NextResponse.json({
      success: true,
      user: safeUser,
      tenant,
      branches,
      redirectUrl
    });
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
