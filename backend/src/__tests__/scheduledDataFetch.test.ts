import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import {
  ENABLE_DEV_DATA_FETCH_CRONS_ENV,
  runScheduledDataFetchJob,
  shouldRunScheduledDataFetches,
} from '@/lib/scheduledDataFetch';

const mockInfo = vi.mocked(logger.info);

describe('scheduledDataFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always allows scheduled fetches in production', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    const env = {
      NODE_ENV: 'production',
      [ENABLE_DEV_DATA_FETCH_CRONS_ENV]: 'false',
    } as NodeJS.ProcessEnv;

    expect(shouldRunScheduledDataFetches(env)).toBe(true);

    await runScheduledDataFetchJob('cron', job, env);

    expect(job).toHaveBeenCalledTimes(1);
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('skips scheduled fetches in development by default', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    const env = {
      NODE_ENV: 'development',
    } as NodeJS.ProcessEnv;

    expect(shouldRunScheduledDataFetches(env)).toBe(false);

    await runScheduledDataFetchJob('cron', job, env);

    expect(job).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      {
        nodeEnv: 'development',
        [ENABLE_DEV_DATA_FETCH_CRONS_ENV]: null,
      },
      expect.stringContaining(`${ENABLE_DEV_DATA_FETCH_CRONS_ENV}=true`),
    );
  });

  it('allows scheduled fetches in development when explicitly enabled', async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    const env = {
      NODE_ENV: 'development',
      [ENABLE_DEV_DATA_FETCH_CRONS_ENV]: 'true',
    } as NodeJS.ProcessEnv;

    expect(shouldRunScheduledDataFetches(env)).toBe(true);

    await runScheduledDataFetchJob('daily-cron', job, env);

    expect(job).toHaveBeenCalledTimes(1);
    expect(mockInfo).not.toHaveBeenCalled();
  });
});
