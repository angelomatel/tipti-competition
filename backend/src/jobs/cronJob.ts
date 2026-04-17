import cron from 'node-cron';
import { FETCH_INTERVAL_MINUTES } from '@/constants';
import { logger } from '@/lib/logger';
import { runScheduledDataFetchJob } from '@/lib/scheduledDataFetch';
import { runCronCycle } from '@/services/cronCycleService';

export function startCronJob(): void {
  cron.schedule(`*/${FETCH_INTERVAL_MINUTES} * * * *`, () => {
    void runScheduledDataFetchJob('cron', () => runCronCycle({ source: 'scheduled' }));
  });
  logger.debug(`[cron] ${FETCH_INTERVAL_MINUTES}-minute snapshot job scheduled.`);
}
