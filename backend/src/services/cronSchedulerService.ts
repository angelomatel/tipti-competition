import {
  CRON_PLAYER_CONCURRENCY,
  FETCH_INTERVAL_MINUTES,
  RIOT_APP_RATE_PER_120_SECONDS,
} from '@/constants';
import type { PlayerDocument } from '@/types/Player';

const RECENT_ACTIVITY_WINDOW_MS = 60 * 60 * 1000;

export interface PlayerPollState {
  lastRankPollAt?: number;
  lastMatchPollAt?: number;
  lastCatchupAt?: number;
  lastProcessedAt?: number;
  lastActivityAt?: number;
}

export interface CronCycleSelection {
  selectedPlayers: PlayerDocument[];
  deferredPlayers: number;
  oldestPlayerStalenessMs: number | null;
}

let roundRobinCursor = 0;
const playerPollState = new Map<string, PlayerPollState>();

export function getPlayerProcessingConcurrency(): number {
  return CRON_PLAYER_CONCURRENCY;
}

export function getPlayerPollState(discordId: string): PlayerPollState {
  return { ...(playerPollState.get(discordId) ?? {}) };
}

export function setPlayerPollState(discordId: string, state: PlayerPollState): void {
  playerPollState.set(discordId, state);
}

export function getSchedulerCursor(): number {
  return roundRobinCursor;
}

export function shouldUseCatchUpMode(
  player: PlayerDocument,
  cycleCatchUp: boolean,
  nowMs: number,
): boolean {
  if (cycleCatchUp) return true;

  const state = playerPollState.get(player.discordId);
  if (!state?.lastProcessedAt) return true;
  return nowMs - state.lastProcessedAt > FETCH_INTERVAL_MINUTES * 2 * 60 * 1000;
}

export function selectPlayersForCycle(players: PlayerDocument[], nowMs: number): CronCycleSelection {
  const stablePlayers = getStableActivePlayers(players);
  syncPlayerPollState(stablePlayers);

  const prioritizedGroups = getPrioritizedGroups(stablePlayers, nowMs);
  const selectedPlayers = pickPlayersForCycle(prioritizedGroups, getMaxPlayersForCycle());
  advanceRoundRobinCursor(prioritizedGroups.roundRobinPool, selectedPlayers);

  return {
    selectedPlayers,
    deferredPlayers: Math.max(0, stablePlayers.length - selectedPlayers.length),
    oldestPlayerStalenessMs: getOldestPlayerStalenessMs(stablePlayers, nowMs),
  };
}

export function resetCronSchedulerState(): void {
  roundRobinCursor = 0;
  playerPollState.clear();
}

function getMaxPlayersForCycle(): number {
  const estimatedBaseCostPerPlayer = 2;
  const cycleRequestBudget = Math.max(
    20,
    Math.floor(RIOT_APP_RATE_PER_120_SECONDS * (FETCH_INTERVAL_MINUTES / 2) * 0.8),
  );
  return Math.max(1, Math.floor(cycleRequestBudget / estimatedBaseCostPerPlayer));
}

function getStableActivePlayers(players: PlayerDocument[]): PlayerDocument[] {
  return [...players].sort((a, b) => {
    const aRegisteredAt = a.registeredAt instanceof Date ? a.registeredAt.getTime() : 0;
    const bRegisteredAt = b.registeredAt instanceof Date ? b.registeredAt.getTime() : 0;
    if (aRegisteredAt !== bRegisteredAt) return aRegisteredAt - bRegisteredAt;
    return a.discordId.localeCompare(b.discordId);
  });
}

function syncPlayerPollState(players: PlayerDocument[]): void {
  const activeIds = new Set(players.map((player) => player.discordId));

  for (const player of players) {
    if (!playerPollState.has(player.discordId)) {
      playerPollState.set(player.discordId, {});
    }
  }

  for (const discordId of [...playerPollState.keys()]) {
    if (!activeIds.has(discordId)) {
      playerPollState.delete(discordId);
    }
  }
}

function getPrioritizedGroups(players: PlayerDocument[], nowMs: number): {
  neverPolled: PlayerDocument[];
  stalePlayers: PlayerDocument[];
  recentActive: PlayerDocument[];
  roundRobinPool: PlayerDocument[];
} {
  const neverPolled = players.filter((player) => !playerPollState.get(player.discordId)?.lastProcessedAt);
  const recentActive = players.filter((player) => {
    const lastActivityAt = playerPollState.get(player.discordId)?.lastActivityAt;
    return Boolean(lastActivityAt && nowMs - lastActivityAt <= RECENT_ACTIVITY_WINDOW_MS);
  });
  const stalePlayers = players
    .filter((player) => isStaleInactivePlayer(player, recentActive, nowMs))
    .sort((a, b) => getPlayerStalenessMs(b, nowMs) - getPlayerStalenessMs(a, nowMs));

  const prioritizedIds = new Set([
    ...neverPolled.map((player) => player.discordId),
    ...stalePlayers.map((player) => player.discordId),
    ...recentActive.map((player) => player.discordId),
  ]);

  return {
    neverPolled,
    stalePlayers,
    recentActive,
    roundRobinPool: getRoundRobinPlayers(
      players.filter((player) => !prioritizedIds.has(player.discordId)),
    ),
  };
}

function isStaleInactivePlayer(
  player: PlayerDocument,
  recentActive: PlayerDocument[],
  nowMs: number,
): boolean {
  const state = playerPollState.get(player.discordId);
  if (!state?.lastProcessedAt) return false;
  if (recentActive.some((candidate) => candidate.discordId === player.discordId)) return false;
  return nowMs - state.lastProcessedAt > FETCH_INTERVAL_MINUTES * 2 * 60 * 1000;
}

function pickPlayersForCycle(
  groups: { neverPolled: PlayerDocument[]; stalePlayers: PlayerDocument[]; recentActive: PlayerDocument[]; roundRobinPool: PlayerDocument[] },
  maxPlayersForCycle: number,
): PlayerDocument[] {
  const selectedPlayers: PlayerDocument[] = [];
  const selectedIds = new Set<string>();

  for (const group of [groups.neverPolled, groups.stalePlayers, groups.recentActive, groups.roundRobinPool]) {
    for (const player of group) {
      if (selectedPlayers.length >= maxPlayersForCycle) {
        return selectedPlayers;
      }
      if (selectedIds.has(player.discordId)) continue;

      selectedPlayers.push(player);
      selectedIds.add(player.discordId);
    }
  }

  return selectedPlayers;
}

function advanceRoundRobinCursor(roundRobinPool: PlayerDocument[], selectedPlayers: PlayerDocument[]): void {
  if (roundRobinPool.length === 0) return;

  const roundRobinIds = new Set(roundRobinPool.map((player) => player.discordId));
  const selectedRoundRobinCount = selectedPlayers.filter((player) => roundRobinIds.has(player.discordId)).length;
  roundRobinCursor = (roundRobinCursor + selectedRoundRobinCount) % roundRobinPool.length;
}

function getRoundRobinPlayers(players: PlayerDocument[]): PlayerDocument[] {
  if (players.length === 0) return [];
  const offset = roundRobinCursor % players.length;
  return players.slice(offset).concat(players.slice(0, offset));
}

function getPlayerStalenessMs(player: PlayerDocument, nowMs: number): number {
  const state = playerPollState.get(player.discordId);
  if (state?.lastProcessedAt) {
    return nowMs - state.lastProcessedAt;
  }
  if (player.registeredAt instanceof Date) {
    return nowMs - player.registeredAt.getTime();
  }
  return Number.MAX_SAFE_INTEGER;
}

function getOldestPlayerStalenessMs(players: PlayerDocument[], nowMs: number): number | null {
  if (players.length === 0) return null;
  return Math.max(...players.map((player) => getPlayerStalenessMs(player, nowMs)));
}
