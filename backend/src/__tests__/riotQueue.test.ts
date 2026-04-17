import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('https', () => ({
  default: {
    request: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import https from 'https';
import { RiotRequestQueue } from '@/lib/riotQueue';

const mockRequest = vi.mocked(https.request);

function createRequestMock(
  handler: (
    options: { hostname?: string; path?: string },
    callback: (res: EventEmitter & { statusCode?: number; headers: Record<string, string> }) => void,
    req: EventEmitter & { destroy: (err: Error) => void; end: () => void },
  ) => void,
) {
  mockRequest.mockImplementation((options: any, callback: any) => {
    const req = new EventEmitter() as EventEmitter & { destroy: (err: Error) => void; end: () => void };
    req.destroy = (err: Error) => req.emit('error', err);
    req.end = () => handler(options, callback, req);
    return req as any;
  });
}

function emitResponse(
  callback: (res: EventEmitter & { statusCode?: number; headers: Record<string, string> }) => void,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const res = new EventEmitter() as EventEmitter & { statusCode?: number; headers: Record<string, string> };
  res.statusCode = statusCode;
  res.headers = headers;
  callback(res);
  res.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  res.emit('end');
}

describe('RiotRequestQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bounds in-flight requests to the configured concurrency', async () => {
    const queue = new RiotRequestQueue();
    let activeRequests = 0;
    let maxActiveRequests = 0;

    createRequestMock((_options, callback) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      setTimeout(() => {
        emitResponse(callback, 200, { ok: true });
        activeRequests -= 1;
      }, 5);
    });

    await Promise.all(
      Array.from({ length: 6 }, (_, index) => queue.enqueue(`/match/${index}`, 'example.test', 'api-key', 'matchById')),
    );

    expect(maxActiveRequests).toBeLessThanOrEqual(3);
    expect(queue.getCompletedMetricsSince(0)).toHaveLength(6);
  });

  it('retries 429 responses and records retry metrics on the final request', async () => {
    const queue = new RiotRequestQueue();
    let callCount = 0;

    createRequestMock((_options, callback) => {
      callCount += 1;
      if (callCount === 1) {
        emitResponse(callback, 429, 'rate limited', { 'retry-after': '0' });
        return;
      }
      emitResponse(callback, 200, { ok: true });
    });

    await expect(queue.enqueue('/match/1', 'example.test', 'api-key', 'matchById')).resolves.toEqual({ ok: true });

    const [metric] = queue.getCompletedMetricsSince(0);
    expect(metric).toMatchObject({
      endpoint: 'matchById',
      retryCount: 1,
      rateLimitHitCount: 1,
      status: 'fulfilled',
      statusCode: 200,
    });
  });

  it('sanitizes query strings from error messages', async () => {
    const queue = new RiotRequestQueue();

    createRequestMock((_options, callback) => {
      emitResponse(callback, 500, 'boom');
    });

    let caughtError: unknown;
    try {
      await queue.enqueue('/riot/account/v1/accounts/by-puuid/abc?api_key=super-secret', 'example.test', 'api-key', 'accountByPuuid');
    } catch (err) {
      caughtError = err;
    }

    expect(String(caughtError)).toContain('[example.test/riot/account/v1/accounts/by-puuid/abc]');
    expect(String(caughtError)).not.toContain('super-secret');
  });
});
