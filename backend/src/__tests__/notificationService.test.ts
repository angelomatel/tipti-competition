import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/models/MatchRecord', () => ({
  MatchRecord: {
    find: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/db/models/LpSnapshot', () => ({
  LpSnapshot: {
    find: vi.fn(),
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

vi.mock('@/db/models/DailyPlayerScore', () => ({
  DailyPlayerScore: {
    find: vi.fn(),
  },
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/services/playerService', () => ({
  listActivePlayers: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { MatchRecord } from '@/db/models/MatchRecord';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { getFeedNotifications, ackFeedNotifications, getDailySummary } from '@/services/notificationService';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers } from '@/services/playerService';
import { logger } from '@/lib/logger';
import { NOTIFICATION_FEED_LIMIT } from '@/constants';

const mockMatchFind = vi.mocked(MatchRecord.find);
const mockUpdateMany = vi.mocked(MatchRecord.updateMany);
const mockSnapshotFind = vi.mocked(LpSnapshot.find);
const mockPlayerFind = vi.mocked(Player.find);
const mockPointTransactionFind = vi.mocked(PointTransaction.find);
const mockDailyPlayerScoreFind = vi.mocked(DailyPlayerScore.find);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);
const mockListActivePlayers = vi.mocked(listActivePlayers);
const mockWarn = vi.mocked(logger.warn);

function mockFindLean<T>(value: T) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('notification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTournamentSettings.mockResolvedValue({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
    } as any);
  });

  it('limits feed matches and batches players, transactions, and snapshots', async () => {
    const matches = [
      {
        puuid: 'puuid-1',
        matchId: 'match-1',
        placement: 1,
        playedAt: new Date('2026-01-10T10:00:00Z'),
        lpAttributionStatus: null,
      },
      {
        puuid: 'puuid-2',
        matchId: 'match-2',
        placement: 8,
        playedAt: new Date('2026-01-10T11:00:00Z'),
        lpAttributionStatus: null,
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
    mockPointTransactionFind
      .mockReturnValueOnce(mockFindLean([
        { matchId: 'match-1', source: 'varus_flat', value: 7 },
      ]) as any)
      .mockReturnValueOnce(mockFindLean([
        { matchId: 'match-1', source: 'lp_delta', value: 44 },
      ]) as any);
    mockSnapshotFind.mockReturnValue({
      sort: vi.fn().mockReturnValue(mockFindLean([
        { puuid: 'puuid-1', capturedAt: new Date('2026-01-10T09:00:00Z'), tier: 'GOLD', rank: 'III', leaguePoints: 80 },
        { puuid: 'puuid-1', capturedAt: new Date('2026-01-10T10:30:00Z'), tier: 'GOLD', rank: 'II', leaguePoints: 90 },
      ])),
    } as any);

    const result = await getFeedNotifications();

    expect(limitMatches).toHaveBeenCalledWith(NOTIFICATION_FEED_LIMIT);
    expect(mockPlayerFind).toHaveBeenCalledTimes(1);
    expect(mockPointTransactionFind).toHaveBeenCalledTimes(2);
    expect(mockSnapshotFind).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchId: 'match-1',
      discordId: 'user-1',
      lpDelta: 44,
      lpStatus: 'known',
      godBuffs: [{ source: 'varus_flat', value: 7 }],
    });
  });

  it('does not infer feed LP from current rank state when only a later snapshot exists', async () => {
    const matches = [
      {
        puuid: 'puuid-1',
        matchId: 'match-1',
        placement: 8,
        playedAt: new Date('2026-01-10T10:00:00Z'),
        lpAttributionStatus: 'ambiguous',
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
        currentRank: 'I',
        currentLP: 99,
        discordUsername: 'one',
        discordAvatarUrl: '',
        godSlug: 'zeus',
      },
    ]) as any);
    mockPointTransactionFind
      .mockReturnValueOnce(mockFindLean([]) as any)
      .mockReturnValueOnce(mockFindLean([]) as any);
    mockSnapshotFind.mockReturnValue({
      sort: vi.fn().mockReturnValue(mockFindLean([
        { puuid: 'puuid-1', capturedAt: new Date('2026-01-10T10:30:00Z'), tier: 'GOLD', rank: 'II', leaguePoints: 30 },
      ])),
    } as any);

    const result = await getFeedNotifications();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchId: 'match-1',
      discordId: 'user-1',
      lpDelta: null,
      lpStatus: 'unknown',
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

  it('prefers precomputed daily scores for daily summary', async () => {
    mockDailyPlayerScoreFind.mockReturnValue(mockFindLean([
      { playerId: 'user-1', day: '2026-01-10', rawLpGain: 42 },
      { playerId: 'user-2', day: '2026-01-10', rawLpGain: -15 },
    ]) as any);
    mockPlayerFind.mockReturnValue(mockFindLean([
      { discordId: 'user-1', gameName: 'One' },
      { discordId: 'user-2', gameName: 'Two' },
    ]) as any);

    const summary = await getDailySummary('2026-01-10');

    expect(summary).toEqual({
      date: '2026-01-10',
      climber: { discordId: 'user-1', gameName: 'One', lpGain: 42 },
      slider: { discordId: 'user-2', gameName: 'Two', lpGain: -15 },
    });
    expect(mockListActivePlayers).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('falls back to snapshot recompute when daily scores are unavailable', async () => {
    mockDailyPlayerScoreFind.mockReturnValue(mockFindLean([]) as any);
    mockListActivePlayers.mockResolvedValue([
      { discordId: 'user-1', gameName: 'One', puuid: 'puuid-1' },
      { discordId: 'user-2', gameName: 'Two', puuid: 'puuid-2' },
    ] as any);
    mockSnapshotFind.mockReturnValue({
      sort: vi.fn().mockReturnValue(mockFindLean([
        { _id: 'a', puuid: 'puuid-1', tier: 'GOLD', rank: 'III', leaguePoints: 50, capturedAt: new Date('2026-01-10T01:00:00Z') },
        { _id: 'b', puuid: 'puuid-1', tier: 'GOLD', rank: 'II', leaguePoints: 25, capturedAt: new Date('2026-01-10T23:00:00Z') },
        { _id: 'c', puuid: 'puuid-2', tier: 'GOLD', rank: 'II', leaguePoints: 20, capturedAt: new Date('2026-01-10T01:00:00Z') },
        { _id: 'd', puuid: 'puuid-2', tier: 'GOLD', rank: 'III', leaguePoints: 10, capturedAt: new Date('2026-01-10T23:00:00Z') },
      ])),
    } as any);

    const summary = await getDailySummary('2026-01-10');

    expect(mockWarn).toHaveBeenCalledWith(
      { date: '2026-01-10' },
      '[daily-summary] Falling back to snapshot recompute because daily scores were unavailable.',
    );
    expect(summary).toEqual({
      date: '2026-01-10',
      climber: { discordId: 'user-1', gameName: 'One', lpGain: 75 },
      slider: { discordId: 'user-2', gameName: 'Two', lpGain: -110 },
    });
  });
});
