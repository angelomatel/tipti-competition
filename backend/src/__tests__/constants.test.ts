import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('constants', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses code defaults for runtime tuning instead of env-backed .env values', async () => {
    process.env.CRON_PLAYER_CONCURRENCY = '99';
    process.env.FETCH_INTERVAL_MINUTES = '99';
    process.env.NOTIFICATION_FEED_LIMIT = '999';

    const {
      CRON_PLAYER_CONCURRENCY,
      FETCH_INTERVAL_MINUTES,
      NOTIFICATION_FEED_LIMIT,
    } = await import('@/constants');

    expect(CRON_PLAYER_CONCURRENCY).toBe(4);
    expect(FETCH_INTERVAL_MINUTES).toBe(5);
    expect(NOTIFICATION_FEED_LIMIT).toBe(50);
  });
});
