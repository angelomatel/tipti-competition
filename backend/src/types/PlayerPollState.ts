import type { Document } from 'mongoose';

export type PlayerPollMode = 'baseline' | 'hot';

export interface IPlayerPollState {
  playerId: string;
  puuid: string;
  mode: PlayerPollMode;
  lastProcessedAt: Date | null;
  lastRankPollAt: Date | null;
  lastMatchPollAt: Date | null;
  lastObservedActivityAt: Date | null;
  enteredHotAt: Date | null;
  consecutiveIdleHotPolls: number;
  unresolvedMatchCount: number;
  deferredMatchDetailCount: number;
  nextEligibleAt: Date | null;
}

export type PlayerPollStateDocument = IPlayerPollState & Document;
