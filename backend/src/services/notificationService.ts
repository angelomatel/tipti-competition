import { MatchRecord } from '@/db/models/MatchRecord';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { normalizeLP } from '@/lib/normalizeLP';
import { listActivePlayers } from '@/services/playerService';
import { getTournamentSettings } from '@/services/tournamentService';
import { DAILY_GRAPH_TOP_N, NOTIFICATION_FEED_LIMIT } from '@/constants';
import { getDayBoundsUTC8 } from '@/lib/dateUtils';

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
  const [players, buffTransactions] = await Promise.all([
    Player.find({ puuid: { $in: puuids }, isActive: true }).lean(),
    PointTransaction.find({ matchId: { $in: matchIds }, type: 'buff' }).lean(),
  ]);

  const playerByPuuid = new Map(players.map((player) => [player.puuid, player]));
  const buffsByMatchId = new Map<string, Array<{ source: string; value: number }>>();
  for (const txn of buffTransactions) {
    if (!txn.matchId) continue;
    const buffs = buffsByMatchId.get(txn.matchId) ?? [];
    buffs.push({ source: txn.source, value: txn.value });
    buffsByMatchId.set(txn.matchId, buffs);
  }

  for (const match of matches) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) continue;

    // Find snapshot just before and just after the match to compute LP delta
    const snapshotBefore = await LpSnapshot.findOne({
      puuid: match.puuid,
      capturedAt: { $lte: match.playedAt },
    }).sort({ capturedAt: -1 });

    const snapshotAfter = await LpSnapshot.findOne({
      puuid: match.puuid,
      capturedAt: { $gt: match.playedAt },
    }).sort({ capturedAt: 1 });

    let lpDelta: number | null = null;
    if (snapshotBefore && snapshotAfter) {
      const normBefore = normalizeLP(snapshotBefore.tier, snapshotBefore.rank, snapshotBefore.leaguePoints);
      const normAfter = normalizeLP(snapshotAfter.tier, snapshotAfter.rank, snapshotAfter.leaguePoints);
      lpDelta = normAfter - normBefore;
    } else if (snapshotAfter) {
      // Only have post-match snapshot — compare to player's pre-registration baseline (rough)
      const normAfter = normalizeLP(snapshotAfter.tier, snapshotAfter.rank, snapshotAfter.leaguePoints);
      const normCurrent = normalizeLP(player.currentTier, player.currentRank, player.currentLP);
      lpDelta = normCurrent - normAfter;
    }

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
      godSlug: player.godSlug ?? null,
      godBuffs: buffsByMatchId.get(match.matchId) ?? [],
      playedAt: match.playedAt,
    });
  }

  return results;
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


export async function getDailySummary(date: string): Promise<DailySummary> {
  const { dayStart, dayEnd } = getDayBoundsUTC8(date);
  const players = await listActivePlayers();

  const stats: DailyPlayerStat[] = [];

  for (const player of players) {
    const firstSnap = await LpSnapshot.findOne({
      puuid: player.puuid,
      capturedAt: { $gte: dayStart, $lte: dayEnd },
    }).sort({ capturedAt: 1 });

    const lastSnap = await LpSnapshot.findOne({
      puuid: player.puuid,
      capturedAt: { $gte: dayStart, $lte: dayEnd },
    }).sort({ capturedAt: -1 });

    if (!firstSnap || !lastSnap || firstSnap._id.equals(lastSnap._id)) continue;

    const normFirst = normalizeLP(firstSnap.tier, firstSnap.rank, firstSnap.leaguePoints);
    const normLast = normalizeLP(lastSnap.tier, lastSnap.rank, lastSnap.leaguePoints);
    const lpGain = normLast - normFirst;

    stats.push({ discordId: player.discordId, gameName: player.gameName, lpGain });
  }

  if (stats.length === 0) return { climber: null, slider: null, date };

  stats.sort((a, b) => b.lpGain - a.lpGain);
  const climber = stats[0].lpGain > 0 ? stats[0] : null;
  const slider = stats[stats.length - 1].lpGain < 0 ? stats[stats.length - 1] : null;

  return { climber, slider, date };
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
  const { dayStart, dayEnd } = getDayBoundsUTC8(date);
  const players = await listActivePlayers();

  // Rank players by current normalized LP to pick top N
  const ranked = players
    .map((p) => ({ player: p, norm: normalizeLP(p.currentTier, p.currentRank, p.currentLP) }))
    .sort((a, b) => b.norm - a.norm)
    .slice(0, DAILY_GRAPH_TOP_N);

  const series: PlayerGraphSeries[] = [];

  for (const { player } of ranked) {
    const snapshots = await LpSnapshot.find({
      puuid: player.puuid,
      capturedAt: { $gte: dayStart, $lte: dayEnd },
    }).sort({ capturedAt: 1 });

    if (snapshots.length === 0) continue;

    const dataPoints = snapshots.map((s) => ({
      time: s.capturedAt.toISOString(),
      normalizedLP: normalizeLP(s.tier, s.rank, s.leaguePoints),
      tier: s.tier,
      rank: s.rank,
      leaguePoints: s.leaguePoints,
    }));

    series.push({ 
      discordId: player.discordId, 
      gameName: player.gameName, 
      tagLine: player.tagLine,
      discordAvatarUrl: player.discordAvatarUrl,
      dataPoints,
    });
  }

  return { players: series, date };
}
