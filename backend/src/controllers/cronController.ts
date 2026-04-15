import type { Request, Response, NextFunction } from 'express';
import { runCronCycle } from '@/jobs/cronJob';
import { runDailyProcessing } from '@/jobs/dailyCronJob';

export async function triggerCron(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void runCronCycle();
    res.json({ message: 'Cron cycle triggered.' });
  } catch (err) { next(err); }
}

export async function triggerDailyCron(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const day = req.body.day as string | undefined;
    await runDailyProcessing(day);
    res.json({ message: `Daily processing completed${day ? ` for ${day}` : ''}.` });
  } catch (err) { next(err); }
}
