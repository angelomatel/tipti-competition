import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/PointTransaction', () => ({
  PointTransaction: {
    aggregate: vi.fn(),
    distinct: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    findOne: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/db/models/Player', () => ({
  Player: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/dateUtils', () => ({
  getCurrentPhtDay: vi.fn(() => '2026-04-03'),
  getTodayUTC8: vi.fn(() => '2026-04-03'),
  dateToUTC8Str: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { PointTransaction } from '@/db/models/PointTransaction';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { logger } from '@/lib/logger';

const mockAggregate = vi.mocked(PointTransaction.aggregate);
const mockCreate = vi.mocked(PointTransaction.create);
const mockDistinct = vi.mocked(PointTransaction.distinct);
const mockUpdateOne = vi.mocked(PointTransaction.updateOne);
const mockSnapshotFindOne = vi.mocked(LpSnapshot.findOne);
const mockMatchFindOne = vi.mocked(MatchRecord.findOne);
const mockMatchFind = vi.mocked(MatchRecord.find);
const mockMatchUpdateMany = vi.mocked(MatchRecord.updateMany);
const mockMatchUpdateOne = vi.mocked(MatchRecord.updateOne);

describe('createLpDeltaTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistinct.mockResolvedValue([]);
    mockUpdateOne.mockResolvedValue({ upsertedCount: 1 } as any);
    mockMatchFindOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    } as any);
    mockMatchFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as any);
    mockMatchUpdateMany.mockResolvedValue({ modifiedCount: 0 } as any);
    mockMatchUpdateOne.mockResolvedValue({ modifiedCount: 0 } as any);
    mockSnapshotFindOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    } as any);
  });

  it('uses the stored LP baseline offset during rank resets so points do not drop', async () => {
    mockAggregate.mockResolvedValue([{ _id: null, total: 125 }] as any);

    await createLpDeltaTransaction({
      discordId: 'user-1',
      puuid: 'puuid-1',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 50,
      lpBaselineNorm: 1850,
      lpBaselineOffset: 125,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any);

    expect(mockSnapshotFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('falls back to the tournament start snapshot when no reset baseline exists', async () => {
    mockSnapshotFindOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue({
        tier: 'GOLD',
        rank: 'IV',
        leaguePoints: 0,
      }),
    } as any);
    mockAggregate.mockResolvedValue([{ _id: null, total: 100 }] as any);

    await createLpDeltaTransaction({
      discordId: 'user-2',
      puuid: 'puuid-2',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 0,
      lpBaselineNorm: null,
      lpBaselineOffset: 0,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any);

    expect(mockSnapshotFindOne).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      playerId: 'user-2',
      value: 100,
      source: 'lp_delta',
      type: 'match',
    }));
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'user-2',
        riotId: null,
        playerId: 'user-2',
        godSlug: 'ahri',
        value: 100,
        source: 'lp_delta',
        day: '2026-04-03',
        phase: 1,
      }),
      '[scoring] Created LP delta transaction of 100 for discord:user-2',
    );
  });

  it('skips creating a duplicate match-linked LP delta transaction', async () => {
    mockAggregate.mockResolvedValue([{ _id: null, total: 20 }] as any);
    mockUpdateOne.mockResolvedValue({ upsertedCount: 0 } as any);

    await createLpDeltaTransaction({
      discordId: 'user-3',
      puuid: 'puuid-3',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 20,
      lpBaselineNorm: 1820,
      lpBaselineOffset: 0,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any, {
      newMatches: [
        { matchId: 'match-1', placement: 4, playedAt: new Date('2026-04-03T10:00:00.000Z') },
      ],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'user-3',
        matchId: 'match-1',
      }),
      '[scoring] Skipped duplicate LP delta transaction for discord:user-3 via match match-1',
    );
  });

  it('treats duplicate-key errors as a safe concurrent race', async () => {
    mockAggregate.mockResolvedValue([{ _id: null, total: 20 }] as any);
    mockUpdateOne.mockRejectedValue({ code: 11000 });

    await createLpDeltaTransaction({
      discordId: 'user-3',
      puuid: 'puuid-3',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 20,
      lpBaselineNorm: 1820,
      lpBaselineOffset: 0,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any, {
      newMatches: [
        { matchId: 'match-1', placement: 4, playedAt: new Date('2026-04-03T10:00:00.000Z') },
      ],
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'user-3',
        matchId: 'match-1',
      }),
      '[scoring] Skipped duplicate LP delta transaction for discord:user-3 via match match-1',
    );
  });

  it('links the LP delta to the latest new match and marks earlier matches ambiguous', async () => {
    mockAggregate.mockResolvedValue([{ _id: null, total: 0 }] as any);
    mockMatchFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { matchId: 'match-older', placement: 4, playedAt: new Date('2026-04-03T10:00:00.000Z') },
            { matchId: 'match-latest', placement: 6, playedAt: new Date('2026-04-03T10:30:00.000Z') },
          ]),
        }),
      }),
    } as any);

    await createLpDeltaTransaction({
      discordId: 'user-4',
      puuid: 'puuid-4',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 25,
      lpBaselineNorm: 1800,
      lpBaselineOffset: 0,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any, {
      newMatches: [
        { matchId: 'match-older', placement: 4, playedAt: new Date('2026-04-03T10:00:00.000Z') },
        { matchId: 'match-latest', placement: 6, playedAt: new Date('2026-04-03T10:30:00.000Z') },
      ],
    });

    expect(mockUpdateOne).toHaveBeenCalledWith(
      {
        playerId: 'user-4',
        source: 'lp_delta',
        type: 'match',
        matchId: 'match-latest',
      },
      {
        $setOnInsert: expect.objectContaining({
          playerId: 'user-4',
          matchId: 'match-latest',
          value: 25,
        }),
      },
      { upsert: true },
    );
    expect(mockMatchUpdateMany).toHaveBeenCalledWith(
      { puuid: 'puuid-4', matchId: { $in: ['match-older'] } },
      { $set: { lpAttributionStatus: 'ambiguous', lpAttributionReason: 'multiple_matches_single_delta' } },
    );
    expect(mockMatchUpdateOne).toHaveBeenCalledWith(
      { puuid: 'puuid-4', matchId: 'match-latest' },
      { $set: { lpAttributionStatus: 'linked', lpAttributionReason: null } },
    );
  });

  it('uses previously unresolved matches when attributing a newly observed lp delta', async () => {
    mockAggregate.mockResolvedValue([{ _id: null, total: 0 }] as any);
    mockMatchFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { matchId: 'match-stale', placement: 6, playedAt: new Date('2026-04-03T10:00:00.000Z') },
            { matchId: 'match-new', placement: 8, playedAt: new Date('2026-04-03T10:30:00.000Z') },
          ]),
        }),
      }),
    } as any);

    await createLpDeltaTransaction({
      discordId: 'user-5',
      puuid: 'puuid-5',
      godSlug: 'ahri',
      currentTier: 'GOLD',
      currentRank: 'II',
      currentLP: 25,
      lpBaselineNorm: 1800,
      lpBaselineOffset: 0,
    } as any, {
      currentPhase: 1,
      phases: [],
      startDate: new Date('2026-04-01T00:00:00.000Z'),
    } as any, {
      newMatches: [
        { matchId: 'match-new', placement: 8, playedAt: new Date('2026-04-03T10:30:00.000Z') },
      ],
    });

    expect(mockUpdateOne).toHaveBeenCalledWith(
      {
        playerId: 'user-5',
        source: 'lp_delta',
        type: 'match',
        matchId: 'match-new',
      },
      expect.any(Object),
      { upsert: true },
    );
    expect(mockMatchUpdateMany).toHaveBeenCalledWith(
      { puuid: 'puuid-5', matchId: { $in: ['match-stale'] } },
      { $set: { lpAttributionStatus: 'ambiguous', lpAttributionReason: 'multiple_matches_single_delta' } },
    );
  });
});
