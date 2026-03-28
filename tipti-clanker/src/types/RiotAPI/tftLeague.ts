import { Tier, Division } from '@/types/Rank';

// Types for TFT League API responses
export interface MiniSeriesDTO {
  losses: number;
  progress: string; // e.g. "WLL"
  target: number;
  wins: number;
}

export interface TFTLeagueEntryDTO {
  leagueId: string;
  queueType: string;
  tier: Tier;
  rank: Division;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran?: boolean;
  inactive?: boolean;
  freshBlood?: boolean;
  hotStreak?: boolean;
  miniSeries?: MiniSeriesDTO;
}

export default TFTLeagueEntryDTO;
