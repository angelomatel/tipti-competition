import mongoose from 'mongoose';
import { MONGODB_URI, MONGODB_DB_NAME, MONGODB_BUFFER_TIMEOUT_MS } from '@/constants';
import { logger } from '@/lib/logger';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;
  mongoose.set('bufferTimeoutMS', MONGODB_BUFFER_TIMEOUT_MS);
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      maxPoolSize: 5,
      minPoolSize: 1,
      waitQueueTimeoutMS: 2_000,
    });
    connected = true;
    logger.info(`MongoDB connected: db=${MONGODB_DB_NAME}`);
  } catch (err: any) {
    if (err?.name === 'MongoServerSelectionError' || err?.code === 16500) {
      logger.error({ err }, 'MongoDB connection failed: rate-limit or timeout');
    } else {
      logger.error({ err }, 'MongoDB connection failed');
    }
    throw err;
  }
}
