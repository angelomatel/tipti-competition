import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('requireAdminPassword', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_API_PASSWORD = 'super-secret';
  });

  it('allows requests with the correct password header', async () => {
    const { requireAdminPassword } = await import('@/middleware/requireAdminPassword');
    const req = {
      header: vi.fn().mockReturnValue('super-secret'),
    } as unknown as Request;
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    requireAdminPassword(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((res.status as any)).not.toHaveBeenCalled();
  });

  it('rejects requests without the password header', async () => {
    const { requireAdminPassword } = await import('@/middleware/requireAdminPassword');
    const req = {
      header: vi.fn().mockReturnValue(undefined),
    } as unknown as Request;
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    requireAdminPassword(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as any)).toHaveBeenCalledWith(401);
    expect((res.json as any)).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid x-admin-password header.',
    });
  });

  it('rejects requests when the configured password is missing', async () => {
    process.env.ADMIN_API_PASSWORD = '';
    const { requireAdminPassword } = await import('@/middleware/requireAdminPassword');
    const req = {
      header: vi.fn().mockReturnValue('super-secret'),
    } as unknown as Request;
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    requireAdminPassword(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as any)).toHaveBeenCalledWith(401);
  });
});
