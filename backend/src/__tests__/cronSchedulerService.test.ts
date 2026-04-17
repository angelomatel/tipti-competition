import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSchedulerCursor,
  resetCronSchedulerState,
  selectPlayersForCycle,
  setPlayerPollState,
} from '@/services/cronSchedulerService';

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    discordId: `user-${index}`,
    puuid: `puuid-${index}`,
    registeredAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
    gameName: `Player${index}`,
    tagLine: 'NA1',
  })) as any;
}

describe('cronSchedulerService', () => {
  beforeEach(() => {
    resetCronSchedulerState();
  });

  it('prioritizes never-polled players ahead of stale and recently active players', () => {
    const players = makePlayers(12);
    const nowMs = Date.now();

    for (let index = 1; index < players.length; index += 1) {
      setPlayerPollState(players[index].discordId, {
        lastProcessedAt: nowMs - 60 * 60 * 1000,
      });
    }

    setPlayerPollState(players[1].discordId, {
      lastProcessedAt: nowMs - 60 * 60 * 1000,
      lastActivityAt: nowMs - 5 * 60 * 1000,
      lastSuccessfulMatchCaptureAt: nowMs - 5 * 60 * 1000,
      skipMatchPollUntilCycle: 3,
    });

    const selection = selectPlayersForCycle(players, nowMs);

    expect(selection.selectedPlayers[0]?.discordId).toBe(players[0].discordId);
    expect(selection.selectedPlayers[1]?.discordId).toBe(players[2].discordId);
    expect(selection.selectedPlayers[2]?.discordId).toBe(players[3].discordId);
    expect(selection.selectedPlayers[selection.selectedPlayers.length - 1]?.discordId).toBe(players[1].discordId);
  });

  it('prioritizes backlog players ahead of stale and normal round-robin players', () => {
    const players = makePlayers(6);
    const nowMs = Date.now();

    for (let index = 0; index < players.length; index += 1) {
      setPlayerPollState(players[index].discordId, {
        lastProcessedAt: nowMs - 60 * 1000,
      });
    }

    setPlayerPollState(players[4].discordId, {
      lastProcessedAt: nowMs - 60 * 1000,
      hasDeferredMatchBacklog: true,
    });

    const selection = selectPlayersForCycle(players, nowMs);

    expect(selection.selectedPlayers[0]?.discordId).toBe(players[4].discordId);
  });

  it('keeps freshly serviced players in the tail bucket while cooldown is active', () => {
    const players = makePlayers(8);
    const nowMs = Date.now();

    for (const player of players) {
      setPlayerPollState(player.discordId, {
        lastProcessedAt: nowMs - 60 * 1000,
      });
    }

    setPlayerPollState(players[0].discordId, {
      lastProcessedAt: nowMs - 60 * 1000,
      lastSuccessfulMatchCaptureAt: nowMs - 60 * 1000,
      skipMatchPollUntilCycle: 3,
    });
    setPlayerPollState(players[1].discordId, {
      lastProcessedAt: nowMs - 10 * 60 * 1000,
    });

    const selection = selectPlayersForCycle(players, nowMs);

    expect(selection.selectedPlayers[0]?.discordId).toBe(players[1].discordId);
    expect(selection.selectedPlayers[selection.selectedPlayers.length - 1]?.discordId).toBe(players[0].discordId);
  });

  it('does not keep backlog players in the tail bucket even if they have an active cooldown', () => {
    const players = makePlayers(5);
    const nowMs = Date.now();

    for (const player of players) {
      setPlayerPollState(player.discordId, {
        lastProcessedAt: nowMs - 60 * 1000,
      });
    }

    setPlayerPollState(players[3].discordId, {
      lastProcessedAt: nowMs - 60 * 1000,
      skipMatchPollUntilCycle: 4,
      hasDeferredMatchBacklog: true,
    });

    const selection = selectPlayersForCycle(players, nowMs);

    expect(selection.selectedPlayers[0]?.discordId).toBe(players[3].discordId);
  });

  it('advances the round-robin cursor across non-priority players', () => {
    const players = makePlayers(100);
    const nowMs = Date.now();

    for (const player of players) {
      setPlayerPollState(player.discordId, {
        lastProcessedAt: nowMs - 60 * 1000,
      });
    }

    const firstSelection = selectPlayersForCycle(players, nowMs);
    expect(firstSelection.selectedPlayers.map((player: any) => player.discordId)).toEqual(
      players.slice(0, 90).map((player: any) => player.discordId),
    );
    expect(getSchedulerCursor()).toBe(90);

    const secondSelection = selectPlayersForCycle(players, nowMs);
    expect(secondSelection.selectedPlayers.map((player: any) => player.discordId)).toEqual([
      players[90].discordId,
      players[91].discordId,
      players[92].discordId,
      players[93].discordId,
      players[94].discordId,
      players[95].discordId,
      players[96].discordId,
      players[97].discordId,
      players[98].discordId,
      players[99].discordId,
      players[0].discordId,
      players[1].discordId,
      players[2].discordId,
      players[3].discordId,
      players[4].discordId,
      players[5].discordId,
      players[6].discordId,
      players[7].discordId,
      players[8].discordId,
      players[9].discordId,
      players[10].discordId,
      players[11].discordId,
      players[12].discordId,
      players[13].discordId,
      players[14].discordId,
      players[15].discordId,
      players[16].discordId,
      players[17].discordId,
      players[18].discordId,
      players[19].discordId,
      players[20].discordId,
      players[21].discordId,
      players[22].discordId,
      players[23].discordId,
      players[24].discordId,
      players[25].discordId,
      players[26].discordId,
      players[27].discordId,
      players[28].discordId,
      players[29].discordId,
      players[30].discordId,
      players[31].discordId,
      players[32].discordId,
      players[33].discordId,
      players[34].discordId,
      players[35].discordId,
      players[36].discordId,
      players[37].discordId,
      players[38].discordId,
      players[39].discordId,
      players[40].discordId,
      players[41].discordId,
      players[42].discordId,
      players[43].discordId,
      players[44].discordId,
      players[45].discordId,
      players[46].discordId,
      players[47].discordId,
      players[48].discordId,
      players[49].discordId,
      players[50].discordId,
      players[51].discordId,
      players[52].discordId,
      players[53].discordId,
      players[54].discordId,
      players[55].discordId,
      players[56].discordId,
      players[57].discordId,
      players[58].discordId,
      players[59].discordId,
      players[60].discordId,
      players[61].discordId,
      players[62].discordId,
      players[63].discordId,
      players[64].discordId,
      players[65].discordId,
      players[66].discordId,
      players[67].discordId,
      players[68].discordId,
      players[69].discordId,
      players[70].discordId,
      players[71].discordId,
      players[72].discordId,
      players[73].discordId,
      players[74].discordId,
      players[75].discordId,
      players[76].discordId,
      players[77].discordId,
      players[78].discordId,
      players[79].discordId,
    ]);
    expect(getSchedulerCursor()).toBe(80);
  });
});
