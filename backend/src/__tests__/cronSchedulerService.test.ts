import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFind,
  mockBulkWrite,
  mockUpdateOne,
} = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockBulkWrite: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

vi.mock('@/db/models/PlayerPollState', () => ({
  PlayerPollState: {
    find: mockFind,
    bulkWrite: mockBulkWrite,
    updateOne: mockUpdateOne,
  },
}));

import {
  buildDefaultPollState,
  selectPlayersForCycles,
  syncActivePollStates,
} from '@/services/cronSchedulerService';

function makePlayer(
  index: number,
  registeredAt: string,
): any {
  return {
    discordId: `user-${index}`,
    puuid: `puuid-${index}`,
    registeredAt: new Date(registeredAt),
    gameName: `Player${index}`,
    tagLine: 'SG2',
  };
}

describe('cronSchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkWrite.mockResolvedValue(undefined);
    mockUpdateOne.mockResolvedValue(undefined);
  });

  it('creates default persisted state for players missing a poll-state document', async () => {
    mockFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });

    const players = [makePlayer(1, '2026-01-01T00:00:00.000Z')];
    const states = await syncActivePollStates(players);

    expect(mockBulkWrite).toHaveBeenCalledTimes(1);
    expect(states.get('user-1')).toEqual(buildDefaultPollState(players[0]));
  });

  it('prioritizes hot backlog players ahead of recently active hot players', () => {
    const players = [
      makePlayer(1, '2026-01-01T00:00:00.000Z'),
      makePlayer(2, '2026-01-02T00:00:00.000Z'),
      makePlayer(3, '2026-01-03T00:00:00.000Z'),
    ];
    const nowMs = new Date('2026-02-01T00:05:00.000Z').getTime();
    const states = new Map([
      ['user-1', {
        ...buildDefaultPollState(players[0]),
        mode: 'hot',
        unresolvedMatchCount: 2,
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
      ['user-2', {
        ...buildDefaultPollState(players[1]),
        mode: 'hot',
        lastObservedActivityAt: new Date('2026-02-01T00:04:00.000Z'),
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
      ['user-3', {
        ...buildDefaultPollState(players[2]),
        mode: 'baseline',
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
    ]);

    const selection = selectPlayersForCycles(players, states as any, nowMs);

    expect(selection.hotCandidates.map((player) => player.discordId)).toEqual(['user-1', 'user-2']);
    expect(selection.baselineCandidates.map((player) => player.discordId)).toEqual(['user-3']);
  });

  it('prioritizes never-processed baseline players ahead of older baseline players', () => {
    const players = [
      makePlayer(1, '2026-01-01T00:00:00.000Z'),
      makePlayer(2, '2026-01-02T00:00:00.000Z'),
      makePlayer(3, '2026-01-03T00:00:00.000Z'),
    ];
    const nowMs = new Date('2026-02-01T00:05:00.000Z').getTime();
    const states = new Map([
      ['user-1', {
        ...buildDefaultPollState(players[0]),
        mode: 'baseline',
        lastProcessedAt: new Date('2026-02-01T00:04:00.000Z'),
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
      ['user-2', {
        ...buildDefaultPollState(players[1]),
        mode: 'baseline',
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
      ['user-3', {
        ...buildDefaultPollState(players[2]),
        mode: 'baseline',
        lastProcessedAt: new Date('2026-02-01T00:02:00.000Z'),
        nextEligibleAt: new Date('2026-02-01T00:00:00.000Z'),
      }],
    ]);

    const selection = selectPlayersForCycles(players, states as any, nowMs);

    expect(selection.baselineCandidates.map((player) => player.discordId)).toEqual(['user-2', 'user-3', 'user-1']);
  });
});
