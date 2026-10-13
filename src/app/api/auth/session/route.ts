import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsernameOrEmail, getTenant, getBranches } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'No identifier provided' }, { status: 400 });
  }

  const user = getUserByUsernameOrEmail(username);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safeUser } = user;

  let tenant = null;
  let branches: ReturnType<typeof getBranches> = [];

  if (safeUser.tenant_id) {
    tenant = getTenant(safeUser.tenant_id);
    branches = getBranches(safeUser.tenant_id);
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

    const user = getUserByUsernameOrEmail(loginId);
    if (!user) {
      return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 });
    }

    if (user.password_hash !== password) {
      return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;
    let tenant = null;
    let branches: ReturnType<typeof getBranches> = [];

    if (safeUser.tenant_id) {
      tenant = getTenant(safeUser.tenant_id);
      branches = getBranches(safeUser.tenant_id);
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
