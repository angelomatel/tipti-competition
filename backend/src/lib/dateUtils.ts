import { UTC8_OFFSET_MS } from '@/constants';
import type { IPhase } from '@/db/models/TournamentSettings';

/** Converts a UTC Date to a YYYY-MM-DD string in UTC+8. */
export function dateToUTC8Str(date: Date): string {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds N days to a YYYY-MM-DD string and returns the resulting YYYY-MM-DD string. */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Computes the 3 tournament phases dynamically from startDate and endDate. */
export function computePhases(startDate: Date, endDate: Date): IPhase[] {
  const day1 = dateToUTC8Str(startDate);
  const endDay = dateToUTC8Str(endDate);

  return [
    { phase: 1, startDay: day1, endDay: addDaysToDateStr(day1, 4), eliminationCount: 3 },
    { phase: 2, startDay: addDaysToDateStr(day1, 5), endDay: addDaysToDateStr(day1, 9), eliminationCount: 3 },
    { phase: 3, startDay: addDaysToDateStr(day1, 10), endDay: endDay, eliminationCount: 0 },
  ];
}

/** Returns the start/end of a calendar day in UTC+8 as UTC Date objects. */
export function getDayBoundsUTC8(dateStr: string): { dayStart: Date; dayEnd: Date } {
  // dateStr is YYYY-MM-DD in UTC+8; convert to UTC bounds
  const dayStart = new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() - UTC8_OFFSET_MS);
  const dayEnd = new Date(new Date(dateStr + 'T23:59:59.999Z').getTime() - UTC8_OFFSET_MS);
  return { dayStart, dayEnd };
}

/** Returns today's date string in UTC+8 as YYYY-MM-DD. */
export function getTodayUTC8(): string {
  const utc8 = new Date(Date.now() + UTC8_OFFSET_MS);
  return utc8.toISOString().slice(0, 10);
}
