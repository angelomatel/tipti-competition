'use client';

import useSWR from 'swr';
import type { LeaderboardResponse } from '@/src/types/LeaderboardEntry';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UseLeaderboardOptions {
  page?: number;
  pageSize?: number;
  shouldFetch?: boolean;
}

export function useLeaderboard({ page = 1, pageSize = 10, shouldFetch = true }: UseLeaderboardOptions = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return useSWR<LeaderboardResponse>(
    shouldFetch ? `/api/leaderboard?${params.toString()}` : null,
    fetcher,
    {
      refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
      revalidateOnFocus: false,
    },
  );
}
