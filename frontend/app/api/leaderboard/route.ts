import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/src/lib/constants';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const backendParams = new URLSearchParams();

    const page = searchParams.get('page');
    const pageSize = searchParams.get('pageSize');
    const search = searchParams.get('search');
    if (page) backendParams.set('page', page);
    if (pageSize) backendParams.set('pageSize', pageSize);
    if (search?.trim()) backendParams.set('search', search.trim());

    const query = backendParams.toString();
    const backendUrl = `${BACKEND_URL}/api/leaderboard${query ? `?${query}` : ''}`;

    const res = await fetch(backendUrl, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: res.status });
    }
    const data = await res.json();

    // Strip puuid from entries — internal field, not for the client
    const stripPuuid = (entry: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'puuid'));

    if (Array.isArray(data.entries)) data.entries = data.entries.map(stripPuuid);
    if (Array.isArray(data.podiumEntries)) data.podiumEntries = data.podiumEntries.map(stripPuuid);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 502 });
  }
}
