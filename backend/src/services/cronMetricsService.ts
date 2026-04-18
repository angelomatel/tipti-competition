import type { RiotClient, RiotClientQueueSnapshot, RiotClientRequestMetrics } from '@/lib/riotClient';

export interface QueueWaitStats {
  p50QueueWaitMs: number;
  p95QueueWaitMs: number;
}

export interface RiotQueueBackpressureSnapshot extends RiotClientQueueSnapshot, QueueWaitStats {
  recentRequestCount: number;
}

export function getQueueWaitStats(metrics: RiotClientRequestMetrics[]): QueueWaitStats {
  if (metrics.length === 0) {
    return { p50QueueWaitMs: 0, p95QueueWaitMs: 0 };
  }

  const waitTimes = metrics
    .map((metric) => metric.startedAt - metric.queuedAt)
    .sort((a, b) => a - b);

  return {
    p50QueueWaitMs: getPercentile(waitTimes, 0.5),
    p95QueueWaitMs: getPercentile(waitTimes, 0.95),
  };
}

export function summarizeRequestsByEndpoint(metrics: RiotClientRequestMetrics[]): Record<string, number> {
  return metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.endpoint] = (acc[metric.endpoint] ?? 0) + 1;
    return acc;
  }, {});
}

export function getQueueBackpressureSnapshot(
  riotClient: RiotClient,
  nowMs: number,
  lookbackMs = 5 * 60 * 1000,
): RiotQueueBackpressureSnapshot {
  const metrics = riotClient.getRequestMetricsSince(nowMs - lookbackMs);
  const queueStats = getQueueWaitStats(metrics);
  const queueSnapshot = riotClient.getQueueSnapshot();

  return {
    ...queueSnapshot,
    ...queueStats,
    recentRequestCount: metrics.length,
  };
}

function getPercentile(values: number[], percentile: number): number {
  const index = Math.min(values.length - 1, Math.floor((values.length - 1) * percentile));
  return values[index] ?? 0;
}
