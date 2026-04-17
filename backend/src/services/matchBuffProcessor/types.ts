export interface BuffEntry {
  value: number;
  source: string;
  type: 'buff' | 'penalty';
}

export interface PlayerContext {
  discordId: string;
  puuid: string;
  godSlug: string;
  currentTier: string;
  riotId?: string;
}

export type LeanMatchRecord = {
  _id: unknown;
  puuid: string;
  matchId: string;
  placement: number;
  playedAt: Date;
};

export type LeanLpSnapshot = {
  _id: unknown;
  puuid: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  capturedAt: Date;
};

export interface ActivePlayerRecord {
  discordId: string;
  puuid: string;
  godSlug?: string | null;
  isEliminatedFromGod?: boolean;
  currentTier: string;
  riotId?: string | null;
}

export interface DailyBuffTotalRow {
  _id: {
    playerId: string;
    day: string;
  };
  total: number;
}

export interface KayleActivityRow {
  playerId: string;
  day: string;
}

export interface MatchStreakState {
  count: number;
  isWin: boolean;
}

export interface MatchBuffDerivedState {
  matchesByPuuidDay: Map<string, LeanMatchRecord[]>;
  previousPlacementByMatchId: Map<string, number | null>;
  streakByMatchId: Map<string, MatchStreakState>;
  dailyLpGainByKey: Map<string, number>;
  dailyBuffTotals: Map<string, number>;
  kayleActivityAwarded: Set<string>;
  threshTop1PlacementByDay: Map<string, number | null>;
}
