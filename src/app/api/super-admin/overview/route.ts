import { NextResponse } from 'next/server';
import { getPlatformOverviewMetrics } from '@/lib/db/queries';

export async function GET() {
  try {
    const metrics = getPlatformOverviewMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching platform metrics', error);
    return NextResponse.json({ error: 'Failed to fetch platform metrics' }, { status: 500 });
  }
}
