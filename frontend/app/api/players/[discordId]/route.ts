import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/src/lib/constants';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ discordId: string }> },
) {
  const { discordId } = await params;
  const { searchParams } = new URL(request.url);
  const matchLimit = searchParams.get('matchLimit');

  try {
    const backendUrl = new URL(`${BACKEND_URL}/api/players/${encodeURIComponent(discordId)}`);
    if (matchLimit !== null) backendUrl.searchParams.set('matchLimit', matchLimit);
    const res = await fetch(backendUrl.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Player not found' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 502 });
  }
}
