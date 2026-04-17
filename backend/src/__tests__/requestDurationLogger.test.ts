import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestDurationLogger } from '@/middleware/requestDurationLogger';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeResponse(statusCode: number) {
  const res = new EventEmitter() as EventEmitter & { statusCode: number };
  res.statusCode = statusCode;
  return res;
}

describe('requestDurationLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs successful monitored requests at debug', () => {
    const req = { method: 'GET', path: '/api/leaderboard' };
    const res = makeResponse(200);
    const next = vi.fn();

    requestDurationLogger(req as any, res as any, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/leaderboard',
        statusCode: 200,
      }),
      'HTTP request completed',
    );
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs client errors for monitored requests at warn', () => {
    const req = { method: 'GET', path: '/api/leaderboard' };
    const res = makeResponse(404);

    requestDurationLogger(req as any, res as any, vi.fn());
    res.emit('finish');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/leaderboard',
        statusCode: 404,
      }),
      'HTTP request completed with client error',
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs server errors for monitored requests at error', () => {
    const req = { method: 'GET', path: '/api/leaderboard' };
    const res = makeResponse(503);

    requestDurationLogger(req as any, res as any, vi.fn());
    res.emit('finish');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/leaderboard',
        statusCode: 503,
      }),
      'HTTP request completed with server error',
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('does not log unmonitored requests', () => {
    const req = { method: 'GET', path: '/api/health' };
    const res = makeResponse(200);
    const next = vi.fn();

    requestDurationLogger(req as any, res as any, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('treats daily summary and graph routes as monitored', () => {
    for (const path of ['/api/notifications/daily-summary', '/api/notifications/daily-graph']) {
      vi.clearAllMocks();

      const req = { method: 'GET', path };
      const res = makeResponse(200);

      requestDurationLogger(req as any, res as any, vi.fn());
      res.emit('finish');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path,
          statusCode: 200,
        }),
        'HTTP request completed',
      );
    }
  });
});
