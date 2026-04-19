import {
  CRON_PLAYER_CONCURRENCY,
  HOT_PLAYER_TTL_MINUTES,
} from '@/constants';
import { PlayerPollState } from '@/db/models/PlayerPollState';
import type { PlayerDocument } from '@/types/Player';
import type { IPlayerPollState } from '@/types/PlayerPollState';

export type PersistedPlayerPollState = IPlayerPollState;

export interface CronSchedulerSelection {
  hotCandidates: PlayerDocument[];
  baselineCandidates: PlayerDocument[];
  eligibleHotCount: number;
  eligibleBaselineCount: number;
}

export function getPlayerProcessingConcurrency(): number {
  return CRON_PLAYER_CONCURRENCY;
}

export async function syncActivePollStates(
  players: PlayerDocument[],
): Promise<Map<string, PersistedPlayerPollState>> {
  if (players.length === 0) {
    return new Map();
  }

  const playerIds = players.map((player) => player.discordId);
  const existingStates = await PlayerPollState.find({ playerId: { $in: playerIds } }).lean();
  const stateByPlayerId = new Map<string, PersistedPlayerPollState>(
    existingStates.map((state) => [state.playerId, normalizePollState(state)]),
  );

  const bulkOperations: Array<{
    updateOne: {
      filter: { playerId: string };
      update: Record<string, unknown>;
      upsert: true;
    };
  }> = [];
  const nowMs = Date.now();

  for (const player of players) {
    const existingState = stateByPlayerId.get(player.discordId);
    if (!existingState) {
      const nextState = buildDefaultPollState(player);
      stateByPlayerId.set(player.discordId, nextState);
      bulkOperations.push({
        updateOne: {
          filter: { playerId: player.discordId },
          update: { $setOnInsert: serializePollState(nextState) },
          upsert: true,
        },
      });
      continue;
    }

    const normalizedState = normalizeStaleHotState(existingState, nowMs);
    if (normalizedState !== existingState) {
      stateByPlayerId.set(player.discordId, normalizedState);
      bulkOperations.push({
        updateOne: {
          filter: { playerId: player.discordId },
          update: { $set: serializePollState(normalizedState) },
          upsert: true,
        },
      });
      continue;
    }

    if (existingState.puuid !== player.puuid) {
      const nextState = {
        ...existingState,
        puuid: player.puuid,
      };
      stateByPlayerId.set(player.discordId, nextState);
      bulkOperations.push({
        updateOne: {
          filter: { playerId: player.discordId },
          update: { $set: { puuid: player.puuid } },
          upsert: true,
        },
      });
    }
  }

  if (bulkOperations.length > 0) {
    await PlayerPollState.bulkWrite(bulkOperations, { ordered: false });
  }

  return stateByPlayerId;
}

export async function persistPlayerPollState(
  player: PlayerDocument,
  state: PersistedPlayerPollState,
): Promise<void> {
  await PlayerPollState.updateOne(
    { playerId: player.discordId },
    { $set: serializePollState({ ...state, playerId: player.discordId, puuid: player.puuid }) },
    { upsert: true },
  );
}

export function selectPlayersForCycles(
  players: PlayerDocument[],
  states: Map<string, PersistedPlayerPollState>,
  nowMs: number,
): CronSchedulerSelection {
  const stablePlayers = [...players].sort(comparePlayersStable);
  const hotCandidates = stablePlayers
    .filter((player) => {
      const state = states.get(player.discordId);
      return state?.mode === 'hot' && isStateEligible(state, nowMs);
    })
    .sort((left, right) => compareHotPlayers(left, right, states, nowMs));
  const baselineCandidates = stablePlayers
    .filter((player) => {
      const state = states.get(player.discordId);
      return (state?.mode ?? 'baseline') === 'baseline' && isStateEligible(state, nowMs);
    })
    .sort((left, right) => compareBaselinePlayers(left, right, states, nowMs));

  return {
    hotCandidates,
    baselineCandidates,
    eligibleHotCount: hotCandidates.length,
    eligibleBaselineCount: baselineCandidates.length,
  };
}

export function buildDefaultPollState(player: Pick<PlayerDocument, 'discordId' | 'puuid'>): PersistedPlayerPollState {
  return {
    playerId: player.discordId,
    puuid: player.puuid,
    mode: 'baseline',
    lastProcessedAt: null,
    lastRankPollAt: null,
    lastMatchPollAt: null,
    lastObservedActivityAt: null,
    enteredHotAt: null,
    consecutiveIdleHotPolls: 0,
    unresolvedMatchCount: 0,
    deferredMatchDetailCount: 0,
    nextEligibleAt: null,
  };
}

export function hasOutstandingHotWork(state: PersistedPlayerPollState | undefined): boolean {
  return (state?.unresolvedMatchCount ?? 0) > 0 || (state?.deferredMatchDetailCount ?? 0) > 0;
}

function normalizePollState(
  state: Partial<PersistedPlayerPollState> & Pick<PersistedPlayerPollState, 'playerId' | 'puuid'>,
): PersistedPlayerPollState {
  return {
    playerId: state.playerId,
    puuid: state.puuid,
    mode: state.mode ?? 'baseline',
    lastProcessedAt: state.lastProcessedAt ? new Date(state.lastProcessedAt) : null,
    lastRankPollAt: state.lastRankPollAt ? new Date(state.lastRankPollAt) : null,
    lastMatchPollAt: state.lastMatchPollAt ? new Date(state.lastMatchPollAt) : null,
    lastObservedActivityAt: state.lastObservedActivityAt ? new Date(state.lastObservedActivityAt) : null,
    enteredHotAt: state.enteredHotAt ? new Date(state.enteredHotAt) : null,
    consecutiveIdleHotPolls: state.consecutiveIdleHotPolls ?? 0,
    unresolvedMatchCount: state.unresolvedMatchCount ?? 0,
    deferredMatchDetailCount: state.deferredMatchDetailCount ?? 0,
    nextEligibleAt: state.nextEligibleAt ? new Date(state.nextEligibleAt) : null,
  };
}

function serializePollState(state: PersistedPlayerPollState): Record<string, unknown> {
  return {
    playerId: state.playerId,
    puuid: state.puuid,
    mode: state.mode,
    lastProcessedAt: state.lastProcessedAt,
    lastRankPollAt: state.lastRankPollAt,
    lastMatchPollAt: state.lastMatchPollAt,
    lastObservedActivityAt: state.lastObservedActivityAt,
    enteredHotAt: state.enteredHotAt,
    consecutiveIdleHotPolls: state.consecutiveIdleHotPolls,
    unresolvedMatchCount: state.unresolvedMatchCount,
    deferredMatchDetailCount: state.deferredMatchDetailCount,
    nextEligibleAt: state.nextEligibleAt,
  };
}

function comparePlayersStable(left: PlayerDocument, right: PlayerDocument): number {
  const leftRegisteredAt = left.registeredAt instanceof Date ? left.registeredAt.getTime() : 0;
  const rightRegisteredAt = right.registeredAt instanceof Date ? right.registeredAt.getTime() : 0;
  if (leftRegisteredAt !== rightRegisteredAt) {
    return leftRegisteredAt - rightRegisteredAt;
  }
  return left.discordId.localeCompare(right.discordId);
}

function compareHotPlayers(
  left: PlayerDocument,
  right: PlayerDocument,
  states: Map<string, PersistedPlayerPollState>,
  nowMs: number,
): number {
  const leftState = states.get(left.discordId);
  const rightState = states.get(right.discordId);
  const leftOutstanding = getOutstandingWeight(leftState);
  const rightOutstanding = getOutstandingWeight(rightState);
  if (leftOutstanding !== rightOutstanding) {
    return rightOutstanding - leftOutstanding;
  }

  const leftProcessedAt = getComparableTime(leftState?.lastProcessedAt, 0);
  const rightProcessedAt = getComparableTime(rightState?.lastProcessedAt, 0);
  if (leftProcessedAt !== rightProcessedAt) {
    return leftProcessedAt - rightProcessedAt;
  }

  const leftEligibleAt = getComparableTime(leftState?.nextEligibleAt, 0);
  const rightEligibleAt = getComparableTime(rightState?.nextEligibleAt, 0);
  if (leftEligibleAt !== rightEligibleAt) {
    return leftEligibleAt - rightEligibleAt;
  }

  const leftActivityAt = getComparableTime(leftState?.lastObservedActivityAt, nowMs);
  const rightActivityAt = getComparableTime(rightState?.lastObservedActivityAt, nowMs);
  if (leftActivityAt !== rightActivityAt) {
    return rightActivityAt - leftActivityAt;
  }

  return comparePlayersStable(left, right);
}

function compareBaselinePlayers(
  left: PlayerDocument,
  right: PlayerDocument,
  states: Map<string, PersistedPlayerPollState>,
  _nowMs: number,
): number {
  const leftState = states.get(left.discordId);
  const rightState = states.get(right.discordId);
  const leftNeverPolled = leftState?.lastProcessedAt ? 0 : 1;
  const rightNeverPolled = rightState?.lastProcessedAt ? 0 : 1;
  if (leftNeverPolled !== rightNeverPolled) {
    return rightNeverPolled - leftNeverPolled;
  }

  const leftProcessedAt = getComparableTime(leftState?.lastProcessedAt, 0);
  const rightProcessedAt = getComparableTime(rightState?.lastProcessedAt, 0);
  if (leftProcessedAt !== rightProcessedAt) {
    return leftProcessedAt - rightProcessedAt;
  }

  const leftEligibleAt = getComparableTime(leftState?.nextEligibleAt, 0);
  const rightEligibleAt = getComparableTime(rightState?.nextEligibleAt, 0);
  if (leftEligibleAt !== rightEligibleAt) {
    return leftEligibleAt - rightEligibleAt;
  }

  return comparePlayersStable(left, right);
}

function getOutstandingWeight(state: PersistedPlayerPollState | undefined): number {
  if (!state) return 0;
  return state.deferredMatchDetailCount + state.unresolvedMatchCount;
}

function getComparableTime(date: Date | null | undefined, fallback: number): number {
  return date instanceof Date ? date.getTime() : fallback;
}

function isStateEligible(state: PersistedPlayerPollState | undefined, nowMs: number): boolean {
  if (!state?.nextEligibleAt) return true;
  return state.nextEligibleAt.getTime() <= nowMs;
}

function normalizeStaleHotState(
  state: PersistedPlayerPollState,
  nowMs: number,
): PersistedPlayerPollState {
  if (state.mode !== 'hot' || hasOutstandingHotWork(state)) {
    return state;
  }

  const cooldownReferenceMs = Math.max(
    getComparableTime(state.lastObservedActivityAt, 0),
    getComparableTime(state.lastProcessedAt, 0),
    getComparableTime(state.enteredHotAt, 0),
  );

  if (cooldownReferenceMs === 0) {
    return state;
  }

  const staleThresholdMs = HOT_PLAYER_TTL_MINUTES * 60 * 1_000;
  if (nowMs - cooldownReferenceMs < staleThresholdMs) {
    return state;
  }

  return {
    ...state,
    mode: 'baseline',
    enteredHotAt: null,
    consecutiveIdleHotPolls: 0,
    nextEligibleAt: new Date(nowMs),
  };
}
