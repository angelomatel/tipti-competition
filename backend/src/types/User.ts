export interface RegisterPlayerRequest {
  discordId: string;
  gameName: string;
  tagLine: string;
  addedBy: string;
  discordAvatarUrl?: string;
  discordUsername?: string;
}
