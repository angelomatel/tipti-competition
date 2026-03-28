import type { Request, Response } from 'express';
import { computePlayerScoreBreakdown, computePlayerDailyBreakdown } from '@/services/scoringEngine';

export async function getPlayerPoints(req: Request, res: Response): Promise<void> {
  const discordId = req.params['discordId'] as string;
  const breakdown = await computePlayerScoreBreakdown(discordId);
  res.json(breakdown);
}

export async function getPlayerDailyPoints(req: Request, res: Response): Promise<void> {
  const discordId = req.params['discordId'] as string;
  const daily = await computePlayerDailyBreakdown(discordId);
  res.json(daily);
}
