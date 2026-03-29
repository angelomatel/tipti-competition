import { PointTransaction } from '@/db/models/PointTransaction';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { GOD_SCORE_TOP_N } from '@/constants';
import { normalizeLP } from '@/lib/normalizeLP';
import { getTodayUTC8 } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import type { TournamentSettingsDocument } from '@/db/models/TournamentSettings';
import type { PlayerDocument } from '@/types/Player';
import type { PlayerScoreBreakdown, DailyPointEntry } from '@/types/God';

export async function computePlayerScore(discordId: string): Promise<number> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function computePlayerScoreBreakdown(discordId: string): Promise<PlayerScoreBreakdown> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$value' },
      },
    },
  ]);

  const breakdown: PlayerScoreBreakdown = {
    match: 0,
    buff: 0,
    penalty: 0,
    godPlacementBonus: 0,
    total: 0,
  };

  for (const row of result) {
    switch (row._id) {
      case 'match':               breakdown.match = row.total; break;
      case 'buff':                breakdown.buff = row.total; break;
      case 'penalty':             breakdown.penalty = row.total; break;
      case 'god_placement_bonus': breakdown.godPlacementBonus = row.total; break;
    }
  }
  breakdown.total = breakdown.match + breakdown.buff + breakdown.penalty + breakdown.godPlacementBonus;
  return breakdown;
}

export async function computePlayerDailyBreakdown(discordId: string): Promise<DailyPointEntry[]> {
  const transactions = await PointTransaction.find({ playerId: discordId })
    .sort({ day: 1, createdAt: 1 })
    .lean();

  const dayMap = new Map<string, DailyPointEntry>();
  for (const tx of transactions) {
    let entry = dayMap.get(tx.day);
    if (!entry) {
      entry = { day: tx.day, transactions: [] };
      dayMap.set(tx.day, entry);
    }
    entry.transactions.push({
      type: tx.type,
      value: tx.value,
      source: tx.source,
    });
  }

  return Array.from(dayMap.values());
}

export async function computePlayerDailyPointGain(discordId: string, day: string): Promise<number> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId, day } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function computeGodScore(godSlug: string): Promise<number> {
  const players = await Player.find({
    godSlug,
    isActive: true,
    isEliminatedFromGod: false,
  });

  if (players.length === 0) return 0;

  const scores: number[] = [];
  for (const player of players) {
    scores.push(await computePlayerScore(player.discordId));
  }

  scores.sort((a, b) => b - a);

  const n = Math.min(
    GOD_SCORE_TOP_N.MAX,
    Math.max(GOD_SCORE_TOP_N.MIN, Math.floor(players.length / 3)),
  );
  const topN = scores.slice(0, n);
  return topN.reduce((sum, s) => sum + s, 0) / topN.length;
}

/**
 * Creates a match PointTransaction for the LP delta since the last scoring.
 * Self-correcting: compares (currentLP - baselineLP) against sum of existing match transactions.
 */
export async function createLpDeltaTransaction(
  player: PlayerDocument,
  settings: TournamentSettingsDocument,
): Promise<void> {
  if (!player.godSlug) return;

  const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);

  // Tournament baseline: first snapshot on/after startDate
  const baseline = await LpSnapshot.findOne({
    puuid: player.puuid,
    capturedAt: { $gte: settings.startDate },
  }).sort({ capturedAt: 1 });

  if (!baseline) return;

  const baseNorm = normalizeLP(baseline.tier, baseline.rank, baseline.leaguePoints);
  const expectedTotal = currentNorm - baseNorm;

  // Sum existing match transactions
  const result = await PointTransaction.aggregate([
    { $match: { playerId: player.discordId, type: 'match' } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  const existingTotal = result[0]?.total ?? 0;

  const delta = expectedTotal - existingTotal;
  if (delta === 0) return;

  const today = getTodayUTC8();
  const phase = settings.phases.find((p) => today >= p.startDay && today <= p.endDay);

  await PointTransaction.create({
    playerId: player.discordId,
    godSlug: player.godSlug,
    type: 'match',
    value: delta,
    source: 'lp_delta',
    day: today,
    phase: phase?.phase ?? settings.currentPhase,
  });

  logger.debug({ discordId: player.discordId, delta }, `[scoring] LP delta transaction created`);
}
