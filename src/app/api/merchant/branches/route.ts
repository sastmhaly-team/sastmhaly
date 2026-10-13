import { NextRequest, NextResponse } from 'next/server';
import { getBranches } from '@/lib/db/supabase-queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return NextResponse.json({ branches: [] });
  }

  try {
    const branches = await getBranches(tenantId);
    return NextResponse.json({ branches });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ 
    error: 'إضافة الفروع مقتصرة على إدارة المنصة (Super Admin) فقط. يرجى التواصل مع إدارة سستمهالي لإضافة فرع جديد.' 
  }, { status: 403 });
}
