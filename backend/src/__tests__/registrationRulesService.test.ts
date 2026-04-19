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

vi.mock('@/services/tournamentService', () => ({
  getTournamentSettings: vi.fn(),
}));

vi.mock('@/lib/dateUtils', () => ({
  getCurrentPhtDay: vi.fn(),
}));

import { God } from '@/db/models/God';
import { Player } from '@/db/models/Player';
import { getCurrentPhtDay } from '@/lib/dateUtils';
import { getTournamentSettings } from '@/services/tournamentService';
import {
  applyGodRegistrationAvailability,
  assertRegistrationAllowed,
  getGodRegistrationMessage,
  getTournamentRegistrationStatus,
  REGISTRATION_CLOSED_MESSAGE,
} from '@/services/registrationRulesService';

const mockGodFind = vi.mocked(God.find);
const mockPlayerFind = vi.mocked(Player.find);
const mockGetCurrentPhtDay = vi.mocked(getCurrentPhtDay);
const mockGetTournamentSettings = vi.mocked(getTournamentSettings);

describe('registrationRulesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTournamentSettings.mockResolvedValue({
      phases: [
        { phase: 1, startDay: '2026-04-15', endDay: '2026-04-19', eliminationCount: 3 },
        { phase: 2, startDay: '2026-04-20', endDay: '2026-04-24', eliminationCount: 3 },
        { phase: 3, startDay: '2026-04-25', endDay: '2026-04-28', eliminationCount: 0 },
      ],
    } as any);
    mockGetCurrentPhtDay.mockReturnValue('2026-04-19');
    mockGodFind.mockResolvedValue([
      { slug: 'ahri', name: 'Ahri', isEliminated: false },
      { slug: 'ekko', name: 'Ekko', isEliminated: false },
      { slug: 'varus', name: 'Varus', isEliminated: false },
    ] as any);
    mockPlayerFind.mockResolvedValue([] as any);
  });

  it('closes public registration once phase 2 has started', async () => {
    mockGetCurrentPhtDay.mockReturnValue('2026-04-20');

    await expect(assertRegistrationAllowed('ahri')).rejects.toThrow(REGISTRATION_CLOSED_MESSAGE);

    expect(mockGodFind).not.toHaveBeenCalled();
    expect(mockPlayerFind).not.toHaveBeenCalled();
  });

  it('rejects gods that are ahead of the least-populated active god by 2 or more players', async () => {
    mockPlayerFind.mockResolvedValue([
      { godSlug: 'varus', isActive: true },
      { godSlug: 'varus', isActive: true },
      { godSlug: 'varus', isActive: true },
      { godSlug: 'ahri', isActive: true },
    ] as any);

    await expect(assertRegistrationAllowed('varus')).rejects.toThrow(
      'Varus is not accepting subjects at this moment.',
    );
  });

  it('allows gods that are only ahead by 1 player', async () => {
    mockPlayerFind.mockResolvedValue([
      { godSlug: 'varus', isActive: true },
      { godSlug: 'varus', isActive: true },
      { godSlug: 'ahri', isActive: true },
      { godSlug: 'ekko', isActive: true },
    ] as any);

    await expect(assertRegistrationAllowed('varus')).resolves.toBeUndefined();
  });

  it('derives tournament registration status from backend settings', () => {
    mockGetCurrentPhtDay.mockReturnValue('2026-04-19');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T01:00:00.000Z'));

    expect(getTournamentRegistrationStatus({
      startDate: new Date('2026-04-18T00:00:00.000Z'),
      phases: [
        { phase: 1, startDay: '2026-04-15', endDay: '2026-04-19', eliminationCount: 3 },
        { phase: 2, startDay: '2026-04-20', endDay: '2026-04-24', eliminationCount: 3 },
      ],
    } as any)).toEqual({
      hasStarted: true,
      isRegistrationOpen: true,
      registrationClosedReason: null,
    });

    vi.useRealTimers();
  });

  it('applies god registration availability from backend player counts', () => {
    expect(applyGodRegistrationAvailability([
      { slug: 'ahri', name: 'Ahri', playerCount: 1, isEliminated: false },
      { slug: 'varus', name: 'Varus', playerCount: 3, isEliminated: false },
      { slug: 'ekko', name: 'Ekko', playerCount: 2, isEliminated: false },
    ])).toEqual([
      {
        slug: 'ahri',
        name: 'Ahri',
        playerCount: 1,
        isEliminated: false,
        isAcceptingSubjects: true,
        registrationMessage: null,
      },
      {
        slug: 'varus',
        name: 'Varus',
        playerCount: 3,
        isEliminated: false,
        isAcceptingSubjects: false,
        registrationMessage: getGodRegistrationMessage('Varus'),
      },
      {
        slug: 'ekko',
        name: 'Ekko',
        playerCount: 2,
        isEliminated: false,
        isAcceptingSubjects: true,
        registrationMessage: null,
      },
    ]);
  });
});
