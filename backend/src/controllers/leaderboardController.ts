import type { Request, Response, NextFunction } from 'express';
import { computeLeaderboard } from '@/services/leaderboardService';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const search = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;

    const data = await computeLeaderboard({ page, pageSize, search: typeof search === 'string' ? search : undefined });
    res.json(data);
  } catch (err) { next(err); }
}
