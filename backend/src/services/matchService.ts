import { MatchRecord } from '@/db/models/MatchRecord';
import { getRiotClient } from '@/services/riotService';
import { TftQueueId } from '@/lib/riotClient';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { withRetry } from '@/lib/withRetry';
import {
  MATCH_DETAIL_FETCH_CAP_CATCHUP,
  MATCH_DETAIL_FETCH_CAP_NORMAL,
  MATCH_ID_FETCH_COUNT_CATCHUP,
  MATCH_ID_FETCH_COUNT_NORMAL,
} from '@/constants';
import type { PlayerDocument } from '@/types/Player';
import type { TournamentSettingsDocument } from '@/db/models/TournamentSettings';

export interface CaptureMatchesOptions {
  settings: Pick<TournamentSettingsDocument, 'startDate' | 'endDate'>;
  mode?: 'normal' | 'catch-up';
  requestedMatchIdCount?: number;
  maxMatchDetails?: number;
}

export interface CaptureMatchesResult {
  requestedMatchIdCount: number;
  fetchedMatchIdCount: number;
  matchDetailRequestCount: number;
  capturedCount: number;
  duplicateCount: number;
  nonRankedCount: number;
  outOfWindowCount: number;
  missingParticipantCount: number;
  deferredMatchDetailCount: number;
}

export async function captureMatchesForPlayer(
  player: PlayerDocument,
  options: CaptureMatchesOptions,
): Promise<CaptureMatchesResult> {
  const riot = getRiotClient();
  const mode = options.mode ?? 'normal';
  const settings = options.settings;
  const requestedMatchIdCount = options.requestedMatchIdCount
    ?? (mode === 'catch-up' ? MATCH_ID_FETCH_COUNT_CATCHUP : MATCH_ID_FETCH_COUNT_NORMAL);
  const maxMatchDetails = options.maxMatchDetails
    ?? (mode === 'catch-up' ? MATCH_DETAIL_FETCH_CAP_CATCHUP : MATCH_DETAIL_FETCH_CAP_NORMAL);
  let duplicateCount = 0;
  let nonRankedCount = 0;
  let outOfWindowCount = 0;
  let missingParticipantCount = 0;
  let capturedCount = 0;
  let deferredMatchDetailCount = 0;
  const playerLabel = getPlayerLogLabel(player);
  logger.debug(
    { discordId: player.discordId, riotId: player.riotId ?? null, puuid: player.puuid },
    `[match] Starting match capture for ${playerLabel}`,
  );

  // Use the player's most recent captured match as startTime to avoid gaps
  const lastMatch = await MatchRecord.findOne({ puuid: player.puuid })
    .sort({ playedAt: -1 })
    .lean();
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
  const matchIds = await riot.getMatchIdsByPuuid(player.puuid, requestedMatchIdCount, 'SEA_REGIONAL', startTime);
  logger.debug({ discordId: player.discordId, fetchedMatchIdCount: matchIds.length }, '[match] Received match IDs from Riot API');

  const existingRecords = await MatchRecord.find({
    puuid: player.puuid,
    matchId: { $in: matchIds },
  })
    .select({ matchId: 1, _id: 0 })
    .lean();
  const existingMatchIds = new Set(existingRecords.map((record) => record.matchId));
  const uncapturedMatchIds = matchIds.filter((matchId) => !existingMatchIds.has(matchId));
  duplicateCount = matchIds.length - uncapturedMatchIds.length;

  const matchIdsToFetch = uncapturedMatchIds.slice(0, maxMatchDetails);
  deferredMatchDetailCount = Math.max(0, uncapturedMatchIds.length - matchIdsToFetch.length);

  const bulkOperations: Array<{
    updateOne: {
      filter: { puuid: string; matchId: string };
      update: { $setOnInsert: { puuid: string; matchId: string; placement: number; playedAt: Date } };
      upsert: true;
    };
  }> = [];

  await Promise.all(matchIdsToFetch.map(async (matchId) => {
    try {
      const match = await riot.getMatchById(matchId);

      // Defensive guard: skip non-ranked matches (Riot API ?queue filter is not always reliable)
      if (match.info.queue_id !== TftQueueId.RANKED) {
        nonRankedCount += 1;
        return;
      }

      const matchDate = new Date(match.info.game_datetime);

      // Skip matches outside the tournament window
      if (matchDate < settings.startDate || matchDate > settings.endDate) {
        outOfWindowCount += 1;
        return;
      }

      const participant = match.info.participants.find((p) => p.puuid === player.puuid);
      if (!participant) {
        missingParticipantCount += 1;
        return;
      }

      bulkOperations.push({
        updateOne: {
          filter: { puuid: player.puuid, matchId },
          update: {
            $setOnInsert: {
              puuid: player.puuid,
              matchId,
              placement: participant.placement,
              playedAt: matchDate,
            },
          },
          upsert: true,
        },
      });

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
  }));

  if (bulkOperations.length > 0) {
    const bulkResult = await withRetry('MatchRecord.bulkWrite', () => MatchRecord.bulkWrite(bulkOperations, { ordered: false }));
    capturedCount = (bulkResult as any)?.upsertedCount ?? bulkOperations.length;
  }

  if (capturedCount > 0 || deferredMatchDetailCount > 0) {
    logger.info(
      {
        discordId: player.discordId,
        riotId: player.riotId ?? null,
        puuid: player.puuid,
        requestedMatchIdCount,
        fetchedMatchIdCount: matchIds.length,
        matchDetailRequestCount: matchIdsToFetch.length,
        capturedCount,
        duplicateCount,
        nonRankedCount,
        outOfWindowCount,
        missingParticipantCount,
        deferredMatchDetailCount,
      },
      `[match] Match capture summary for ${playerLabel}`,
    );
  }

  logger.debug(
    { discordId: player.discordId, riotId: player.riotId ?? null, puuid: player.puuid },
    `[match] Match capture complete for ${playerLabel}`,
  );

  return {
    requestedMatchIdCount,
    fetchedMatchIdCount: matchIds.length,
    matchDetailRequestCount: matchIdsToFetch.length,
    capturedCount,
    duplicateCount,
    nonRankedCount,
    outOfWindowCount,
    missingParticipantCount,
    deferredMatchDetailCount,
  };
}
