'use client';

import useSWR from 'swr';
import { LEADERBOARD_REFRESH_INTERVAL } from '@/src/lib/constants';

export interface GodPlayer {
  discordId: string;
  gameName: string;
  tagLine: string;
  currentTier: string;
  currentRank: string;
  currentLP: number;
  scorePoints: number;
  discordAvatarUrl?: string;
  discordUsername?: string;
  isEliminatedFromGod: boolean;
}

export interface GodDetail {
  god: {
    slug: string;
    name: string;
    title: string;
    isEliminated: boolean;
    eliminatedInPhase: number | null;
  };
  players: GodPlayer[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useGod(slug: string | null) {
  return useSWR<GodDetail>(
    slug ? `/api/gods/${slug}` : null,
    fetcher,
    {
      refreshInterval: LEADERBOARD_REFRESH_INTERVAL,
      revalidateOnFocus: false,
    },
  );
}
