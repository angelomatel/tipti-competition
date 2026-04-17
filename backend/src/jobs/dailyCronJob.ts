import cron from 'node-cron';
import { PHT_TIMEZONE } from '@/constants';
import { logger } from '@/lib/logger';
import { runScheduledDataFetchJob } from '@/lib/scheduledDataFetch';
import { runDailyProcessing } from '@/services/dailyProcessingService';

export function startDailyCronJob(): void {
  cron.schedule('0 0 * * *', () => {
    void runScheduledDataFetchJob('daily-cron', () => runDailyProcessing());
  }, { timezone: PHT_TIMEZONE });
  logger.info(`[daily-cron] Daily processing job scheduled (0 0 * * *, timezone=${PHT_TIMEZONE}).`);
}
