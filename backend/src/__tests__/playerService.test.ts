import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/Player', () => ({
  Player: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    create: vi.fn(),
  },
}));

vi.mock('@/services/riotService', () => ({
  getRiotClient: vi.fn(),
}));

vi.mock('@/lib/riotUtils', () => ({
  findRankedEntry: vi.fn(),
}));

import { Player } from '@/db/models/Player';
import { getRiotClient } from '@/services/riotService';
import { findRankedEntry } from '@/lib/riotUtils';
import { registerPlayer } from '@/services/playerService';

const mockFindOne = vi.mocked(Player.findOne);
const mockCreate = vi.mocked(Player.create);
const mockGetRiotClient = vi.mocked(getRiotClient);
const mockFindRankedEntry = vi.mocked(findRankedEntry);

describe('registerPlayer duplicate handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetRiotClient.mockReturnValue({
      getPuuidByRiotId: vi.fn().mockResolvedValue('puuid-1'),
      getTftLeagueByPuuid: vi.fn().mockResolvedValue([]),
    } as any);

    mockFindRankedEntry.mockReturnValue(undefined as any);
    mockFindOne.mockResolvedValue(null as any);
  });

  it('throws an already-registered error when the puuid already exists', async () => {
    mockFindOne
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({ puuid: 'puuid-1' } as any);

    await expect(
      registerPlayer({
        discordId: 'discord-2',
        gameName: 'Summoner',
        tagLine: 'NA1',
        addedBy: 'discord-2',
        godSlug: 'ekko',
      }),
    ).rejects.toThrow('already registered');

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('converts Mongo duplicate-key errors into an already-registered error', async () => {
    mockCreate.mockRejectedValueOnce({
      name: 'MongoServerError',
      code: 11000,
      message: 'E11000 duplicate key error collection: players index: puuid_1 dup key',
    });

    await expect(
      registerPlayer({
        discordId: 'discord-1',
        gameName: 'Summoner',
        tagLine: 'NA1',
        addedBy: 'discord-1',
        godSlug: 'ahri',
      }),
    ).rejects.toThrow('already registered');
  });
});
