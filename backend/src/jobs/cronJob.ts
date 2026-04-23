import cron from 'node-cron';
import {
  FETCH_INTERVAL_MINUTES,
  HOT_POLL_INTERVAL_SECONDS,
  MATCH_DRAIN_INTERVAL_SECONDS,
} from '@/constants';
import { logger } from '@/lib/logger';
import { runScheduledDataFetchJob } from '@/lib/scheduledDataFetch';
import { runCronCycle, runMatchDrainCycle } from '@/services/cronCycleService';

export function startCronJob(): void {
  cron.schedule(`*/${HOT_POLL_INTERVAL_SECONDS / 60} * * * *`, () => {
    void runScheduledDataFetchJob('cron-hot', () => runCronCycle({ source: 'scheduled', cycleType: 'hot' }));
  });
  cron.schedule(`*/${FETCH_INTERVAL_MINUTES} * * * *`, () => {
    void runScheduledDataFetchJob('cron-baseline', () => runCronCycle({ source: 'scheduled', cycleType: 'baseline' }));
  });
  cron.schedule(`*/${MATCH_DRAIN_INTERVAL_SECONDS / 60} * * * *`, () => {
    void runScheduledDataFetchJob('cron-match-drain', () => runMatchDrainCycle({ source: 'scheduled' }));
  });
  logger.debug(
    `[cron] ${HOT_POLL_INTERVAL_SECONDS}-second hot rank job, ${FETCH_INTERVAL_MINUTES}-minute baseline rank job, `
      + `and ${MATCH_DRAIN_INTERVAL_SECONDS}-second match-drain job scheduled.`,
  );
}
