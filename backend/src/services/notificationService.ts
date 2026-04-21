import { MatchRecord } from '@/db/models/MatchRecord';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { normalizeLP } from '@/lib/normalizeLP';
import { listActivePlayers } from '@/services/playerService';
import { getTournamentSettings } from '@/services/tournamentService';
import { DAILY_GRAPH_TOP_N, NOTIFICATION_FEED_LIMIT } from '@/constants';
import { getPhtDayBounds } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';

export interface FeedNotification {
  notificationType: 'single_match' | 'grouped_matches';
  matchId: string;
  matchIds: string[];
  puuid: string;
  discordId: string;
  gameName: string;
  tagLine: string;
  discordUsername: string;
  discordAvatarUrl: string;
  placement: number | null;
  lpDelta: number | null;
  lpStatus: 'known' | 'resolving' | 'unknown' | 'none';
  godSlug: string | null;
  godBuffs: Array<{ source: string; value: number }>;
  playedAt: Date;
  matches: Array<{
    matchId: string;
    placement: number;
    playedAt: Date;
    godBuffs: Array<{ source: string; value: number }>;
  }>;
}

const warnedStuckMatches = new Set<string>();
const ATTRIBUTION_GRACE_MS = 30 * 60 * 1000;

export async function getFeedNotifications(): Promise<FeedNotification[]> {
  const settings = await getTournamentSettings();
  const pendingMatches = await MatchRecord.find({
    notifiedAt: null,
    playedAt: { $gte: settings.startDate, $lte: settings.endDate },
  }).sort({ playedAt: 1 }).limit(NOTIFICATION_FEED_LIMIT * 10).lean();

  const results: FeedNotification[] = [];
  const puuids = [...new Set(pendingMatches.map((match) => match.puuid))];
  const matchIds = pendingMatches.map((match) => match.matchId);
  const [players, buffTransactions, matchTransactions, snapshots] = await Promise.all([
    Player.find({ puuid: { $in: puuids }, isActive: true }).lean(),
    PointTransaction.find({ matchId: { $in: matchIds }, type: 'buff' }).lean(),
    PointTransaction.find({ matchId: { $in: matchIds }, type: 'match', source: 'lp_delta' }).lean(),
    LpSnapshot.find({
      puuid: { $in: puuids },
      capturedAt: { $gte: settings.startDate, $lte: settings.endDate },
    }).sort({ puuid: 1, capturedAt: 1 }).lean(),
  ]);
  const playerByPuuid = new Map(players.map((player) => [player.puuid, player]));
  const playerByDiscordId = new Map(players.map((player) => [player.discordId, player]));
  const buffsByPlayerMatch = new Map<string, Array<{ source: string; value: number }>>();
  const trackedPlayersByMatchId = new Map<string, number>();
  for (const match of pendingMatches) {
    trackedPlayersByMatchId.set(match.matchId, (trackedPlayersByMatchId.get(match.matchId) ?? 0) + 1);
  }

  for (const txn of buffTransactions) {
    if (!txn.matchId || !txn.playerId) continue;
    const owner = playerByDiscordId.get(txn.playerId);
    if (owner && owner.godSlug && txn.godSlug && owner.godSlug !== txn.godSlug) {
      logger.warn(
        {
          playerId: txn.playerId,
          matchId: txn.matchId,
          txnGodSlug: txn.godSlug,
          playerGodSlug: owner.godSlug,
          source: txn.source,
          value: txn.value,
        },
        '[feed] Skipping buff transaction whose godSlug does not match the player\'s current god',
      );
      continue;
    }
    const key = `${txn.playerId}:${txn.matchId}`;
    const buffs = buffsByPlayerMatch.get(key) ?? [];
    buffs.push({ source: txn.source, value: txn.value });
    buffsByPlayerMatch.set(key, buffs);
  }

  const lpDeltaByPlayerMatch = new Map<string, number>();
  const lpTxnCountByPlayerMatch = new Map<string, number>();
  for (const txn of matchTransactions) {
    if (!txn.matchId) continue;
    const key = `${txn.playerId}:${txn.matchId}`;
    lpDeltaByPlayerMatch.set(key, (lpDeltaByPlayerMatch.get(key) ?? 0) + txn.value);
    lpTxnCountByPlayerMatch.set(key, (lpTxnCountByPlayerMatch.get(key) ?? 0) + 1);
  }

  const snapshotsByPuuid = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const playerSnapshots = snapshotsByPuuid.get(snapshot.puuid) ?? [];
    playerSnapshots.push(snapshot);
    snapshotsByPuuid.set(snapshot.puuid, playerSnapshots);
  }

  logger.debug(
    {
      pendingMatchCount: pendingMatches.length,
      uniquePuuidCount: puuids.length,
      uniqueMatchCount: new Set(matchIds).size,
      playerCount: players.length,
      buffTransactionCount: buffTransactions.length,
      lpTransactionCount: matchTransactions.length,
      snapshotCount: snapshots.length,
    },
    '[feed] Loaded pending notifications and attribution inputs',
  );

  const resolvedMatchesByPuuid = new Map<string, Array<{
    matchId: string;
    puuid: string;
    discordId: string;
    gameName: string;
    tagLine: string;
    discordUsername: string;
    discordAvatarUrl: string;
    placement: number;
    lpDelta: number | null;
    lpStatus: 'known' | 'resolving' | 'unknown' | 'none';
    lpSource: 'transaction' | 'snapshot' | 'none';
    godSlug: string | null;
    godBuffs: Array<{ source: string; value: number }>;
    playedAt: Date;
    lpAttributionStatus: 'pending' | 'linked' | 'ambiguous' | null;
  }>>();

  for (const match of pendingMatches) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) {
      logger.warn(
        {
          matchId: match.matchId,
          puuid: match.puuid,
          placement: match.placement,
          playedAt: match.playedAt,
        },
        '[feed] Skipping notification because no active player record matched the match puuid',
      );
      continue;
    }

    const playerMatchKey = `${player.discordId}:${match.matchId}`;
    const playerSnapshots = snapshotsByPuuid.get(match.puuid) ?? [];
    const snapshotBefore = [...playerSnapshots].reverse().find((snapshot) => snapshot.capturedAt <= match.playedAt) ?? null;
    const snapshotAfter = playerSnapshots.find((snapshot) => snapshot.capturedAt > match.playedAt) ?? null;
    const transactionLpDelta = lpDeltaByPlayerMatch.get(playerMatchKey);
    const snapshotLpDelta = resolveSnapshotLpDelta(snapshotBefore, snapshotAfter);
    const lpDelta = transactionLpDelta
      ?? snapshotLpDelta;
    const lpStatus = lpDeltaByPlayerMatch.has(playerMatchKey)
      ? 'known'
      : match.lpAttributionStatus === 'ambiguous'
        ? 'unknown'
        : match.lpAttributionStatus === 'pending'
          ? 'resolving'
        : lpDelta !== null
          ? 'known'
          : 'none';
    const lpSource = transactionLpDelta !== undefined
      ? 'transaction'
      : snapshotLpDelta !== null
        ? 'snapshot'
        : 'none';
    const trackedPlayersInMatch = trackedPlayersByMatchId.get(match.matchId) ?? 1;
    const lpTxnCount = lpTxnCountByPlayerMatch.get(playerMatchKey) ?? 0;

    logger.debug(
      {
        matchId: match.matchId,
        discordId: player.discordId,
        riotId: `${player.gameName}#${player.tagLine}`,
        placement: match.placement,
        playedAt: match.playedAt,
        lpDelta,
        lpStatus,
        lpSource,
        transactionLpDelta: transactionLpDelta ?? null,
        snapshotLpDelta,
        lpTxnCount,
        buffCount: (buffsByPlayerMatch.get(playerMatchKey) ?? []).length,
        trackedPlayersInMatch,
        matchLpAttributionStatus: match.lpAttributionStatus ?? null,
        hasSnapshotBefore: Boolean(snapshotBefore),
        hasSnapshotAfter: Boolean(snapshotAfter),
      },
      '[feed] Resolved notification attribution',
    );

    if (lpSource === 'none' || lpStatus !== 'known') {
      const matchAgeMs = Date.now() - new Date(match.playedAt).getTime();
      const isAmbiguous = match.lpAttributionStatus === 'ambiguous';
      const isStuck = matchAgeMs > ATTRIBUTION_GRACE_MS;
      const warnKey = `${match.matchId}:${player.discordId}`;
      const shouldWarn = (isAmbiguous || isStuck) && !warnedStuckMatches.has(warnKey);

      if (shouldWarn) {
        warnedStuckMatches.add(warnKey);
        logger.warn(
          {
            matchId: match.matchId,
            discordId: player.discordId,
            riotId: `${player.gameName}#${player.tagLine}`,
            placement: match.placement,
            playedAt: match.playedAt,
            lpDelta,
            lpStatus,
            lpSource,
            trackedPlayersInMatch,
            lpTxnCount,
            matchLpAttributionStatus: match.lpAttributionStatus ?? null,
            hasSnapshotBefore: Boolean(snapshotBefore),
            hasSnapshotAfter: Boolean(snapshotAfter),
            matchAgeMs,
          },
          '[feed] Notification is missing a definitive LP attribution',
        );
      } else {
        logger.debug(
          { matchId: match.matchId, discordId: player.discordId, lpStatus, lpSource, matchAgeMs },
          '[feed] Notification is missing a definitive LP attribution',
        );
      }
    }

    const resolvedMatches = resolvedMatchesByPuuid.get(match.puuid) ?? [];
    resolvedMatches.push({
      matchId: match.matchId,
      puuid: match.puuid,
      discordId: player.discordId,
      gameName: player.gameName,
      tagLine: player.tagLine,
      discordUsername: player.discordUsername ?? '',
      discordAvatarUrl: player.discordAvatarUrl ?? '',
      placement: match.placement,
      lpDelta,
      lpStatus,
      lpSource,
      godSlug: player.godSlug ?? null,
      godBuffs: buffsByPlayerMatch.get(playerMatchKey) ?? [],
      playedAt: match.playedAt,
      lpAttributionStatus: match.lpAttributionStatus ?? null,
    });
    resolvedMatchesByPuuid.set(match.puuid, resolvedMatches);
  }

  for (const playerMatches of resolvedMatchesByPuuid.values()) {
    const ambiguousGroup: typeof playerMatches = [];

    for (const match of playerMatches) {
      if (match.lpAttributionStatus === 'ambiguous') {
        ambiguousGroup.push(match);
        continue;
      }

      if (match.lpStatus !== 'known') {
        ambiguousGroup.length = 0;
        continue;
      }

      const groupedMatches = ambiguousGroup.length > 0
        ? [...ambiguousGroup, match]
        : [match];

      results.push({
        notificationType: groupedMatches.length > 1 ? 'grouped_matches' : 'single_match',
        matchId: match.matchId,
        matchIds: groupedMatches.map((item) => item.matchId),
        puuid: match.puuid,
        discordId: match.discordId,
        gameName: match.gameName,
        tagLine: match.tagLine,
        discordUsername: match.discordUsername,
        discordAvatarUrl: match.discordAvatarUrl,
        placement: groupedMatches.length === 1 ? match.placement : null,
        lpDelta: match.lpDelta,
        lpStatus: match.lpStatus,
        godSlug: match.godSlug,
        godBuffs: match.godBuffs,
        playedAt: match.playedAt,
        matches: groupedMatches.map((item) => ({
          matchId: item.matchId,
          placement: item.placement,
          playedAt: item.playedAt,
          godBuffs: item.godBuffs,
        })),
      });
      ambiguousGroup.length = 0;
    }
  }

  results.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const limitedResults = results.slice(0, NOTIFICATION_FEED_LIMIT);

  logger.debug(
    {
      notificationCount: limitedResults.length,
      matchIds: limitedResults.flatMap((result) => result.matchIds),
    },
    '[feed] Prepared notifications for delivery',
  );

  return limitedResults;
}

function resolveSnapshotLpDelta(
  snapshotBefore:
    | { tier: string; rank: string; leaguePoints: number; capturedAt: Date }
    | null,
  snapshotAfter:
    | { tier: string; rank: string; leaguePoints: number; capturedAt: Date }
    | null,
): number | null {
  if (!snapshotBefore || !snapshotAfter) return null;

  // Only derive LP deltas when the match is bounded by two snapshots.
  // Falling back to current player state can leak a later match's LP swing
  // into an earlier feed notification.
  const normBefore = normalizeLP(snapshotBefore.tier, snapshotBefore.rank, snapshotBefore.leaguePoints);
  const normAfter = normalizeLP(snapshotAfter.tier, snapshotAfter.rank, snapshotAfter.leaguePoints);
  return normAfter - normBefore;
}

export async function ackFeedNotifications(matchIds: string[]): Promise<void> {
  await MatchRecord.updateMany(
    { matchId: { $in: matchIds }, notifiedAt: null },
    { $set: { notifiedAt: new Date() } },
  );
}

export interface DailyPlayerStat {
  discordId: string;
  gameName: string;
  lpGain: number;
}

export interface DailySummary {
  climber: DailyPlayerStat | null;
  slider: DailyPlayerStat | null;
  date: string;
}

function buildDailySummaryFromStats(stats: DailyPlayerStat[], date: string): DailySummary {
  if (stats.length === 0) return { climber: null, slider: null, date };

  stats.sort((a, b) => b.lpGain - a.lpGain);
  const climber = stats[0].lpGain > 0 ? stats[0] : null;
  const slider = stats[stats.length - 1].lpGain < 0 ? stats[stats.length - 1] : null;

  return { climber, slider, date };
}

async function getDailySummaryFromScores(date: string): Promise<DailySummary | null> {
  const dailyScores = await DailyPlayerScore.find({ day: date }).lean();
  if (dailyScores.length === 0) {
    return null;
  }

  const players = await Player.find({
    discordId: { $in: dailyScores.map((score) => score.playerId) },
    isActive: true,
  }).lean();

  const playerByDiscordId = new Map(players.map((player) => [player.discordId, player]));
  const stats = dailyScores.flatMap((score) => {
    const player = playerByDiscordId.get(score.playerId);
    if (!player) return [];

    return [{
      discordId: player.discordId,
      gameName: player.gameName,
      lpGain: score.rawLpGain,
    }];
  });

  if (stats.length === 0) {
    return null;
  }

  return buildDailySummaryFromStats(stats, date);
}

async function recomputeDailySummaryFromSnapshots(date: string): Promise<DailySummary> {
  const { dayStart, dayEnd } = getPhtDayBounds(date);
  const players = await listActivePlayers();
  const snapshots = await LpSnapshot.find({
    puuid: { $in: players.map((player) => player.puuid) },
    capturedAt: { $gte: dayStart, $lte: dayEnd },
  })
    .sort({ puuid: 1, capturedAt: 1 })
    .lean();
  const firstSnapshotByPuuid = new Map<string, (typeof snapshots)[number]>();
  const lastSnapshotByPuuid = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!firstSnapshotByPuuid.has(snapshot.puuid)) {
      firstSnapshotByPuuid.set(snapshot.puuid, snapshot);
    }
    lastSnapshotByPuuid.set(snapshot.puuid, snapshot);
  }

  const stats: DailyPlayerStat[] = players.flatMap((player) => {
    const firstSnap = firstSnapshotByPuuid.get(player.puuid);
    const lastSnap = lastSnapshotByPuuid.get(player.puuid);
    if (!firstSnap || !lastSnap || String(firstSnap._id) === String(lastSnap._id)) {
      return [];
    }

    const normFirst = normalizeLP(firstSnap.tier, firstSnap.rank, firstSnap.leaguePoints);
    const normLast = normalizeLP(lastSnap.tier, lastSnap.rank, lastSnap.leaguePoints);
    const lpGain = normLast - normFirst;
    return [{ discordId: player.discordId, gameName: player.gameName, lpGain }];
  });

  return buildDailySummaryFromStats(stats, date);
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const scoreSummary = await getDailySummaryFromScores(date);
  if (scoreSummary) {
    return scoreSummary;
  }

  logger.warn({ date }, '[daily-summary] Falling back to snapshot recompute because daily scores were unavailable.');
  return recomputeDailySummaryFromSnapshots(date);
}

export interface PlayerGraphSeries {
  discordId: string;
  gameName: string;
  tagLine: string;
  discordAvatarUrl?: string;
  dataPoints: Array<{
    time: string;
    normalizedLP: number;
    tier: string;
    rank: string;
    leaguePoints: number;
  }>;
}

export interface DailyGraphData {
  players: PlayerGraphSeries[];
  date: string;
}

export async function getDailyGraphData(date: string): Promise<DailyGraphData> {
  const { dayStart, dayEnd } = getPhtDayBounds(date);
  const players = await listActivePlayers();

  const ranked = players
    .map((p) => ({ player: p, norm: normalizeLP(p.currentTier, p.currentRank, p.currentLP) }))
    .sort((a, b) => b.norm - a.norm)
    .slice(0, DAILY_GRAPH_TOP_N);

  const rankedPlayers = ranked.map(({ player }) => player);
  const snapshots = await LpSnapshot.find({
    puuid: { $in: rankedPlayers.map((player) => player.puuid) },
    capturedAt: { $gte: dayStart, $lte: dayEnd },
  })
    .sort({ puuid: 1, capturedAt: 1 })
    .lean();
  const snapshotsByPuuid = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const playerSnapshots = snapshotsByPuuid.get(snapshot.puuid) ?? [];
    playerSnapshots.push(snapshot);
    snapshotsByPuuid.set(snapshot.puuid, playerSnapshots);
  }

  const series: PlayerGraphSeries[] = rankedPlayers.flatMap((player) => {
    const playerSnapshots = snapshotsByPuuid.get(player.puuid) ?? [];
    if (playerSnapshots.length === 0) return [];

    const dataPoints = playerSnapshots.map((snapshot) => ({
      time: snapshot.capturedAt.toISOString(),
      normalizedLP: normalizeLP(snapshot.tier, snapshot.rank, snapshot.leaguePoints),
      tier: snapshot.tier,
      rank: snapshot.rank,
      leaguePoints: snapshot.leaguePoints,
    }));

    return [{
      discordId: player.discordId,
      gameName: player.gameName,
      tagLine: player.tagLine,
      discordAvatarUrl: player.discordAvatarUrl,
      dataPoints,
    }];
  });

  return { players: series, date };
}
