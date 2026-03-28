import { MatchRecord } from '@/db/models/MatchRecord';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { normalizeLP } from '@/lib/normalizeLP';
import { listActivePlayers } from '@/services/playerService';
import { NOTIFICATION_PLACEMENTS, DAILY_GRAPH_TOP_N, UTC8_OFFSET_MS } from '@/constants';

export interface FeedNotification {
  matchId: string;
  puuid: string;
  discordId: string;
  gameName: string;
  placement: number;
  lpDelta: number | null;
  playedAt: Date;
}

export async function getFeedNotifications(): Promise<FeedNotification[]> {
  const matches = await MatchRecord.find({
    placement: { $in: NOTIFICATION_PLACEMENTS },
    notifiedAt: null,
  }).sort({ playedAt: 1 });

  const results: FeedNotification[] = [];

  for (const match of matches) {
    const player = await Player.findOne({ puuid: match.puuid, isActive: true });
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
      placement: match.placement,
      lpDelta,
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

/** Returns the start/end of a calendar day in UTC+8 as UTC Date objects. */
function getDayBoundsUTC8(dateStr: string): { dayStart: Date; dayEnd: Date } {
  // dateStr is YYYY-MM-DD in UTC+8; convert to UTC bounds
  const dayStart = new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() - UTC8_OFFSET_MS);
  const dayEnd = new Date(new Date(dateStr + 'T23:59:59.999Z').getTime() - UTC8_OFFSET_MS);
  return { dayStart, dayEnd };
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
  dataPoints: Array<{ time: string; normalizedLP: number }>;
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
    }));

    series.push({ discordId: player.discordId, gameName: player.gameName, dataPoints });
  }

  return { players: series, date };
}
