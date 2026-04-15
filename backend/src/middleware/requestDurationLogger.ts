import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';

const MONITORED_ROUTES = new Set([
  '/api/leaderboard',
  '/api/notifications/feed',
  '/api/gods',
  '/api/gods/standings',
]);

export function requestDurationLogger(req: Request, res: Response, next: NextFunction): void {
  if (!MONITORED_ROUTES.has(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }, 'HTTP request completed');
  });

  next();
}
