import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/src/lib/constants';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/gods/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: res.status });
    }
    const data = await res.json();

    // Strip puuid from player entries
    if (data.players) {
      data.players = data.players.map(({ puuid, ...rest }: any) => rest);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch god data' }, { status: 502 });
  }
}
