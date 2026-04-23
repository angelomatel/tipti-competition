import {
  BASELINE_FRESHNESS_FLOOR_MINUTES,
  COLD_DISCOVERY_RESERVE_PER_MINUTE,
  CRON_PLAYER_CONCURRENCY,
  FETCH_INTERVAL_MINUTES,
  HOT_IDLE_POLLS_TO_COOLDOWN,
  HOT_PLAYER_TTL_MINUTES,
  HOT_POLL_INTERVAL_SECONDS,
  PENDING_ATTRIBUTION_TTL_MINUTES,
  RIOT_APP_RATE_PER_120_SECONDS,
  SCHEDULER_MAX_BLOCKED_FOR_MS,
  SCHEDULER_MAX_P95_QUEUE_WAIT_MS,
  SCHEDULER_MAX_PENDING_REQUESTS,
} from '@/constants';
import { MatchRecord } from '@/db/models/MatchRecord';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { captureMatchesForPlayer, type CaptureMatchesResult } from '@/services/matchService';
import { getQueueBackpressureSnapshot, summarizeRequestsByEndpoint } from '@/services/cronMetricsService';
import {
  buildDefaultPollState,
  getPlayerProcessingConcurrency,
  hasOutstandingHotWork,
  persistPlayerPollState,
  selectPlayersForCycles,
  selectPlayersForMatchDrain,
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
type CycleKind = CycleType | 'match-drain';

export interface RunCronCycleOptions {
  source?: 'scheduled' | 'admin';
  catchUp?: boolean;
  cycleType?: CycleType | 'all';
}

export interface RunMatchDrainCycleOptions {
  source?: 'scheduled' | 'admin';
  catchUp?: boolean;
}

type CompetitiveState = Pick<
  PlayerDocument,
  'currentTier' | 'currentRank' | 'currentLP' | 'currentWins' | 'currentLosses'
>;

const runningCycles = new Set<CycleKind | 'all'>();
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
      // Drain anything that was deferred (queue pressure) or whose match poll is stale,
      // so an admin "refresh everything" actually flushes pending match work.
      await runMatchDrainCycleInternal({ source: options.source, catchUp: options.catchUp });
      await processMatchBuffs();
      return;
    }

    await runSingleCycle(cycleType, options, false);
  } finally {
    finishCycle(cycleType);
  }
}

async function runMatchDrainCycleInternal(options: RunMatchDrainCycleOptions): Promise<void> {
  // Used when we're already inside an 'all' cycle lock — skip the lock to avoid deadlock.
  const cycleStartedAt = Date.now();
  const riotClient = getRiotClient();
  const settings = await getTournamentSettings();
  const now = new Date();
  if (!isTournamentActive(now, settings.startDate, settings.endDate)) {
    return;
  }

  const players = await listActivePlayers();
  const states = await syncActivePollStates(players);
  const candidates = selectPlayersForMatchDrain(players, states, cycleStartedAt);
  if (candidates.length === 0) return;

  const concurrency = Math.min(
    getPlayerProcessingConcurrency(),
    CRON_PLAYER_CONCURRENCY,
    Math.max(1, candidates.length),
  );
  let nextIndex = 0;

  const workerLoop = async () => {
    while (true) {
      if (hasQueuePressure(riotClient, Date.now())) return;
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= candidates.length) return;

      const selected = candidates[currentIndex]!;
      if (activePlayerLocks.has(selected.discordId)) continue;

      activePlayerLocks.add(selected.discordId);
      try {
        await processMatchDrainForPlayer(selected, settings, Boolean(options.catchUp), states);
      } finally {
        activePlayerLocks.delete(selected.discordId);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, workerLoop));
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

  const freshnessFloorMs = BASELINE_FRESHNESS_FLOOR_MINUTES * 60 * 1_000;
  const isBaselineStarved = (player: PlayerDocument, nowMs: number): boolean => {
    if (cycleType !== 'baseline') return false;
    // Rank polls are the per-cycle touchpoint now (match polls only fire on deltas),
    // so use lastRankPollAt to detect a baseline player starving under load.
    const lastPollMs = states.get(player.discordId)?.lastRankPollAt?.getTime() ?? 0;
    return lastPollMs === 0 || nowMs - lastPollMs >= freshnessFloorMs;
  };
  let starvationOverrides = 0;

  const workerLoop = async () => {
    while (true) {
      const currentIndex = nextIndex;
      const player = currentIndex < candidates.length ? candidates[currentIndex] : undefined;
      const starved = player ? isBaselineStarved(player, Date.now()) : false;

      if (!starved) {
        const gate = shouldStopScheduling();
        if (gate.stop) {
          if (gate.reason === 'queue') queueLimited = true;
          if (gate.reason === 'reserve') reserveLimited = true;
          return;
        }
      }

      nextIndex += 1;
      if (currentIndex >= candidates.length) {
        return;
      }

      const selected = player!;
      if (starved) starvationOverrides += 1;

      if (activePlayerLocks.has(selected.discordId)) {
        lockedPlayers += 1;
        continue;
      }

      activePlayerLocks.add(selected.discordId);
      try {
        await processPlayerCycle(selected, cycleType, settings, Boolean(options.catchUp), states);
        processedPlayers += 1;
      } finally {
        activePlayerLocks.delete(selected.discordId);
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
      starvationOverrides,
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
  const riotClient = getRiotClient();

  logger.debug({ ...playerContext, cycleType, mode: state.mode }, `[cron-rank] Processing ${playerLabel}`);

  try {
    // Rank poll is always run — it's the cheap change detector for this player.
    const rankPolledAt = new Date();
    const updatedPlayer = await captureSnapshotForPlayer(player);
    state.lastRankPollAt = rankPolledAt;

    const competitiveStateChanged = hasCompetitiveStateChanged(beforeState, getCompetitiveState(updatedPlayer));
    const hadCarriedOutstandingWork = state.deferredMatchDetailCount > 0
      || state.unresolvedMatchCount > 0
      || state.pendingMatchFetch;
    // Admin-driven catch-up forces a match fetch so it actually pulls recent history
    // even for players whose rank snapshot didn't move.
    const shouldFetchMatchesNow = catchUp || competitiveStateChanged || hadCarriedOutstandingWork;

    let matchResult: CaptureMatchesResult | null = null;
    let pendingMatchFetch = state.pendingMatchFetch;

    if (shouldFetchMatchesNow) {
      if (hasQueuePressure(riotClient, Date.now())) {
        // Defer to match-drain cron to avoid piling on a stressed queue.
        pendingMatchFetch = true;
        logger.debug(
          { ...playerContext, cycleType },
          `[cron-rank] Deferring match fetch due to queue pressure for ${playerLabel}`,
        );
      } else {
        const matchMode = catchUp ? 'catch-up' : cycleType === 'hot' ? 'hot' : 'baseline';
        matchResult = await captureMatchesForPlayer(updatedPlayer, { settings, mode: matchMode });
        state.lastMatchPollAt = new Date();
        pendingMatchFetch = false;
      }
    }

    if (competitiveStateChanged) {
      await createLpDeltaTransaction(updatedPlayer, settings, {
        newMatches: matchResult?.newMatches ?? [],
      });
    }

    const unresolvedMatchCount = await countOutstandingMatchAttribution(player.puuid);
    const nextState = getNextPlayerPollState({
      player,
      cycleType,
      previousState: { ...state, pendingMatchFetch },
      processedAt: new Date(),
      matchResult,
      competitiveStateChanged,
      unresolvedMatchCount,
      pendingMatchFetch,
    });

    states.set(player.discordId, nextState);
    await persistPlayerPollState(player, nextState);

    logger.debug(
      {
        ...playerContext,
        cycleType,
        competitiveStateChanged,
        matchFetchRan: matchResult !== null,
        capturedCount: matchResult?.capturedCount ?? 0,
        deferredMatchDetailCount: nextState.deferredMatchDetailCount,
        unresolvedMatchCount,
        pendingMatchFetch: nextState.pendingMatchFetch,
        nextMode: nextState.mode,
        nextEligibleAt: nextState.nextEligibleAt?.toISOString() ?? null,
      },
      `[cron-rank] Finished processing ${playerLabel}`,
    );
  } catch (err) {
    logger.error({ err, ...playerContext, cycleType }, `[cron-rank] Failed processing ${playerLabel}`);
  }
}

async function processMatchDrainForPlayer(
  player: PlayerDocument,
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
  const riotClient = getRiotClient();

  logger.debug(
    { ...playerContext, mode: state.mode, pendingMatchFetch: state.pendingMatchFetch },
    `[cron-match] Processing ${playerLabel}`,
  );

  try {
    const matchMode = catchUp ? 'catch-up' : state.mode === 'hot' ? 'hot' : 'baseline';
    const matchResult = await captureMatchesForPlayer(player, { settings, mode: matchMode });
    state.lastMatchPollAt = new Date();
    state.pendingMatchFetch = false;

    // Symmetric to the rank cron: if we captured new matches, fetch rank immediately so
    // LP attribution can proceed without waiting for the next rank tick.
    let updatedPlayer: PlayerDocument = player;
    let competitiveStateChanged = false;
    if (matchResult.capturedCount > 0 && !hasQueuePressure(riotClient, Date.now())) {
      updatedPlayer = await captureSnapshotForPlayer(player);
      state.lastRankPollAt = new Date();
      competitiveStateChanged = hasCompetitiveStateChanged(beforeState, getCompetitiveState(updatedPlayer));
    }

    if (competitiveStateChanged) {
      await createLpDeltaTransaction(updatedPlayer, settings, { newMatches: matchResult.newMatches });
    }

    const unresolvedMatchCount = await countOutstandingMatchAttribution(player.puuid);
    // Match-drain treats player's current mode as the cycle context so hot/baseline
    // transitions still work correctly.
    const nextState = getNextPlayerPollState({
      player,
      cycleType: state.mode,
      previousState: state,
      processedAt: new Date(),
      matchResult,
      competitiveStateChanged,
      unresolvedMatchCount,
      pendingMatchFetch: false,
    });

    states.set(player.discordId, nextState);
    await persistPlayerPollState(player, nextState);

    logger.debug(
      {
        ...playerContext,
        competitiveStateChanged,
        capturedCount: matchResult.capturedCount,
        deferredMatchDetailCount: matchResult.deferredMatchDetailCount,
        unresolvedMatchCount,
        nextMode: nextState.mode,
        nextEligibleAt: nextState.nextEligibleAt?.toISOString() ?? null,
      },
      `[cron-match] Finished processing ${playerLabel}`,
    );
  } catch (err) {
    logger.error({ err, ...playerContext }, `[cron-match] Failed processing ${playerLabel}`);
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
  pendingMatchFetch,
}: {
  player: PlayerDocument;
  cycleType: CycleType;
  previousState: PersistedPlayerPollState;
  processedAt: Date;
  matchResult: CaptureMatchesResult | null;
  competitiveStateChanged: boolean;
  unresolvedMatchCount: number;
  pendingMatchFetch: boolean;
}): PersistedPlayerPollState {
  // When matchResult is null (rank cycle that skipped the match fetch) we carry the
  // previous tick's deferred count forward and assume no new uncaptured matches.
  const capturedCount = matchResult?.capturedCount ?? 0;
  const deferredMatchDetailCount = matchResult?.deferredMatchDetailCount
    ?? previousState.deferredMatchDetailCount;
  const uncapturedMatchCount = matchResult?.uncapturedMatchCount ?? 0;

  const hadObservedActivity = capturedCount > 0
    || deferredMatchDetailCount > 0
    || competitiveStateChanged
    || unresolvedMatchCount > 0;
  const isIdleHotPoll = cycleType === 'hot'
    && !hadObservedActivity
    && uncapturedMatchCount === 0
    && !pendingMatchFetch;

  const nextState: PersistedPlayerPollState = {
    ...previousState,
    playerId: player.discordId,
    puuid: player.puuid,
    lastProcessedAt: processedAt,
    lastMatchPollAt: previousState.lastMatchPollAt,
    lastRankPollAt: previousState.lastRankPollAt,
    unresolvedMatchCount,
    deferredMatchDetailCount,
    pendingMatchFetch,
    consecutiveIdleHotPolls: isIdleHotPoll
      ? previousState.consecutiveIdleHotPolls + 1
      : hasOutstandingWork(capturedCount, deferredMatchDetailCount, unresolvedMatchCount)
          || competitiveStateChanged
          || pendingMatchFetch
        ? 0
        : previousState.consecutiveIdleHotPolls,
  };

  if (hadObservedActivity) {
    nextState.lastObservedActivityAt = processedAt;
  }

  const shouldStayHot = hasOutstandingWork(capturedCount, deferredMatchDetailCount, unresolvedMatchCount)
    || competitiveStateChanged
    || pendingMatchFetch
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
  capturedCount: number,
  deferredMatchDetailCount: number,
  unresolvedMatchCount: number,
): boolean {
  return capturedCount > 0 || deferredMatchDetailCount > 0 || unresolvedMatchCount > 0;
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

async function countOutstandingMatchAttribution(puuid: string): Promise<number> {
  // Pending matches older than the TTL are treated as abandoned attributions
  // (Riot LP never landed in time) so they no longer keep the player in hot mode.
  const cutoff = new Date(Date.now() - PENDING_ATTRIBUTION_TTL_MINUTES * 60 * 1_000);
  return MatchRecord.countDocuments({
    puuid,
    lpAttributionStatus: 'pending',
    playedAt: { $gte: cutoff },
  });
}

function hasQueuePressure(riotClient: ReturnType<typeof getRiotClient>, nowMs: number): boolean {
  const queueSnapshot = getQueueBackpressureSnapshot(riotClient, nowMs);
  return queueSnapshot.queuedRequests >= SCHEDULER_MAX_PENDING_REQUESTS
    || queueSnapshot.blockedForMs >= SCHEDULER_MAX_BLOCKED_FOR_MS
    || queueSnapshot.p95QueueWaitMs >= SCHEDULER_MAX_P95_QUEUE_WAIT_MS;
}

async function processMatchBuffs(): Promise<void> {
  try {
    await processNewMatchBuffs();
  } catch (err) {
    logger.error({ err }, '[cron] Failed to process match buffs');
  }
}

function tryStartCycle(cycleType: CycleKind | 'all'): boolean {
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

function finishCycle(cycleType: CycleKind | 'all'): void {
  runningCycles.delete(cycleType);
}

export async function runMatchDrainCycle(options: RunMatchDrainCycleOptions = {}): Promise<void> {
  if (!tryStartCycle('match-drain')) {
    logger.warn('[cron-match] A conflicting match-drain cycle is already running. Skipping.');
    return;
  }

  const cycleStartedAt = Date.now();
  const cycleSource = options.source ?? 'scheduled';
  const riotClient = getRiotClient();

  try {
    const settings = await getTournamentSettings();
    const now = new Date();
    if (!isTournamentActive(now, settings.startDate, settings.endDate)) {
      return;
    }

    const players = await listActivePlayers();
    const states = await syncActivePollStates(players);
    const candidates = selectPlayersForMatchDrain(players, states, cycleStartedAt);
    const concurrency = Math.min(
      getPlayerProcessingConcurrency(),
      CRON_PLAYER_CONCURRENCY,
      Math.max(1, candidates.length),
    );
    let processedPlayers = 0;
    let lockedPlayers = 0;
    let queueLimited = false;
    let nextIndex = 0;

    logger.info(
      {
        source: cycleSource,
        activePlayerCount: players.length,
        candidateCount: candidates.length,
        concurrency,
      },
      '[cron-match] Starting match-drain cycle',
    );

    const workerLoop = async () => {
      while (true) {
        if (hasQueuePressure(riotClient, Date.now())) {
          queueLimited = true;
          return;
        }

        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= candidates.length) {
          return;
        }

        const selected = candidates[currentIndex]!;
        if (activePlayerLocks.has(selected.discordId)) {
          lockedPlayers += 1;
          continue;
        }

        activePlayerLocks.add(selected.discordId);
        try {
          await processMatchDrainForPlayer(selected, settings, Boolean(options.catchUp), states);
          processedPlayers += 1;
        } finally {
          activePlayerLocks.delete(selected.discordId);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, workerLoop));

    await processMatchBuffs();

    const requestMetrics = riotClient.getRequestMetricsSince(cycleStartedAt);
    const queueSnapshot = getQueueBackpressureSnapshot(riotClient, Date.now());
    logger.info(
      {
        source: cycleSource,
        durationMs: Date.now() - cycleStartedAt,
        candidateCount: candidates.length,
        playersProcessed: processedPlayers,
        playersSkippedByLock: lockedPlayers,
        queueLimited,
        queuedRequests: queueSnapshot.queuedRequests,
        activeRequests: queueSnapshot.activeRequests,
        blockedForMs: queueSnapshot.blockedForMs,
        requestsLastMinute: queueSnapshot.requestsLastMinute,
        p50QueueWaitMs: queueSnapshot.p50QueueWaitMs,
        p95QueueWaitMs: queueSnapshot.p95QueueWaitMs,
        riotRequestsByEndpoint: summarizeRequestsByEndpoint(requestMetrics),
      },
      '[cron-match] Match-drain cycle summary',
    );
  } finally {
    finishCycle('match-drain');
  }
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
