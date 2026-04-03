import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ADMIN_PASSWORD, ADMIN_PASSWORD_HEADER } from '@/constants';

function toHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function isValidPassword(candidate: string): boolean {
  if (!ADMIN_PASSWORD) {
    return false;
  }

  const expected = Buffer.from(ADMIN_PASSWORD, 'utf8');
  const actual = Buffer.from(candidate, 'utf8');

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

export function requireAdminPassword(req: Request, res: Response, next: NextFunction): void {
  const providedPassword = toHeaderValue(req.header(ADMIN_PASSWORD_HEADER));

  if (!isValidPassword(providedPassword)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: `Missing or invalid ${ADMIN_PASSWORD_HEADER} header.`,
    });
    return;
  }

  next();
}
