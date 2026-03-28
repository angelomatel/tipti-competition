'use client';

import useSWR from 'swr';
import type { GodStandingsResponse } from '@/src/types/God';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGods() {
  return useSWR<GodStandingsResponse>('/api/gods/standings', fetcher, {
    refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });
}
