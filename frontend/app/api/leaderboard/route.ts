import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/leaderboard`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend unavailable' }, { status: res.status });
    }
    const data = await res.json();

    // Strip puuid from entries — internal field, not for the client
    if (data.entries) {
      data.entries = data.entries.map(({ puuid, ...rest }: any) => rest);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 502 });
  }
}
