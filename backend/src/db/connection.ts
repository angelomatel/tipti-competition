import mongoose from 'mongoose';
import { MONGODB_URI, MONGODB_DB_NAME } from '@/constants';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  connected = true;
  console.log(`MongoDB connected: ${MONGODB_URI}/${MONGODB_DB_NAME}`);
}
