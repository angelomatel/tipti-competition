import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/God', () => ({
  God: {
    find: vi.fn(),
  },
}));

vi.mock('@/db/models/Player', () => ({
  Player: {
    find: vi.fn(),
  },
}));

vi.mock('@/services/scoringEngine', () => ({
  computePlayerScoreTotals: vi.fn(),
}));

import { God } from '@/db/models/God';
import { Player } from '@/db/models/Player';
import { computePlayerScoreTotals } from '@/services/scoringEngine';
import { getGodStandings } from '@/services/godService';

const mockGodFind = vi.mocked(God.find);
const mockPlayerFind = vi.mocked(Player.find);
const mockComputePlayerScoreTotals = vi.mocked(computePlayerScoreTotals);

describe('getGodStandings optimized aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes counts, top-N scores, and eliminated sorting without per-god queries', async () => {
    mockGodFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { slug: 'zeus', name: 'Zeus', title: 'Sky', isEliminated: false },
          { slug: 'hades', name: 'Hades', title: 'Underworld', isEliminated: true },
        ]),
      }),
    } as any);
    mockPlayerFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { discordId: 'user-1', godSlug: 'zeus', isEliminatedFromGod: false },
          { discordId: 'user-2', godSlug: 'zeus', isEliminatedFromGod: false },
          { discordId: 'user-3', godSlug: 'zeus', isEliminatedFromGod: true },
          { discordId: 'user-4', godSlug: 'hades', isEliminatedFromGod: false },
        ]),
      }),
    } as any);
    mockComputePlayerScoreTotals.mockResolvedValue(new Map([
      ['user-1', 100],
      ['user-2', 50],
      ['user-3', 500],
      ['user-4', 999],
    ]));

    const result = await getGodStandings();

    expect(mockPlayerFind).toHaveBeenCalledWith({ isActive: true });
    expect(mockComputePlayerScoreTotals).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        slug: 'zeus',
        name: 'Zeus',
        title: 'Sky',
        score: 75,
        playerCount: 3,
        isEliminated: false,
      },
      {
        slug: 'hades',
        name: 'Hades',
        title: 'Underworld',
        score: 0,
        playerCount: 1,
        isEliminated: true,
      },
    ]);
  });
});
