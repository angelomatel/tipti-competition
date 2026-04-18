import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockListActivePlayers,
  mockCaptureSnapshotForPlayer,
  mockCaptureMatchesForPlayer,
  mockCreateLpDeltaTransaction,
  mockProcessNewMatchBuffs,
  mockGetTournamentSettings,
  mockGetRiotClient,
  mockPlayerPollStateFind,
  mockPlayerPollStateBulkWrite,
  mockPlayerPollStateUpdateOne,
  mockCountOutstandingMatches,
  mockWarn,
} = vi.hoisted(() => ({
  mockListActivePlayers: vi.fn(),
  mockCaptureSnapshotForPlayer: vi.fn(),
  mockCaptureMatchesForPlayer: vi.fn(),
  mockCreateLpDeltaTransaction: vi.fn(),
  mockProcessNewMatchBuffs: vi.fn(),
  mockGetTournamentSettings: vi.fn(),
  mockGetRiotClient: vi.fn(),
  mockPlayerPollStateFind: vi.fn(),
  mockPlayerPollStateBulkWrite: vi.fn(),
  mockPlayerPollStateUpdateOne: vi.fn(),
  mockCountOutstandingMatches: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/services/playerService', () => ({
  listActivePlayers: mockListActivePlayers,
}));

vi.mock('@/services/snapshotService', () => ({
  captureSnapshotForPlayer: mockCaptureSnapshotForPlayer,
}));

vi.mock('@/services/matchService', () => ({
  captureMatchesForPlayer: mockCaptureMatchesForPlayer,
}));

vi.mock('@/services/scoringEngine', () => ({
  createLpDeltaTransaction: mockCreateLpDeltaTransaction,
}));

vi.mock('@/services/matchBuffProcessor', () => ({
  processNewMatchBuffs: mockProcessNewMatchBuffs,
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: mockGetTournamentSettings,
}));

vi.mock('@/services/riotService', () => ({
  getRiotClient: mockGetRiotClient,
}));

vi.mock('@/db/models/PlayerPollState', () => ({
  PlayerPollState: {
    find: mockPlayerPollStateFind,
    bulkWrite: mockPlayerPollStateBulkWrite,
    updateOne: mockPlayerPollStateUpdateOne,
  },
}));

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    countDocuments: mockCountOutstandingMatches,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: mockWarn,
  },
}));

import { runCronCycle, resetCronCycleState } from '@/services/cronCycleService';

function makeSettings(startOffsetMs = -3_600_000, endOffsetMs = 3_600_000) {
  const now = Date.now();
  return {
    startDate: new Date(now + startOffsetMs),
    endDate: new Date(now + endOffsetMs),
  } as any;
}

function makePlayer(): any {
  return {
    discordId: 'user-1',
    puuid: 'puuid-1',
    gameName: 'Player',
    tagLine: 'SG2',
    riotId: 'Player#SG2',
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 40,
    currentWins: 10,
    currentLosses: 10,
  };
}

const defaultMatchCaptureResult = {
  requestedMatchIdCount: 10,
  fetchedMatchIdCount: 0,
  uncapturedMatchCount: 0,
  matchDetailRequestCount: 0,
  capturedCount: 0,
  duplicateCount: 0,
  nonRankedCount: 0,
  outOfWindowCount: 0,
  missingParticipantCount: 0,
  deferredMatchDetailCount: 0,
  newMatches: [],
};

describe('runCronCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCronCycleState();

    mockGetTournamentSettings.mockResolvedValue(makeSettings());
    mockPlayerPollStateFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    mockPlayerPollStateBulkWrite.mockResolvedValue(undefined);
    mockPlayerPollStateUpdateOne.mockResolvedValue(undefined);
    mockListActivePlayers.mockResolvedValue([makePlayer()]);
    mockCaptureMatchesForPlayer.mockResolvedValue(defaultMatchCaptureResult);
    mockCaptureSnapshotForPlayer.mockImplementation(async (player: any) => player);
    mockCreateLpDeltaTransaction.mockResolvedValue(undefined);
    mockProcessNewMatchBuffs.mockResolvedValue(undefined);
    mockCountOutstandingMatches.mockResolvedValue(0);
    mockGetRiotClient.mockReturnValue({
      getRequestMetricsSince: vi.fn().mockReturnValue([]),
      getQueueSnapshot: vi.fn().mockReturnValue({
        queuedRequests: 0,
        activeRequests: 0,
        blockedUntil: null,
        blockedForMs: 0,
        requestsLastSecond: 0,
        requestsLastMinute: 0,
        requestsLast120Seconds: 0,
      }),
    });
  });

  it('promotes a baseline player to hot mode after capturing a new match', async () => {
    mockCaptureMatchesForPlayer.mockResolvedValue({
      ...defaultMatchCaptureResult,
      uncapturedMatchCount: 1,
      capturedCount: 1,
      newMatches: [
        {
          matchId: 'SG2_1',
          placement: 2,
          playedAt: new Date('2026-04-18T00:00:00.000Z'),
        },
      ],
    });

    await runCronCycle({ cycleType: 'baseline', source: 'scheduled' });

    expect(mockPlayerPollStateUpdateOne).toHaveBeenCalledWith(
      { playerId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          mode: 'hot',
          deferredMatchDetailCount: 0,
          unresolvedMatchCount: 0,
          nextEligibleAt: expect.any(Date),
        }),
      }),
      { upsert: true },
    );
  });

  it('keeps pending hot players cheap on no-op polls and cools them back to baseline after idle TTL', async () => {
    const now = new Date();
    mockPlayerPollStateFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          playerId: 'user-1',
          puuid: 'puuid-1',
          mode: 'hot',
          lastProcessedAt: new Date(now.getTime() - 60_000),
          lastRankPollAt: new Date(now.getTime() - 60_000),
          lastMatchPollAt: new Date(now.getTime() - 60_000),
          lastObservedActivityAt: new Date(now.getTime() - 16 * 60 * 1000),
          enteredHotAt: new Date(now.getTime() - 16 * 60 * 1000),
          consecutiveIdleHotPolls: 2,
          unresolvedMatchCount: 0,
          deferredMatchDetailCount: 0,
          nextEligibleAt: new Date(now.getTime() - 1_000),
        },
      ]),
    });

    await runCronCycle({ cycleType: 'hot', source: 'scheduled' });

    expect(mockCaptureSnapshotForPlayer).not.toHaveBeenCalled();
    expect(mockPlayerPollStateUpdateOne).toHaveBeenCalledWith(
      { playerId: 'user-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          mode: 'baseline',
          consecutiveIdleHotPolls: 0,
          enteredHotAt: null,
          nextEligibleAt: expect.any(Date),
        }),
      }),
      { upsert: true },
    );
  });

  it('skips overlapping cycles of the same type', async () => {
    let release: (() => void) | undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockCaptureMatchesForPlayer.mockImplementation(async () => {
      await blocker;
      return defaultMatchCaptureResult;
    });

    const firstRun = runCronCycle({ cycleType: 'hot', source: 'scheduled' });
    await Promise.resolve();
    const secondRun = runCronCycle({ cycleType: 'hot', source: 'scheduled' });

    release?.();
    await Promise.all([firstRun, secondRun]);

    expect(mockWarn).toHaveBeenCalledWith(
      { cycleType: 'hot' },
      '[cron] A conflicting cycle is already running. Skipping overlapping cycle.',
    );
  });
});
