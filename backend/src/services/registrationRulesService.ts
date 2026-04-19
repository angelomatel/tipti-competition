import { God } from '@/db/models/God';
import { Player } from '@/db/models/Player';
import { getCurrentPhtDay } from '@/lib/dateUtils';
import { getTournamentSettings } from '@/services/tournamentService';
import type { GodStanding } from '@/types/God';
import type { TournamentSettingsDocument } from '@/db/models/TournamentSettings';

export const REGISTRATION_GOD_IMBALANCE_THRESHOLD = 2;
export const REGISTRATION_CLOSED_MESSAGE = 'Registration is closed. Phase 2 has already started.';
export const GOD_NOT_ACCEPTING_SUBJECTS_SUFFIX = 'is not accepting subjects at this moment.';

export interface TournamentRegistrationStatus {
  hasStarted: boolean;
  isRegistrationOpen: boolean;
  registrationClosedReason: string | null;
}

function getPhase2StartDay(settings: Pick<TournamentSettingsDocument, 'phases'>): string | undefined {
  return settings.phases.find((phase) => phase.phase === 2)?.startDay;
}

export function getTournamentRegistrationStatus(
  settings: Pick<TournamentSettingsDocument, 'startDate' | 'phases'>,
): TournamentRegistrationStatus {
  const phase2StartDay = getPhase2StartDay(settings);
  const isRegistrationOpen = !(phase2StartDay && getCurrentPhtDay() >= phase2StartDay);

  return {
    hasStarted: new Date() >= new Date(settings.startDate),
    isRegistrationOpen,
    registrationClosedReason: isRegistrationOpen ? null : REGISTRATION_CLOSED_MESSAGE,
  };
}

export function getGodRegistrationMessage(godName: string): string {
  return `${godName} ${GOD_NOT_ACCEPTING_SUBJECTS_SUFFIX}`;
}

export function applyGodRegistrationAvailability<T extends Pick<GodStanding, 'slug' | 'name' | 'playerCount' | 'isEliminated'>>(
  gods: T[],
): Array<T & Pick<GodStanding, 'isAcceptingSubjects' | 'registrationMessage'>> {
  const activeGods = gods.filter((god) => !god.isEliminated);
  if (activeGods.length <= 1) {
    return gods.map((god) => ({
      ...god,
      isAcceptingSubjects: !god.isEliminated,
      registrationMessage: null,
    }));
  }

  const minPlayerCount = Math.min(...activeGods.map((god) => god.playerCount));

  return gods.map((god) => {
    if (god.isEliminated) {
      return {
        ...god,
        isAcceptingSubjects: false,
        registrationMessage: null,
      };
    }

    const isAcceptingSubjects = god.playerCount - minPlayerCount < REGISTRATION_GOD_IMBALANCE_THRESHOLD;
    return {
      ...god,
      isAcceptingSubjects,
      registrationMessage: isAcceptingSubjects ? null : getGodRegistrationMessage(god.name),
    };
  });
}

export async function assertRegistrationAllowed(godSlug: string): Promise<void> {
  const settings = await getTournamentSettings();
  const registrationStatus = getTournamentRegistrationStatus(settings);
  if (!registrationStatus.isRegistrationOpen) {
    throw new Error(registrationStatus.registrationClosedReason ?? REGISTRATION_CLOSED_MESSAGE);
  }

  const activeGods = await God.find({ isEliminated: false });
  const selectedGod = activeGods.find((god) => god.slug === godSlug);
  if (!selectedGod) {
    throw new Error(`God "${godSlug}" is no longer available for registration.`);
  }

  if (activeGods.length <= 1) {
    return;
  }

  const countsByGod = new Map(activeGods.map((god) => [god.slug, 0]));
  const activePlayers = await Player.find({
    isActive: true,
    godSlug: { $in: activeGods.map((god) => god.slug) },
  });

  for (const player of activePlayers) {
    if (!player.godSlug || !countsByGod.has(player.godSlug)) continue;
    countsByGod.set(player.godSlug, (countsByGod.get(player.godSlug) ?? 0) + 1);
  }

  const godAvailability = applyGodRegistrationAvailability(activeGods.map((god) => ({
    slug: god.slug,
    name: god.name,
    playerCount: countsByGod.get(god.slug) ?? 0,
    isEliminated: god.isEliminated,
  })));
  const selectedGodAvailability = godAvailability.find((god) => god.slug === godSlug);
  if (!selectedGodAvailability?.isAcceptingSubjects) {
    throw new Error(selectedGodAvailability?.registrationMessage ?? getGodRegistrationMessage(selectedGod.name));
  }
}
