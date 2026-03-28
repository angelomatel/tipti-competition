import type { Tier, Division } from '@/src/types/Rank';

export interface SnapshotPoint {
  capturedAt: string;
  tier: Tier;
  rank: Division | '';
  leaguePoints: number;
  normalizedLP: number;
  wins: number;
  losses: number;
}

export interface MatchEntry {
  matchId: string;
  placement: number;
  playedAt: string;
}

export interface MatchPoint {
  playedAt: string;
  placement: number;
  matchId: string;
  tier: Tier;
  rank: Division | '';
  leaguePoints: number;
  normalizedLP: number;
}

export interface PlayerProfileData {
  discordId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  riotId: string;
  currentTier: Tier;
  currentRank: Division | '';
  currentLP: number;
  currentWins: number;
  currentLosses: number;
  discordAvatarUrl: string;
  discordUsername: string;
}

export interface PlayerProfileResponse {
  player: PlayerProfileData;
  snapshots: SnapshotPoint[];
  matches: MatchEntry[];
  matchPoints: MatchPoint[];
}
