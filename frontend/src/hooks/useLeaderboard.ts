'use client';

import useSWR from 'swr';
import type { LeaderboardResponse } from '@/src/types/LeaderboardEntry';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UseLeaderboardOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  shouldFetch?: boolean;
}

export function useLeaderboard({ page = 1, pageSize = 10, search = '', shouldFetch = true }: UseLeaderboardOptions = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set('search', normalizedSearch);

  return useSWR<LeaderboardResponse>(
    shouldFetch ? `/api/leaderboard?${params.toString()}` : null,
    fetcher,
    {
      keepPreviousData: true,
      refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
      revalidateOnFocus: false,
    },
  );
}
