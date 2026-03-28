import type { Tier, Division } from '@/src/types/Rank';

export interface LeaderboardEntry {
  rank: number;
  discordId: string;
  gameName: string;
  tagLine: string;
  riotId: string;
  currentTier: Tier;
  currentRank: Division | '';
  currentLP: number;
  currentWins: number;
  currentLosses: number;
  lpGain: number;
  discordAvatarUrl?: string;
  discordUsername?: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  updatedAt: string;
}
