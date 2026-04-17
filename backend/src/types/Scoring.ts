export interface PlayerScoreBreakdown {
  match: number;
  buff: number;
  penalty: number;
  godPlacementBonus: number;
  total: number;
}

export interface DailyPointTransaction {
  type: string;
  value: number;
  source: string;
  matchId?: string | null;
  placement?: number;
  playedAt?: Date;
  lpStatus?: 'known' | 'unknown' | 'none';
}

export interface DailyPointEntry {
  day: string;
  transactions: DailyPointTransaction[];
}
