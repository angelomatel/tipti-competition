import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { captureMatchesForPlayer } from '@/services/matchService';
import { listActivePlayers } from '@/services/playerService';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { getRiotClient } from '@/services/riotService';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { getTournamentSettings } from '@/services/tournamentService';
import {
  getPlayerPollState,
  getPlayerProcessingConcurrency,
  getSchedulerCursor,
  resetCronSchedulerState,
  selectPlayersForCycle,
  setPlayerPollState,
  shouldUseCatchUpMode,
} from '@/services/cronSchedulerService';
import { getQueueWaitStats, summarizeRequestsByEndpoint } from '@/services/cronMetricsService';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import type { PlayerDocument } from '@/types/Player';

export interface RunCronCycleOptions {
  source?: 'scheduled' | 'admin';
  catchUp?: boolean;
}

type CompetitiveState = Pick<
  PlayerDocument,
  'currentTier' | 'currentRank' | 'currentLP' | 'currentWins' | 'currentLosses'
>;

let isRunning = false;

export async function runCronCycle(options: RunCronCycleOptions = {}): Promise<void> {
  if (isRunning) {
    logger.warn('[cron] Previous cycle is still running. Skipping overlapping cycle.');
    return;
  }

  isRunning = true;
  const cycleStartedAt = Date.now();
  const cycleSource = options.source ?? 'scheduled';
  const riotClient = getRiotClient();

  try {
    const settings = await getTournamentSettings();
    const now = new Date();
    logger.debug(
      {
        now: now.toISOString(),
        startDate: settings.startDate.toISOString(),
        endDate: settings.endDate.toISOString(),
      },
      '[cron] Loaded tournament settings for cycle',
    );

    if (!isTournamentActive(now, settings.startDate, settings.endDate)) {
      return;
    }

    logger.debug('[cron] Starting snapshot cycle...');
    logger.debug('[cron] Fetching active players...');

    const players = await listActivePlayers();
    const concurrency = getPlayerProcessingConcurrency();
    const selection = selectPlayersForCycle(players, cycleStartedAt);

    logger.debug(
      `[cron] Processing ${selection.selectedPlayers.length} of ${players.length} active players with concurrency ${concurrency}`,
    );

    await runWithConcurrency(selection.selectedPlayers, concurrency, async (player) => {
      await processPlayerCycle(player, settings, selection.cycleNumber, cycleStartedAt, Boolean(options.catchUp));
    });

    await processMatchBuffs();
    logCycleSummary({
      cycleSource,
      cycleStartedAt,
      playersConsidered: players.length,
      playersProcessed: selection.selectedPlayers.length,
      playersDeferred: selection.deferredPlayers,
      oldestPlayerStalenessMs: selection.oldestPlayerStalenessMs,
      requestMetrics: riotClient.getRequestMetricsSince(cycleStartedAt),
    });

    logger.debug('[cron] Cycle complete.');
  } finally {
    isRunning = false;
  }
}

export function resetCronCycleState(): void {
  isRunning = false;
  resetCronSchedulerState();
}

async function processPlayerCycle(
  player: PlayerDocument,
  settings: Awaited<ReturnType<typeof getTournamentSettings>>,
  cycleNumber: number,
  cycleStartedAt: number,
  cycleCatchUp: boolean,
): Promise<void> {
  const playerLabel = getPlayerLogLabel(player);
  const playerContext = getPlayerContext(player);

  logger.debug(playerContext, `[cron] Processing player ${playerLabel}`);

  try {
    const state = getPlayerPollState(player.discordId);
    const beforeState = getCompetitiveState(player);

    logger.debug(
      { ...playerContext, beforeState },
      `[cron] Current competitive state before refresh for ${playerLabel}`,
    );

    const updatedPlayer = await refreshPlayerSnapshot(player, playerContext, playerLabel, state);
    const matchResult = await capturePlayerMatches(
      player,
      settings,
      cycleStartedAt,
      cycleCatchUp,
      playerContext,
      playerLabel,
      state,
    );

    await syncPlayerScoring(
      playerContext,
      playerLabel,
      beforeState,
      updatedPlayer,
      settings,
      state,
      cycleNumber,
      matchResult.capturedCount,
      matchResult.deferredMatchDetailCount,
    );
    logDeferredMatchDetails(playerContext, playerLabel, matchResult.deferredMatchDetailCount);

    state.lastProcessedAt = Date.now();
    setPlayerPollState(player.discordId, state);
    logger.debug(playerContext, `[cron] Finished processing ${playerLabel}`);
  } catch (err) {
    logger.error({ err, ...playerContext }, `[cron] Failed processing ${playerLabel}`);
  }
}

async function refreshPlayerSnapshot(
  player: PlayerDocument,
  playerContext: ReturnType<typeof getPlayerContext>,
  playerLabel: string,
  state: ReturnType<typeof getPlayerPollState>,
): Promise<PlayerDocument> {
  logger.debug(playerContext, `[cron] Fetching latest ranked snapshot for ${playerLabel}`);

  const updatedPlayer = await captureSnapshotForPlayer(player);
  state.lastRankPollAt = Date.now();

  logger.debug(
    {
      ...playerContext,
      currentTier: updatedPlayer.currentTier,
      currentRank: updatedPlayer.currentRank,
      currentLP: updatedPlayer.currentLP,
      currentWins: updatedPlayer.currentWins,
      currentLosses: updatedPlayer.currentLosses,
    },
    `[cron] Ranked snapshot refresh complete for ${playerLabel}`,
  );

  return updatedPlayer;
}

async function capturePlayerMatches(
  player: PlayerDocument,
  settings: Awaited<ReturnType<typeof getTournamentSettings>>,
  cycleStartedAt: number,
  cycleCatchUp: boolean,
  playerContext: ReturnType<typeof getPlayerContext>,
  playerLabel: string,
  state: ReturnType<typeof getPlayerPollState>,
) {
  logger.debug(playerContext, `[cron] Fetching match history for ${playerLabel}`);

  const mode = shouldUseCatchUpMode(player, cycleCatchUp, cycleStartedAt) ? 'catch-up' : 'normal';
  if (mode === 'catch-up') {
    state.lastCatchupAt = Date.now();
  }

  const matchResult = await captureMatchesForPlayer(player, { settings, mode });
  state.lastMatchPollAt = Date.now();

  logger.debug(playerContext, `[cron] Match history capture complete for ${playerLabel}`);
  return matchResult;
}

async function syncPlayerScoring(
  playerContext: ReturnType<typeof getPlayerContext>,
  playerLabel: string,
  beforeState: CompetitiveState,
  updatedPlayer: PlayerDocument,
  settings: Awaited<ReturnType<typeof getTournamentSettings>>,
  state: ReturnType<typeof getPlayerPollState>,
  cycleNumber: number,
  capturedMatchCount: number,
  deferredMatchDetailCount: number,
): Promise<void> {
  const nowMs = Date.now();
  const competitiveStateChanged = hasCompetitiveStateChanged(beforeState, getCompetitiveState(updatedPlayer));
  state.hasDeferredMatchBacklog = deferredMatchDetailCount > 0;

  if (!competitiveStateChanged) {
    logger.debug(playerContext, `[cron] No competitive state change for ${playerLabel}; skipping scoring`);
  } else {
    logger.debug(playerContext, `[cron] Competitive state changed for ${playerLabel}; creating LP delta transaction`);
    await createLpDeltaTransaction(updatedPlayer, settings, { newMatches: matchResult.newMatches });
  }

  if (capturedMatchCount > 0) {
    state.lastActivityAt = nowMs;
    state.lastSuccessfulMatchCaptureAt = nowMs;
    state.consecutiveNoOpPolls = 0;
    state.lastNoOpPollAt = undefined;
    if (!state.hasDeferredMatchBacklog) {
      state.skipMatchPollUntilCycle = cycleNumber + 3;
    } else {
      state.skipMatchPollUntilCycle = undefined;
    }
    return;
  }

  if (competitiveStateChanged) {
    state.lastActivityAt = nowMs;
    state.consecutiveNoOpPolls = 0;
    state.lastNoOpPollAt = undefined;
    if (!state.hasDeferredMatchBacklog) {
      state.skipMatchPollUntilCycle = cycleNumber + 2;
    } else {
      state.skipMatchPollUntilCycle = undefined;
    }
    return;
  }

  state.lastNoOpPollAt = nowMs;
  state.consecutiveNoOpPolls = (state.consecutiveNoOpPolls ?? 0) + 1;

  if (state.hasDeferredMatchBacklog) {
    state.skipMatchPollUntilCycle = undefined;
    return;
  }

  if ((state.consecutiveNoOpPolls ?? 0) >= 2) {
    state.skipMatchPollUntilCycle = cycleNumber + 2;
  } else {
    state.skipMatchPollUntilCycle = undefined;
  }
}

function logDeferredMatchDetails(
  playerContext: ReturnType<typeof getPlayerContext>,
  playerLabel: string,
  deferredMatchDetailCount: number,
): void {
  if (deferredMatchDetailCount <= 0) return;

  logger.info(
    { ...playerContext, deferredMatchDetailCount },
    `[cron] Deferred match detail fetches for ${playerLabel} due to remaining cycle budget`,
  );
}

async function processMatchBuffs(): Promise<void> {
  try {
    logger.debug('[cron] Starting match buff processing');
    await processNewMatchBuffs();
    logger.debug('[cron] Match buff processing complete');
  } catch (err) {
    logger.error({ err }, '[cron] Failed to process match buffs');
  }
}

function logCycleSummary({
  cycleSource,
  cycleStartedAt,
  playersConsidered,
  playersProcessed,
  playersDeferred,
  oldestPlayerStalenessMs,
  requestMetrics,
}: {
  cycleSource: 'scheduled' | 'admin';
  cycleStartedAt: number;
  playersConsidered: number;
  playersProcessed: number;
  playersDeferred: number;
  oldestPlayerStalenessMs: number | null;
  requestMetrics: ReturnType<ReturnType<typeof getRiotClient>['getRequestMetricsSince']>;
}): void {
  const queueWaitStats = getQueueWaitStats(requestMetrics);
  const retryCount = requestMetrics.reduce((sum, metric) => sum + metric.retryCount, 0);
  const rateLimitHitCount = requestMetrics.reduce((sum, metric) => sum + metric.rateLimitHitCount, 0);

  logger.info(
    {
      source: cycleSource,
      durationMs: Date.now() - cycleStartedAt,
      playersConsidered,
      playersProcessed,
      playersDeferred,
      schedulerCursor: getSchedulerCursor(),
      oldestPlayerStalenessMs,
      riotRequestsByEndpoint: summarizeRequestsByEndpoint(requestMetrics),
      p50QueueWaitMs: queueWaitStats.p50QueueWaitMs,
      p95QueueWaitMs: queueWaitStats.p95QueueWaitMs,
      retryCount,
      rateLimitHitCount,
    },
    '[cron] Cycle summary',
  );
}

function isTournamentActive(now: Date, startDate: Date, endDate: Date): boolean {
  if (now < startDate) {
    logger.warn('[cron] Tournament has not started yet. Skipping cycle.');
    return false;
  }
  if (now > endDate) {
    logger.warn('[cron] Tournament has ended. Skipping cycle.');
    return false;
  }
  return true;
}

function getPlayerContext(player: PlayerDocument): {
  discordId: string;
  riotId: string | null;
  puuid: string;
} {
  return {
    discordId: player.discordId,
    riotId: player.riotId ?? (player.gameName && player.tagLine ? `${player.gameName}#${player.tagLine}` : null),
    puuid: player.puuid,
  };
}

function getCompetitiveState(player: CompetitiveState): CompetitiveState {
  return {
    currentTier: player.currentTier,
    currentRank: player.currentRank,
    currentLP: player.currentLP,
    currentWins: player.currentWins,
    currentLosses: player.currentLosses,
  };
}

function hasCompetitiveStateChanged(before: CompetitiveState, after: CompetitiveState): boolean {
  return before.currentTier !== after.currentTier
    || before.currentRank !== after.currentRank
    || before.currentLP !== after.currentLP
    || before.currentWins !== after.currentWins
    || before.currentLosses !== after.currentLosses;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  const workerLoop = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, workerLoop));
}
