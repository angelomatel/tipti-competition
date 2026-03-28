import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/src/lib/constants';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/gods/standings`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch god standings' }, { status: 502 });
  }
}
