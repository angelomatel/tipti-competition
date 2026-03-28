import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/db/models/Player', () => ({
  Player: { find: vi.fn() },
}));

vi.mock('@/services/snapshotService', () => ({
  captureSnapshotForPlayer: vi.fn(),
}));

vi.mock('@/services/matchService', () => ({
  captureMatchesForPlayer: vi.fn(),
}));

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { runCronCycle } from '@/jobs/cronJob';
import { Player } from '@/db/models/Player';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { captureMatchesForPlayer } from '@/services/matchService';
import { getTournamentSettings } from '@/services/tournamentService';

const mockGetTournamentSettings = getTournamentSettings as ReturnType<typeof vi.fn>;
const mockPlayerFind = Player.find as ReturnType<typeof vi.fn>;
const mockCaptureSnapshot = captureSnapshotForPlayer as ReturnType<typeof vi.fn>;
const mockCaptureMatches = captureMatchesForPlayer as ReturnType<typeof vi.fn>;

function makeSettings(startOffset: number, endOffset: number) {
  const now = Date.now();
  return {
    startDate: new Date(now + startOffset),
    endDate: new Date(now + endOffset),
  };
}

describe('runCronCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes all active players successfully', async () => {
    // Tournament is active (started 1h ago, ends in 1h)
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));

    const players = [
      { discordId: 'user1', puuid: 'puuid1' },
      { discordId: 'user2', puuid: 'puuid2' },
    ];
    mockPlayerFind.mockResolvedValue(players);
    mockCaptureSnapshot.mockResolvedValue(undefined);
    mockCaptureMatches.mockResolvedValue(undefined);

    await runCronCycle();

    expect(mockCaptureSnapshot).toHaveBeenCalledTimes(2);
    expect(mockCaptureMatches).toHaveBeenCalledTimes(2);
    expect(mockCaptureSnapshot).toHaveBeenCalledWith(players[0]);
    expect(mockCaptureSnapshot).toHaveBeenCalledWith(players[1]);
  });

  it('continues processing when one player fails', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));

    const players = [
      { discordId: 'user1', puuid: 'puuid1' },
      { discordId: 'user2', puuid: 'puuid2' },
    ];
    mockPlayerFind.mockResolvedValue(players);
    mockCaptureSnapshot
      .mockRejectedValueOnce(new Error('Riot API timeout'))
      .mockResolvedValueOnce(undefined);
    mockCaptureMatches.mockResolvedValue(undefined);

    await runCronCycle();

    // Second player should still be processed
    expect(mockCaptureSnapshot).toHaveBeenCalledTimes(2);
    expect(mockCaptureMatches).toHaveBeenCalledTimes(1); // only for second player
  });

  it('handles empty player list gracefully', async () => {
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-3600_000, 3600_000));
    mockPlayerFind.mockResolvedValue([]);

    await runCronCycle();

    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
    expect(mockCaptureMatches).not.toHaveBeenCalled();
  });

  it('skips cycle when tournament has not started yet', async () => {
    // Tournament starts in 1 hour
    mockGetTournamentSettings.mockResolvedValue(makeSettings(3600_000, 7200_000));

    await runCronCycle();

    expect(mockPlayerFind).not.toHaveBeenCalled();
    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
  });

  it('skips cycle when tournament has ended', async () => {
    // Tournament ended 1 hour ago
    mockGetTournamentSettings.mockResolvedValue(makeSettings(-7200_000, -3600_000));

    await runCronCycle();

    expect(mockPlayerFind).not.toHaveBeenCalled();
    expect(mockCaptureSnapshot).not.toHaveBeenCalled();
  });
});
