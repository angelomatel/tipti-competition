import { MatchRecord } from '@/db/models/MatchRecord';
import { getRiotClient } from '@/services/riotService';
import { logger } from '@/lib/logger';
import type { PlayerDocument } from '@/types/Player';

export async function captureMatchesForPlayer(player: PlayerDocument): Promise<void> {
  const riot = getRiotClient();
  const matchIds = await riot.getMatchIdsByPuuid(player.puuid, 10);

  for (const matchId of matchIds) {
    const exists = await MatchRecord.exists({ puuid: player.puuid, matchId });
    if (exists) continue;

    try {
      const match = await riot.getMatchById(matchId);
      const participant = match.info.participants.find((p) => p.puuid === player.puuid);
      if (!participant) continue;

      await MatchRecord.create({
        puuid:      player.puuid,
        matchId,
        placement:  participant.placement,
        playedAt:   new Date(match.info.game_datetime),
      });
    } catch (err) {
      logger.error({ err, matchId }, `Match fetch failed for ${matchId}`);
    }
  }
}
