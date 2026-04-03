import type { Request, Response } from 'express';
import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { PointTransaction } from '@/db/models/PointTransaction';
import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { logger } from '@/lib/logger';
import { resetAllPlayerRankBaselines } from '@/services/playerService';

export async function wipePlayerData(req: Request, res: Response): Promise<void> {
  const results = await Promise.all([
    Player.deleteMany({}),
    LpSnapshot.deleteMany({}),
    MatchRecord.deleteMany({}),
    PointTransaction.deleteMany({}),
    DailyPlayerScore.deleteMany({}),
  ]);

  const summary = {
    players: results[0].deletedCount,
    snapshots: results[1].deletedCount,
    matches: results[2].deletedCount,
    pointTransactions: results[3].deletedCount,
    dailyPlayerScores: results[4].deletedCount,
  };

  logger.info(summary, 'Wiped all player data');
  res.json({ wiped: true, ...summary });
}

export async function resetAllPlayerRanks(_req: Request, res: Response): Promise<void> {
  const result = await resetAllPlayerRankBaselines();

  logger.info(
    result,
    'Reset all player ranks, LP, points, and derived history for a new set',
  );

  res.json({
    ok: true,
    ...result,
  });
}
