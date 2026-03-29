export interface IPhase {
  phase: number;
  startDay: string;
  endDay: string;
  eliminationCount: number;
}

export interface TournamentSettings {
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  phases: IPhase[];
  currentPhase: number;
  buffsEnabled: boolean;
}

export interface TournamentSettingsResponse {
  settings: TournamentSettings;
}
