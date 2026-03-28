'use client';

import useSWR from 'swr';
import type { LeaderboardResponse } from '@/src/types/LeaderboardEntry';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLeaderboard() {
  return useSWR<LeaderboardResponse>('/api/leaderboard', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  });
}
