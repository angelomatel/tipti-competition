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
  matchId: string;
  puuid: string;
  discordId: string;
  gameName: string;
  tagLine: string;
  discordUsername: string;
  discordAvatarUrl: string;
  placement: number;
  lpDelta: number | null;
  lpStatus: 'known' | 'unknown' | 'none';
  godSlug: string | null;
  godBuffs: Array<{ source: string; value: number }>;
  playedAt: Date;
}

export async function getFeedNotifications(): Promise<FeedNotification[]> {
  const settings = await getTournamentSettings();
  const matches = await MatchRecord.find({
    notifiedAt: null,
    playedAt: { $gte: settings.startDate, $lte: settings.endDate },
  }).sort({ playedAt: 1 }).limit(NOTIFICATION_FEED_LIMIT).lean();

  const results: FeedNotification[] = [];
  const puuids = [...new Set(matches.map((match) => match.puuid))];
  const matchIds = matches.map((match) => match.matchId);
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
  const buffsByMatchId = new Map<string, Array<{ source: string; value: number }>>();
  for (const txn of buffTransactions) {
    if (!txn.matchId) continue;
    const buffs = buffsByMatchId.get(txn.matchId) ?? [];
    buffs.push({ source: txn.source, value: txn.value });
    buffsByMatchId.set(txn.matchId, buffs);
  }

  const lpDeltaByPlayerMatch = new Map<string, number>();
  for (const txn of matchTransactions) {
    if (!txn.matchId) continue;
    const key = `${txn.playerId}:${txn.matchId}`;
    lpDeltaByPlayerMatch.set(key, (lpDeltaByPlayerMatch.get(key) ?? 0) + txn.value);
  }

  const snapshotsByPuuid = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const playerSnapshots = snapshotsByPuuid.get(snapshot.puuid) ?? [];
    playerSnapshots.push(snapshot);
    snapshotsByPuuid.set(snapshot.puuid, playerSnapshots);
  }

  for (const match of matches) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) continue;
    const playerMatchKey = `${player.discordId}:${match.matchId}`;
    const playerSnapshots = snapshotsByPuuid.get(match.puuid) ?? [];
    const snapshotBefore = [...playerSnapshots].reverse().find((snapshot) => snapshot.capturedAt <= match.playedAt) ?? null;
    const snapshotAfter = playerSnapshots.find((snapshot) => snapshot.capturedAt > match.playedAt) ?? null;
    const lpDelta = lpDeltaByPlayerMatch.get(playerMatchKey)
      ?? resolveSnapshotLpDelta(snapshotBefore, snapshotAfter);
    const lpStatus = lpDeltaByPlayerMatch.has(playerMatchKey)
      ? 'known'
      : match.lpAttributionStatus === 'ambiguous'
        ? 'unknown'
        : lpDelta !== null
          ? 'known'
          : 'none';

    results.push({
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
      godSlug: player.godSlug ?? null,
      godBuffs: buffsByMatchId.get(match.matchId) ?? [],
      playedAt: match.playedAt,
    });
  }

  return results;
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
