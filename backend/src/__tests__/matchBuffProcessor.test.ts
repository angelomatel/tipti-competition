import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/PointTransaction', () => ({
  PointTransaction: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    find: vi.fn(),
    updateOne: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('@/db/models/Player', () => ({
  Player: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/services/scoringEngine', () => ({
  computePlayerScore: vi.fn(),
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
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { getTournamentSettings } from '@/services/tournamentService';
import { logger } from '@/lib/logger';

const mockMatchFind = vi.mocked(MatchRecord.find);
const mockMatchUpdateOne = vi.mocked(MatchRecord.updateOne);
const mockPlayerFind = vi.mocked(Player.find) as any;
const mockPointAggregate = vi.mocked(PointTransaction.aggregate);
const mockPointCreate = vi.mocked(PointTransaction.create);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
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

describe('processNewMatchBuffs', () => {
  const player = {
    discordId: 'discord-1',
    puuid: 'puuid-1',
    godSlug: 'ahri',
    currentTier: 'GOLD',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTournamentSettings.mockResolvedValue(makeSettings());
    mockPointAggregate.mockResolvedValue([{ _id: null, total: 0 }] as any);
    (mockPlayerFind as any).mockImplementation(async (query: any) => {
      if (query?.puuid) return [player] as any;
      if (query?.godSlug) return [player] as any;
      return [] as any;
    });
  });

  it('skips matches from phase 1 even if they are still buffered for processing', async () => {
    const match = {
      _id: 'match-1',
      puuid: player.puuid,
      matchId: 'match-1',
      placement: 1,
      playedAt: new Date('2026-04-02T12:00:00.000Z'),
    };
    mockMatchFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([match]),
    } as any);
    mockMatchUpdateOne.mockResolvedValue({} as any);

    await processNewMatchBuffs();

    expect(mockPointCreate).not.toHaveBeenCalled();
    expect(mockMatchUpdateOne).toHaveBeenCalledWith(
      { _id: match._id },
      { buffProcessed: true },
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
    mockMatchFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([match]),
    } as any);
    mockMatchUpdateOne.mockResolvedValue({} as any);
    mockPointCreate.mockResolvedValue({} as any);

    await processNewMatchBuffs();

    expect(mockPointCreate).toHaveBeenCalledWith(expect.objectContaining({
      playerId: player.discordId,
      godSlug: player.godSlug,
      type: 'buff',
      source: 'ahri_first_place',
      matchId: match.matchId,
      day: '2026-04-06',
      phase: 2,
      value: 17,
    }));
    expect(mockMatchUpdateOne).toHaveBeenCalledWith(
      { _id: match._id },
      { buffProcessed: true },
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
