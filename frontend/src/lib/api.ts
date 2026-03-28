import { BACKEND_URL } from '@/src/lib/constants';

export async function fetchPlayer(discordId: string): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/players/${encodeURIComponent(discordId)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch player: ${res.statusText}`);
  return res.json();
}
