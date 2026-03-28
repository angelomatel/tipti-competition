import { MongoServerError } from 'mongodb';
import { MONGODB_WRITE_RETRY_ATTEMPTS, MONGODB_WRITE_RETRY_BASE_DELAY_MS } from '@/constants';
import { logger } from '@/lib/logger';

function isRetryable(err: unknown): boolean {
  if (err instanceof MongoServerError && err.code === 16500) return true;
  if ((err as any)?.name === 'MongooseError' && (err as any).message.includes('timeout')) return true;
  if ((err as any)?.name === 'MongoNetworkError') return true;
  return false;
}

export async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MONGODB_WRITE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MONGODB_WRITE_RETRY_ATTEMPTS) break;
      const delay = MONGODB_WRITE_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      logger.warn({ err, attempt, delay }, `[withRetry] ${label} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
