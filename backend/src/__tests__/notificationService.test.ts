import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    find: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/db/models/Player', () => ({
  Player: {
    find: vi.fn(),
  },
}));

vi.mock('@/db/models/PointTransaction', () => ({
  PointTransaction: {
    find: vi.fn(),
  },
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

import { MatchRecord } from '@/db/models/MatchRecord';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { getFeedNotifications, ackFeedNotifications } from '@/services/notificationService';
import { getTournamentSettings } from '@/services/tournamentService';
import { NOTIFICATION_FEED_LIMIT } from '@/constants';

const mockMatchFind = vi.mocked(MatchRecord.find);
const mockUpdateMany = vi.mocked(MatchRecord.updateMany);
const mockSnapshotFindOne = vi.mocked(LpSnapshot.findOne);
const mockPlayerFind = vi.mocked(Player.find);
const mockPointTransactionFind = vi.mocked(PointTransaction.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);

function mockFindLean<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('notification feed optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTournamentSettings.mockResolvedValue({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
    } as any);

    mockSnapshotFindOne.mockReturnValue({
      sort: vi.fn().mockResolvedValue(null),
    } as any);
  });

  it('limits feed matches and batches players and buff transactions', async () => {
    const matches = [
      {
        puuid: 'puuid-1',
        matchId: 'match-1',
        placement: 1,
        playedAt: new Date('2026-01-10T10:00:00Z'),
      },
      {
        puuid: 'puuid-2',
        matchId: 'match-2',
        placement: 8,
        playedAt: new Date('2026-01-10T11:00:00Z'),
      },
    ];
    const leanMatches = vi.fn().mockResolvedValue(matches);
    const limitMatches = vi.fn().mockReturnValue({ lean: leanMatches });
    const sortMatches = vi.fn().mockReturnValue({ limit: limitMatches });
    mockMatchFind.mockReturnValue({ sort: sortMatches } as any);

    mockPlayerFind.mockReturnValue(mockFindLean([
      {
        puuid: 'puuid-1',
        discordId: 'user-1',
        gameName: 'One',
        tagLine: 'TAG',
        currentTier: 'GOLD',
        currentRank: 'II',
        currentLP: 90,
        discordUsername: 'one',
        discordAvatarUrl: '',
        godSlug: 'zeus',
      },
    ]) as any);
    mockPointTransactionFind.mockReturnValue(mockFindLean([
      { matchId: 'match-1', source: 'varus_flat', value: 7 },
    ]) as any);

    const result = await getFeedNotifications();

    expect(limitMatches).toHaveBeenCalledWith(NOTIFICATION_FEED_LIMIT);
    expect(mockPlayerFind).toHaveBeenCalledTimes(1);
    expect(mockPointTransactionFind).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchId: 'match-1',
      discordId: 'user-1',
      godBuffs: [{ source: 'varus_flat', value: 7 }],
    });
  });

  it('keeps ack behavior unchanged', async () => {
    mockUpdateMany.mockResolvedValue({ modifiedCount: 2 } as any);

    await ackFeedNotifications(['match-1', 'match-2']);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      { matchId: { $in: ['match-1', 'match-2'] }, notifiedAt: null },
      { $set: { notifiedAt: expect.any(Date) } },
    );
  });
});
