import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';

const MONITORED_ROUTES = new Set([
  '/api/leaderboard',
  '/api/notifications/feed',
  '/api/notifications/daily-summary',
  '/api/notifications/daily-graph',
  '/api/gods',
  '/api/gods/standings',
  '/api/cron/run',
  '/api/cron/run-daily',
]);

const MONITORED_ROUTE_PATTERNS = [
  /^\/api\/players\/[^/]+$/,
];

function isMonitoredRoute(path: string): boolean {
  return MONITORED_ROUTES.has(path) || MONITORED_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}

export function requestDurationLogger(req: Request, res: Response, next: NextFunction): void {
  if (!isMonitoredRoute(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const logPayload = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    if (res.statusCode >= 500) {
      logger.error(logPayload, 'HTTP request completed with server error');
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload, 'HTTP request completed with client error');
    } else {
      logger.debug(logPayload, 'HTTP request completed');
    }
  });

  next();
}
