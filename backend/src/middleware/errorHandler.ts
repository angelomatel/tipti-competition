import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  const status: number = err.status ?? err.statusCode ?? 500;
  const message: string = err.message ?? 'Internal server error';
  logger.error({ err, status }, message);
  res.status(status).json({ error: message });
}
