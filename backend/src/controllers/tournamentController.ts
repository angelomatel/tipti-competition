import type { Request, Response, NextFunction } from 'express';
import {
  getTournamentSettings,
  updateTournamentSettings,
} from '@/services/tournamentService';

export async function getTournament(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await getTournamentSettings();
    res.json({ settings });
  } catch (err) { next(err); }
}

export async function updateTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      name, startDate, endDate,
      feedChannelId, dailyChannelId, godStandingsChannelId,
    } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (startDate !== undefined) updates.startDate = new Date(startDate);
    if (endDate !== undefined) updates.endDate = new Date(endDate);
    if (feedChannelId !== undefined) updates.feedChannelId = feedChannelId;
    if (dailyChannelId !== undefined) updates.dailyChannelId = dailyChannelId;
    if (godStandingsChannelId !== undefined) updates.godStandingsChannelId = godStandingsChannelId;

    const settings = await updateTournamentSettings(updates);
    res.json({ settings });
  } catch (err) { next(err); }
}
