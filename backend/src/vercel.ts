import 'tsconfig-paths/register';
import 'dotenv/config';
import { connectDB } from '@/db/connection';
import { app } from '@/app';

let initialized = false;

async function initialize(): Promise<void> {
  if (initialized) return;
  await connectDB();
  initialized = true;
}

export default async function handler(req: any, res: any): Promise<void> {
  await initialize();
  await app(req, res);
}
