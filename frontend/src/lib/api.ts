import { BACKEND_URL } from '@/src/lib/constants';
import type { PlayerProfileResponse } from '@/src/types/PlayerProfile';

export async function fetchPlayer(discordId: string): Promise<PlayerProfileResponse> {
  const res = await fetch(`${BACKEND_URL}/api/players/${encodeURIComponent(discordId)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch player: ${res.statusText}`);
  return res.json();
}
