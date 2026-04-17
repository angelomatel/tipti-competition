import { logger } from '@/lib/logger';

export const ENABLE_DEV_DATA_FETCH_CRONS_ENV = 'ENABLE_DEV_DATA_FETCH_CRONS';

const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function shouldRunScheduledDataFetches(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') {
    return true;
  }

  const rawValue = env[ENABLE_DEV_DATA_FETCH_CRONS_ENV]?.trim().toLowerCase();
  return rawValue ? TRUE_ENV_VALUES.has(rawValue) : false;
}

export async function runScheduledDataFetchJob(
  jobName: string,
  job: () => Promise<void> | void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (shouldRunScheduledDataFetches(env)) {
    await job();
    return;
  }

  logger.info(
    {
      nodeEnv: env.NODE_ENV ?? null,
      [ENABLE_DEV_DATA_FETCH_CRONS_ENV]: env[ENABLE_DEV_DATA_FETCH_CRONS_ENV] ?? null,
    },
    `[${jobName}] Scheduled data fetch skipped outside production. Set ${ENABLE_DEV_DATA_FETCH_CRONS_ENV}=true to enable it in development.`,
  );
}
