import { SORAKA_STREAK_CAP } from '@/constants';
import { dateToPhtDayStr, getPhtDayBounds } from '@/lib/dateUtils';
import { normalizeLP } from '@/lib/normalizeLP';

import type {
  ActivePlayerRecord,
  DailyBuffTotalRow,
  KayleActivityRow,
  LeanLpSnapshot,
  LeanMatchRecord,
  MatchBuffDerivedState,
  PlayerContext,
} from '@/services/matchBuffProcessor/types';

export function getBuffActivationStart(
  settings: { phases: Array<{ phase: number; startDay: string }> },
): Date | null {
  const phase2 = settings.phases.find((phase) => phase.phase === 2);
  if (!phase2) return null;
  return getPhtDayBounds(phase2.startDay).dayStart;
}

export function buildGodRankings(
  players: Array<Pick<ActivePlayerRecord, 'discordId' | 'godSlug' | 'isEliminatedFromGod'>>,
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

export function mapPlayersByPuuid(
  players: ActivePlayerRecord[],
  targetPuuids: string[],
): Map<string, PlayerContext> {
  const targetPuuidSet = new Set(targetPuuids);
  const playersByPuuid = new Map<string, PlayerContext>();

  for (const player of players) {
    if (!targetPuuidSet.has(player.puuid) || !player.godSlug || player.isEliminatedFromGod) continue;
    playersByPuuid.set(player.puuid, {
      discordId: player.discordId,
      puuid: player.puuid,
      godSlug: player.godSlug,
      currentTier: player.currentTier,
      riotId: player.riotId ?? undefined,
    });
  }

  return playersByPuuid;
}

export function findTopRankedPlayerPuuid(
  godSlug: string,
  rankingsByGod: Map<string, Map<string, number>>,
  players: ActivePlayerRecord[],
): string | null {
  const rankings = rankingsByGod.get(godSlug);
  if (!rankings) return null;

  for (const [playerId, rank] of rankings) {
    if (rank !== 1) continue;
    return players.find((player) => player.discordId === playerId)?.puuid ?? null;
  }

  return null;
}

export function buildMatchBuffDerivedState(params: {
  historicalMatches: LeanMatchRecord[];
  snapshots: LeanLpSnapshot[];
  dailyBuffRows: DailyBuffTotalRow[];
  kayleActivityTransactions: KayleActivityRow[];
  matchDays: string[];
  threshTop1PlayerPuuid: string | null;
  unprocessedMatchIds: Set<string>;
}): MatchBuffDerivedState {
  const groupedMatches = groupHistoricalMatches(params.historicalMatches);

  return {
    matchesByPuuidDay: groupedMatches.matchesByPuuidDay,
    previousPlacementByMatchId: buildPreviousPlacementByMatchId(
      groupedMatches.historicalMatchesByPuuid,
      params.unprocessedMatchIds,
    ),
    streakByMatchId: buildStreakByMatchId(
      groupedMatches.historicalMatchesByPuuid,
      params.unprocessedMatchIds,
    ),
    dailyLpGainByKey: buildDailyLpGainByKey(params.snapshots),
    dailyBuffTotals: new Map(
      params.dailyBuffRows.map((row) => [`${row._id.playerId}:${row._id.day}`, row.total]),
    ),
    kayleActivityAwarded: new Set(
      params.kayleActivityTransactions.map((transaction) => `${transaction.playerId}:${transaction.day}`),
    ),
    threshTop1PlacementByDay: buildThreshTop1PlacementByDay(
      params.matchDays,
      params.threshTop1PlayerPuuid,
      groupedMatches.matchesByPuuidDay,
    ),
  };
}

function groupHistoricalMatches(historicalMatches: LeanMatchRecord[]): {
  historicalMatchesByPuuid: Map<string, LeanMatchRecord[]>;
  matchesByPuuidDay: Map<string, LeanMatchRecord[]>;
} {
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

  return { historicalMatchesByPuuid, matchesByPuuidDay };
}

function buildPreviousPlacementByMatchId(
  historicalMatchesByPuuid: Map<string, LeanMatchRecord[]>,
  unprocessedMatchIds: Set<string>,
): Map<string, number | null> {
  const previousPlacementByMatchId = new Map<string, number | null>();

  for (const playerMatches of historicalMatchesByPuuid.values()) {
    for (let index = 0; index < playerMatches.length; index += 1) {
      const match = playerMatches[index]!;
      if (!unprocessedMatchIds.has(match.matchId)) continue;

      const previousMatch = index > 0 ? playerMatches[index - 1]! : null;
      previousPlacementByMatchId.set(match.matchId, previousMatch?.placement ?? null);
    }
  }

  return previousPlacementByMatchId;
}

function buildStreakByMatchId(
  historicalMatchesByPuuid: Map<string, LeanMatchRecord[]>,
  unprocessedMatchIds: Set<string>,
): Map<string, { count: number; isWin: boolean }> {
  const streakByMatchId = new Map<string, { count: number; isWin: boolean }>();

  for (const playerMatches of historicalMatchesByPuuid.values()) {
    for (let index = 0; index < playerMatches.length; index += 1) {
      const match = playerMatches[index]!;
      if (!unprocessedMatchIds.has(match.matchId)) continue;

      const previousMatch = index > 0 ? playerMatches[index - 1]! : null;
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

  return streakByMatchId;
}

function buildDailyLpGainByKey(snapshots: LeanLpSnapshot[]): Map<string, number> {
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
      normalizeLP(lastSnapshot.tier, lastSnapshot.rank, lastSnapshot.leaguePoints)
        - normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints),
    );
  }

  return dailyLpGainByKey;
}

function buildThreshTop1PlacementByDay(
  matchDays: string[],
  threshTop1PlayerPuuid: string | null,
  matchesByPuuidDay: Map<string, LeanMatchRecord[]>,
): Map<string, number | null> {
  const threshTop1PlacementByDay = new Map<string, number | null>();
  if (!threshTop1PlayerPuuid) return threshTop1PlacementByDay;

  for (const day of matchDays) {
    const dayMatches = matchesByPuuidDay.get(`${threshTop1PlayerPuuid}:${day}`) ?? [];
    threshTop1PlacementByDay.set(day, dayMatches.length > 0 ? dayMatches[dayMatches.length - 1]!.placement : null);
  }

  return threshTop1PlacementByDay;
}
