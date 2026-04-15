import 'tsconfig-paths/register';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from '@/db/connection';
import { configureRoutes } from '@/routing/routes';
import { errorHandler } from '@/middleware/errorHandler';
import { requestDurationLogger } from '@/middleware/requestDurationLogger';
import { startCronJob } from '@/jobs/cronJob';
import { startDailyCronJob } from '@/jobs/dailyCronJob';
import { BACKEND_MODE, BACKEND_PORT } from '@/constants';
import { logger } from '@/lib/logger';

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestDurationLogger);

configureRoutes(app);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDB();

  if (BACKEND_MODE === 'cron' || BACKEND_MODE === 'all') {
    startCronJob();
    startDailyCronJob();
    logger.info(`Cron jobs started in BACKEND_MODE=${BACKEND_MODE}`);
  }

  if (BACKEND_MODE === 'http' || BACKEND_MODE === 'all') {
    app.listen(BACKEND_PORT, () => {
      logger.info(`Server running on http://localhost:${BACKEND_PORT}`);
    });
  }
}

void start();
