import { UTC8_OFFSET_MS } from '@/constants';

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
