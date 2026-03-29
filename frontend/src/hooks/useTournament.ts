'use client';
import useSWR from 'swr';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';
import { TournamentSettingsResponse } from '@/src/types/Tournament';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTournament() {
  return useSWR<TournamentSettingsResponse>('/api/tournament/settings', fetcher, {
    refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });
}
