import { TournamentSettings } from '@/db/models/TournamentSettings';
import type { TournamentSettingsDocument } from '@/db/models/TournamentSettings';
import { TOURNAMENT_START_DATE, TOURNAMENT_END_DATE } from '@/constants';

/**
 * Returns the active tournament settings document.
 * If none exists, seeds one from environment variables.
 */
export async function getTournamentSettings(): Promise<TournamentSettingsDocument> {
  const existing = await TournamentSettings.findOne({ isActive: true });
  if (existing) return existing;

  // Seed from env vars on first run
  return TournamentSettings.create({
    name: 'Space Gods Tournament',
    startDate: TOURNAMENT_START_DATE,
    endDate:   TOURNAMENT_END_DATE,
    isActive:  true,
  });
}

export async function updateTournamentSettings(
  updates: Partial<Pick<TournamentSettingsDocument, 'name' | 'startDate' | 'endDate' | 'isActive'>>,
): Promise<TournamentSettingsDocument> {
  const settings = await getTournamentSettings();
  Object.assign(settings, updates);
  return settings.save();
}
