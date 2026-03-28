import mongoose from 'mongoose';
import { MONGODB_URI, MONGODB_DB_NAME } from '@/constants';
import { logger } from '@/lib/logger';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      maxPoolSize: 5,
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
