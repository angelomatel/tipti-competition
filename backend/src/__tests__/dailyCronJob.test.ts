import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSchedule = vi.fn();
const mockInfo = vi.fn();

vi.mock('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockInfo,
  },
}));

describe('startDailyCronJob', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSchedule.mockReset();
    mockInfo.mockReset();
  });

  it('registers the daily processing job at midnight PHT', async () => {
    const { startDailyCronJob } = await import('@/jobs/dailyCronJob');

    startDailyCronJob();

    expect(mockSchedule).toHaveBeenCalledWith(
      '0 0 * * *',
      expect.any(Function),
      { timezone: 'Asia/Manila' },
    );
    expect(mockInfo).toHaveBeenCalledWith(
      '[daily-cron] Daily processing job scheduled (0 0 * * *, timezone=Asia/Manila).',
    );
  });
});
