import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/PointTransaction', () => ({
  PointTransaction: {
    aggregate: vi.fn(),
    find: vi.fn(),
    insertMany: vi.fn(),
  },
}));

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    find: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/db/models/Player', () => ({
  Player: {
    find: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    find: vi.fn(),
  },
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/services/scoringEngine', () => ({
  computePlayerScoreTotals: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { MatchRecord } from '@/db/models/MatchRecord';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerScoreTotals } from '@/services/scoringEngine';
import { logger } from '@/lib/logger';

const mockMatchFind = vi.mocked(MatchRecord.find);
const mockMatchUpdateMany = vi.mocked(MatchRecord.updateMany);
const mockPlayerFind = vi.mocked(Player.find);
const mockPointAggregate = vi.mocked(PointTransaction.aggregate);
const mockPointFind = vi.mocked(PointTransaction.find);
const mockPointInsertMany = vi.mocked(PointTransaction.insertMany);
const mockSnapshotFind = vi.mocked(LpSnapshot.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockComputePlayerScoreTotals = vi.mocked(computePlayerScoreTotals);
const mockDebug = vi.mocked(logger.debug);
const mockInfo = vi.mocked(logger.info);

function makeSettings() {
  return {
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2026-04-14T23:59:59.000Z'),
    currentPhase: 2,
    buffsEnabled: true,
    phases: [
      { phase: 1, startDay: '2026-04-01', endDay: '2026-04-05', eliminationCount: 3 },
      { phase: 2, startDay: '2026-04-06', endDay: '2026-04-10', eliminationCount: 3 },
      { phase: 3, startDay: '2026-04-11', endDay: '2026-04-14', eliminationCount: 0 },
    ],
  } as any;
}

function mockFindSortLean<T>(value: T) {
  return {
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(value),
    }),
  };
}

describe('processNewMatchBuffs', () => {
  const player = {
    discordId: 'discord-1',
    puuid: 'puuid-1',
    godSlug: 'ahri',
    currentTier: 'GOLD',
    isEliminatedFromGod: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTournamentSettings.mockResolvedValue(makeSettings());
    mockComputePlayerScoreTotals.mockResolvedValue(new Map());
    mockPointAggregate.mockResolvedValue([] as any);
    mockPointFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
      lean: vi.fn().mockResolvedValue([]),
    } as any);
    mockSnapshotFind.mockReturnValue(mockFindSortLean([]) as any);
    mockPlayerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([player]),
      }),
    } as any);
  });

  it('skips matches from phase 1 even if they are still buffered for processing', async () => {
    const match = {
      _id: 'match-1',
      puuid: player.puuid,
      matchId: 'match-1',
      placement: 1,
      playedAt: new Date('2026-04-02T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchUpdateMany.mockResolvedValue({ modifiedCount: 1 } as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [match._id] } },
      { $set: { buffProcessed: true } },
    );
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: player.discordId,
        riotId: null,
        godSlug: player.godSlug,
        matchId: match.matchId,
      }),
      '[match-buff] Match match-1 for discord:discord-1 occurred before buff activation; marking processed without buffs',
    );
  });

  it('applies buffs to matches once phase 2 has begun', async () => {
    const match = {
      _id: 'match-2',
      puuid: player.puuid,
      matchId: 'match-2',
      placement: 1,
      playedAt: new Date('2026-04-06T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchUpdateMany.mockResolvedValue({ modifiedCount: 1 } as any);
    mockPointInsertMany.mockResolvedValue([] as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        playerId: player.discordId,
        godSlug: player.godSlug,
        type: 'buff',
        source: 'ahri_first_place',
        matchId: match.matchId,
        day: '2026-04-06',
        phase: 2,
        value: 17,
      }),
    ], { ordered: false });
    expect(mockMatchUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [match._id] } },
      { $set: { buffProcessed: true } },
    );
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: player.discordId,
        discordId: player.discordId,
        riotId: null,
        godSlug: player.godSlug,
        source: 'ahri_first_place',
        matchId: match.matchId,
        value: 17,
      }),
      '[match-buff] Created buff transaction of 17 from ahri_first_place for discord:discord-1 on match match-2',
    );
  });
});
