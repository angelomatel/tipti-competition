import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSchedule = vi.fn();
const mockInfo = vi.fn();
const mockRunScheduledDataFetchJob = vi.fn();
const mockRunDailyProcessing = vi.fn();

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

vi.mock('@/lib/scheduledDataFetch', () => ({
  runScheduledDataFetchJob: mockRunScheduledDataFetchJob,
}));

vi.mock('@/services/dailyProcessingService', () => ({
  runDailyProcessing: mockRunDailyProcessing,
}));

describe('startDailyCronJob', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSchedule.mockReset();
    mockInfo.mockReset();
    mockRunScheduledDataFetchJob.mockReset();
    mockRunDailyProcessing.mockReset();
  });

  it('registers the daily processing job at midnight PHT and delegates to dailyProcessingService', async () => {
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

    const scheduledHandler = mockSchedule.mock.calls[0]?.[1] as (() => void) | undefined;
    scheduledHandler?.();

    expect(mockRunScheduledDataFetchJob).toHaveBeenCalledWith('daily-cron', expect.any(Function));

    const delegatedJob = mockRunScheduledDataFetchJob.mock.calls[0]?.[1] as (() => Promise<void>) | undefined;
    await delegatedJob?.();

    expect(mockRunDailyProcessing).toHaveBeenCalledTimes(1);
  });
});
