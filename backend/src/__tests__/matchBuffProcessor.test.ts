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
    bulkWrite: vi.fn(),
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

vi.mock('@/services/godService', () => ({
  getGodStandings: vi.fn(),
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
import { getGodStandings } from '@/services/godService';
import { logger } from '@/lib/logger';

const mockMatchFind = vi.mocked(MatchRecord.find);
const mockMatchBulkWrite = vi.mocked(MatchRecord.bulkWrite);
const mockPlayerFind = vi.mocked(Player.find);
const mockPointAggregate = vi.mocked(PointTransaction.aggregate);
const mockPointFind = vi.mocked(PointTransaction.find);
const mockPointInsertMany = vi.mocked(PointTransaction.insertMany);
const mockSnapshotFind = vi.mocked(LpSnapshot.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockComputePlayerScoreTotals = vi.mocked(computePlayerScoreTotals);
const mockGetGodStandings = vi.mocked(getGodStandings);
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
    mockGetGodStandings.mockResolvedValue([] as any);
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
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: 'before_buff_activation' } },
        },
      },
    ]);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: player.discordId,
        riotId: null,
        godSlug: player.godSlug,
        matchId: match.matchId,
        reason: 'before_buff_activation',
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
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);
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
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: null } },
        },
      },
    ]);
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

  it('logs no_player reason when match has no tracked player', async () => {
    const match = {
      _id: 'match-np',
      puuid: 'puuid-orphan',
      matchId: 'match-np',
      placement: 3,
      playedAt: new Date('2026-04-06T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: 'no_player' } },
        },
      },
    ]);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        puuid: 'puuid-orphan',
        matchId: match.matchId,
        reason: 'no_player',
      }),
      expect.stringContaining('has no tracked player'),
    );
  });

  it('logs rule_returned_empty reason when rule produces no entries (Ahri placement 5)', async () => {
    const match = {
      _id: 'match-empty',
      puuid: player.puuid,
      matchId: 'match-empty',
      placement: 5,
      playedAt: new Date('2026-04-06T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: 'rule_returned_empty' } },
        },
      },
    ]);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: player.discordId,
        godSlug: 'ahri',
        matchId: match.matchId,
        reason: 'rule_returned_empty',
      }),
      expect.stringContaining('produced no transactions (rule_returned_empty)'),
    );
  });

  it('logs rule_rolled_zero reason when Aurelion Sol rolls a 0', async () => {
    const asolPlayer = {
      discordId: 'discord-asol',
      puuid: 'puuid-asol',
      godSlug: 'aurelion_sol',
      currentTier: 'GOLD',
      isEliminatedFromGod: false,
    };
    mockPlayerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([asolPlayer]),
      }),
    } as any);

    const match = {
      _id: 'match-asol',
      puuid: asolPlayer.puuid,
      matchId: 'match-asol',
      placement: 1,
      playedAt: new Date('2026-04-06T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      await processNewMatchBuffs();
    } finally {
      randomSpy.mockRestore();
    }

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: 'rule_rolled_zero' } },
        },
      },
    ]);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        godSlug: 'aurelion_sol',
        matchId: match.matchId,
        reason: 'rule_rolled_zero',
      }),
      expect.stringContaining('produced no transactions (rule_rolled_zero)'),
    );
  });

  it('logs daily_cap_hit reason when cap is exhausted before any entry is written', async () => {
    const match = {
      _id: 'match-cap',
      puuid: player.puuid,
      matchId: 'match-cap',
      placement: 1,
      playedAt: new Date('2026-04-06T12:00:00.000Z'),
    };
    mockMatchFind
      .mockReturnValueOnce(mockFindSortLean([match]) as any)
      .mockReturnValueOnce(mockFindSortLean([match]) as any);
    mockMatchBulkWrite.mockResolvedValue({ modifiedCount: 1 } as any);
    mockPointAggregate.mockResolvedValue([
      { _id: { playerId: player.discordId, day: '2026-04-06' }, total: 75 },
    ] as any);

    await processNewMatchBuffs();

    expect(mockPointInsertMany).not.toHaveBeenCalled();
    expect(mockMatchBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: match._id },
          update: { $set: { buffProcessed: true, buffSkipReason: 'daily_cap_hit' } },
        },
      },
    ]);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: player.discordId,
        godSlug: 'ahri',
        matchId: match.matchId,
        reason: 'daily_cap_hit',
        currentCapTotal: 75,
        cap: 75,
      }),
      expect.stringContaining('produced no transactions (daily_cap_hit)'),
    );
  });
});
