import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    aggregate: vi.fn(),
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
  searchActivePlayers: vi.fn(),
}));

vi.mock('@/services/scoringEngine', () => ({
  computePlayerScoreTotals: vi.fn(),
  computePlayerDailyPointGainTotals: vi.fn(),
}));

import { LpSnapshot } from '@/db/models/LpSnapshot';
import { God } from '@/db/models/God';
import { clearLeaderboardCache, computeLeaderboard } from '@/services/leaderboardService';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers, searchActivePlayers } from '@/services/playerService';
import { computePlayerDailyPointGainTotals, computePlayerScoreTotals } from '@/services/scoringEngine';

const mockAggregateSnapshots = vi.mocked(LpSnapshot.aggregate);
const mockGodFind = vi.mocked(God.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockListActivePlayers = vi.mocked(listActivePlayers);
const mockSearchActivePlayers = vi.mocked(searchActivePlayers);
const mockComputePlayerScoreTotals = vi.mocked(computePlayerScoreTotals);
const mockComputePlayerDailyPointGainTotals = vi.mocked(computePlayerDailyPointGainTotals);

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
    clearLeaderboardCache();

    mockGetTournamentSettings.mockResolvedValue({
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    } as any);

    mockListActivePlayers.mockResolvedValue(players as any);
    mockSearchActivePlayers.mockResolvedValue(players as any);

    const scoreByDiscordId: Record<string, number> = {
      user1: 50,
      user2: 40,
      user3: 30,
      user4: 20,
      user5: 10,
    };

    mockComputePlayerScoreTotals.mockResolvedValue(new Map(
      Object.entries(scoreByDiscordId),
    ));
    mockComputePlayerDailyPointGainTotals.mockResolvedValue(new Map());

    mockGodFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ slug: 'zeus', name: 'Zeus' }]),
    } as any);

    mockAggregateSnapshots.mockResolvedValue([]);
  });

  it('returns podium entries on page 1 as part of the pageSize', async () => {
    // Total players: 5. PageSize: 5.
    const result = await computeLeaderboard({ page: 1, pageSize: 5 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.totalEntries).toBe(5);
    expect(result.totalPages).toBe(1);

    expect(result.podiumEntries.map((p) => p.discordId)).toEqual(['user1', 'user2', 'user3']);
    expect(result.entries).toHaveLength(2); // Remaining 2 of 5
    expect(result.entries[0].discordId).toBe('user4');
    expect(result.entries[1].discordId).toBe('user5');
  });

  it('disables podium if pageSize < 3', async () => {
    const result = await computeLeaderboard({ page: 1, pageSize: 2 });

    expect(result.podiumEntries).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].discordId).toBe('user1');
  });

  it('returns continuation on page > 1 correctly', async () => {
    // Total players: 5. PageSize: 2.
    // Page 1: user1, user2 (podium disabled)
    // Page 2: user3, user4
    // Page 3: user5
    const result = await computeLeaderboard({ page: 2, pageSize: 2 });

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.podiumEntries).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].discordId).toBe('user3');
    expect(result.entries[1].discordId).toBe('user4');
  });

  it('uses batched score and snapshot reads while preserving daily LP and point gains', async () => {
    mockAggregateSnapshots
      .mockResolvedValueOnce([
        { puuid: 'puuid1', tier: 'GOLD', rank: 'II', leaguePoints: 50 },
      ] as any)
      .mockResolvedValueOnce([
        { puuid: 'puuid1', tier: 'GOLD', rank: 'II', leaguePoints: 75 },
      ] as any);
    mockComputePlayerDailyPointGainTotals.mockResolvedValue(new Map([['user1', 7]]));

    const result = await computeLeaderboard({ page: 1, pageSize: 2 });

    expect(mockAggregateSnapshots).toHaveBeenCalledTimes(2);
    expect(mockComputePlayerScoreTotals).toHaveBeenCalledTimes(1);
    expect(mockComputePlayerDailyPointGainTotals).toHaveBeenCalledTimes(1);
    expect(result.entries[0].discordId).toBe('user1');
    expect(result.entries[0].lpGain).toBe(15);
    expect(result.entries[0].dailyPointGain).toBe(7);
  });

  it('filters by search while preserving global rank numbers', async () => {
    mockSearchActivePlayers.mockResolvedValue([players[1], players[3]] as any);

    const result = await computeLeaderboard({ page: 1, pageSize: 10, search: 'o' });

    expect(result.podiumEntries).toEqual([]);
    expect(result.entries.map((entry) => entry.discordId)).toEqual(['user2', 'user4']);
    expect(result.entries.map((entry) => entry.rank)).toEqual([2, 4]);
  });

  it('treats whitespace search as the unfiltered leaderboard', async () => {
    const result = await computeLeaderboard({ page: 1, pageSize: 5, search: '   ' });

    expect(mockSearchActivePlayers).not.toHaveBeenCalled();
    expect(result.podiumEntries.map((entry) => entry.discordId)).toEqual(['user1', 'user2', 'user3']);
  });

  it('returns an empty result when no players match search', async () => {
    mockSearchActivePlayers.mockResolvedValue([]);

    const result = await computeLeaderboard({ page: 1, pageSize: 10, search: 'missing' });

    expect(result.totalEntries).toBe(0);
    expect(result.entries).toEqual([]);
    expect(result.podiumEntries).toEqual([]);
    expect(mockComputePlayerScoreTotals).not.toHaveBeenCalled();
  });

  it('uses separate cache entries for different search terms', async () => {
    mockSearchActivePlayers
      .mockResolvedValueOnce([players[0]] as any)
      .mockResolvedValueOnce([players[1]] as any);

    const first = await computeLeaderboard({ page: 1, pageSize: 10, search: 'one' });
    const second = await computeLeaderboard({ page: 1, pageSize: 10, search: 'two' });

    expect(first.entries.map((entry) => entry.discordId)).toEqual(['user1']);
    expect(second.entries.map((entry) => entry.discordId)).toEqual(['user2']);
    expect(mockSearchActivePlayers).toHaveBeenCalledTimes(2);
  });
});
