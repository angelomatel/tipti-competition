import type { Request, Response, NextFunction } from 'express';
import { computeLeaderboard } from '@/services/leaderboardService';

export async function getLeaderboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await computeLeaderboard();
    res.json(data);
  } catch (err) { next(err); }
}
