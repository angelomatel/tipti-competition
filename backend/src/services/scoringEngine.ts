import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { GOD_SCORE_TOP_N } from '@/constants';
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
