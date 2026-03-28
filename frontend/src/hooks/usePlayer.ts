'use client';

import useSWR from 'swr';
import type { PlayerProfileResponse } from '@/src/types/PlayerProfile';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePlayer(discordId: string | null) {
  return useSWR<PlayerProfileResponse>(
    discordId ? `/api/players/${discordId}` : null,
    fetcher,
  );
}
