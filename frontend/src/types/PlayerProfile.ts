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
  lpStatus?: 'known' | 'resolving' | 'unknown' | 'none';
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

export interface DailyPointTransaction {
  type: string;
  value: number;
  source: string;
  matchId?: string | null;
  placement?: number;
  playedAt?: string;
  lpStatus?: 'known' | 'resolving' | 'unknown' | 'none';
}

export interface DailyPointEntry {
  day: string;
  transactions: DailyPointTransaction[];
}

export interface PlayerScoreBreakdown {
  match: number;
  buff: number;
  penalty: number;
  godPlacementBonus: number;
  total: number;
}

export interface PlayerProfileResponse {
  player: PlayerProfileData;
  snapshots: SnapshotPoint[];
  matches?: MatchEntry[];
  matchPoints: MatchPoint[];
  godSlug: string | null;
  godName: string | null;
  godTitle: string | null;
  scorePoints: number;
  pointBreakdown: PlayerScoreBreakdown;
  dailyPoints: DailyPointEntry[];
  pollState?: {
    lastRankPollAt: string | null;
    lastMatchPollAt: string | null;
  } | null;
}
