import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from '@/db/connection';
import { configureRoutes } from '@/routing/routes';
import { errorHandler } from '@/middleware/errorHandler';
import { startCronJob } from '@/jobs/cronJob';
import { BACKEND_PORT } from '@/constants';
import { logger } from '@/lib/logger';

const app = express();
app.use(cors());
app.use(express.json());

configureRoutes(app);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDB();
  startCronJob();
  app.listen(BACKEND_PORT, () => {
    logger.info(`Server running on http://localhost:${BACKEND_PORT}`);
  });
}

void start();
