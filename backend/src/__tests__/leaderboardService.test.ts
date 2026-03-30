import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/db/models/God', () => ({
  God: {
    find: vi.fn(),
  },
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/services/playerService', () => ({
  listActivePlayers: vi.fn(),
}));

vi.mock('@/services/scoringEngine', () => ({
  computePlayerScore: vi.fn(),
  computePlayerDailyPointGain: vi.fn(),
}));

import { LpSnapshot } from '@/db/models/LpSnapshot';
import { God } from '@/db/models/God';
import { computeLeaderboard } from '@/services/leaderboardService';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers } from '@/services/playerService';
import { computePlayerScore, computePlayerDailyPointGain } from '@/services/scoringEngine';

const mockFindSnapshot = vi.mocked(LpSnapshot.findOne);
const mockGodFind = vi.mocked(God.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockListActivePlayers = vi.mocked(listActivePlayers);
const mockComputePlayerScore = vi.mocked(computePlayerScore);
const mockComputePlayerDailyPointGain = vi.mocked(computePlayerDailyPointGain);

const players = [
  {
    discordId: 'user1',
    puuid: 'puuid1',
    gameName: 'One',
    tagLine: 'NA1',
    riotId: 'One#NA1',
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 90,
    currentWins: 10,
    currentLosses: 5,
    godSlug: 'zeus',
    isEliminatedFromGod: false,
    discordAvatarUrl: '',
    discordUsername: 'one',
  },
  {
    discordId: 'user2',
    puuid: 'puuid2',
    gameName: 'Two',
    tagLine: 'NA1',
    riotId: 'Two#NA1',
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 80,
    currentWins: 10,
    currentLosses: 5,
    godSlug: 'zeus',
    isEliminatedFromGod: false,
    discordAvatarUrl: '',
    discordUsername: 'two',
  },
  {
    discordId: 'user3',
    puuid: 'puuid3',
    gameName: 'Three',
    tagLine: 'NA1',
    riotId: 'Three#NA1',
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 70,
    currentWins: 10,
    currentLosses: 5,
    godSlug: 'zeus',
    isEliminatedFromGod: false,
    discordAvatarUrl: '',
    discordUsername: 'three',
  },
  {
    discordId: 'user4',
    puuid: 'puuid4',
    gameName: 'Four',
    tagLine: 'NA1',
    riotId: 'Four#NA1',
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 60,
    currentWins: 10,
    currentLosses: 5,
    godSlug: 'zeus',
    isEliminatedFromGod: false,
    discordAvatarUrl: '',
    discordUsername: 'four',
  },
  {
    discordId: 'user5',
    puuid: 'puuid5',
    gameName: 'Five',
    tagLine: 'NA1',
    riotId: 'Five#NA1',
    currentTier: 'GOLD',
    currentRank: 'II',
    currentLP: 50,
    currentWins: 10,
    currentLosses: 5,
    godSlug: 'zeus',
    isEliminatedFromGod: false,
    discordAvatarUrl: '',
    discordUsername: 'five',
  },
] as any[];

describe('computeLeaderboard pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTournamentSettings.mockResolvedValue({
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    } as any);

    mockListActivePlayers.mockResolvedValue(players as any);

    const scoreByDiscordId: Record<string, number> = {
      user1: 50,
      user2: 40,
      user3: 30,
      user4: 20,
      user5: 10,
    };

    mockComputePlayerScore.mockImplementation(async (discordId: string) => scoreByDiscordId[discordId] ?? 0);
    mockComputePlayerDailyPointGain.mockResolvedValue(0);

    mockGodFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ slug: 'zeus', name: 'Zeus' }]),
    } as any);

    mockFindSnapshot.mockImplementation(() => ({
      sort: vi.fn().mockResolvedValue(null),
    } as any));
  });

  it('returns podium entries on page 1 and paginates remaining players', async () => {
    const result = await computeLeaderboard({ page: 1, pageSize: 1 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
    expect(result.totalEntries).toBe(5);
    expect(result.totalPages).toBe(2);

    expect(result.podiumEntries.map((p) => p.discordId)).toEqual(['user1', 'user2', 'user3']);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].discordId).toBe('user4');
    expect(result.entries[0].rank).toBe(4);
  });

  it('returns no podium entries on page > 1 and keeps paginated continuation', async () => {
    const result = await computeLeaderboard({ page: 2, pageSize: 1 });

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.podiumEntries).toEqual([]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].discordId).toBe('user5');
    expect(result.entries[0].rank).toBe(5);
  });
});
