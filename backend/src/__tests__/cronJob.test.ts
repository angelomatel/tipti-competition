import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSchedule = vi.fn();
const mockDebug = vi.fn();
const mockRunScheduledDataFetchJob = vi.fn();
const mockRunCronCycle = vi.fn();

vi.mock('node-cron', () => ({
  default: {
    schedule: mockSchedule,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: mockDebug,
  },
}));

vi.mock('@/lib/scheduledDataFetch', () => ({
  runScheduledDataFetchJob: mockRunScheduledDataFetchJob,
}));

vi.mock('@/services/cronCycleService', () => ({
  runCronCycle: mockRunCronCycle,
}));

describe('startCronJob', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSchedule.mockReset();
    mockDebug.mockReset();
    mockRunScheduledDataFetchJob.mockReset();
    mockRunCronCycle.mockReset();
  });

  it('registers the cron schedule and delegates execution to cronCycleService', async () => {
    const { startCronJob } = await import('@/jobs/cronJob');

    startCronJob();

    expect(mockSchedule).toHaveBeenNthCalledWith(1, '*/1 * * * *', expect.any(Function));
    expect(mockSchedule).toHaveBeenNthCalledWith(2, '*/5 * * * *', expect.any(Function));
    expect(mockDebug).toHaveBeenCalledWith('[cron] 60-second hot job and 5-minute baseline job scheduled.');

    const scheduledHandler = mockSchedule.mock.calls[0]?.[1] as (() => void) | undefined;
    scheduledHandler?.();

    expect(mockRunScheduledDataFetchJob).toHaveBeenCalledWith('cron-hot', expect.any(Function));

    const delegatedJob = mockRunScheduledDataFetchJob.mock.calls[0]?.[1] as (() => Promise<void>) | undefined;
    await delegatedJob?.();

    expect(mockRunCronCycle).toHaveBeenCalledWith({ source: 'scheduled', cycleType: 'hot' });

    const baselineHandler = mockSchedule.mock.calls[1]?.[1] as (() => void) | undefined;
    baselineHandler?.();

    expect(mockRunScheduledDataFetchJob).toHaveBeenNthCalledWith(2, 'cron-baseline', expect.any(Function));

    const delegatedBaselineJob = mockRunScheduledDataFetchJob.mock.calls[1]?.[1] as (() => Promise<void>) | undefined;
    await delegatedBaselineJob?.();

    expect(mockRunCronCycle).toHaveBeenNthCalledWith(2, { source: 'scheduled', cycleType: 'baseline' });
  });
});
