import type { PlayerDocument } from '@/types/Player';

type PlayerLogIdentity = Pick<PlayerDocument, 'discordId'> & Partial<Pick<PlayerDocument, 'riotId' | 'gameName' | 'tagLine'>>;

export function getPlayerLogLabel(player: PlayerLogIdentity): string {
  return player.riotId
    ?? (player.gameName && player.tagLine ? `${player.gameName}#${player.tagLine}` : `discord:${player.discordId}`);
}
