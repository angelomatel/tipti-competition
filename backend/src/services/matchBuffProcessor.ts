import { MatchRecord } from '@/db/models/MatchRecord';
import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerScoreTotals } from '@/services/scoringEngine';
import { normalizeLP, TIER_ORDER } from '@/lib/normalizeLP';
import { getCurrentPhtDay, getPhtDayBounds, dateToPhtDayStr } from '@/lib/dateUtils';
import {
  BUFF_DAILY_CAP,
  GOD_DAILY_CAP_OVERRIDES,
  VARUS_FLAT_PER_MATCH,
  VARUS_TOP10_BONUS,
  VARUS_TOP_N,
  EKKO_FLAT_PER_MATCH,
  EKKO_REPEAT_BONUS,
  EVELYNN_FLAT_PER_MATCH,
  EVELYNN_HIGH_LP_PER_MATCH,
  EVELYNN_LP_TIER_THRESHOLDS,
  EVELYNN_LP_DEFAULT_THRESHOLD,
  THRESH_FLAT_PER_MATCH,
  THRESH_MATCH_BONUS,
  THRESH_TOP1_FLAT,
  YASUO_PLACEMENT_BONUSES,
  SORAKA_WIN_STREAK_PER,
  SORAKA_LOSS_STREAK_PER,
  SORAKA_STREAK_CAP,
  KAYLE_FLAT_PER_MATCH,
  KAYLE_ACTIVITY_BONUS,
  KAYLE_ACTIVITY_MIN_MATCHES,
  AHRI_PER_FIRST,
  ASOL_BASE_UPPER,
  ASOL_SHIFT_CAP,
} from '@/constants';
import { logger } from '@/lib/logger';

interface BuffEntry {
  value: number;
  source: string;
  type: 'buff' | 'penalty';
}

interface PlayerContext {
  discordId: string;
  puuid: string;
  godSlug: string;
  currentTier: string;
  riotId?: string;
}

type LeanMatchRecord = {
  _id: unknown;
  puuid: string;
  matchId: string;
  placement: number;
  playedAt: Date;
};

type LeanLpSnapshot = {
  _id: unknown;
  puuid: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  capturedAt: Date;
};

function getPlayerLogLabel(player: Pick<PlayerContext, 'discordId' | 'riotId'>): string {
  return player.riotId ?? `discord:${player.discordId}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDailyCap(godSlug: string): number {
  return GOD_DAILY_CAP_OVERRIDES[godSlug] ?? BUFF_DAILY_CAP;
}

function getEvelynnLpThreshold(tierOrder: number): number {
  for (const tier of EVELYNN_LP_TIER_THRESHOLDS) {
    if (tierOrder <= tier.maxTierOrder) return tier.lp;
  }
  return EVELYNN_LP_DEFAULT_THRESHOLD;
}

function getBuffActivationStart(settings: Awaited<ReturnType<typeof getTournamentSettings>>): Date | null {
  const phase2 = settings.phases.find((phase) => phase.phase === 2);
  if (!phase2) return null;
  return getPhtDayBounds(phase2.startDay).dayStart;
}

function buildGodRankings(
  players: Array<{ discordId: string; godSlug?: string | null; isEliminatedFromGod?: boolean }>,
  scoreTotals: Map<string, number>,
): Map<string, Map<string, number>> {
  const playersByGod = new Map<string, Array<{ discordId: string; score: number }>>();

  for (const player of players) {
    if (!player.godSlug || player.isEliminatedFromGod) continue;
    const godPlayers = playersByGod.get(player.godSlug) ?? [];
    godPlayers.push({
      discordId: player.discordId,
      score: scoreTotals.get(player.discordId) ?? 0,
    });
    playersByGod.set(player.godSlug, godPlayers);
  }

  const rankingsByGod = new Map<string, Map<string, number>>();
  for (const [godSlug, godPlayers] of playersByGod) {
    godPlayers.sort((a, b) => b.score - a.score);
    rankingsByGod.set(
      godSlug,
      new Map(godPlayers.map((player, index) => [player.discordId, index + 1])),
    );
  }

  return rankingsByGod;
}

function computeVarusMatchBuff(rank: number): BuffEntry[] {
  const results: BuffEntry[] = [];
  results.push({ value: VARUS_FLAT_PER_MATCH, source: 'varus_flat', type: 'buff' });
  if (rank <= VARUS_TOP_N) {
    results.push({ value: VARUS_TOP10_BONUS, source: 'varus_top10', type: 'buff' });
  }
  return results;
}

function computeEkkoMatchBuff(placement: number, prevPlacement: number | null): BuffEntry[] {
  const results: BuffEntry[] = [];
  results.push({ value: EKKO_FLAT_PER_MATCH, source: 'ekko_flat', type: 'buff' });
  if (prevPlacement !== null && placement === prevPlacement) {
    results.push({ value: EKKO_REPEAT_BONUS, source: 'ekko_repeat', type: 'buff' });
  }
  return results;
}

function computeEvelynnMatchBuff(dailyLpGain: number, tierOrder: number): BuffEntry[] {
  const threshold = getEvelynnLpThreshold(tierOrder);
  if (dailyLpGain >= threshold) {
    return [{ value: EVELYNN_HIGH_LP_PER_MATCH, source: 'evelynn_high', type: 'buff' }];
  }
  return [{ value: EVELYNN_FLAT_PER_MATCH, source: 'evelynn_flat', type: 'buff' }];
}

function computeThreshMatchBuff(
  placement: number,
  isTop1: boolean,
  top1LatestPlacement: number | null,
): BuffEntry[] {
  if (isTop1) {
    return [{ value: THRESH_TOP1_FLAT, source: 'thresh_top1', type: 'buff' }];
  }

  const results: BuffEntry[] = [];
  results.push({ value: THRESH_FLAT_PER_MATCH, source: 'thresh_flat', type: 'buff' });
  if (top1LatestPlacement !== null && placement === top1LatestPlacement) {
    results.push({ value: THRESH_MATCH_BONUS, source: 'thresh_match', type: 'buff' });
  }
  return results;
}

function computeYasuoMatchBuff(placement: number): BuffEntry[] {
  if (placement < 5 || placement > 8) return [];
  const value = YASUO_PLACEMENT_BONUSES[placement - 5];
  return [{ value, source: `yasuo_${placement}th`, type: 'buff' }];
}

function computeSorakaMatchBuff(streakCount: number, isWinStreak: boolean): BuffEntry[] {
  const cappedStreak = Math.min(streakCount, SORAKA_STREAK_CAP - 1);
  if (cappedStreak === 0) return [];

  if (isWinStreak) {
    return [{ value: cappedStreak * SORAKA_WIN_STREAK_PER, source: 'soraka_streak', type: 'buff' }];
  }
  return [{ value: cappedStreak * SORAKA_LOSS_STREAK_PER, source: 'soraka_loss_streak', type: 'penalty' }];
}

function computeAhriMatchBuff(placement: number): BuffEntry[] {
  if (placement === 1) {
    return [{ value: AHRI_PER_FIRST, source: 'ahri_first_place', type: 'buff' }];
  }
  return [];
}

function computeAsolMatchBuff(placement: number): BuffEntry[] {
  const shift = -Math.min(placement - 1, ASOL_SHIFT_CAP);
  const lower = shift;
  const upper = ASOL_BASE_UPPER + shift;
  const value = randomInt(lower, upper);
  if (value === 0) return [];

  return [{
    value,
    source: 'asol_cosmic',
    type: value > 0 ? 'buff' : 'penalty',
  }];
}

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
    .lean();
  const scoreTotals = await computePlayerScoreTotals(allActivePlayers.map((player) => player.discordId));
  const godRankingsCache = buildGodRankings(allActivePlayers, scoreTotals);

  const playerByPuuid = new Map<string, PlayerContext>();
  for (const player of allActivePlayers) {
    if (!puuids.includes(player.puuid) || !player.godSlug) continue;
    playerByPuuid.set(player.puuid, {
      discordId: player.discordId,
      puuid: player.puuid,
      godSlug: player.godSlug,
      currentTier: player.currentTier,
      riotId: player.riotId ?? undefined,
    });
  }

  let threshTop1PlayerPuuid: string | null = null;
  const threshRankings = godRankingsCache.get('thresh');
  if (threshRankings) {
    for (const [playerId, rank] of threshRankings) {
      if (rank !== 1) continue;
      threshTop1PlayerPuuid = allActivePlayers.find((player) => player.discordId === playerId)?.puuid ?? null;
      break;
    }
  }

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
    PointTransaction.aggregate<{ _id: { playerId: string; day: string }; total: number }>([
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
      .lean(),
  ]);

  const historicalMatchesByPuuid = new Map<string, LeanMatchRecord[]>();
  const matchesByPuuidDay = new Map<string, LeanMatchRecord[]>();
  for (const match of historicalMatches) {
    const playerMatches = historicalMatchesByPuuid.get(match.puuid) ?? [];
    playerMatches.push(match);
    historicalMatchesByPuuid.set(match.puuid, playerMatches);

    const dayKey = `${match.puuid}:${dateToPhtDayStr(match.playedAt)}`;
    const dayMatches = matchesByPuuidDay.get(dayKey) ?? [];
    dayMatches.push(match);
    matchesByPuuidDay.set(dayKey, dayMatches);
  }

  const previousPlacementByMatchId = new Map<string, number | null>();
  const streakByMatchId = new Map<string, { count: number; isWin: boolean }>();
  for (const playerMatches of historicalMatchesByPuuid.values()) {
    for (let index = 0; index < playerMatches.length; index += 1) {
      const match = playerMatches[index]!;
      if (!unprocessedMatchIds.has(match.matchId)) continue;

      const previousMatch = index > 0 ? playerMatches[index - 1]! : null;
      previousPlacementByMatchId.set(match.matchId, previousMatch?.placement ?? null);

      if (!previousMatch) {
        streakByMatchId.set(match.matchId, { count: 0, isWin: true });
        continue;
      }

      const isWin = previousMatch.placement <= 4;
      let count = 0;
      for (let cursor = index - 1; cursor >= 0 && count < SORAKA_STREAK_CAP; cursor -= 1) {
        const streakMatch = playerMatches[cursor]!;
        if ((streakMatch.placement <= 4) !== isWin) break;
        count += 1;
      }
      streakByMatchId.set(match.matchId, { count, isWin });
    }
  }

  const firstSnapshotByKey = new Map<string, LeanLpSnapshot>();
  const lastSnapshotByKey = new Map<string, LeanLpSnapshot>();
  for (const snapshot of snapshots) {
    const snapshotKey = `${snapshot.puuid}:${dateToPhtDayStr(snapshot.capturedAt)}`;
    if (!firstSnapshotByKey.has(snapshotKey)) {
      firstSnapshotByKey.set(snapshotKey, snapshot);
    }
    lastSnapshotByKey.set(snapshotKey, snapshot);
  }

  const dailyLpGainByKey = new Map<string, number>();
  for (const [snapshotKey, firstSnapshot] of firstSnapshotByKey) {
    const lastSnapshot = lastSnapshotByKey.get(snapshotKey);
    if (!lastSnapshot) continue;
    dailyLpGainByKey.set(
      snapshotKey,
      normalizeLP(lastSnapshot.tier, lastSnapshot.rank, lastSnapshot.leaguePoints) -
        normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints),
    );
  }

  const dailyBuffTotals = new Map<string, number>(
    dailyBuffRows.map((row) => [`${row._id.playerId}:${row._id.day}`, row.total]),
  );
  const kayleActivityAwarded = new Set(
    kayleActivityTransactions.map((transaction) => `${transaction.playerId}:${transaction.day}`),
  );

  const threshTop1PlacementByDay = new Map<string, number | null>();
  if (threshTop1PlayerPuuid) {
    for (const day of matchDays) {
      const dayMatches = matchesByPuuidDay.get(`${threshTop1PlayerPuuid}:${day}`) ?? [];
      threshTop1PlacementByDay.set(day, dayMatches.length > 0 ? dayMatches[dayMatches.length - 1]!.placement : null);
    }
  }

  const today = getCurrentPhtDay();
  const phase = settings.phases.find((phaseConfig) => today >= phaseConfig.startDay && today <= phaseConfig.endDay);
  const phaseNum = phase?.phase ?? settings.currentPhase;
  const buffActivationStart = getBuffActivationStart(settings);

  const processedMatchIds: unknown[] = [];
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
      processedMatchIds.push(match._id);
      continue;
    }

    if (buffActivationStart && match.playedAt < buffActivationStart) {
      logger.debug(
        {
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          godSlug: player.godSlug,
          matchId: match.matchId,
          playedAt: match.playedAt.toISOString(),
          buffActivationStart: buffActivationStart.toISOString(),
        },
        `[match-buff] Match ${match.matchId} for ${getPlayerLogLabel(player)} occurred before buff activation; marking processed without buffs`,
      );
      processedMatchIds.push(match._id);
      continue;
    }

    const matchDay = dateToPhtDayStr(match.playedAt);
    const totalKey = `${player.discordId}:${matchDay}`;
    const cap = getDailyCap(player.godSlug);
    let currentTotal = dailyBuffTotals.get(totalKey) ?? 0;
    let entries: BuffEntry[] = [];

    switch (player.godSlug) {
      case 'varus': {
        const rankings = godRankingsCache.get('varus') ?? new Map<string, number>();
        entries = computeVarusMatchBuff(rankings.get(player.discordId) ?? 999);
        break;
      }
      case 'ekko':
        entries = computeEkkoMatchBuff(match.placement, previousPlacementByMatchId.get(match.matchId) ?? null);
        break;
      case 'evelynn': {
        const dailyLpGain = dailyLpGainByKey.get(`${match.puuid}:${matchDay}`) ?? 0;
        const tierOrder = TIER_ORDER[player.currentTier as keyof typeof TIER_ORDER] ?? 0;
        entries = computeEvelynnMatchBuff(dailyLpGain, tierOrder);
        break;
      }
      case 'thresh': {
        const rankings = godRankingsCache.get('thresh') ?? new Map<string, number>();
        const rank = rankings.get(player.discordId) ?? 999;
        const isTop1 = rank === 1;
        const top1Placement = isTop1 ? null : (threshTop1PlacementByDay.get(matchDay) ?? null);
        entries = computeThreshMatchBuff(match.placement, isTop1, top1Placement);
        break;
      }
      case 'yasuo':
        entries = computeYasuoMatchBuff(match.placement);
        break;
      case 'soraka': {
        const streak = streakByMatchId.get(match.matchId) ?? { count: 0, isWin: true };
        const isWin = match.placement <= 4;
        const effectiveCount = streak.count > 0 && streak.isWin === isWin ? streak.count : 0;
        entries = computeSorakaMatchBuff(effectiveCount, isWin);
        break;
      }
      case 'kayle': {
        entries = [{ value: KAYLE_FLAT_PER_MATCH, source: 'kayle_flat', type: 'buff' }];
        const matchesToday = matchesByPuuidDay.get(`${match.puuid}:${matchDay}`)?.length ?? 0;
        if (matchesToday >= KAYLE_ACTIVITY_MIN_MATCHES && !kayleActivityAwarded.has(totalKey)) {
          entries.push({ value: KAYLE_ACTIVITY_BONUS, source: 'kayle_activity', type: 'buff' });
          kayleActivityAwarded.add(totalKey);
        }
        break;
      }
      case 'ahri':
        entries = computeAhriMatchBuff(match.placement);
        break;
      case 'aurelion_sol':
        entries = computeAsolMatchBuff(match.placement);
        break;
    }

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

    dailyBuffTotals.set(totalKey, currentTotal);
    processedMatchIds.push(match._id);
  }

  if (transactionDocs.length > 0) {
    await PointTransaction.insertMany(transactionDocs, { ordered: false });
  }
  if (processedMatchIds.length > 0) {
    await MatchRecord.updateMany(
      { _id: { $in: processedMatchIds } },
      { $set: { buffProcessed: true } },
    );
  }

  logger.debug(`[match-buff] Processed ${unprocessed.length} match buff(s)`);
}
