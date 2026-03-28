import type { Request, Response, NextFunction } from 'express';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getPlayerByDiscordId } from '@/services/playerService';

export async function getSnapshots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshots = await LpSnapshot.find({ puuid: req.params.puuid })
      .sort({ capturedAt: -1 })
      .limit(100);
    res.json({ snapshots });
  } catch (err) { next(err); }
}
