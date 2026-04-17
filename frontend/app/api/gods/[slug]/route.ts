import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/src/lib/constants';
import type { GodDetail, GodPlayer } from '@/src/hooks/useGod';

type SanitizedGodPlayer = Omit<GodPlayer, 'puuid'>;

function stripPlayerPuuid(player: GodPlayer & { puuid?: string }): SanitizedGodPlayer {
  const sanitizedPlayer = { ...player };
  delete sanitizedPlayer.puuid;
  return sanitizedPlayer;
}

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
    const data = (await res.json()) as GodDetail & {
      players?: Array<GodPlayer & { puuid?: string }>;
    };

    // Strip puuid from player entries
    if (data.players) {
      data.players = data.players.map(stripPlayerPuuid);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch god data' }, { status: 502 });
  }
}
