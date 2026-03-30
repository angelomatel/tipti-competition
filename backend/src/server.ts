import 'tsconfig-paths/register';
import 'dotenv/config';
import { connectDB } from '@/db/connection';
import { startCronJob } from '@/jobs/cronJob';
import { startDailyCronJob } from '@/jobs/dailyCronJob';
import { BACKEND_PORT } from '@/constants';
import { logger } from '@/lib/logger';
import { app } from '@/app';

async function start(): Promise<void> {
  await connectDB();
  startCronJob();
  startDailyCronJob();
  app.listen(BACKEND_PORT, () => {
    logger.info(`Server running on http://localhost:${BACKEND_PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  void start();
}
