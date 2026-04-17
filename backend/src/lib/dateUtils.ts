import { PHT_UTC_OFFSET_MS } from '@/constants';
import type { IPhase } from '@/db/models/TournamentSettings';

/** Converts a UTC timestamp to the matching PHT calendar day string. */
export function dateToPhtDayStr(date: Date): string {
  return new Date(date.getTime() + PHT_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds N days to a PHT day string and returns the resulting YYYY-MM-DD string. */
export function addDaysToPhtDayStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Computes the 3 tournament phases dynamically from startDate and endDate. */
export function computePhases(startDate: Date, endDate: Date): IPhase[] {
  const day1 = dateToPhtDayStr(startDate);
  const endDay = dateToPhtDayStr(endDate);

  return [
    { phase: 1, startDay: day1, endDay: addDaysToPhtDayStr(day1, 4), eliminationCount: 3 },
    { phase: 2, startDay: addDaysToPhtDayStr(day1, 5), endDay: addDaysToPhtDayStr(day1, 9), eliminationCount: 3 },
    { phase: 3, startDay: addDaysToPhtDayStr(day1, 10), endDay, eliminationCount: 0 },
  ];
}

/** Returns the UTC bounds for a single PHT calendar day. */
export function getPhtDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() - PHT_UTC_OFFSET_MS);
  const dayEnd = new Date(new Date(dateStr + 'T23:59:59.999Z').getTime() - PHT_UTC_OFFSET_MS);
  return { dayStart, dayEnd };
}

/** Returns the current PHT calendar day string. */
export function getCurrentPhtDay(): string {
  const pht = new Date(Date.now() + PHT_UTC_OFFSET_MS);
  return pht.toISOString().slice(0, 10);
}

// Backward-compatible aliases while call sites are migrated to PHT terminology.
export const dateToUTC8Str = dateToPhtDayStr;
export const addDaysToDateStr = addDaysToPhtDayStr;
export const getDayBoundsUTC8 = getPhtDayBounds;
export const getTodayUTC8 = getCurrentPhtDay;
