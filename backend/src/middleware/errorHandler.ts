import type { Request, Response, NextFunction } from 'express';
import { MongoServerError } from 'mongodb';
import { logger } from '@/lib/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof MongoServerError) {
    const status = err.code === 16500 ? 503 : 500;
    logger.error({ err, status }, err.message);
    res.status(status).json({ error: 'Database temporarily unavailable' });
    return;
  }
  if (err?.name === 'MongooseError' && err.message.includes('timeout')) {
    logger.error({ err }, 'MongoDB operation timed out');
    res.status(503).json({ error: 'Database operation timed out' });
    return;
  }
  const status: number = err.status ?? err.statusCode ?? 500;
  const message: string = err.message ?? 'Internal server error';
  logger.error({ err, status }, message);
  res.status(status).json({ error: message });
}
