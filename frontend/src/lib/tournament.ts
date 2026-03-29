import type { TournamentSettings } from '@/src/types/Tournament';

/** Check if the tournament event has actually started (start date is in the past) */
export function isEventStarted(settings: TournamentSettings | undefined | null): boolean {
  if (!settings?.startDate) return false;
  return new Date(settings.startDate) <= new Date();
}

/** Get the day number of the tournament (1-indexed) */
export function getDayNumber(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

/** Get days remaining until start date */
export function getDaysUntilStart(startDate: string): number {
  const diff = new Date(startDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Get days remaining until end date */
export function getDaysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
