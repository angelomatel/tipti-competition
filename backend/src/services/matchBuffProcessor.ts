import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { dateToPhtDayStr, getCurrentPhtDay, getPhtDayBounds } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { computePlayerScoreTotals } from '@/services/scoringEngine';
import {
  buildGodRankings,
  buildMatchBuffDerivedState,
  findTopRankedPlayerPuuid,
  getBuffActivationStart,
  mapPlayersByPuuid,
} from '@/services/matchBuffProcessor/context';
import { buildMatchBuffEntries, getDailyCap } from '@/services/matchBuffProcessor/rules';
import type {
  ActivePlayerRecord,
  DailyBuffTotalRow,
  KayleActivityRow,
  LeanLpSnapshot,
  LeanMatchRecord,
} from '@/services/matchBuffProcessor/types';
import { getTournamentSettings } from '@/services/tournamentService';
import type { BuffSkipReason } from '@/types/Player';

export async function processNewMatchBuffs(): Promise<void> {
  const settings = await getTournamentSettings();
  if (!settings.buffsEnabled) {
    logger.debug('[match-buff] Buffs not enabled, skipping');
    return;
  }

  const unprocessed = await MatchRecord.find({ buffProcessed: false }).sort({ playedAt: 1 }).lean() as LeanMatchRecord[];
  if (unprocessed.length === 0) return;

  logger.debug(`[match-buff] Processing ${unprocessed.length} unprocessed match(es)`);

  const unprocessedMatchIds = new Set(unprocessed.map((match) => match.matchId));
  const puuids = [...new Set(unprocessed.map((match) => match.puuid))];
  const matchDays = [...new Set(unprocessed.map((match) => dateToPhtDayStr(match.playedAt)))].sort();

  const allActivePlayers = await Player.find({ isActive: true })
    .select({ discordId: 1, puuid: 1, godSlug: 1, isEliminatedFromGod: 1, currentTier: 1, riotId: 1 })
    .lean() as ActivePlayerRecord[];

  const scoreTotals = await computePlayerScoreTotals(allActivePlayers.map((player) => player.discordId));
  const godRankings = buildGodRankings(allActivePlayers, scoreTotals);
  const playerByPuuid = mapPlayersByPuuid(allActivePlayers, puuids);
  const threshTop1PlayerPuuid = findTopRankedPlayerPuuid('thresh', godRankings, allActivePlayers);

  const minDayStart = matchDays.length > 0 ? getPhtDayBounds(matchDays[0]!).dayStart : null;
  const maxDayEnd = matchDays.length > 0 ? getPhtDayBounds(matchDays[matchDays.length - 1]!).dayEnd : null;
  const contextPuuids = threshTop1PlayerPuuid
    ? [...new Set([...puuids, threshTop1PlayerPuuid])]
    : puuids;
  const playerIds = [...new Set([...playerByPuuid.values()].map((player) => player.discordId))];

  const [historicalMatches, snapshots, dailyBuffRows, kayleActivityTransactions] = await Promise.all([
    maxDayEnd
      ? MatchRecord.find({
        puuid: { $in: contextPuuids },
        playedAt: { $lte: maxDayEnd },
      })
        .sort({ puuid: 1, playedAt: 1 })
        .lean() as Promise<LeanMatchRecord[]>
      : Promise.resolve([] as LeanMatchRecord[]),
    minDayStart && maxDayEnd
      ? LpSnapshot.find({
        puuid: { $in: puuids },
        capturedAt: { $gte: minDayStart, $lte: maxDayEnd },
      })
        .sort({ puuid: 1, capturedAt: 1 })
        .lean() as Promise<LeanLpSnapshot[]>
      : Promise.resolve([] as LeanLpSnapshot[]),
    PointTransaction.aggregate<DailyBuffTotalRow>([
      {
        $match: {
          playerId: { $in: playerIds },
          day: { $in: matchDays },
          type: 'buff',
        },
      },
      {
        $group: {
          _id: { playerId: '$playerId', day: '$day' },
          total: { $sum: '$value' },
        },
      },
    ]),
    PointTransaction.find({
      playerId: { $in: playerIds },
      day: { $in: matchDays },
      source: 'kayle_activity',
    })
      .select({ playerId: 1, day: 1, _id: 0 })
      .lean() as Promise<KayleActivityRow[]>,
  ]);

  const derivedState = buildMatchBuffDerivedState({
    historicalMatches,
    snapshots,
    dailyBuffRows,
    kayleActivityTransactions,
    matchDays,
    threshTop1PlayerPuuid,
    unprocessedMatchIds,
  });

  const today = getCurrentPhtDay();
  const phase = settings.phases.find((phaseConfig) => today >= phaseConfig.startDay && today <= phaseConfig.endDay);
  const phaseNum = phase?.phase ?? settings.currentPhase;
  const buffActivationStart = getBuffActivationStart(settings);

  const processedMatches: Array<{ _id: unknown; skipReason: BuffSkipReason | null }> = [];
  const transactionDocs: Array<{
    playerId: string;
    godSlug: string;
    type: 'buff' | 'penalty';
    value: number;
    source: string;
    matchId: string;
    day: string;
    phase: number;
  }> = [];

  for (const match of unprocessed) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) {
      logger.info(
        {
          puuid: match.puuid,
          matchId: match.matchId,
          placement: match.placement,
          playedAt: match.playedAt.toISOString(),
          reason: 'no_player' satisfies BuffSkipReason,
        },
        `[match-buff] Match ${match.matchId} has no tracked player for puuid ${match.puuid}; marking processed without buffs`,
      );
      processedMatches.push({ _id: match._id, skipReason: 'no_player' });
      continue;
    }

    if (buffActivationStart && match.playedAt < buffActivationStart) {
      logger.info(
        {
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          godSlug: player.godSlug,
          matchId: match.matchId,
          placement: match.placement,
          playedAt: match.playedAt.toISOString(),
          buffActivationStart: buffActivationStart.toISOString(),
          reason: 'before_buff_activation' satisfies BuffSkipReason,
        },
        `[match-buff] Match ${match.matchId} for ${getPlayerLogLabel(player)} occurred before buff activation; marking processed without buffs`,
      );
      processedMatches.push({ _id: match._id, skipReason: 'before_buff_activation' });
      continue;
    }

    const matchDay = dateToPhtDayStr(match.playedAt);
    const totalKey = `${player.discordId}:${matchDay}`;
    const cap = getDailyCap(player.godSlug);
    let currentTotal = derivedState.dailyBuffTotals.get(totalKey) ?? 0;

    const entries = buildMatchBuffEntries({
      match,
      player,
      matchDay,
      rankingsByGod: godRankings,
      previousPlacementByMatchId: derivedState.previousPlacementByMatchId,
      dailyLpGainByKey: derivedState.dailyLpGainByKey,
      threshTop1PlacementByDay: derivedState.threshTop1PlacementByDay,
      streakByMatchId: derivedState.streakByMatchId,
      matchesByPuuidDay: derivedState.matchesByPuuidDay,
      kayleActivityAwarded: derivedState.kayleActivityAwarded,
    });

    let writtenForMatch = 0;
    for (const entry of entries) {
      let finalValue = entry.value;
      if (finalValue > 0) {
        const remaining = cap - currentTotal;
        if (remaining <= 0) continue;
        finalValue = Math.min(finalValue, remaining);
        currentTotal += finalValue;
      }

      if (finalValue === 0) continue;

      transactionDocs.push({
        playerId: player.discordId,
        godSlug: player.godSlug,
        type: entry.type,
        value: finalValue,
        source: entry.source,
        matchId: match.matchId,
        day: matchDay,
        phase: phaseNum,
      });
      writtenForMatch += 1;

      logger.info(
        {
          playerId: player.discordId,
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          godSlug: player.godSlug,
          type: entry.type,
          value: finalValue,
          source: entry.source,
          matchId: match.matchId,
          day: matchDay,
          phase: phaseNum,
        },
        `[match-buff] Created ${entry.type} transaction of ${finalValue} from ${entry.source} for ${getPlayerLogLabel(player)} on match ${match.matchId}`,
      );
    }

    derivedState.dailyBuffTotals.set(totalKey, currentTotal);

    let skipReason: BuffSkipReason | null = null;
    if (writtenForMatch === 0) {
      if (entries.length === 0) {
        skipReason = player.godSlug === 'aurelion_sol' ? 'rule_rolled_zero' : 'rule_returned_empty';
      } else {
        skipReason = 'daily_cap_hit';
      }
      logger.info(
        {
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          godSlug: player.godSlug,
          matchId: match.matchId,
          placement: match.placement,
          day: matchDay,
          phase: phaseNum,
          reason: skipReason,
          currentCapTotal: currentTotal,
          cap,
        },
        `[match-buff] Match ${match.matchId} for ${getPlayerLogLabel(player)} produced no transactions (${skipReason}); marking processed`,
      );
    }

    processedMatches.push({ _id: match._id, skipReason });
  }

  if (transactionDocs.length > 0) {
    await PointTransaction.insertMany(transactionDocs, { ordered: false });
  }
  if (processedMatches.length > 0) {
    await MatchRecord.bulkWrite(
      processedMatches.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { buffProcessed: true, buffSkipReason: entry.skipReason } },
        },
      })),
    );
  }

  logger.debug(`[match-buff] Processed ${unprocessed.length} match buff(s)`);
}
