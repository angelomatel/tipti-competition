import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/playerService', () => ({
  listActivePlayers: vi.fn(),
}));

vi.mock('@/services/snapshotService', () => ({
  captureSnapshotForPlayer: vi.fn(),
}));

vi.mock('@/services/matchService', () => ({
  captureMatchesForPlayer: vi.fn(),
}));

vi.mock('@/services/scoringEngine', () => ({
  createLpDeltaTransaction: vi.fn(),
}));

vi.mock('@/services/matchBuffProcessor', () => ({
  processNewMatchBuffs: vi.fn(),
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/services/riotService', () => ({
  getRiotClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { runCronCycle, resetCronCycleState } from '@/services/cronCycleService';
import { captureMatchesForPlayer } from '@/services/matchService';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { listActivePlayers } from '@/services/playerService';
import { getRiotClient } from '@/services/riotService';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { getTournamentSettings } from '@/services/tournamentService';

const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockGetRiotClient = vi.mocked(getRiotClient);
const mockListActivePlayers = vi.mocked(listActivePlayers);
const mockCaptureSnapshot = vi.mocked(captureSnapshotForPlayer);
const mockCaptureMatches = vi.mocked(captureMatchesForPlayer);
const mockCreateLpDelta = vi.mocked(createLpDeltaTransaction);
const mockProcessBuffs = vi.mocked(processNewMatchBuffs);
const mockWarn = vi.mocked(logger.warn);
const mockDebug = vi.mocked(logger.debug);
const mockError = vi.mocked(logger.error);

const defaultMatchCaptureResult = {
  requestedMatchIdCount: 10,
  fetchedMatchIdCount: 0,
  matchDetailRequestCount: 0,
  capturedCount: 0,
  duplicateCount: 0,
  nonRankedCount: 0,
  outOfWindowCount: 0,
  missingParticipantCount: 0,
  deferredMatchDetailCount: 0,
};

function makeSettings(startOffset: number, endOffset: number) {
  const now = Date.now();
  return {
    startDate: new Date(now + startOffset),
    endDate: new Date(now + endOffset),
  } as any;
}

describe('runCronCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCronCycleState();
    mockGetRiotClient.mockReturnValue({
      getRequestMetricsSince: vi.fn().mockReturnValue([]),
    } as any);
  });

  it('processes all active players successfully', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));

    const players = [
      {
        discordId: 'user1',
        puuid: 'puuid1',
        gameName: 'One',
        tagLine: 'NA1',
        currentTier: 'GOLD',
        currentRank: 'II',
        currentLP: 50,
        currentWins: 10,
        currentLosses: 5,
      },
      {
        discordId: 'user2',
        puuid: 'puuid2',
        gameName: 'Two',
        tagLine: 'NA1',
        currentTier: 'PLATINUM',
        currentRank: 'IV',
        currentLP: 20,
        currentWins: 20,
        currentLosses: 20,
      },
    ];
    mockListActivePlayers.mockResolvedValue(players as any);
    mockCaptureSnapshot.mockImplementation(async (player) => ({ ...player, currentLP: player.currentLP + 10 } as any));
    mockCaptureMatches.mockResolvedValue(defaultMatchCaptureResult as any);
    mockCreateLpDelta.mockResolvedValue(undefined);
    mockProcessBuffs.mockResolvedValue(undefined);

    await runCronCycle();

    expect(mockCaptureSnapshot).toHaveBeenCalledTimes(2);
    expect(mockCaptureMatches).toHaveBeenCalledTimes(2);
    expect(mockCreateLpDelta).toHaveBeenCalledTimes(2);
    expect(mockProcessBuffs).toHaveBeenCalledTimes(1);
    expect(mockCaptureSnapshot).toHaveBeenCalledWith(players[0]);
    expect(mockCaptureSnapshot).toHaveBeenCalledWith(players[1]);
    expect(mockCaptureMatches).toHaveBeenCalledWith(
      players[0],
      expect.objectContaining({
        settings: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      }),
    );
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'user1',
        riotId: 'One#NA1',
        puuid: 'puuid1',
      }),
      '[cron] Processing player One#NA1',
    );
  });

  it('continues processing when one player fails', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));

    const players = [
      {
        discordId: 'user1', puuid: 'puuid1', gameName: 'One', tagLine: 'NA1',
        currentTier: 'GOLD', currentRank: 'II', currentLP: 50, currentWins: 10, currentLosses: 5,
      },
      {
        discordId: 'user2', puuid: 'puuid2', gameName: 'Two', tagLine: 'NA1',
        currentTier: 'PLATINUM', currentRank: 'IV', currentLP: 20, currentWins: 20, currentLosses: 20,
      },
    ];
    mockListActivePlayers.mockResolvedValue(players as any);
    mockCaptureSnapshot
      .mockRejectedValueOnce(new Error('Riot API timeout'))
      .mockResolvedValueOnce({ ...players[1], currentLP: 30 } as any);
    mockCaptureMatches.mockResolvedValue(defaultMatchCaptureResult as any);
    mockCreateLpDelta.mockResolvedValue(undefined);
    mockProcessBuffs.mockResolvedValue(undefined);

    await runCronCycle();

    expect(mockCaptureSnapshot).toHaveBeenCalledTimes(2);
    expect(mockCaptureMatches).toHaveBeenCalledTimes(1);
    expect(mockCreateLpDelta).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'user1',
        riotId: 'One#NA1',
        puuid: 'puuid1',
      }),
      '[cron] Failed processing One#NA1',
    );
  });

  it('skips scoring when competitive state does not change', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));
    const players = [{
      discordId: 'user1', puuid: 'puuid1', gameName: 'One', tagLine: 'NA1',
      currentTier: 'GOLD', currentRank: 'II', currentLP: 50, currentWins: 10, currentLosses: 5,
    }];
    mockListActivePlayers.mockResolvedValue(players as any);
    mockCaptureSnapshot.mockResolvedValue(players[0] as any);
    mockCaptureMatches.mockResolvedValue(defaultMatchCaptureResult as any);
    mockProcessBuffs.mockResolvedValue(undefined);

    await runCronCycle();

    expect(mockCreateLpDelta).not.toHaveBeenCalled();
  });

  it('handles empty player list gracefully', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));
    mockListActivePlayers.mockResolvedValue([] as any);
    mockProcessBuffs.mockResolvedValue(undefined);

    await runCronCycle();

    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
    expect(mockCaptureMatches).not.toHaveBeenCalled();
    expect(mockProcessBuffs).toHaveBeenCalledTimes(1);
  });

  it('skips cycle when tournament has not started yet', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(3600_000, 7200_000));

    await runCronCycle();

    expect(mockListActivePlayers).not.toHaveBeenCalled();
    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
  });

  it('skips cycle when tournament has ended', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-7200_000, -3600_000));

    await runCronCycle();

    expect(mockListActivePlayers).not.toHaveBeenCalled();
    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
  });

  it('skips overlapping runs with isRunning guard', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));
    mockListActivePlayers.mockResolvedValue([
      {
        discordId: 'user1', puuid: 'puuid1', gameName: 'One', tagLine: 'NA1',
        currentTier: 'GOLD', currentRank: 'II', currentLP: 50, currentWins: 10, currentLosses: 5,
      },
    ] as any);

    let release: (() => void) | undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });

    mockCaptureSnapshot.mockImplementation(async (player) => {
      await blocker;
      return { ...player, currentLP: player.currentLP + 5 } as any;
    });
    mockCaptureMatches.mockResolvedValue(defaultMatchCaptureResult as any);
    mockCreateLpDelta.mockResolvedValue(undefined);
    mockProcessBuffs.mockResolvedValue(undefined);

    const firstRun = runCronCycle();
    await Promise.resolve();
    const secondRun = runCronCycle();
    release?.();

    await Promise.all([firstRun, secondRun]);

    expect(mockWarn).toHaveBeenCalledWith('[cron] Previous cycle is still running. Skipping overlapping cycle.');
    expect(mockListActivePlayers).toHaveBeenCalledTimes(1);
  });
});
