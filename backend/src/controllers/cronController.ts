import type { Request, Response, NextFunction } from 'express';
import { runCronCycle } from '@/jobs/cronJob';

export async function triggerCron(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void runCronCycle();
    res.json({ message: 'Cron cycle triggered.' });
  } catch (err) { next(err); }
}
