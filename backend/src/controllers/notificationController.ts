import type { Request, Response, NextFunction } from 'express';
import {
  getFeedNotifications,
  ackFeedNotifications,
  getDailySummary,
  getDailyGraphData,
} from '@/services/notificationService';
import { DATE_PARAM_REGEX } from '@/constants';

function isValidDateParam(date: unknown): date is string {
  return typeof date === 'string' && DATE_PARAM_REGEX.test(date);
}

export async function getNotificationFeed(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notifications = await getFeedNotifications();
    res.json({ notifications });
  } catch (err) { next(err); }
}

export async function ackNotificationFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { matchIds } = req.body as { matchIds: string[] };
    if (!Array.isArray(matchIds)) {
      res.status(400).json({ error: 'matchIds must be an array' });
      return;
    }
    await ackFeedNotifications(matchIds);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function getNotificationDailySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const date = req.query.date;
    if (!isValidDateParam(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }
    const summary = await getDailySummary(date);
    res.json(summary);
  } catch (err) { next(err); }
}

export async function getNotificationDailyGraph(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const date = req.query.date;
    if (!isValidDateParam(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }
    const data = await getDailyGraphData(date);
    res.json(data);
  } catch (err) { next(err); }
}
