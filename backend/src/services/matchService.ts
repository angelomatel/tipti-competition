import { MatchRecord } from '@/db/models/MatchRecord';
import { getRiotClient } from '@/services/riotService';
import { getTournamentSettings } from '@/services/tournamentService';
import { TftQueueId } from '@/lib/riotClient';
import { logger } from '@/lib/logger';
import type { PlayerDocument } from '@/types/Player';

export async function captureMatchesForPlayer(player: PlayerDocument): Promise<void> {
  const riot = getRiotClient();
  const settings = await getTournamentSettings();

  // Use the player's most recent captured match as startTime to avoid gaps
  const lastMatch = await MatchRecord.findOne({ puuid: player.puuid }).sort({ playedAt: -1 });
  const startTime = lastMatch
    ? Math.floor(lastMatch.playedAt.getTime() / 1000)
    : Math.floor(settings.startDate.getTime() / 1000);

  const matchIds = await riot.getMatchIdsByPuuid(player.puuid, 50, 'SEA_REGIONAL', TftQueueId.RANKED, startTime);

  for (const matchId of matchIds) {
    const exists = await MatchRecord.exists({ puuid: player.puuid, matchId });
    if (exists) continue;

    try {
      const match = await riot.getMatchById(matchId);
      const matchDate = new Date(match.info.game_datetime);

      // Skip matches outside the tournament window
      if (matchDate < settings.startDate || matchDate > settings.endDate) continue;

      const participant = match.info.participants.find((p) => p.puuid === player.puuid);
      if (!participant) continue;

      await MatchRecord.create({
        puuid:      player.puuid,
        matchId,
        placement:  participant.placement,
        playedAt:   matchDate,
      });
    } catch (err) {
      logger.error({ err, matchId }, `Match fetch failed for ${matchId}`);
    }
  }
}
