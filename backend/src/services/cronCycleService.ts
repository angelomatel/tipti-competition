import {
  BASELINE_RANK_REFRESH_INTERVAL_MINUTES,
  COLD_DISCOVERY_RESERVE_PER_MINUTE,
  CRON_PLAYER_CONCURRENCY,
  FETCH_INTERVAL_MINUTES,
  HOT_IDLE_POLLS_TO_COOLDOWN,
  HOT_PLAYER_TTL_MINUTES,
  HOT_POLL_INTERVAL_SECONDS,
  HOT_RANK_REFRESH_INTERVAL_MINUTES,
  RIOT_APP_RATE_PER_120_SECONDS,
  SCHEDULER_MAX_P95_QUEUE_WAIT_MS,
  SCHEDULER_MAX_PENDING_REQUESTS,
} from '@/constants';
import { MatchRecord } from '@/db/models/MatchRecord';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { captureMatchesForPlayer } from '@/services/matchService';
import { getQueueBackpressureSnapshot, summarizeRequestsByEndpoint } from '@/services/cronMetricsService';
import {
  buildDefaultPollState,
  getPlayerProcessingConcurrency,
  hasOutstandingHotWork,
  persistPlayerPollState,
  selectPlayersForCycles,
  syncActivePollStates,
  type PersistedPlayerPollState,
} from '@/services/cronSchedulerService';
import { listActivePlayers } from '@/services/playerService';
import { getRiotClient } from '@/services/riotService';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { getTournamentSettings } from '@/services/tournamentService';
import type { PlayerDocument } from '@/types/Player';

type CycleType = 'hot' | 'baseline';

export interface RunCronCycleOptions {
  source?: 'scheduled' | 'admin';
  catchUp?: boolean;
  cycleType?: CycleType | 'all';
}

type CompetitiveState = Pick<
  PlayerDocument,
  'currentTier' | 'currentRank' | 'currentLP' | 'currentWins' | 'currentLosses'
>;

const runningCycles = new Set<CycleType | 'all'>();
const activePlayerLocks = new Set<string>();

export async function runCronCycle(options: RunCronCycleOptions = {}): Promise<void> {
  const cycleType = options.cycleType ?? 'all';

  if (!tryStartCycle(cycleType)) {
    logger.warn({ cycleType }, '[cron] A conflicting cycle is already running. Skipping overlapping cycle.');
    return;
  }

  try {
    if (cycleType === 'all') {
      await runSingleCycle('baseline', options, true);
      await runSingleCycle('hot', options, true);
      await processMatchBuffs();
      return;
    }

    await runSingleCycle(cycleType, options, false);
  } finally {
    finishCycle(cycleType);
  }
}

export function resetCronCycleState(): void {
  runningCycles.clear();
  activePlayerLocks.clear();
}

async function runSingleCycle(
  cycleType: CycleType,
  options: RunCronCycleOptions,
  skipMatchBuffs: boolean,
): Promise<void> {
  const cycleStartedAt = Date.now();
  const cycleSource = options.source ?? 'scheduled';
  const riotClient = getRiotClient();

  const settings = await getTournamentSettings();
  const now = new Date();
  if (!isTournamentActive(now, settings.startDate, settings.endDate)) {
    return;
  }

  const players = await listActivePlayers();
  const states = await syncActivePollStates(players);
  const selection = selectPlayersForCycles(players, states, cycleStartedAt);
  const candidates = cycleType === 'hot' ? selection.hotCandidates : selection.baselineCandidates;
  const opposingEligibleCount = cycleType === 'hot' ? selection.eligibleBaselineCount : selection.eligibleHotCount;
  const concurrency = Math.min(getPlayerProcessingConcurrency(), CRON_PLAYER_CONCURRENCY, Math.max(1, candidates.length));
  let processedPlayers = 0;
  let lockedPlayers = 0;
  let queueLimited = false;
  let reserveLimited = false;
  let nextIndex = 0;

  logger.info(
    {
      cycleType,
      source: cycleSource,
      activePlayerCount: players.length,
      candidateCount: candidates.length,
      hotCandidateCount: selection.eligibleHotCount,
      baselineCandidateCount: selection.eligibleBaselineCount,
      concurrency,
    },
    '[cron] Starting cycle',
  );

  const shouldStopScheduling = (): { stop: boolean; reason?: 'queue' | 'reserve' } => {
    if (hasQueuePressure(riotClient, Date.now())) {
      return { stop: true, reason: 'queue' };
    }

    if (cycleType === 'hot' && opposingEligibleCount > 0) {
      const snapshot = riotClient.getQueueSnapshot();
      const hotBudgetPerMinute = Math.max(
        0,
        Math.floor(RIOT_APP_RATE_PER_120_SECONDS / 2) - COLD_DISCOVERY_RESERVE_PER_MINUTE,
      );
      if (snapshot.requestsLastMinute >= hotBudgetPerMinute) {
        return { stop: true, reason: 'reserve' };
      }
    }

    return { stop: false };
  };

  const workerLoop = async () => {
    while (true) {
      const gate = shouldStopScheduling();
      if (gate.stop) {
        if (gate.reason === 'queue') queueLimited = true;
        if (gate.reason === 'reserve') reserveLimited = true;
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= candidates.length) {
        return;
      }

      const player = candidates[currentIndex]!;
      if (activePlayerLocks.has(player.discordId)) {
        lockedPlayers += 1;
        continue;
      }

      activePlayerLocks.add(player.discordId);
      try {
        await processPlayerCycle(player, cycleType, settings, Boolean(options.catchUp), states);
        processedPlayers += 1;
      } finally {
        activePlayerLocks.delete(player.discordId);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, workerLoop));

  if (!skipMatchBuffs) {
    await processMatchBuffs();
  }

  const requestMetrics = riotClient.getRequestMetricsSince(cycleStartedAt);
  const queueSnapshot = getQueueBackpressureSnapshot(riotClient, Date.now());
  logger.info(
    {
      cycleType,
      source: cycleSource,
      durationMs: Date.now() - cycleStartedAt,
      candidateCount: candidates.length,
      playersProcessed: processedPlayers,
      playersSkippedByLock: lockedPlayers,
      queueLimited,
      reserveLimited,
      hotCandidateCount: selection.eligibleHotCount,
      baselineCandidateCount: selection.eligibleBaselineCount,
      queuedRequests: queueSnapshot.queuedRequests,
      activeRequests: queueSnapshot.activeRequests,
      blockedForMs: queueSnapshot.blockedForMs,
      requestsLastMinute: queueSnapshot.requestsLastMinute,
      p50QueueWaitMs: queueSnapshot.p50QueueWaitMs,
      p95QueueWaitMs: queueSnapshot.p95QueueWaitMs,
      riotRequestsByEndpoint: summarizeRequestsByEndpoint(requestMetrics),
    },
    '[cron] Cycle summary',
  );
}

async function processPlayerCycle(
  player: PlayerDocument,
  cycleType: CycleType,
  settings: Awaited<ReturnType<typeof getTournamentSettings>>,
  catchUp: boolean,
  states: Map<string, PersistedPlayerPollState>,
): Promise<void> {
  const playerLabel = getPlayerLogLabel(player);
  const playerContext = getPlayerContext(player);
  const state = {
    ...(states.get(player.discordId) ?? buildDefaultPollState(player)),
  };
  const beforeState = getCompetitiveState(player);
  const startedAt = new Date();

  logger.debug({ ...playerContext, cycleType, mode: state.mode }, `[cron] Processing ${playerLabel}`);

  try {
    const matchMode = catchUp ? 'catch-up' : cycleType === 'hot' ? 'hot' : 'baseline';
    const matchResult = await captureMatchesForPlayer(player, { settings, mode: matchMode });
    state.lastMatchPollAt = startedAt;

    const shouldFetchSnapshot = needsRankRefresh(cycleType, state, matchResult, startedAt.getTime());
    const updatedPlayer = shouldFetchSnapshot ? await captureSnapshotForPlayer(player) : player;
    if (shouldFetchSnapshot) {
      state.lastRankPollAt = new Date();
    }

    const competitiveStateChanged = hasCompetitiveStateChanged(beforeState, getCompetitiveState(updatedPlayer));
    if (competitiveStateChanged) {
      await createLpDeltaTransaction(updatedPlayer, settings, { newMatches: matchResult.newMatches });
    }

    const unresolvedMatchCount = await countOutstandingMatchAttribution(player.puuid);
    const nextState = getNextPlayerPollState({
      player,
      cycleType,
      previousState: state,
      processedAt: new Date(),
      matchResult,
      competitiveStateChanged,
      unresolvedMatchCount,
    });

    states.set(player.discordId, nextState);
    await persistPlayerPollState(player, nextState);

    logger.debug(
      {
        ...playerContext,
        cycleType,
        competitiveStateChanged,
        capturedCount: matchResult.capturedCount,
        deferredMatchDetailCount: matchResult.deferredMatchDetailCount,
        unresolvedMatchCount,
        nextMode: nextState.mode,
        nextEligibleAt: nextState.nextEligibleAt?.toISOString() ?? null,
      },
      `[cron] Finished processing ${playerLabel}`,
    );
  } catch (err) {
    logger.error({ err, ...playerContext, cycleType }, `[cron] Failed processing ${playerLabel}`);
  }
}

function getNextPlayerPollState({
  player,
  cycleType,
  previousState,
  processedAt,
  matchResult,
  competitiveStateChanged,
  unresolvedMatchCount,
}: {
  player: PlayerDocument;
  cycleType: CycleType;
  previousState: PersistedPlayerPollState;
  processedAt: Date;
  matchResult: Awaited<ReturnType<typeof captureMatchesForPlayer>>;
  competitiveStateChanged: boolean;
  unresolvedMatchCount: number;
}): PersistedPlayerPollState {
  const hadObservedActivity = matchResult.capturedCount > 0
    || matchResult.deferredMatchDetailCount > 0
    || competitiveStateChanged
    || unresolvedMatchCount > 0;
  const isIdleHotPoll = cycleType === 'hot'
    && !hadObservedActivity
    && matchResult.uncapturedMatchCount === 0;

  const nextState: PersistedPlayerPollState = {
    ...previousState,
    playerId: player.discordId,
    puuid: player.puuid,
    lastProcessedAt: processedAt,
    lastMatchPollAt: previousState.lastMatchPollAt,
    lastRankPollAt: previousState.lastRankPollAt,
    unresolvedMatchCount,
    deferredMatchDetailCount: matchResult.deferredMatchDetailCount,
    consecutiveIdleHotPolls: isIdleHotPoll
      ? previousState.consecutiveIdleHotPolls + 1
      : hasOutstandingWork(matchResult, unresolvedMatchCount) || competitiveStateChanged
        ? 0
        : previousState.consecutiveIdleHotPolls,
  };

  if (hadObservedActivity) {
    nextState.lastObservedActivityAt = processedAt;
  }

  const shouldStayHot = hasOutstandingWork(matchResult, unresolvedMatchCount)
    || competitiveStateChanged
    || (previousState.mode === 'hot' && !canCoolDownHotPlayer(previousState, nextState, processedAt));

  if (shouldStayHot) {
    nextState.mode = 'hot';
    nextState.enteredHotAt = previousState.mode === 'hot'
      ? previousState.enteredHotAt ?? processedAt
      : processedAt;
    nextState.nextEligibleAt = new Date(processedAt.getTime() + HOT_POLL_INTERVAL_SECONDS * 1_000);
    return nextState;
  }

  nextState.mode = 'baseline';
  nextState.enteredHotAt = null;
  nextState.consecutiveIdleHotPolls = 0;
  nextState.nextEligibleAt = new Date(processedAt.getTime() + FETCH_INTERVAL_MINUTES * 60 * 1_000);
  return nextState;
}

function hasOutstandingWork(
  matchResult: Awaited<ReturnType<typeof captureMatchesForPlayer>>,
  unresolvedMatchCount: number,
): boolean {
  return matchResult.capturedCount > 0
    || matchResult.deferredMatchDetailCount > 0
    || unresolvedMatchCount > 0;
}

function canCoolDownHotPlayer(
  previousState: PersistedPlayerPollState,
  nextState: PersistedPlayerPollState,
  processedAt: Date,
): boolean {
  if (hasOutstandingHotWork(nextState)) {
    return false;
  }

  const lastObservedActivityAt = nextState.lastObservedActivityAt ?? previousState.lastObservedActivityAt;
  if (!lastObservedActivityAt) {
    return nextState.consecutiveIdleHotPolls >= HOT_IDLE_POLLS_TO_COOLDOWN;
  }

  return nextState.consecutiveIdleHotPolls >= HOT_IDLE_POLLS_TO_COOLDOWN
    && processedAt.getTime() - lastObservedActivityAt.getTime() >= HOT_PLAYER_TTL_MINUTES * 60 * 1_000;
}

function needsRankRefresh(
  cycleType: CycleType,
  state: PersistedPlayerPollState,
  matchResult: Awaited<ReturnType<typeof captureMatchesForPlayer>>,
  nowMs: number,
): boolean {
  if (matchResult.capturedCount > 0 || matchResult.deferredMatchDetailCount > 0) {
    return true;
  }

  const intervalMinutes = cycleType === 'hot'
    ? HOT_RANK_REFRESH_INTERVAL_MINUTES
    : BASELINE_RANK_REFRESH_INTERVAL_MINUTES;
  const lastRankPollAtMs = state.lastRankPollAt?.getTime() ?? 0;
  return lastRankPollAtMs === 0 || nowMs - lastRankPollAtMs >= intervalMinutes * 60 * 1_000;
}

async function countOutstandingMatchAttribution(puuid: string): Promise<number> {
  return MatchRecord.countDocuments({
    puuid,
    lpAttributionStatus: 'pending',
  });
}

function hasQueuePressure(riotClient: ReturnType<typeof getRiotClient>, nowMs: number): boolean {
  const queueSnapshot = getQueueBackpressureSnapshot(riotClient, nowMs);
  return queueSnapshot.queuedRequests >= SCHEDULER_MAX_PENDING_REQUESTS
    || queueSnapshot.blockedForMs > 0
    || queueSnapshot.p95QueueWaitMs >= SCHEDULER_MAX_P95_QUEUE_WAIT_MS;
}

async function processMatchBuffs(): Promise<void> {
  try {
    await processNewMatchBuffs();
  } catch (err) {
    logger.error({ err }, '[cron] Failed to process match buffs');
  }
}

function tryStartCycle(cycleType: CycleType | 'all'): boolean {
  if (cycleType === 'all') {
    if (runningCycles.size > 0) return false;
    runningCycles.add('all');
    return true;
  }

  if (runningCycles.has('all') || runningCycles.has(cycleType)) {
    return false;
  }

  runningCycles.add(cycleType);
  return true;
}

function finishCycle(cycleType: CycleType | 'all'): void {
  runningCycles.delete(cycleType);
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
