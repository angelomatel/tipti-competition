import { MatchRecord } from '@/db/models/MatchRecord';
import { getRiotClient } from '@/services/riotService';
import { getTournamentSettings } from '@/services/tournamentService';
import { TftQueueId } from '@/lib/riotClient';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { withRetry } from '@/lib/withRetry';
import type { PlayerDocument } from '@/types/Player';

export async function captureMatchesForPlayer(player: PlayerDocument): Promise<void> {
  const riot = getRiotClient();
  const settings = await getTournamentSettings();
  let duplicateCount = 0;
  let nonRankedCount = 0;
  let outOfWindowCount = 0;
  let missingParticipantCount = 0;
  let capturedCount = 0;
  const playerLabel = getPlayerLogLabel(player);
  logger.debug(
    { discordId: player.discordId, riotId: player.riotId ?? null, puuid: player.puuid },
    `[match] Starting match capture for ${playerLabel}`,
  );

  // Use the player's most recent captured match as startTime to avoid gaps
  const lastMatch = await MatchRecord.findOne({ puuid: player.puuid }).sort({ playedAt: -1 });
  const startTime = lastMatch
    ? Math.floor(lastMatch.playedAt.getTime() / 1000)
    : Math.floor(settings.startDate.getTime() / 1000);
  logger.debug(
    {
      discordId: player.discordId,
      lastMatchId: lastMatch?.matchId ?? null,
      lastMatchPlayedAt: lastMatch?.playedAt?.toISOString() ?? null,
      startTime,
    },
    '[match] Computed startTime for match history fetch',
  );

  logger.debug({ discordId: player.discordId, startTime }, '[match] Fetching match IDs from Riot API');
  const matchIds = await riot.getMatchIdsByPuuid(player.puuid, 50, 'SEA_REGIONAL', startTime);
  logger.debug({ discordId: player.discordId, fetchedMatchIdCount: matchIds.length }, '[match] Received match IDs from Riot API');

  for (const matchId of matchIds) {
    const exists = await MatchRecord.exists({ puuid: player.puuid, matchId });
    if (exists) {
      duplicateCount += 1;
      continue;
    }

    try {
      const match = await riot.getMatchById(matchId);

      // Defensive guard: skip non-ranked matches (Riot API ?queue filter is not always reliable)
      if (match.info.queue_id !== TftQueueId.RANKED) {
        nonRankedCount += 1;
        continue;
      }

      const matchDate = new Date(match.info.game_datetime);

      // Skip matches outside the tournament window
      if (matchDate < settings.startDate || matchDate > settings.endDate) {
        outOfWindowCount += 1;
        continue;
      }

      const participant = match.info.participants.find((p) => p.puuid === player.puuid);
      if (!participant) {
        missingParticipantCount += 1;
        continue;
      }

      await withRetry('MatchRecord.create', () => MatchRecord.create({
        puuid:      player.puuid,
        matchId,
        placement:  participant.placement,
        playedAt:   matchDate,
      }));
      capturedCount += 1;

      logger.info(
        {
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          puuid: player.puuid,
          matchId,
          placement: participant.placement,
          playedAt: matchDate.toISOString(),
        },
        `[match] Captured ranked tournament match ${matchId} for ${playerLabel}`,
      );
    } catch (err) {
      logger.error(
        { err, discordId: player.discordId, riotId: player.riotId ?? null, matchId },
        `[match] Failed to fetch match ${matchId} for ${playerLabel}`,
      );
    }
  }

  if (capturedCount > 0) {
    logger.info(
      {
        discordId: player.discordId,
        riotId: player.riotId ?? null,
        puuid: player.puuid,
        fetchedMatchIdCount: matchIds.length,
        capturedCount,
        duplicateCount,
        nonRankedCount,
        outOfWindowCount,
        missingParticipantCount,
      },
      `[match] Match capture summary for ${playerLabel}`,
    );
  }

  logger.debug(
    { discordId: player.discordId, riotId: player.riotId ?? null, puuid: player.puuid },
    `[match] Match capture complete for ${playerLabel}`,
  );
}
