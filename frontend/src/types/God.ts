export interface GodInfo {
  slug: string;
  name: string;
  title: string;
  score: number;
  playerCount: number;
  isEliminated: boolean;
}

export interface GodStandingsResponse {
  standings: GodInfo[];
  updatedAt: string;
}
