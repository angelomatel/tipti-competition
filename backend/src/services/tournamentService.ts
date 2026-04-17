import { TournamentSettings, type TournamentSettingsDocument } from '@/db/models/TournamentSettings';
import { TOURNAMENT_START_DATE, TOURNAMENT_END_DATE } from '@/constants';
import { computePhases, getCurrentPhtDay } from '@/lib/dateUtils';

/**
 * Returns the active tournament settings document.
 * If none exists, seeds one from environment variables.
 * Phases, buffsEnabled, and currentPhase are always computed in-memory from dates.
 */
export async function getTournamentSettings(): Promise<TournamentSettingsDocument> {
  const existing = await TournamentSettings.findOne();
  const settings = existing ?? await TournamentSettings.create({
    name: 'Space Gods Tournament',
    startDate: TOURNAMENT_START_DATE,
    endDate:   TOURNAMENT_END_DATE,
  });

  // Always compute phases from dates
  const phases = computePhases(settings.startDate, settings.endDate);
  settings.phases = phases;

  // Derive currentPhase and buffsEnabled from today's date
  const today = getCurrentPhtDay();
  const currentPhaseObj = phases.find((p) => today >= p.startDay && today <= p.endDay);
  if (currentPhaseObj) {
    settings.currentPhase = currentPhaseObj.phase;
  }

  const phase2 = phases.find((p) => p.phase === 2);
  if (phase2 && today >= phase2.startDay) {
    settings.buffsEnabled = true;
  }

  return settings;
}

export async function updateTournamentSettings(
  updates: Partial<Pick<TournamentSettingsDocument, 'name' | 'startDate' | 'endDate' | 'feedChannelId' | 'dailyChannelId' | 'godStandingsChannelId' | 'auditChannelId' | 'bootcampChatChannelId'>>,
): Promise<TournamentSettingsDocument> {
  const settings = await getTournamentSettings();
  Object.assign(settings, updates);
  return settings.save();
}
