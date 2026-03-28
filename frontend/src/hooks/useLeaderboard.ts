'use client';

import useSWR from 'swr';
import type { LeaderboardResponse } from '@/src/types/LeaderboardEntry';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLeaderboard() {
  return useSWR<LeaderboardResponse>('/api/leaderboard', fetcher, {
    refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });
}
