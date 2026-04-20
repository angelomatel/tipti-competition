import type { Document } from 'mongoose';

export interface IPlayer {
  discordId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  riotId: string;
  registeredAt: Date;
  addedBy: string;
  isActive: boolean;
  currentTier: string;
  currentRank: string;
  currentLP: number;
  currentWins: number;
  currentLosses: number;
  discordAvatarUrl: string;
  discordUsername: string;
  godSlug: string | null;
  isEliminatedFromGod: boolean;
  lpBaselineNorm: number | null;
  lpBaselineOffset: number;
}

export interface ILpSnapshot {
  puuid: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  capturedAt: Date;
}

export type BuffSkipReason =
  | 'before_buff_activation'
  | 'no_player'
  | 'rule_returned_empty'
  | 'rule_rolled_zero'
  | 'daily_cap_hit';

export interface IMatchRecord {
  puuid: string;
  matchId: string;
  placement: number;
  playedAt: Date;
  capturedAt: Date;
  notifiedAt: Date | null;
  buffProcessed: boolean;
  buffSkipReason: BuffSkipReason | null;
  lpAttributionStatus: 'pending' | 'linked' | 'ambiguous' | null;
  lpAttributionReason: 'multiple_matches_single_delta' | null;
}

export type PlayerDocument = IPlayer & Document;
export type LpSnapshotDocument = ILpSnapshot & Document;
export type MatchRecordDocument = IMatchRecord & Document;
