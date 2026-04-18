import cron from 'node-cron';
import { FETCH_INTERVAL_MINUTES, HOT_POLL_INTERVAL_SECONDS } from '@/constants';
import { logger } from '@/lib/logger';
import { runScheduledDataFetchJob } from '@/lib/scheduledDataFetch';
import { runCronCycle } from '@/services/cronCycleService';

export function startCronJob(): void {
  cron.schedule(`*/${HOT_POLL_INTERVAL_SECONDS / 60} * * * *`, () => {
    void runScheduledDataFetchJob('cron-hot', () => runCronCycle({ source: 'scheduled', cycleType: 'hot' }));
  });
  cron.schedule(`*/${FETCH_INTERVAL_MINUTES} * * * *`, () => {
    void runScheduledDataFetchJob('cron-baseline', () => runCronCycle({ source: 'scheduled', cycleType: 'baseline' }));
  });
  logger.debug(
    `[cron] ${HOT_POLL_INTERVAL_SECONDS}-second hot job and ${FETCH_INTERVAL_MINUTES}-minute baseline job scheduled.`,
  );
}
