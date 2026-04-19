import type { Document } from 'mongoose';

export interface IGod {
  slug: string;
  name: string;
  title: string;
  isEliminated: boolean;
  eliminatedAt: Date | null;
  eliminatedInPhase: number | null;
}

export interface IPointTransaction {
  playerId: string;
  godSlug: string;
  type: 'match' | 'buff' | 'penalty' | 'god_placement_bonus';
  value: number;
  source: string;
  matchId: string | null;
  day: string;
  phase: number;
  createdAt: Date;
}

export interface IDailyPlayerScore {
  playerId: string;
  puuid: string;
  godSlug: string;
  day: string;
  rawLpGain: number;
  matchCount: number;
  placements: number[];
  createdAt: Date;
}

export type GodDocument = IGod & Document;
export type PointTransactionDocument = IPointTransaction & Document;
export type DailyPlayerScoreDocument = IDailyPlayerScore & Document;

export interface GodDefinition {
  slug: string;
  name: string;
  title: string;
}

export interface GodStanding {
  slug: string;
  name: string;
  title: string;
  score: number;
  playerCount: number;
  isEliminated: boolean;
  isAcceptingSubjects: boolean;
  registrationMessage: string | null;
}
