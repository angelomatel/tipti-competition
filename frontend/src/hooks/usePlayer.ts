'use client';

import useSWR from 'swr';
import type { PlayerProfileResponse } from '@/src/types/PlayerProfile';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePlayer(discordId: string | null, matchLimit?: number) {
  const key = discordId
    ? `/api/players/${discordId}${matchLimit !== undefined ? `?matchLimit=${matchLimit}` : ''}`
    : null;
  return useSWR<PlayerProfileResponse>(key, fetcher);
}
