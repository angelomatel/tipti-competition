export interface LeaderboardEntry {
  rank: number;
  discordId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  riotId: string;
  currentTier: string;
  currentRank: string;
  currentLP: number;
  currentWins: number;
  currentLosses: number;
  lpGain: number;
  scorePoints: number;
  godSlug: string | null;
  godName: string | null;
  isEliminatedFromGod: boolean;
  dailyPointGain: number;
  discordAvatarUrl: string;
  discordUsername: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  updatedAt: string;
}
