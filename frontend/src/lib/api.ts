const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

export async function fetchPlayer(discordId: string): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/api/players/${encodeURIComponent(discordId)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to fetch player: ${res.statusText}`);
  return res.json();
}
