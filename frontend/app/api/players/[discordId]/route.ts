import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ discordId: string }> },
) {
  const { discordId } = await params;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/players/${encodeURIComponent(discordId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Player not found' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 502 });
  }
}
