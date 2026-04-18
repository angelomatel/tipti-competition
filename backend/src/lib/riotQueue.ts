import https from 'https';
import {
  RIOT_APP_RATE_PER_120_SECONDS,
  RIOT_APP_RATE_PER_SECOND,
  RIOT_QUEUE_MAX_IN_FLIGHT,
  RIOT_REQUEST_TIMEOUT_MS,
} from '@/constants';
import { logger } from '@/lib/logger';

interface QueuedRequest {
  path: string;
  host: string;
  apiKey: string;
  endpoint: string;
  queuedAt: number;
  retryCount: number;
  rateLimitHitCount: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export interface RiotRequestMetric {
  endpoint: string;
  queuedAt: number;
  startedAt: number;
  finishedAt: number;
  retryCount: number;
  rateLimitHitCount: number;
  statusCode: number | null;
  status: 'fulfilled' | 'rejected';
}

export interface RiotQueueSnapshot {
  queuedRequests: number;
  activeRequests: number;
  blockedUntil: number | null;
  blockedForMs: number;
  requestsLastSecond: number;
  requestsLastMinute: number;
  requestsLast120Seconds: number;
}

export class RiotRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private activeRequests = 0;
  private blockedUntil = 0;
  private secondWindow: number[] = [];
  private minuteWindow: number[] = [];
  private twoMinuteWindow: number[] = [];
  private completedMetrics: RiotRequestMetric[] = [];
  private drainTimer: NodeJS.Timeout | null = null;

  enqueue(path: string, host: string, apiKey: string, endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        path,
        host,
        apiKey,
        endpoint,
        queuedAt: Date.now(),
        retryCount: 0,
        rateLimitHitCount: 0,
        resolve,
        reject,
      });
      this.scheduleDrain(0);
    });
  }

  getCompletedMetricsSince(since: number): RiotRequestMetric[] {
    return this.completedMetrics.filter((metric) => metric.finishedAt >= since);
  }

  getSnapshot(): RiotQueueSnapshot {
    const now = Date.now();
    this.pruneWindows(now);
    return {
      queuedRequests: this.queue.length,
      activeRequests: this.activeRequests,
      blockedUntil: this.blockedUntil > now ? this.blockedUntil : null,
      blockedForMs: this.blockedUntil > now ? this.blockedUntil - now : 0,
      requestsLastSecond: this.secondWindow.length,
      requestsLastMinute: this.minuteWindow.length,
      requestsLast120Seconds: this.twoMinuteWindow.length,
    };
  }

  private scheduleDrain(delayMs: number): void {
    if (this.drainTimer) {
      return;
    }

    if (delayMs > 0) {
      logger.info(
        {
          delayMs,
          queuedRequests: this.queue.length,
          activeRequests: this.activeRequests,
        },
        '[riot-queue] Waiting for rate budget',
      );
    }

    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.drain();
    }, Math.max(0, delayMs));
  }

  private drain(): void {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    const now = Date.now();
    this.processing = true;

    if (now < this.blockedUntil) {
      this.scheduleDrain(this.blockedUntil - now);
      return;
    }

    this.pruneWindows(now);

    while (this.activeRequests < RIOT_QUEUE_MAX_IN_FLIGHT && this.queue.length > 0) {
      const waitMs = this.getRateLimitDelay(now);
      if (waitMs > 0) {
        this.scheduleDrain(waitMs);
        return;
      }

      const item = this.queue.shift()!;
      this.recordDispatch(Date.now());
      this.activeRequests += 1;
      this.executeRequest(item);
    }
  }

  private executeRequest(item: QueuedRequest): void {
    const startedAt = Date.now();
    const options: https.RequestOptions = {
      hostname: item.host,
      path: item.path,
      method: 'GET',
      headers: {
        'X-Riot-Token': item.apiKey,
        'Accept': 'application/json',
      },
      timeout: RIOT_REQUEST_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(Buffer.from(c)));
      res.on('end', () => {
        const finishedAt = Date.now();
        const body = Buffer.concat(chunks).toString('utf8');
        const requestLabel = this.formatRequestLabel(item.host, item.path);

        if (res.statusCode === 429) {
          const retryAfter = parseInt(res.headers['retry-after'] as string ?? '1', 10);
          this.blockedUntil = Date.now() + retryAfter * 1000;
          item.retryCount += 1;
          item.rateLimitHitCount += 1;
          this.queue.unshift(item);
          this.activeRequests -= 1;
          this.scheduleDrain(retryAfter * 1000);
          return;
        }

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            item.resolve(JSON.parse(body));
            this.recordMetric(item, startedAt, finishedAt, res.statusCode, 'fulfilled');
          } catch (parseErr) {
            item.reject(parseErr);
            this.recordMetric(item, startedAt, finishedAt, res.statusCode, 'rejected');
          }
        } else {
          const err = new Error(`HTTP ${res.statusCode}: ${body} [${requestLabel}]`);
          (err as any).status = res.statusCode;
          item.reject(err);
          this.recordMetric(item, startedAt, finishedAt, res.statusCode ?? null, 'rejected');
        }

        this.activeRequests -= 1;
        this.scheduleDrain(0);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${RIOT_REQUEST_TIMEOUT_MS}ms [${this.formatRequestLabel(item.host, item.path)}]`));
    });

    req.on('error', (e) => {
      const finishedAt = Date.now();
      item.reject(e);
      this.recordMetric(item, startedAt, finishedAt, (e as any)?.status ?? null, 'rejected');
      this.activeRequests -= 1;
      this.scheduleDrain(0);
    });

    req.end();
  }

  private pruneWindows(now: number): void {
    while (this.secondWindow.length > 0 && now - this.secondWindow[0]! >= 1_000) {
      this.secondWindow.shift();
    }
    while (this.minuteWindow.length > 0 && now - this.minuteWindow[0]! >= 60_000) {
      this.minuteWindow.shift();
    }
    while (this.twoMinuteWindow.length > 0 && now - this.twoMinuteWindow[0]! >= 120_000) {
      this.twoMinuteWindow.shift();
    }
    if (this.completedMetrics.length > 5_000) {
      this.completedMetrics.splice(0, this.completedMetrics.length - 5_000);
    }
  }

  private getRateLimitDelay(now: number): number {
    this.pruneWindows(now);

    if (this.secondWindow.length >= RIOT_APP_RATE_PER_SECOND) {
      const oldest = this.secondWindow[0]!;
      return Math.max(1, 1_000 - (now - oldest));
    }

    if (this.twoMinuteWindow.length >= RIOT_APP_RATE_PER_120_SECONDS) {
      const oldest = this.twoMinuteWindow[0]!;
      return Math.max(1, 120_000 - (now - oldest));
    }

    return 0;
  }

  private recordDispatch(timestamp: number): void {
    this.secondWindow.push(timestamp);
    this.minuteWindow.push(timestamp);
    this.twoMinuteWindow.push(timestamp);
  }

  private formatRequestLabel(host: string, path: string): string {
    return `${host}${path.replace(/\?.*$/, '')}`;
  }

  private recordMetric(
    item: QueuedRequest,
    startedAt: number,
    finishedAt: number,
    statusCode: number | null,
    status: 'fulfilled' | 'rejected',
  ): void {
    this.completedMetrics.push({
      endpoint: item.endpoint,
      queuedAt: item.queuedAt,
      startedAt,
      finishedAt,
      retryCount: item.retryCount,
      rateLimitHitCount: item.rateLimitHitCount,
      statusCode,
      status,
    });
  }
}
