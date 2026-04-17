import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    findOne: vi.fn(),
    find: vi.fn(),
    bulkWrite: vi.fn(),
  },
}));

vi.mock('@/services/riotService', () => ({
  getRiotClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/withRetry', () => ({
  withRetry: vi.fn(async (_label: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/riotClient', () => ({
  TftQueueId: {
    RANKED: 1100,
  },
}));

import { MatchRecord } from '@/db/models/MatchRecord';
import { getRiotClient } from '@/services/riotService';
import { logger } from '@/lib/logger';
import { captureMatchesForPlayer } from '@/services/matchService';

const mockFindOne = vi.mocked(MatchRecord.findOne);
const mockFind = vi.mocked(MatchRecord.find);
const mockBulkWrite = vi.mocked(MatchRecord.bulkWrite);
const mockGetRiotClient = vi.mocked(getRiotClient);
const mockInfo = vi.mocked(logger.info);

describe('captureMatchesForPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFindOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);

    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    mockBulkWrite.mockResolvedValue({ upsertedCount: 1 } as any);
  });

  it('logs captured matches with match and player identifiers', async () => {
    mockGetRiotClient.mockReturnValue({
      getMatchIdsByPuuid: vi.fn().mockResolvedValue(['SEA_123']),
      getMatchById: vi.fn().mockResolvedValue({
        info: {
          queue_id: 1100,
          game_datetime: new Date('2026-04-10T12:34:56.000Z').getTime(),
          participants: [
            { puuid: 'puuid-1', placement: 2 },
          ],
        },
      }),
    } as any);

    await captureMatchesForPlayer({
      discordId: 'discord-1',
      puuid: 'puuid-1',
      riotId: 'Player#SEA',
      gameName: 'Player',
      tagLine: 'SEA',
    } as any, {
      settings: {
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-04-30T23:59:59.000Z'),
      },
    });

    expect(mockBulkWrite).toHaveBeenCalledTimes(1);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'discord-1',
        riotId: 'Player#SEA',
        puuid: 'puuid-1',
        matchId: 'SEA_123',
        placement: 2,
      }),
      '[match] Captured ranked tournament match SEA_123 for Player#SEA',
    );
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        discordId: 'discord-1',
        riotId: 'Player#SEA',
        capturedCount: 1,
        requestedMatchIdCount: 10,
      }),
      '[match] Match capture summary for Player#SEA',
    );
  });
});
