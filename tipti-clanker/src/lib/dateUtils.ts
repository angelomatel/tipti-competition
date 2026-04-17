import { PHT_TIMEZONE, PHT_UTC_OFFSET_MS } from '@/lib/constants';

/** Converts a UTC timestamp to the matching PHT calendar day string. */
export function dateToPhtDayStr(date: Date): string {
  return new Date(date.getTime() + PHT_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Returns the current PHT calendar day string. */
export function getCurrentPhtDay(): string {
  return dateToPhtDayStr(new Date());
}

/** Returns the prior PHT calendar day string. */
export function getYesterdayPhtDay(): string {
  const today = getCurrentPhtDay();
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getPhtTimeZone(): string {
  return PHT_TIMEZONE;
}
